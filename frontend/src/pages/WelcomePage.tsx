import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from '../styles/welcome.module.css';

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className={styles.welcomeContainer}>
      {/* Navigation Header */}
      <header className={styles.header}>
        <div className={styles.logoContainer} onClick={() => navigate('/')}>
          <div className={styles.logoIcon}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="14" width="20" height="8" rx="2" />
              <path d="M17 2H7L2 14h20L17 2z" />
              <circle cx="6.5" cy="18.5" r="1" fill="#ffffff" />
              <circle cx="17.5" cy="18.5" r="1" fill="#ffffff" />
            </svg>
          </div>
          <span className={styles.logoText}>
            Park<span className={styles.logoDot}>Smart</span>
          </span>
        </div>

        <div className={styles.navActions}>
          <a
            href="mailto:support@parksmart.com"
            className={styles.supportLink}
          >
            Support
          </a>
          {user ? (
            <>
              <button
                className={styles.registerBtn}
                onClick={() => navigate('/login')}
              >
                Dashboard
              </button>
            </>
          ) : (
            <>
              <button
                className={styles.loginBtn}
                onClick={() => navigate('/login')}
              >
                Log in
              </button>
              <button
                className={styles.registerBtn}
                onClick={() => navigate('/register')}
              >
                Register
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Giải pháp đỗ xe <br />
            <span className={styles.highlightText}>Thông minh & Tối ưu</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Hệ thống quản lý bãi đỗ xe thông minh toàn diện. Hỗ trợ đặt chỗ trước linh hoạt,
            check-in/check-out bằng mã QR tiện lợi, cùng giao diện quản lý trực quan giúp tiết kiệm thời gian lên tới 93%.
          </p>
          <div className={styles.ctaButtons}>
            {user ? (
              <>
                <button
                  className={styles.ctaPrimary}
                  onClick={() => navigate('/login')}
                >
                  Vào Dashboard
                </button>
                <button
                  className={styles.ctaSecondary}
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <button
                  className={styles.ctaPrimary}
                  onClick={() => navigate('/register')}
                >
                  Đăng ký ngay
                </button>
                <button
                  className={styles.ctaSecondary}
                  onClick={() => navigate('/login')}
                >
                  Đăng nhập bãi xe
                </button>
              </>
            )}
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.imageWrapper}>
            <img src="/parking_hero.png" alt="Smart Parking System Illustration" />
          </div>

          {/* Isometric Map Legend Badge (inspired by user screenshot) */}
          <div className={styles.mapLegendCard}>
            <div className={styles.legendTitle}>Khu vực đỗ</div>
            <div className={styles.legendList}>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: '#60a5fa' }} />
                <span>Vãng lai (Casual)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: '#f59e0b' }} />
                <span>Gói tháng (Sub)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: '#8b5cf6' }} />
                <span>Khách VIP (Visitor)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: '#ec4899' }} />
                <span>Xe máy (Moto)</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: '#84cc16' }} />
                <span>Xe điện (EV)</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Stats and Feature Highlights */}
      <section className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>01.</div>
          <h3 className={styles.statTitle}>Đặt chỗ linh hoạt</h3>
          <p className={styles.statDesc}>
            Đặt vị trí đỗ xe trước khi tới bãi. Tự động đề xuất các vị trí đỗ tối ưu dựa trên giải thuật Greedy thông minh.
          </p>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>02.</div>
          <h3 className={styles.statTitle}>Vận hành siêu tốc</h3>
          <p className={styles.statDesc}>
            Tối ưu hóa quy trình Check-in/Check-out nhanh chóng cho nhân viên, quản lý thất lạc vé đỗ dễ dàng.
          </p>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>03.</div>
          <h3 className={styles.statTitle}>Báo cáo trực quan</h3>
          <p className={styles.statDesc}>
            Cung cấp số liệu thống kê chi tiết về tỷ lệ lấp đầy, doanh thu định kỳ, biểu đồ lưu lượng thời gian thực cho quản lý.
          </p>
        </div>
      </section>
    </div>
  );
};
