import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

let socket;

export default function Chat() {
  const { user, isStaff } = useAuth();
  const [threadId, setThreadId] = useState(isStaff ? '' : `${user.id}__support`);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    socket = io('/', { path: '/socket.io' });
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;

    async function loadHistory() {
      const { data } = await client.get(`/chat/${threadId}`);
      if (!cancelled) setMessages(data.messages);
    }
    loadHistory();

    socket.emit('chat:join', threadId);
    const handler = (msg) => {
      if (msg.threadId === threadId) setMessages(prev => [...prev, msg]);
    };
    socket.on('chat:message', handler);

    return () => {
      cancelled = true;
      socket.emit('chat:leave', threadId);
      socket.off('chat:message', handler);
    };
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim() || !threadId) return;
    await client.post(`/chat/${threadId}`, { message: text.trim() });
    setText('');
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>Support chat</h1>
      <p style={{ color: 'var(--ink-500)', marginTop: 4, marginBottom: 20 }}>
        {isStaff ? 'Message a tenant directly.' : 'Message the property team.'}
      </p>

      {isStaff && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <label>Tenant support thread ID</label>
          <input
            placeholder="e.g. <tenant-user-id>__support"
            value={threadId}
            onChange={e => setThreadId(e.target.value)}
          />
          <p style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 6 }}>
            Copy a tenant's user ID from Tenants &amp; leases, then append <code>__support</code>.
          </p>
        </div>
      )}

      <div className="card" style={{ padding: 16, height: 420, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
          {messages.map((m, i) => {
            const mine = m.senderId === user.id;
            return (
              <div key={m._id || i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                <div style={{
                  background: mine ? 'var(--ink-900)' : 'var(--paper-100)',
                  color: mine ? '#fff' : 'var(--ink-900)',
                  padding: '8px 12px',
                  borderRadius: 12,
                  fontSize: 14
                }}>
                  {m.message}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-500)', marginTop: 2, textAlign: mine ? 'right' : 'left' }}>
                  {m.senderRole}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            placeholder="Type a message…"
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={!threadId}
          />
          <button className="btn" type="submit" disabled={!threadId}>Send</button>
        </form>
      </div>
    </div>
  );
}
