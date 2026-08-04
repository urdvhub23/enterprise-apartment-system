import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not sign in. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--paper-0)'
    }}>
      <div className="card" style={{ width: 380, padding: 32 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 4 }}>Ledger</div>
        <p style={{ color: 'var(--ink-500)', fontSize: 14, marginTop: 0, marginBottom: 24 }}>
          Sign in to your apartment account
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && (
            <div style={{ color: 'var(--rust-600)', fontSize: 13, marginBottom: 16 }}>{error}</div>
          )}
          <button className="btn btn--brass" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 20, textAlign: 'center' }}>
          New here? <Link to="/register" style={{ color: 'var(--brass-600)', fontWeight: 600 }}>Create an account</Link>
        </p>
        <p style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 16, textAlign: 'center' }}>
          Demo: admin@apartments.test / tenant@apartments.test — Password123!
        </p>
      </div>
    </div>
  );
}
