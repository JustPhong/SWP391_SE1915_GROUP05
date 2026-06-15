import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  HomeIcon,
  BarChartIcon,
  LogoutIcon,
  BellIcon,
  HelpIcon,
  SearchIcon,
  SettingsIcon,
  LayoutIcon,
  ShieldCheckIcon,
  HistoryIcon,
} from './ui/Icons';
import styles from '../styles/admin.module.css';

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { label: 'Quản lý tài khoản', path: '/admin/users', icon: HomeIcon },
  { label: 'Phân quyền',        path: '/admin/permissions', icon: ShieldCheckIcon },
  { label: 'Cấu hình bãi & slot', path: '/admin/parking', icon: LayoutIcon },
  { label: 'Quy tắc tính phí', path: '/admin/fee-rules', icon: BarChartIcon },
  { label: 'Nhật ký hệ thống', path: '/admin/audit-logs', icon: HistoryIcon },
];

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      const workSessionId = localStorage.getItem('workSessionId');
      if (workSessionId) {
        await api.post('/auth/logout', { workSessionId }).catch(() => {});
      }
    } catch { /* ignore */ }
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);
  const displayName = user?.fullName ?? 'Quản trị viên';

  return (
    <div className={styles.layout}>
      {sidebarOpen && (
        <div className={styles.backdrop} onClick={closeSidebar} aria-hidden="true" />
      )}

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarLogo}>
          <div className={styles.sidebarLogoIcon}>P</div>
          <div className={styles.sidebarLogoText}>
            <span className={styles.sidebarLogoName}>ParkSmart Vietnam</span>
            <span className={styles.sidebarLogoSub}>Quản trị hệ thống</span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          <p className={styles.navSectionLabel}>Quản trị</p>
          <div className={styles.navSection}>
            {navItems.map((item) => {
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
          <div>
            <div className={styles.topBarBuilding}>Trang Quản trị</div>
            <div className={styles.topBarSubtitle}>ParkSmart Vietnam</div>
          </div>
        </div>

        <div className={styles.topBarRight}>
          <div className={styles.searchBox}>
            <SearchIcon size={14} />
            <input type="text" placeholder="Tìm kiếm..." />
          </div>
          <button className={styles.topBarIconBtn} aria-label="Thông báo">
            <BellIcon size={18} />
          </button>
          <button className={styles.topBarIconBtn} aria-label="Hỗ trợ">
            <HelpIcon size={18} />
          </button>
          <div className={styles.userAvatar}>
            <div className={styles.avatarCircle}>{getInitials(displayName)}</div>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{displayName}</span>
              <span className={styles.roleBadge}>Quản trị viên</span>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
