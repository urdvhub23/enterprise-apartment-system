import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Billing() {
  const { isStaff } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [leases, setLeases] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ lease_id: '', billing_period_start: '', billing_period_end: '', due_date: '', rent_amount: '', utilities_amount: '', late_fee: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);

  async function load() {
    const requests = [client.get('/billing/invoices')];
    if (isStaff) requests.push(client.get('/property/leases'));
    const results = await Promise.all(requests);
    setInvoices(results[0].data.invoices);
    if (isStaff) setLeases(results[1].data.leases.filter(l => l.status === 'active'));
    setLoading(false);
  }

  useEffect(() => { load(); }, [isStaff]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await client.post('/billing/invoices', form);
      setShowForm(false);
      setForm({ lease_id: '', billing_period_start: '', billing_period_end: '', due_date: '', rent_amount: '', utilities_amount: '', late_fee: '' });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not issue invoice');
    }
  }

  async function payNow(invoice) {
    setPayingId(invoice.id);
    try {
      await client.post('/billing/payments', {
        invoice_id: invoice.id,
        amount: invoice.total_amount,
        method: 'card'
      });
      await load();
    } catch (err) {
      alert(err.response?.data?.error || 'Payment failed');
    } finally {
      setPayingId(null);
    }
  }

  const statusTone = { paid: 'good', issued: 'info', partially_paid: 'warn', overdue: 'bad', draft: 'warn', void: 'bad' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26 }}>{isStaff ? 'Billing' : 'Rent & invoices'}</h1>
          <p style={{ color: 'var(--ink-500)', marginTop: 4 }}>
            {isStaff ? 'Issue invoices and track the ledger.' : 'Review and pay your rent invoices.'}
          </p>
        </div>
        {isStaff && (
          <button className="btn btn--brass" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Cancel' : '+ Issue invoice'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ padding: 20, marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label>Lease</label>
            <select required value={form.lease_id} onChange={e => {
              const lease = leases.find(l => l.id === e.target.value);
              setForm({ ...form, lease_id: e.target.value, rent_amount: lease?.monthly_rent || '' });
            }}>
              <option value="">Select active lease</option>
              {leases.map(l => (
                <option key={l.id} value={l.id}>{l.tenant?.full_name} — {l.apartment?.building_name} {l.apartment?.unit_number}</option>
              ))}
            </select>
          </div>
          <div><label>Period start</label><input type="date" required value={form.billing_period_start} onChange={e => setForm({ ...form, billing_period_start: e.target.value })} /></div>
          <div><label>Period end</label><input type="date" required value={form.billing_period_end} onChange={e => setForm({ ...form, billing_period_end: e.target.value })} /></div>
          <div><label>Due date</label><input type="date" required value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
          <div><label>Rent ($)</label><input type="number" required value={form.rent_amount} onChange={e => setForm({ ...form, rent_amount: e.target.value })} /></div>
          <div><label>Utilities ($)</label><input type="number" value={form.utilities_amount} onChange={e => setForm({ ...form, utilities_amount: e.target.value })} /></div>
          <div><label>Late fee ($)</label><input type="number" value={form.late_fee} onChange={e => setForm({ ...form, late_fee: e.target.value })} /></div>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button className="btn" type="submit">Issue invoice</button>
          </div>
          {error && <div style={{ color: 'var(--rust-600)', fontSize: 13, gridColumn: '1 / -1' }}>{error}</div>}
        </form>
      )}

      {loading ? <p style={{ color: 'var(--ink-500)' }}>Loading invoices…</p> : (
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: 12, color: 'var(--ink-500)', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Invoice</th>
                {isStaff && <th>Tenant</th>}
                <th>Period</th>
                <th>Total</th>
                <th>Due</th>
                <th>Status</th>
                {!isStaff && <th></th>}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} style={{ borderTop: '1px solid var(--line)', fontSize: 14 }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{inv.invoice_number}</td>
                  {isStaff && <td>{inv.Lease?.tenant?.full_name}</td>}
                  <td style={{ fontSize: 13 }}>{inv.billing_period_start} → {inv.billing_period_end}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>${Number(inv.total_amount).toLocaleString()}</td>
                  <td>{inv.due_date}</td>
                  <td><span className={`key-tag key-tag--${statusTone[inv.status]}`}>{inv.status.replace('_', ' ')}</span></td>
                  {!isStaff && (
                    <td>
                      {inv.status !== 'paid' && (
                        <button className="btn" style={{ fontSize: 12, padding: '5px 12px' }} disabled={payingId === inv.id} onClick={() => payNow(inv)}>
                          {payingId === inv.id ? 'Processing…' : 'Pay now'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 20, color: 'var(--ink-500)' }}>No invoices yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
