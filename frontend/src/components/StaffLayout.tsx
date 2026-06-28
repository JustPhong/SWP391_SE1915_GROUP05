import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  HomeIcon,
  SearchIcon,
  CheckCircleIcon,
  LogoutIcon,
  LayoutIcon,
  BellIcon,
  HelpIcon,
  CalendarIcon,
} from './ui/Icons';
import styles from '../styles/staff.module.css';

interface StaffLayoutProps {
  children: ReactNode;
  title?: string;
  showGreeting?: boolean;
}

const staffNavItems = [
  { label: 'Tổng quan', path: '/staff/dashboard', icon: HomeIcon },
  { label: 'Tra cứu xe', path: '/staff/search', icon: SearchIcon },
  { label: 'Check-in', path: '/staff/checkin', icon: CheckCircleIcon },
  { label: 'Check-out', path: '/staff/checkout', icon: LogoutIcon },
  { label: 'Sơ đồ tầng', path: '/staff/floor-map', icon: LayoutIcon },
  { label: 'Đặt chỗ', path: '/staff/bookings', icon: CalendarIcon },
  { label: 'Báo cáo ca', path: '/staff/reports', icon: BellIcon },
];

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function getShiftName(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return 'Ca sáng · 06:00–14:00';
  if (h >= 14 && h < 22) return 'Ca chiều · 14:00–22:00';
  return 'Ca đêm · 22:00–06:00';
}

export function StaffLayout({ children, title = 'Trang tổng quan', showGreeting = false }: StaffLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      const workSessionId = localStorage.getItem('workSessionId');
      if (workSessionId) {
        await api.post('/auth/logout', { workSessionId }).catch(() => { });
      }
    } catch { /* ignore */ }
    logout();
    navigate('/');
  };

  const closeSidebar = () => setSidebarOpen(false);
  const displayName = user?.fullName ?? 'Nhân viên';

  return (
    <div className={styles.layout}>
      {sidebarOpen && (
        <div className={styles.backdrop} onClick={closeSidebar} aria-hidden="true" />
      )}

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarLogo}>
          <img src="/logo.png" alt="ParkSmart Logo" className={styles.sidebarLogoIcon} />
          <div className={styles.sidebarLogoText}>
            <span className={styles.sidebarLogoName}>PARKING SYSTEM</span>
            <span className={styles.sidebarLogoSub}>Nhân viên trực ca</span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          <p className={styles.navSectionLabel}>Thao tác</p>
          <div className={styles.navSection}>
            {staffNavItems.map((item) => {
              const isActive = location.pathname === item.path;
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
            Hỗ trợ
          </button>
          <button className={styles.sidebarBottomItem} onClick={handleLogout}>
            <span className={styles.navItemIcon}>
              <LogoutIcon size={16} />
            </span>
            Đăng xuất
          </button>
        </div>
      </aside>

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
        </div>
        <div className={styles.topBarRight}>
          <div className={styles.userAvatar}>
            <div className={styles.avatarCircle}>{getInitials(displayName)}</div>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{displayName}</span>
              <span className={styles.shiftBadge}>{getShiftName()}</span>
            </div>
          </div>
          <button className={styles.iconBtn} aria-label="Thông báo">
            <BellIcon size={18} />
          </button>

        </div>
      </header>

      <main className={styles.main}>
        {showGreeting && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 className={styles.pageTitle} style={{ margin: 0 }}>{title}</h1>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', fontWeight: 400, lineHeight: 1.4 }}>
              {getGreeting()}, {displayName}
            </p>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
