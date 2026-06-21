import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  HomeIcon,
  CarIcon,
  BarChartIcon,
  TrendUpIcon,
  LogoutIcon,
  BellIcon,
  HelpIcon,
} from './ui/Icons';
import styles from '../styles/manager.module.css';

interface ManagerLayoutProps {
  children: ReactNode;
}

const managerNavItems = [
  { label: 'Tổng quan', path: '/manager/dashboard', icon: HomeIcon },
  { label: 'Doanh thu', path: '/manager/revenue', icon: BarChartIcon },
  { label: 'Tỉ lệ lấp đầy', path: '/manager/occupancy', icon: TrendUpIcon },
  { label: 'Lưu lượng xe', path: '/manager/traffic', icon: CarIcon },
];

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

export function ManagerLayout({ children }: ManagerLayoutProps) {
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
  const displayName = user?.fullName ?? 'Quản lý';

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
            <span className={styles.sidebarLogoSub}>Quản lý (Manager)</span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          <p className={styles.navSectionLabel}>Báo cáo &amp; Thống kê</p>
          <div className={styles.navSection}>
            {managerNavItems.map((item) => {
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
          <div>
            <div className={styles.topBarBuilding}>Tòa nhà A</div>
            <div className={styles.topBarSubtitle}>Báo cáo &amp; Thống kê 2026</div>
          </div>
        </div>

        <div className={styles.topBarRight}>
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
              <span className={styles.roleBadge}>Quản lý</span>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
