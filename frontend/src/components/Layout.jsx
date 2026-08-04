import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const tenantLinks = [
  { to: '/', label: 'Overview' },
  { to: '/billing', label: 'Rent & invoices' },
  { to: '/complaints', label: 'Maintenance' },
  { to: '/facilities', label: 'Facilities' },
  { to: '/visitors', label: 'Visitor passes' },
  { to: '/community', label: 'Community' },
  { to: '/notices', label: 'Notices' },
  { to: '/chat', label: 'Support chat' },
];

const staffLinks = [
  { to: '/', label: 'Overview' },
  { to: '/apartments', label: 'Units' },
  { to: '/tenants', label: 'Tenants & leases' },
  { to: '/billing', label: 'Billing' },
  { to: '/complaints', label: 'Maintenance' },
  { to: '/facilities', label: 'Facilities' },
  { to: '/visitors', label: 'Gate log' },
  { to: '/community', label: 'Community' },
  { to: '/notices', label: 'Notices' },
  { to: '/chat', label: 'Support chat' },
  { to: '/analytics', label: 'Analytics' },
];

export default function Layout({ children }) {
  const { user, logout, isStaff } = useAuth();
  const navigate = useNavigate();
  const links = isStaff ? staffLinks : tenantLinks;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 232, background: 'var(--ink-900)', color: '#fff',
        padding: '24px 16px', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ marginBottom: 32, paddingLeft: 8 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1.1 }}>Ledger</div>
          <div style={{ fontSize: 11, color: '#94A0B4', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Apartment Manager
          </div>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              style={({ isActive }) => ({
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                color: isActive ? 'var(--ink-900)' : '#D6DBE3',
                background: isActive ? 'var(--brass-100)' : 'transparent',
                textDecoration: 'none'
              })}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ borderTop: '1px solid #333E4D', paddingTop: 16, marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.full_name}</div>
          <div style={{ fontSize: 12, color: '#94A0B4', textTransform: 'capitalize', marginBottom: 12 }}>
            {user?.role?.replace('_', ' ')}
          </div>
          <button
            className="btn btn--ghost"
            style={{ color: '#D6DBE3', width: '100%', border: '1px solid #333E4D' }}
            onClick={() => { logout(); navigate('/login'); }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1100 }}>
        {children}
      </main>
    </div>
  );
}
