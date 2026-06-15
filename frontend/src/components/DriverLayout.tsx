import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HomeIcon,
  CalendarIcon,
  CarIconFilled,
  HistoryIcon,
  HelpIcon,
  LogoutIcon,
  BellIcon,
  SettingsIcon,
  SearchIcon,
  SupportIcon,
} from './ui/Icons';
import styles from '../styles/driver.module.css';

interface DriverLayoutProps {
  children: ReactNode;
  title?: string;
}

const driverNavItems = [
  { label: 'Dashboard', path: '/', icon: HomeIcon },
  { label: 'Book Slot', path: '/booking', icon: CalendarIcon },
  { label: 'Monthly Package', path: '/monthly-package', icon: CarIconFilled },
  { label: 'My Vehicle', path: '/my-vehicle', icon: CarIconFilled },
  { label: 'History', path: '/history', icon: HistoryIcon },
];

function getInitials(name: string) {
  // First letter of the FIRST and LAST word of fullName, uppercased.
  // Examples: "Nguyễn Văn A" -> "NA", "Trần Thị B" -> "TB", "Admin" -> "A".
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return (parts[0]![0] ?? '').toUpperCase();
  const first = parts[0]![0] ?? '';
  const last  = parts[parts.length - 1]![0] ?? '';
  return (first + last).toUpperCase();
}

// Human-readable role label for the small secondary line under the name.
function getRoleLabel(role: string | undefined): string {
  switch (role) {
    case 'ADMIN':   return 'Quản trị viên';
    case 'MANAGER': return 'Quản lý';
    case 'STAFF':   return 'Nhân viên';
    case 'DRIVER':  return 'Người lái xe';
    default:        return 'Người dùng';
  }
}

export function DriverLayout({ children, title = 'Dashboard' }: DriverLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  // Greeting + initials MUST derive from fullName, never from the role label.
  // Fall back to email only if fullName is missing/empty.
  const displayName = (user?.fullName?.trim() || user?.email) || 'Driver';

  return (
    <div className={styles.layout}>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className={styles.backdrop} onClick={closeSidebar} aria-hidden="true" />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarLogo}>
          <div className={styles.sidebarLogoIcon}>P</div>
          <div className={styles.sidebarLogoText}>
            <span className={styles.sidebarLogoName}>ParkSmart</span>
            <span className={styles.sidebarLogoSub}>Driver Management</span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          <p className={styles.navSectionLabel}>Menu</p>
          <div className={styles.navSection}>
            {driverNavItems.map((item) => {
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                  onClick={closeSidebar}
                >
                  <span className={styles.navItemIcon}>
                    <Icon size={16} />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.sidebarBottomItem}>
            <span className={styles.navItemIcon}>
              <HelpIcon size={16} />
            </span>
            Help
          </button>
          <button className={styles.sidebarBottomItem} onClick={handleLogout}>
            <span className={styles.navItemIcon}>
              <LogoutIcon size={16} />
            </span>
            Logout
          </button>
          <button className={styles.supportBtn}>
            <span className={styles.navItemIcon}>
              <SupportIcon size={16} />
            </span>
            Support Center
          </button>
        </div>
      </aside>

      {/* Top Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button
            className={styles.hamburgerBtn}
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle sidebar"
          >
            <span className={styles.hamburgerLine} />
            <span className={styles.hamburgerLine} />
            <span className={styles.hamburgerLine} />
          </button>
          <h1 className={styles.pageTitle}>{title}</h1>
        </div>
        <div className={styles.topBarRight}>
          <div className={styles.searchBox}>
            <SearchIcon size={14} />
            <input type="text" placeholder="Search..." />
          </div>
          <button className={styles.topBarIconBtn}>
            <BellIcon size={16} />
            <span className={styles.notifDot} />
          </button>
          <button className={styles.topBarIconBtn}>
            <SettingsIcon size={16} />
          </button>
          <div className={styles.userAvatar}>
            <div className={styles.avatarCircle}>{getInitials(displayName)}</div>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{displayName}</span>
              <span className={styles.roleBadge}>{getRoleLabel(user?.role)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>{children}</main>
    </div>
  );
}
