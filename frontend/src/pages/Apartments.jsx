import { useEffect, useState } from 'react';
import client from '../api/client';

const emptyForm = { building_name: '', unit_number: '', floor: '', bedrooms: 1, bathrooms: 1, area_sqft: '', monthly_rent: '' };

export default function Apartments() {
  const [apartments, setApartments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    const { data } = await client.get('/property/apartments');
    setApartments(data.apartments);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await client.post('/property/apartments', form);
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add unit');
    }
  }

  const statusTone = { vacant: 'warn', occupied: 'good', under_maintenance: 'bad' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26 }}>Units</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 4 }}>Every apartment across your buildings.</p>
        </div>
        <button className="btn btn--brass" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Cancel' : '+ Add unit'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div><label>Building name</label><input required value={form.building_name} onChange={e => setForm({ ...form, building_name: e.target.value })} /></div>
          <div><label>Unit number</label><input required value={form.unit_number} onChange={e => setForm({ ...form, unit_number: e.target.value })} /></div>
          <div><label>Floor</label><input type="number" value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })} /></div>
          <div><label>Bedrooms</label><input type="number" min="0" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })} /></div>
          <div><label>Bathrooms</label><input type="number" min="0" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: e.target.value })} /></div>
          <div><label>Area (sqft)</label><input type="number" value={form.area_sqft} onChange={e => setForm({ ...form, area_sqft: e.target.value })} /></div>
          <div><label>Monthly rent ($)</label><input type="number" required min="0" value={form.monthly_rent} onChange={e => setForm({ ...form, monthly_rent: e.target.value })} /></div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button className="btn" type="submit">Save unit</button>
          </div>
          {error && <div style={{ color: 'var(--rust-600)', fontSize: 13, gridColumn: '1 / -1' }}>{error}</div>}
        </form>
      )}

      {loading ? <p style={{ color: 'var(--ink-500)' }}>Loading units…</p> : (
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: 12, color: 'var(--ink-500)', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Building</th>
                <th>Unit</th>
                <th>Beds/Baths</th>
                <th>Rent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {apartments.map(a => (
                <tr key={a.id} style={{ borderTop: '1px solid var(--line)', fontSize: 14 }}>
                  <td style={{ padding: '12px 16px' }}>{a.building_name}</td>
                  <td>{a.unit_number}</td>
                  <td>{a.bedrooms}bd / {a.bathrooms}ba</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>${Number(a.monthly_rent).toLocaleString()}</td>
                  <td><span className={`key-tag key-tag--${statusTone[a.status]}`}>{a.status.replace('_', ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
