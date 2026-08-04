import { useEffect, useState, useCallback } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const OFFLINE_QUEUE_KEY = 'apt_manager_offline_visitor_queue';

function readQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]'); }
  catch { return []; }
}
function writeQueue(queue) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export default function Visitors() {
  const { isStaff, user } = useAuth();
  return isStaff ? <GateLog /> : <ResidentPasses />;
}

// ---------------- Resident: generate time-limited QR passes ----------------
function ResidentPasses() {
  const [visitors, setVisitors] = useState([]);
  const [apartments, setApartments] = useState([]);
  const [form, setForm] = useState({ apartment_id: '', visitor_name: '', visitor_phone: '', purpose: 'guest', valid_from: '', valid_until: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const [v, l] = await Promise.all([client.get('/visitors/mine'), client.get('/property/leases')]);
    setVisitors(v.data.visitors);
    const apts = l.data.leases.map(lease => lease.apartment).filter(Boolean);
    setApartments(apts);
    if (apts[0]) setForm(f => ({ ...f, apartment_id: apts[0].id }));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await client.post('/visitors', form);
      setForm(f => ({ ...f, visitor_name: '', visitor_phone: '', valid_from: '', valid_until: '' }));
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not generate pass');
    }
  }

  const statusTone = { pending: 'warn', checked_in: 'good', checked_out: 'info', expired: 'bad', cancelled: 'bad' };

  return (
    <div>
      <h1 style={{ fontSize: 26 }}>Visitor passes</h1>
      <p style={{ color: 'var(--ink-500)', marginTop: 4, marginBottom: 24 }}>
        Generate a time-limited QR code for guests, delivery, or vendors.
      </p>

      <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <div>
          <label>Unit</label>
          <select value={form.apartment_id} onChange={e => setForm({ ...form, apartment_id: e.target.value })}>
            {apartments.map(a => <option key={a.id} value={a.id}>{a.building_name} · {a.unit_number}</option>)}
          </select>
        </div>
        <div><label>Visitor name</label><input required value={form.visitor_name} onChange={e => setForm({ ...form, visitor_name: e.target.value })} /></div>
        <div><label>Phone (optional)</label><input value={form.visitor_phone} onChange={e => setForm({ ...form, visitor_phone: e.target.value })} /></div>
        <div>
          <label>Purpose</label>
          <select value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}>
            <option value="guest">Guest</option>
            <option value="delivery">Delivery</option>
            <option value="vendor">Vendor</option>
            <option value="cab">Cab</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div><label>Valid from</label><input type="datetime-local" required value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} /></div>
        <div><label>Valid until (max 72h)</label><input type="datetime-local" required value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} /></div>
        {error && <div style={{ color: 'var(--rust-600)', fontSize: 13, gridColumn: '1 / -1' }}>{error}</div>}
        <div style={{ gridColumn: '1 / -1' }}>
          <button className="btn btn--brass" type="submit">Generate QR pass</button>
        </div>
      </form>

      {loading ? <p style={{ color: 'var(--ink-500)' }}>Loading…</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {visitors.map(v => (
            <div key={v.id} className="card" style={{ padding: 16, textAlign: 'center' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(v.qr_token)}`}
                alt={`QR pass for ${v.visitor_name}`}
                style={{ width: '100%', maxWidth: 160, marginBottom: 10 }}
              />
              <div style={{ fontWeight: 600, fontSize: 14 }}>{v.visitor_name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', textTransform: 'capitalize', marginBottom: 6 }}>{v.purpose}</div>
              <span className={`key-tag key-tag--${statusTone[v.status]}`}>{v.status.replace('_', ' ')}</span>
            </div>
          ))}
          {visitors.length === 0 && <p style={{ color: 'var(--ink-500)' }}>No passes generated yet.</p>}
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 20 }}>
        QR images are rendered via a public QR-generation API for this scaffold — swap in a
        client-side library (e.g. the <code>qrcode</code> npm package) before production, so
        pass tokens aren't sent to a third party.
      </p>
    </div>
  );
}

// ---------------- Gate staff: offline-first check-in log ----------------
function GateLog() {
  const [token, setToken] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [today, setToday] = useState([]);
  const [manualForm, setManualForm] = useState({ visitor_name: '', purpose: 'delivery' });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(readQueue().length);

  const refreshToday = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const { data } = await client.get('/visitors/today');
      setToday(data.visitors);
    } catch { /* stay on cached view if this fails */ }
  }, []);

  const syncQueue = useCallback(async () => {
    const queue = readQueue();
    if (queue.length === 0 || !navigator.onLine) return;
    try {
      await client.post('/visitors/sync-batch', { entries: queue });
      writeQueue([]);
      setQueueSize(0);
      await refreshToday();
    } catch {
      // leave queued entries in place, retry on next online event
    }
  }, [refreshToday]);

  useEffect(() => {
    refreshToday();
    function goOnline() { setIsOnline(true); syncQueue(); }
    function goOffline() { setIsOnline(false); }
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [refreshToday, syncQueue]);

  async function lookup(e) {
    e.preventDefault();
    setLookupError('');
    setLookupResult(null);
    try {
      const { data } = await client.get(`/visitors/lookup/${token}`);
      setLookupResult(data.visitor);
    } catch (err) {
      setLookupError(err.response?.data?.error || 'Pass not found');
    }
  }

  async function checkIn() {
    await client.patch(`/visitors/${lookupResult.id}/check-in`, { entry_method: 'qr_scan' });
    setLookupResult(null);
    setToken('');
    await refreshToday();
  }

  // Offline-first manual log: if online, POST immediately; if offline,
  // queue locally and sync automatically once the connection returns.
  async function submitManualLog(e) {
    e.preventDefault();
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry = { clientId, visitor_name: manualForm.visitor_name, purpose: manualForm.purpose, entry_method: 'manual', occurred_at: new Date().toISOString() };

    if (navigator.onLine) {
      try {
        await client.post('/visitors/sync-batch', { entries: [entry] });
        await refreshToday();
      } catch {
        const queue = readQueue(); queue.push(entry); writeQueue(queue); setQueueSize(queue.length);
      }
    } else {
      const queue = readQueue(); queue.push(entry); writeQueue(queue); setQueueSize(queue.length);
    }
    setManualForm({ visitor_name: '', purpose: 'delivery' });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 style={{ fontSize: 26 }}>Gate log</h1>
        <span className={`key-tag key-tag--${isOnline ? 'good' : 'bad'}`}>{isOnline ? 'online' : 'offline — queuing locally'}</span>
      </div>
      <p style={{ color: 'var(--ink-500)', marginBottom: 24 }}>
        {queueSize > 0 ? `${queueSize} entr${queueSize === 1 ? 'y' : 'ies'} waiting to sync.` : 'All entries synced.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Scan / enter QR code</h3>
          <form onSubmit={lookup} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input placeholder="Paste or scan QR token" value={token} onChange={e => setToken(e.target.value)} />
            <button className="btn" type="submit">Look up</button>
          </form>
          {lookupError && <p style={{ color: 'var(--rust-600)', fontSize: 13 }}>{lookupError}</p>}
          {lookupResult && (
            <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 600 }}>{lookupResult.visitor_name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', textTransform: 'capitalize', marginBottom: 10 }}>{lookupResult.purpose}</div>
              <button className="btn btn--brass" onClick={checkIn}>Check in</button>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Manual walk-in log</h3>
          <form onSubmit={submitManualLog}>
            <div style={{ marginBottom: 10 }}>
              <label>Name</label>
              <input required value={manualForm.visitor_name} onChange={e => setManualForm({ ...manualForm, visitor_name: e.target.value })} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>Purpose</label>
              <select value={manualForm.purpose} onChange={e => setManualForm({ ...manualForm, purpose: e.target.value })}>
                <option value="delivery">Delivery</option>
                <option value="vendor">Vendor</option>
                <option value="guest">Guest</option>
                <option value="cab">Cab</option>
                <option value="other">Other</option>
              </select>
            </div>
            <button className="btn" type="submit">Log entry</button>
          </form>
          <p style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 10 }}>
            Works offline — entries queue on this device and sync automatically once you're back online.
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 16, marginBottom: 14 }}>Today's activity</h3>
        {today.length === 0 && <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>No entries yet today.</p>}
        {today.map(v => (
          <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{v.visitor_name}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', textTransform: 'capitalize' }}>{v.purpose} · {v.entry_method?.replace('_', ' ')}</div>
            </div>
            <span className="key-tag key-tag--good">{v.status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
