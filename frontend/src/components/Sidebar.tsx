import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems: { label: string; path: string; roles: string[] }[] = [
  { label: 'Dashboard', path: '/', roles: ['ADMIN', 'MANAGER', 'STAFF', 'DRIVER'] },
  { label: 'Check In', path: '/checkin', roles: ['ADMIN', 'MANAGER', 'STAFF'] },
  { label: 'Check Out', path: '/checkout', roles: ['ADMIN', 'MANAGER', 'STAFF'] },
  { label: 'Booking', path: '/booking', roles: ['ADMIN', 'MANAGER', 'STAFF', 'DRIVER'] },
  { label: 'Monthly Package', path: '/monthly-package', roles: ['ADMIN', 'MANAGER', 'STAFF', 'DRIVER'] },
  { label: 'Slot Map', path: '/slot-map', roles: ['ADMIN', 'MANAGER', 'STAFF'] },
  { label: 'Reports', path: '/reports', roles: ['ADMIN', 'MANAGER'] },
];

export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();

  const visible = navItems.filter((item) => user && item.roles.includes(user.role));

  return (
    <aside style={{ width: '220px', background: '#16213e', color: '#fff', minHeight: '100vh', padding: '1rem 0' }}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {visible.map((item) => (
          <li key={item.path}>
            <Link
              to={item.path}
              style={{
                display: 'block',
                padding: '0.75rem 1.5rem',
                color: location.pathname === item.path ? '#0f3460' : '#e0e0e0',
                background: location.pathname === item.path ? '#e94560' : 'transparent',
                textDecoration: 'none',
                fontSize: '0.95rem',
              }}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
