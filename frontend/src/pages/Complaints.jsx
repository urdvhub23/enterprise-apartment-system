import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['plumbing', 'electrical', 'security', 'cleaning', 'appliance', 'noise', 'other'];

export default function Complaints() {
  const { isStaff } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ apartmentId: '', category: 'plumbing', title: '', description: '', priority: 'medium' });
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    const requests = [client.get('/complaints')];
    if (!isStaff) requests.push(client.get('/property/leases'));
    const results = await Promise.all(requests);
    setComplaints(results[0].data.complaints);
    if (!isStaff) {
      const leases = results[1].data.leases;
      setApartments(leases.map(l => l.apartment).filter(Boolean));
      if (leases[0]) setForm(f => ({ ...f, apartmentId: leases[0].apartment_id }));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [isStaff]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await client.post('/complaints', form);
      setShowForm(false);
      setForm(f => ({ ...f, title: '', description: '' }));
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit ticket');
    }
  }

  async function updateStatus(id, status) {
    await client.patch(`/complaints/${id}/status`, { status });
    await load();
  }

  const statusTone = { open: 'warn', in_progress: 'info', resolved: 'good', closed: 'good' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26 }}>Maintenance</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 4 }}>
            {isStaff ? 'Track and resolve tenant tickets.' : 'Report an issue with your unit.'}
          </p>
        </div>
        {!isStaff && (
          <button className="btn btn--brass" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Cancel' : '+ New request'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <div>
            <label>Unit</label>
            <select value={form.apartmentId} onChange={e => setForm({ ...form, apartmentId: e.target.value })}>
              {apartments.map(a => <option key={a.id} value={a.id}>{a.building_name} · {a.unit_number}</option>)}
            </select>
          </div>
          <div>
            <label>Category</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label>Title</label>
            <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label>Description</label>
            <textarea required rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label>Priority</label>
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button className="btn" type="submit">Submit ticket</button>
          </div>
          {error && <div style={{ color: 'var(--rust-600)', fontSize: 13, gridColumn: '1 / -1' }}>{error}</div>}
        </form>
      )}

      {loading ? <p style={{ color: 'var(--ink-500)' }}>Loading…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {complaints.length === 0 && <p style={{ color: 'var(--ink-500)' }}>Nothing to show.</p>}
          {complaints.map(c => (
            <div key={c._id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)', textTransform: 'capitalize', marginTop: 2 }}>
                    {c.category} · {c.priority} priority · {new Date(c.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className={`key-tag key-tag--${statusTone[c.status]}`}>{c.status.replace('_', ' ')}</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--ink-700)', marginTop: 10 }}>{c.description}</p>
              {isStaff && c.status !== 'closed' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {c.status === 'open' && <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => updateStatus(c._id, 'in_progress')}>Start work</button>}
                  {c.status !== 'resolved' && <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => updateStatus(c._id, 'resolved')}>Mark resolved</button>}
                  <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => updateStatus(c._id, 'closed')}>Close</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
