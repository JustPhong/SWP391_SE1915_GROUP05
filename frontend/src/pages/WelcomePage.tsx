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
                <button className={styles.btnPrimary} onClick={() => navigate('/login')}>
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
                  <button className={styles.btnPrimary} onClick={() => navigate('/login')}>
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
          <span className={styles.eyebrow}>Bảng giá gói tháng</span>
          <h2 className={styles.sectionTitle}>Chọn gói phù hợp với bạn</h2>
          <p className={styles.pricingNote}>
            Giá áp dụng cho ô tô. Xe máy có biểu giá riêng.
          </p>
          <div className={styles.cardGrid3}>
            <div className={styles.pricingCard}>
              <div className={styles.pricingIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div className={styles.pricingHeader}>
                <span className={styles.pricingTier}>Gói 1 tháng</span>
              </div>
              <div className={styles.pricingDuration}>30 ngày</div>
              <div className={styles.pricingPrice}>1.500.000đ</div>
              <div className={styles.pricingPerDay}>50.000đ/ngày</div>
              <ul className={styles.pricingPerks}>
                <li>Chỗ đỗ cố định khi đăng ký</li>
              </ul>
              <button className={styles.pricingBtn} onClick={() => navigate('/login')}>
                Chọn gói
              </button>
            </div>
            <div className={`${styles.pricingCard} ${styles.pricingCardFeatured}`}>
              <div className={styles.pricingBadge}>Tiết kiệm hơn</div>
              <div className={styles.pricingIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4"/>
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
              </div>
              <div className={styles.pricingHeader}>
                <span className={styles.pricingTier}>Gói 3 tháng</span>
              </div>
              <div className={styles.pricingDuration}>90 ngày</div>
              <div className={styles.pricingPrice}>4.000.000đ</div>
              <div className={styles.pricingPerDay}>44.444đ/ngày</div>
              <div className={styles.savingTag}>Tiết kiệm ~11%</div>
              <ul className={styles.pricingPerks}>
                <li>Chỗ đỗ cố định khi đăng ký</li>
              </ul>
              <button className={`${styles.pricingBtn} ${styles.pricingBtnFeatured}`} onClick={() => navigate('/login')}>
                Chọn gói
              </button>
            </div>
            <div className={styles.pricingCard}>
              <div className={styles.pricingIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>
              <div className={styles.pricingHeader}>
                <span className={styles.pricingTier}>Gói 1 năm</span>
              </div>
              <div className={styles.pricingDuration}>365 ngày</div>
              <div className={styles.pricingPrice}>15.000.000đ</div>
              <div className={styles.pricingPerDay}>41.096đ/ngày</div>
              <div className={styles.savingTag}>Tiết kiệm ~17%</div>
              <ul className={styles.pricingPerks}>
                <li>Chỗ đỗ cố định khi đăng ký</li>
              </ul>
              <button className={styles.pricingBtn} onClick={() => navigate('/login')}>
                Chọn gói
              </button>
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
            <button className={styles.btnWhite} onClick={() => navigate('/login')}>
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
