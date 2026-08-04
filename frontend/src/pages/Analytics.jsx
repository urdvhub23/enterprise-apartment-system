import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import client from '../api/client';
import StatCard from '../components/StatCard';

export default function Analytics() {
  const [portfolio, setPortfolio] = useState([]);
  const [sla, setSla] = useState(null);
  const [risk, setRisk] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [p, s, r] = await Promise.all([
        client.get('/analytics/portfolio'),
        client.get('/analytics/sla'),
        client.get('/analytics/maintenance-risk'),
      ]);
      setPortfolio(p.data.portfolio);
      setSla(s.data);
      setRisk(r.data.risk);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p style={{ color: 'var(--ink-500)' }}>Loading analytics…</p>;

  return (
    <div>
      <h1 style={{ fontSize: 26 }}>Analytics</h1>
      <p style={{ color: 'var(--ink-500)', marginTop: 4, marginBottom: 28 }}>
        Collections, SLA compliance, and early maintenance signals across your portfolio.
      </p>

      {sla && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          <StatCard label="SLA compliance" value={sla.complianceRate !== null ? `${sla.complianceRate}%` : '—'} tone={sla.complianceRate >= 90 ? 'good' : 'warn'} />
          <StatCard label="Escalated tickets" value={sla.escalatedCount} tone={sla.escalatedCount > 0 ? 'bad' : 'good'} />
          <StatCard label="Currently overdue" value={sla.currentlyBreachedOpen} tone={sla.currentlyBreachedOpen > 0 ? 'bad' : 'good'} />
        </div>
      )}

      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>Collections by society</h3>
        <p style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 16 }}>Billed vs. collected, per society you manage.</p>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={portfolio}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="societyName" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="totalBilled" fill="#B08D57" name="Billed" radius={[4, 4, 0, 0]} />
              <Bar dataKey="totalCollected" fill="#4F7A5B" name="Collected" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: 12, color: 'var(--ink-500)', textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 14px' }}>Society</th>
                <th>Units</th>
                <th>Billed</th>
                <th>Collected</th>
                <th>Collection rate</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map(row => (
                <tr key={row.societyId} style={{ borderTop: '1px solid var(--line)', fontSize: 14 }}>
                  <td style={{ padding: '10px 14px' }}>{row.societyName}</td>
                  <td>{row.unitCount}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>${Number(row.totalBilled).toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>${Number(row.totalCollected).toLocaleString()}</td>
                  <td>{row.collectionRate !== null ? `${row.collectionRate}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>Maintenance risk signal</h3>
        <p style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 16 }}>
          Complaint frequency trend by category over the last 30 days vs. the prior 30 — a statistical early-warning
          signal, not a machine-learning prediction.
        </p>
        {risk.map(r => (
          <div key={r.category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, textTransform: 'capitalize' }}>{r.category}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{r.recentCount} tickets recently, vs {r.priorCount} before</div>
            </div>
            <span className={`key-tag key-tag--${r.atRisk ? 'bad' : r.trend === 'falling' ? 'good' : 'info'}`}>
              {r.atRisk ? 'at risk' : r.trend}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
