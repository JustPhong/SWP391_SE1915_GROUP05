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
  SupportIcon,
  LayoutIcon,
} from './ui/Icons';
import styles from '../styles/driver.module.css';

interface DriverLayoutProps {
  children: ReactNode;
  title?: string;
}

const driverNavItems = [
  { label: 'Trang chủ', path: '/', icon: HomeIcon },
  { label: 'Đặt chỗ', path: '/booking', icon: CalendarIcon },
  { label: 'Sơ đồ tầng', path: '/floor-map', icon: LayoutIcon },
  { label: 'Gói tháng', path: '/monthly-package', icon: CarIconFilled },
  { label: 'Xe của tôi', path: '/my-vehicle', icon: CarIconFilled },
  { label: 'Lịch sử', path: '/history', icon: HistoryIcon },
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

export function DriverLayout({ children, title = 'Trang chủ' }: DriverLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const closeSidebar = () => setSidebarOpen(false);

  // Greeting + initials MUST derive from fullName, never from the role label.
  // Fall back to email only if fullName is missing/empty.
  const displayName = (user?.fullName?.trim() || user?.email) || 'Tài xế';

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
            <span className={styles.sidebarLogoSub}>Quản lý tài xế</span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          <p className={styles.navSectionLabel}>Danh mục</p>
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
            Trợ giúp
          </button>
          <button className={styles.sidebarBottomItem} onClick={handleLogout}>
            <span className={styles.navItemIcon}>
              <LogoutIcon size={16} />
            </span>
            Đăng xuất
          </button>
          <button className={styles.supportBtn}>
            <span className={styles.navItemIcon}>
              <SupportIcon size={16} />
            </span>
            Trung tâm hỗ trợ
          </button>
        </div>
      </aside>

      {/* Top Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button
            className={styles.hamburgerBtn}
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Mở/đóng thanh bên"
          >
            <span className={styles.hamburgerLine} />
            <span className={styles.hamburgerLine} />
            <span className={styles.hamburgerLine} />
          </button>
          <h1 className={styles.pageTitle}>{title}</h1>
        </div>
        <div className={styles.topBarRight}>
          <button className={styles.topBarIconBtn}>
            <BellIcon size={16} />
            <span className={styles.notifDot} />
          </button>
          <button className={styles.topBarIconBtn}>
            <SettingsIcon size={16} />
          </button>
          <Link to="/profile" className={styles.userAvatar}>
            <div className={styles.avatarCircle}>{getInitials(displayName)}</div>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{displayName}</span>
              <span className={styles.roleBadge}>{getRoleLabel(user?.role)}</span>
            </div>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>{children}</main>
    </div>
  );
}
