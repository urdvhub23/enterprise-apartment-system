import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Notices() {
  const { isStaff } = useAuth();
  const [notices, setNotices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', category: 'general', pinned: false });
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await client.get('/notices');
    setNotices(data.notices);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    await client.post('/notices', form);
    setShowForm(false);
    setForm({ title: '', body: '', category: 'general', pinned: false });
    await load();
  }

  async function remove(id) {
    if (!confirm('Delete this notice?')) return;
    await client.delete(`/notices/${id}`);
    await load();
  }

  const categoryTone = { general: 'info', maintenance: 'warn', event: 'good', billing: 'warn', emergency: 'bad' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26 }}>Notices</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 4 }}>Building-wide announcements.</p>
        </div>
        {isStaff && (
          <button className="btn btn--brass" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Cancel' : '+ Post notice'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ marginBottom: 14 }}>
            <label>Title</label>
            <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label>Message</label>
            <textarea required rows={4} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label>Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="general">General</option>
                <option value="maintenance">Maintenance</option>
                <option value="event">Event</option>
                <option value="billing">Billing</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} id="pinned" />
              <label htmlFor="pinned" style={{ marginBottom: 0 }}>Pin to top</label>
            </div>
          </div>
          <button className="btn" type="submit">Post notice</button>
        </form>
      )}

      {loading ? <p style={{ color: 'var(--ink-500)' }}>Loading…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {notices.length === 0 && <p style={{ color: 'var(--ink-500)' }}>No notices posted yet.</p>}
          {notices.map(n => (
            <div key={n._id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {n.pinned && '\u{1F4CC} '}{n.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>
                    {new Date(n.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className={`key-tag key-tag--${categoryTone[n.category]}`}>{n.category}</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--ink-700)', marginTop: 10 }}>{n.body}</p>
              {isStaff && (
                <button className="btn btn--ghost" style={{ fontSize: 12, marginTop: 10 }} onClick={() => remove(n._id)}>Delete</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
