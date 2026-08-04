import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';

export default function Overview() {
  const { isStaff, user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [leases, setLeases] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const requests = [
          client.get('/notices'),
          client.get('/complaints'),
          client.get('/property/leases'),
        ];
        if (isStaff) requests.push(client.get('/billing/summary'));

        const results = await Promise.all(requests);
        setNotices(results[0].data.notices);
        setComplaints(results[1].data.complaints);
        setLeases(results[2].data.leases);
        if (isStaff) setSummary(results[3].data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isStaff]);

  if (loading) return <p style={{ color: 'var(--ink-500)' }}>Loading overview…</p>;

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>
        {isStaff ? 'Property overview' : `Welcome back, ${user.full_name.split(' ')[0]}`}
      </h1>
      <p style={{ color: 'var(--ink-500)', marginTop: 6, marginBottom: 28 }}>
        {isStaff ? 'A snapshot of billing, occupancy, and open tickets.' : 'Here\u2019s what\u2019s happening with your apartment.'}
      </p>

      {isStaff && summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <StatCard label="Total billed" value={`$${Number(summary.totalBilled).toLocaleString()}`} tone="info" />
          <StatCard label="Collected" value={`$${Number(summary.totalCollected).toLocaleString()}`} tone="good" />
          <StatCard label="Outstanding" value={`$${Number(summary.outstanding).toLocaleString()}`} tone="warn" />
          <StatCard label="Overdue invoices" value={summary.overdueCount} tone="bad" />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>{isStaff ? 'Active leases' : 'Your lease'}</h3>
          {leases.length === 0 && <EmptyState text="No leases yet." />}
          {leases.slice(0, 6).map(l => (
            <div key={l.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid var(--line)'
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {l.apartment?.building_name} · Unit {l.apartment?.unit_number}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                  {isStaff ? l.tenant?.full_name : `Rent $${l.monthly_rent}/mo`}
                </div>
              </div>
              <span className={`key-tag key-tag--${l.status === 'active' ? 'good' : l.status === 'terminated' ? 'bad' : 'warn'}`}>
                {l.status}
              </span>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Recent notices</h3>
          {notices.length === 0 && <EmptyState text="No notices posted." />}
          {notices.slice(0, 5).map(n => (
            <div key={n._id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{n.category}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginTop: 20 }}>
        <h3 style={{ fontSize: 16, marginBottom: 14 }}>{isStaff ? 'Open maintenance tickets' : 'Your maintenance requests'}</h3>
        {complaints.length === 0 && <EmptyState text="Nothing open right now." />}
        {complaints.slice(0, 6).map(c => (
          <div key={c._id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0', borderBottom: '1px solid var(--line)'
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)', textTransform: 'capitalize' }}>{c.category} · {c.priority} priority</div>
            </div>
            <span className={`key-tag key-tag--${c.status === 'resolved' || c.status === 'closed' ? 'good' : c.status === 'open' ? 'warn' : 'info'}`}>
              {c.status.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>{text}</p>;
}
