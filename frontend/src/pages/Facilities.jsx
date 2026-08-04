import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['clubhouse', 'court', 'pool', 'gym', 'hall', 'other'];

function toLocalInputValue(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function Facilities() {
  const { isStaff } = useAuth();
  const [facilities, setFacilities] = useState([]);
  const [selected, setSelected] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', category: 'clubhouse', capacity: '' });
  const [bookForm, setBookForm] = useState({ start_time: '', end_time: '', notes: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadFacilities() {
    const { data } = await client.get('/facilities');
    setFacilities(data.facilities);
    if (data.facilities[0]) setSelected(data.facilities[0]);
    setLoading(false);
  }

  useEffect(() => { loadFacilities(); }, []);

  useEffect(() => {
    if (!selected) return;
    client.get(`/facilities/${selected.id}/bookings`).then(({ data }) => setBookings(data.bookings));
  }, [selected]);

  async function addFacility(e) {
    e.preventDefault();
    await client.post('/facilities', addForm);
    setShowAddForm(false);
    setAddForm({ name: '', category: 'clubhouse', capacity: '' });
    await loadFacilities();
  }

  async function book(e) {
    e.preventDefault();
    setError('');
    try {
      await client.post(`/facilities/${selected.id}/bookings`, bookForm);
      setBookForm({ start_time: '', end_time: '', notes: '' });
      const { data } = await client.get(`/facilities/${selected.id}/bookings`);
      setBookings(data.bookings);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not book this slot');
    }
  }

  async function cancelBooking(id) {
    await client.patch(`/facilities/bookings/${id}/cancel`);
    const { data } = await client.get(`/facilities/${selected.id}/bookings`);
    setBookings(data.bookings);
  }

  if (loading) return <p style={{ color: 'var(--ink-500)' }}>Loading facilities…</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26 }}>Facilities</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 4 }}>Reserve shared spaces without double-booking.</p>
        </div>
        {isStaff && (
          <button className="btn btn--brass" onClick={() => setShowAddForm(s => !s)}>
            {showAddForm ? 'Cancel' : '+ Add facility'}
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={addFacility} className="card" style={{ padding: 20, marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div><label>Name</label><input required value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} /></div>
          <div>
            <label>Category</label>
            <select value={addForm.category} onChange={e => setAddForm({ ...addForm, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label>Capacity</label><input type="number" value={addForm.capacity} onChange={e => setAddForm({ ...addForm, capacity: e.target.value })} /></div>
          <div style={{ display: 'flex', alignItems: 'end' }}><button className="btn" type="submit">Save</button></div>
        </form>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {facilities.map(f => (
          <button
            key={f.id}
            onClick={() => setSelected(f)}
            className="btn btn--ghost"
            style={{
              border: '1px solid var(--line)',
              background: selected?.id === f.id ? 'var(--ink-900)' : 'transparent',
              color: selected?.id === f.id ? '#fff' : 'var(--ink-900)'
            }}
          >
            {f.name}
          </button>
        ))}
        {facilities.length === 0 && <p style={{ color: 'var(--ink-500)' }}>No facilities added yet.</p>}
      </div>

      {selected && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, marginBottom: 4 }}>Book {selected.name}</h3>
            <p style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 16 }}>
              Open {selected.opens_at?.slice(0, 5)}–{selected.closes_at?.slice(0, 5)} · capacity {selected.capacity || '—'}
            </p>
            <form onSubmit={book}>
              <div style={{ marginBottom: 12 }}>
                <label>Start</label>
                <input type="datetime-local" required value={bookForm.start_time} onChange={e => setBookForm({ ...bookForm, start_time: e.target.value })} min={toLocalInputValue(new Date())} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label>End</label>
                <input type="datetime-local" required value={bookForm.end_time} onChange={e => setBookForm({ ...bookForm, end_time: e.target.value })} min={bookForm.start_time} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label>Notes (optional)</label>
                <input value={bookForm.notes} onChange={e => setBookForm({ ...bookForm, notes: e.target.value })} />
              </div>
              {error && <div style={{ color: 'var(--rust-600)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <button className="btn btn--brass" type="submit" style={{ width: '100%' }}>Reserve slot</button>
            </form>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, marginBottom: 14 }}>Upcoming bookings</h3>
            {bookings.length === 0 && <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>Nothing booked yet.</p>}
            {bookings.map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{b.resident?.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(b.start_time).toLocaleString()} → {new Date(b.end_time).toLocaleTimeString()}
                  </div>
                </div>
                <button className="btn btn--ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => cancelBooking(b.id)}>Cancel</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
