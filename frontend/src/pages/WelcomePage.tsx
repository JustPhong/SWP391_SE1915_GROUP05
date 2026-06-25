import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from '../styles/welcome.module.css';

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className={styles.page}>

      {/* ── 1. NAV ─────────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.logo} onClick={() => navigate('/')}>
            <div className={styles.logoBox}>
              <span className={styles.logoLetter}>P</span>
            </div>
            <span className={styles.logoText}>Park<span className={styles.logoTextAccent}>Smart</span></span>
          </div>

          <div className={styles.navRight}>
            <span className={styles.navSupport}>Hỗ trợ</span>
            {user ? (
              <>
                <button className={styles.btnPrimary} onClick={() => navigate('/dashboard')}>
                  Vào Dashboard
                </button>
                <button className={styles.btnGhost} onClick={() => { logout(); navigate('/'); }}>
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <button className={styles.btnGhost} onClick={() => navigate('/login')}>
                  Đăng nhập
                </button>
                <button className={styles.btnPrimary} onClick={() => navigate('/register')}>
                  Đăng ký
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── 2. HERO ─────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroLeft}>
            <span className={styles.eyebrow}>Hệ thống quản lý bãi đỗ xe</span>
            <h1 className={styles.heroTitle}>
              Giải pháp đỗ xe<br />
              <span className={styles.titleAccent}>Thông minh &amp; Tối ưu</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Hệ thống quản lý bãi đỗ xe toàn diện. Đặt chỗ trước,
              check-in/out bằng mã QR, quản lý trực quan.
            </p>

            <div className={styles.chips}>
              <span className={styles.chip}>Đặt chỗ trước</span>
              <span className={styles.chip}>Mã QR check-in/out</span>
              <span className={styles.chip}>Báo cáo realtime</span>
            </div>

            <div className={styles.heroCtas}>
              {user ? (
                <>
                  <button className={styles.btnPrimary} onClick={() => navigate('/dashboard')}>
                    Vào Dashboard
                  </button>
                  <button className={styles.btnOutline} onClick={() => { logout(); navigate('/'); }}>
                    Đăng xuất
                  </button>
                </>
              ) : (
                <>
                  <button className={styles.btnPrimary} onClick={() => navigate('/register')}>
                    Đăng ký ngay
                  </button>
                  <button className={styles.btnOutline} onClick={() => navigate('/login')}>
                    Đăng nhập
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right: CSS illustration + legend */}
          <div className={styles.heroRight}>
            <div className={styles.showcaseCard}>
              <img
                src="/parking_hero.png"
                alt="Bãi đỗ xe ParkSmart"
                className={styles.heroImage}
              />
            </div>

            {/* Legend card overlaid */}
            <div className={styles.legendCard}>
              <div className={styles.legendTitle}>Khu vực đỗ</div>
              <div className={styles.legendItems}>
                <div className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ backgroundColor: '#2d5fd0' }} />
                  <span>Vãng lai</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ backgroundColor: '#f59e0b' }} />
                  <span>Gói tháng</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. FEATURES ─────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.eyebrow}>Tính năng nổi bật</span>
          <h2 className={styles.sectionTitle}>Mọi thứ bạn cần để vận hành bãi đỗ</h2>
          <div className={styles.cardGrid3}>
            <div className={styles.featureCard}>
              <div className={styles.featureNum}>01</div>
              <h3 className={styles.featureCardTitle}>Đặt chỗ tự động</h3>
              <p className={styles.featureCardDesc}>
                Khách vãng lai đặt chỗ trước, hệ thống tự xếp vị trí tối ưu
                bằng giải thuật Greedy, không cần chọn thủ công.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureNum}>02</div>
              <h3 className={styles.featureCardTitle}>Check-in/out QR</h3>
              <p className={styles.featureCardDesc}>
                Quét mã QR tại cổng, vào ra nhanh chóng, quản lý vé thất lạc
                dễ dàng.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureNum}>03</div>
              <h3 className={styles.featureCardTitle}>Báo cáo trực quan</h3>
              <p className={styles.featureCardDesc}>
                Thống kê tỉ lệ lấp đầy, doanh thu, lưu lượng theo thời gian thực.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. PROCESS ─────────────────────────────────── */}
      <section className={styles.sectionAlt}>
        <div className={styles.sectionInner}>
          <span className={styles.eyebrow}>Quy trình vận hành</span>
          <h2 className={styles.sectionTitle}>Ba bước, từ đặt chỗ đến rời bãi</h2>
          <div className={styles.cardGrid3}>
            <div className={styles.processCard}>
              <div className={styles.stepCircle}>1</div>
              <h3 className={styles.processCardTitle}>Đặt chỗ trực tuyến</h3>
              <p className={styles.processCardDesc}>
                Hệ thống tự xếp vị trí tối ưu và giữ chỗ tức thì.
              </p>
            </div>
            <div className={styles.processCard}>
              <div className={styles.stepCircle}>2</div>
              <h3 className={styles.processCardTitle}>Check-in bằng QR</h3>
              <p className={styles.processCardDesc}>
                Quét mã tại cổng, vé điện tử gắn biển số, không vé giấy.
              </p>
            </div>
            <div className={styles.processCard}>
              <div className={styles.stepCircle}>3</div>
              <h3 className={styles.processCardTitle}>Rời bãi &amp; thanh toán</h3>
              <p className={styles.processCardDesc}>
                Phí tính tự động theo thời gian, thanh toán QR.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. ZONES / PRICING ─────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.eyebrow}>Khu vực &amp; biểu phí</span>
          <h2 className={styles.sectionTitle}>Phân khu rõ ràng, biểu phí minh bạch</h2>
          <div className={styles.cardGrid2}>
            <div className={styles.pricingCard}>
              <div className={styles.pricingHeader}>
                <span className={styles.pricingDot} style={{ backgroundColor: '#2d5fd0' }} />
                <span className={styles.pricingTier}>Vãng lai</span>
              </div>
              <ul className={styles.pricingPerks}>
                <li>Đỗ theo lượt</li>
                <li>Thanh toán QR tại chỗ</li>
                <li>Không cần đăng ký</li>
              </ul>
            </div>
            <div className={`${styles.pricingCard} ${styles.pricingCardFeatured}`}>
              <div className={styles.pricingBadge}>Phổ biến</div>
              <div className={styles.pricingHeader}>
                <span className={styles.pricingDot} style={{ backgroundColor: '#f59e0b' }} />
                <span className={styles.pricingTier}>Gói tháng</span>
              </div>
              <ul className={styles.pricingPerks}>
                <li>Chỗ đỗ ưu tiên cố định</li>
                <li>Ra vào không giới hạn</li>
                <li>Báo cáo chi tiêu hàng tháng</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. CTA BAND ────────────────────────────────── */}
      <section className={styles.ctaBand}>
        <div className={styles.ctaBandInner}>
          <h2 className={styles.ctaTitle}>Sẵn sàng vận hành bãi đỗ thông minh?</h2>
          <p className={styles.ctaSubtitle}>
            Bắt đầu miễn phí ngay hôm nay.
          </p>
          {user ? (
            <button className={styles.btnWhite} onClick={() => navigate('/dashboard')}>
              Vào Dashboard
            </button>
          ) : (
            <>
              <button className={styles.btnWhite} onClick={() => navigate('/register')}>
                Đăng ký miễn phí
              </button>
              <button className={styles.btnWhiteOutline} onClick={() => navigate('/login')}>
                Đăng nhập
              </button>
            </>
          )}
        </div>
      </section>

      {/* ── 8. FOOTER ─────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <div className={styles.logo} onClick={() => navigate('/')}>
              <div className={styles.logoBox}>
                <span className={styles.logoLetter}>P</span>
              </div>
              <span className={`${styles.logoText} ${styles.logoTextFooter}`}>Park<span className={styles.logoTextAccent}>Smart</span></span>
            </div>
            <p className={styles.footerTagline}>
              Giải pháp đỗ xe thông minh &amp; tối ưu.
            </p>
          </div>

          <div className={styles.footerLinks}>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Sản phẩm</span>
              <span>Đặt chỗ</span>
              <span>Check-in QR</span>
              <span>Báo cáo</span>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Công ty</span>
              <span>Giới thiệu</span>
              <span>Tuyển dụng</span>
              <span>Liên hệ</span>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Hỗ trợ</span>
              <span>Trung tâm trợ giúp</span>
              <span>Câu hỏi thường gặp</span>
              <span>Liên hệ</span>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          &copy; 2026 ParkSmart Vietnam
        </div>
      </footer>
    </div>
  );
};
