import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['general', 'events', 'buy_sell', 'lost_found', 'recommendations'];

export default function Community() {
  const { isStaff, user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', category: 'general' });
  const [replyDrafts, setReplyDrafts] = useState({});
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await client.get('/community');
    setPosts(data.posts);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function submitPost(e) {
    e.preventDefault();
    await client.post('/community', { ...form, authorName: user.full_name });
    setForm({ title: '', body: '', category: 'general' });
    setShowForm(false);
    await load();
  }

  async function submitReply(postId) {
    const body = replyDrafts[postId];
    if (!body?.trim()) return;
    await client.post(`/community/${postId}/replies`, { body, authorName: user.full_name });
    setReplyDrafts({ ...replyDrafts, [postId]: '' });
    await load();
  }

  async function moderate(postId, status) {
    await client.patch(`/community/${postId}/moderate`, { status });
    await load();
  }

  const statusTone = { visible: 'good', flagged: 'warn', removed: 'bad' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26 }}>Community</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 4 }}>Discussions, events, and recommendations from your neighbors.</p>
        </div>
        <button className="btn btn--brass" onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Cancel' : '+ New post'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitPost} className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
            <div><label>Title</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <label>Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label>Message</label>
            <textarea required rows={3} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
          </div>
          <button className="btn" type="submit">Post</button>
        </form>
      )}

      {loading ? <p style={{ color: 'var(--ink-500)' }}>Loading…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {posts.length === 0 && <p style={{ color: 'var(--ink-500)' }}>No posts yet — start the conversation.</p>}
          {posts.map(post => (
            <div key={post._id} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{post.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                    {post.authorName} · {post.category.replace('_', ' ')} · {new Date(post.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {isStaff && <span className={`key-tag key-tag--${statusTone[post.status]}`}>{post.status}</span>}
              </div>
              <p style={{ fontSize: 14, color: 'var(--ink-700)', marginTop: 10 }}>{post.body}</p>

              {isStaff && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  {post.status !== 'flagged' && <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => moderate(post._id, 'flagged')}>Flag</button>}
                  {post.status !== 'removed' && <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => moderate(post._id, 'removed')}>Remove</button>}
                  {post.status !== 'visible' && <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => moderate(post._id, 'visible')}>Restore</button>}
                </div>
              )}

              {post.replies?.length > 0 && (
                <div style={{ marginTop: 14, paddingLeft: 14, borderLeft: '2px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {post.replies.filter(r => isStaff || r.status !== 'removed').map((r, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.authorName}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-700)' }}>{r.body}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input
                  placeholder="Write a reply…"
                  value={replyDrafts[post._id] || ''}
                  onChange={e => setReplyDrafts({ ...replyDrafts, [post._id]: e.target.value })}
                />
                <button className="btn btn--ghost" style={{ border: '1px solid var(--line)' }} onClick={() => submitReply(post._id)}>Reply</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
