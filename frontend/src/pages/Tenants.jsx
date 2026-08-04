import { useEffect, useState } from 'react';
import client from '../api/client';

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [apartments, setApartments] = useState([]);
  const [leases, setLeases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tenant_id: '', apartment_id: '', start_date: '', end_date: '', monthly_rent: '', security_deposit: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const [t, a, l] = await Promise.all([
      client.get('/property/tenants'),
      client.get('/property/apartments', { params: { status: 'vacant' } }),
      client.get('/property/leases'),
    ]);
    setTenants(t.data.tenants);
    setApartments(a.data.apartments);
    setLeases(l.data.leases);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await client.post('/property/leases', form);
      setShowForm(false);
      setForm({ tenant_id: '', apartment_id: '', start_date: '', end_date: '', monthly_rent: '', security_deposit: '' });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create lease');
    }
  }

  async function terminate(id) {
    if (!confirm('Terminate this lease? The unit will be marked vacant.')) return;
    await client.patch(`/property/leases/${id}/terminate`);
    await load();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26 }}>Tenants &amp; leases</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 4 }}>Assign tenants to units and track lease terms.</p>
        </div>
        <button className="btn btn--brass" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Cancel' : '+ New lease'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div>
            <label>Tenant</label>
            <select required value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })}>
              <option value="">Select tenant</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.email})</option>)}
            </select>
          </div>
          <div>
            <label>Vacant unit</label>
            <select required value={form.apartment_id} onChange={e => {
              const apt = apartments.find(a => a.id === e.target.value);
              setForm({ ...form, apartment_id: e.target.value, monthly_rent: apt?.monthly_rent || '' });
            }}>
              <option value="">Select unit</option>
              {apartments.map(a => <option key={a.id} value={a.id}>{a.building_name} · {a.unit_number}</option>)}
            </select>
          </div>
          <div><label>Monthly rent ($)</label><input type="number" required value={form.monthly_rent} onChange={e => setForm({ ...form, monthly_rent: e.target.value })} /></div>
          <div><label>Start date</label><input type="date" required value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
          <div><label>End date</label><input type="date" required value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
          <div><label>Security deposit ($)</label><input type="number" value={form.security_deposit} onChange={e => setForm({ ...form, security_deposit: e.target.value })} /></div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button className="btn" type="submit">Create lease</button>
          </div>
          {error && <div style={{ color: 'var(--rust-600)', fontSize: 13, gridColumn: '1 / -1' }}>{error}</div>}
        </form>
      )}

      {loading ? <p style={{ color: 'var(--ink-500)' }}>Loading…</p> : (
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: 12, color: 'var(--ink-500)', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Tenant</th>
                <th>Unit</th>
                <th>Term</th>
                <th>Rent</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leases.map(l => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--line)', fontSize: 14 }}>
                  <td style={{ padding: '12px 16px' }}>{l.tenant?.full_name}</td>
                  <td>{l.apartment?.building_name} · {l.apartment?.unit_number}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{l.start_date} → {l.end_date}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>${Number(l.monthly_rent).toLocaleString()}</td>
                  <td><span className={`key-tag key-tag--${l.status === 'active' ? 'good' : l.status === 'terminated' ? 'bad' : 'warn'}`}>{l.status}</span></td>
                  <td>
                    {l.status === 'active' && (
                      <button className="btn btn--ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => terminate(l.id)}>Terminate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
