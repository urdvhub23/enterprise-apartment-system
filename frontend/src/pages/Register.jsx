import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ ...form, role: 'tenant' });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--paper-0)'
    }}>
      <div className="card" style={{ width: 400, padding: 32 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 4 }}>Create account</div>
        <p style={{ color: 'var(--ink-500)', fontSize: 14, marginTop: 0, marginBottom: 24 }}>
          Tenant sign-up
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label>Full name</label>
            <input value={form.full_name} onChange={e => update('full_name', e.target.value)} required />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => update('email', e.target.value)} required />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label>Phone</label>
            <input value={form.phone} onChange={e => update('phone', e.target.value)} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label>Password (min 8 characters)</label>
            <input type="password" value={form.password} onChange={e => update('password', e.target.value)} required minLength={8} />
          </div>
          {error && <div style={{ color: 'var(--rust-600)', fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <button className="btn btn--brass" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 20, textAlign: 'center' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--brass-600)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
