import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCurrentSession, getMyPackage, CurrentSession } from '../api/driverDashboardApi';
import { addVehicle } from '../api/vehicleApi';
import { ProfilePage } from './Profile';
import { HistoryPage } from './History';
import { MyVehiclePage } from './MyVehicle';
import { MonthlyPackagePage } from './MonthlyPackage';
import { BookingPage } from './Booking';
import { BookingModal, BookingSuccess } from '../components/BookingModal';
import type { ParkingSlot } from '../types';
import { PACKAGES, CASUAL_PRICING, type VType } from '../constants/packages';
import styles from '../styles/welcome.module.css';

type Tab = 'home' | 'vehicles' | 'profile' | 'history' | 'monthly' | 'booking';

// ── Helpers ─────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buổi sáng';
  if (h < 17) return 'Buổi chiều';
  return 'Buổi tối';
}

function getTitle(time: Date): string {
  const h = time.getHours();
  if (h < 5)  return 'Vẫn chưa ngủ à?';
  if (h < 12) return 'Ngày mới tràn đầy năng lượng!';
  if (h < 14) return 'Buổi trưa rồi, xe đã đỗ chưa?';
  if (h < 17) return 'Chiều nay đỗ xe ở đâu?';
  if (h < 20) return 'Buổi tối, rảnh rỗi đỗ xe thôi!';
  if (h < 22) return 'Đêm vắng, bãi xe vẫn mở!';
  return 'Khuya rồi, cẩn thận nhé!';
}

// ── Component ──────────────────────────────────────────────
export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // ── User type detection ──────────────────────────────────
  // All users stay on the Welcome page (including monthly customers) — no redirect.
  const [pkgLoading, setPkgLoading] = useState(true);
  const [hasPackage, setHasPackage] = useState(false); // true = monthly customer

  useEffect(() => {
    if (!user) { setPkgLoading(false); return; }
    getMyPackage().then(pkg => {
      // Mọi user đều ở lại trang Welcome (kể cả khách gói tháng) — không redirect sang /dashboard nữa
      setHasPackage(!!pkg);
      setPkgLoading(false);
    }).catch(() => setPkgLoading(false));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab state (casual users only) ─────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [session, setSession] = useState<CurrentSession | null>(null);

  // ── Support Modal & FAQ states ────────────────────────────
  const [activeSupportTab, setActiveSupportTab] = useState<'help' | 'faq' | 'contact' | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', email: '', subject: 'Sự cố thanh toán', message: '' });
  const [isContactSubmitted, setIsContactSubmitted] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);

  // ── Booking modal state ─────────────────────────────────────
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<{ bookingId: string; slotCode: string } | null>(null);

  const handleBookingSuccess = (slot: ParkingSlot, bookingId: string) => {
    setBookingOpen(false);
    setBookingSuccess({ bookingId, slotCode: slot.code });
  };

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitting(true);
    setTimeout(() => {
      setContactSubmitting(false);
      setIsContactSubmitted(true);
    }, 800);
  };

  const resetContactForm = () => {
    setContactForm({ name: '', phone: '', email: '', subject: 'Sự cố thanh toán', message: '' });
    setIsContactSubmitted(false);
  };

  const renderSupportModal = () => {
    if (!activeSupportTab) return null;

    return (
      <div className={styles.supportModalBackdrop} onClick={() => setActiveSupportTab(null)}>
        <div className={styles.supportModal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.supportModalHeader}>
            <span className={styles.supportModalTitle}>Trung tâm Hỗ trợ ParkSmart</span>
            <button className={styles.supportModalClose} onClick={() => setActiveSupportTab(null)}>&times;</button>
          </div>

          <div className={styles.supportModalTabs}>
            <button
              className={`${styles.supportModalTab} ${activeSupportTab === 'help' ? styles.supportModalTabActive : ''}`}
              onClick={() => { setActiveSupportTab('help'); resetContactForm(); }}
            >
              Trung tâm trợ giúp
            </button>
            <button
              className={`${styles.supportModalTab} ${activeSupportTab === 'faq' ? styles.supportModalTabActive : ''}`}
              onClick={() => { setActiveSupportTab('faq'); resetContactForm(); }}
            >
              Câu hỏi thường gặp
            </button>
            <button
              className={`${styles.supportModalTab} ${activeSupportTab === 'contact' ? styles.supportModalTabActive : ''}`}
              onClick={() => { setActiveSupportTab('contact'); }}
            >
              Liên hệ chúng tôi
            </button>
          </div>

          <div className={styles.supportModalBody}>
            {activeSupportTab === 'help' && (
              <div className={styles.helpGrid}>
                <div className={styles.helpCard}>
                  <div className={styles.helpCardTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 9.21v3z"/></svg>
                    <span>Hotline 24/7</span>
                  </div>
                  <div className={styles.helpCardContent}>
                    <p style={{ fontWeight: 600, color: '#16293f', fontSize: '1.1rem', margin: '0.2rem 0' }}>1900 6868</p>
                    <p>Hỗ trợ khẩn cấp, giải quyết sự cố ra vào bãi và lỗi thanh toán mọi lúc mọi nơi.</p>
                  </div>
                </div>

                <div className={styles.helpCard}>
                  <div className={styles.helpCardTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    <span>Hỗ trợ qua Email</span>
                  </div>
                  <div className={styles.helpCardContent}>
                    <p style={{ fontWeight: 600, color: '#16293f', fontSize: '1rem', margin: '0.2rem 0' }}>support@parksmart.vn</p>
                    <p>Tiếp nhận các phản hồi, đề xuất, yêu cầu hóa đơn hoặc đăng ký gói tháng cho doanh nghiệp.</p>
                  </div>
                </div>

                <div className={styles.helpCard}>
                  <div className={styles.helpCardTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    <span>Thời gian phục vụ</span>
                  </div>
                  <div className={styles.helpCardContent}>
                    <p style={{ fontWeight: 600, color: '#16293f', margin: '0.2rem 0' }}>Thứ 2 - Chủ Nhật</p>
                    <p>Mở cửa phục vụ liên tục 24 giờ mỗi ngày, kể cả các ngày lễ Tết.</p>
                  </div>
                </div>

                <div className={styles.helpCard}>
                  <div className={styles.helpCardTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <span>Văn phòng Quản lý</span>
                  </div>
                  <div className={styles.helpCardContent}>
                    <p style={{ fontWeight: 600, color: '#16293f', margin: '0.2rem 0' }}>Tầng lửng B1</p>
                    <p>Bãi đỗ xe ParkSmart, 123 Đường 3/2, Quận 10, TP. Hồ Chí Minh.</p>
                  </div>
                </div>
              </div>
            )}

            {activeSupportTab === 'faq' && (
              <div className={styles.faqList}>
                {[
                  {
                    q: "Làm thế nào để mua gói vé tháng?",
                    a: "Để đăng ký vé tháng, bạn cần đăng nhập tài khoản của mình, vào mục 'Xe của tôi' để thêm phương tiện đỗ xe, sau đó điều hướng tới mục 'Gói tháng', chọn gói đỗ xe phù hợp (1 tháng, 3 tháng hoặc 1 năm) và thanh toán nhanh chóng bằng mã QR."
                  },
                  {
                    q: "Tôi có thể hủy đặt chỗ trước khi vào bãi không?",
                    a: "Có, bạn hoàn toàn có thể hủy đặt chỗ bất kỳ lúc nào trước giờ hẹn tối thiểu 30 phút. Nếu hủy sau thời gian này hoặc không tới bãi xe (No-show), bạn có thể bị mất số tiền cọc (nếu có)."
                  },
                  {
                    q: "Nếu tôi làm mất vé giấy/thẻ vãng lai thì phải xử lý thế nào?",
                    a: "Hãy liên hệ ngay với nhân viên Staff tại bốt trực cổng ra hoặc phòng điều hành tầng B1. Phí đền bù mất thẻ là 500.000đ, cộng thêm phí đỗ xe thực tế tính từ thời điểm xe check-in vào bãi dựa trên lịch sử ghi nhận camera."
                  },
                  {
                    q: "Hệ thống hỗ trợ những phương thức thanh toán nào?",
                    a: "ParkSmart hỗ trợ các hình thức thanh toán đa dạng bao gồm: tiền mặt trực tiếp tại quầy, quẹt thẻ ngân hàng (ATM/Visa/Mastercard), hoặc quét mã QR thanh toán qua MoMo, ZaloPay, VNPAY."
                  },
                  {
                    q: "Tôi mua vé tháng có được chọn chỗ đỗ cố định không?",
                    a: "Khi bạn đăng ký gói vé tháng cố định (Fixed Slot), hệ thống sẽ sử dụng thuật toán phân vùng tối ưu để tự động chọn và gán một vị trí đỗ xe riêng biệt dành cho bạn. Bạn có thể yêu cầu Manager thay đổi vị trí này nếu khu vực đó còn trống."
                  }
                ].map((item, index) => (
                  <div key={index} className={`${styles.faqItem} ${expandedFaq === index ? styles.faqItemOpen : ''}`}>
                    <button className={styles.faqQuestion} onClick={() => toggleFaq(index)}>
                      <span>{item.q}</span>
                      <span style={{ transition: 'transform 0.2s', transform: expandedFaq === index ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                    </button>
                    {expandedFaq === index && (
                      <div className={styles.faqAnswer}>
                        {item.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeSupportTab === 'contact' && (
              isContactSubmitted ? (
                <div className={styles.successMessage}>
                  <div className={styles.successIcon}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <h4 className={styles.successTitle}>Gửi phản hồi thành công!</h4>
                  <p className={styles.successText}>
                    Cảm ơn bạn. Yêu cầu hỗ trợ của bạn đã được chuyển tới bộ phận kỹ thuật. Chúng tôi sẽ phản hồi lại bạn sớm nhất có thể.
                  </p>
                  <button className={styles.btnOutline} onClick={resetContactForm}>Gửi tin nhắn khác</button>
                </div>
              ) : (
                <form className={styles.contactForm} onSubmit={handleContactSubmit}>
                  <div className={styles.formGroup}>
                    <label className={styles.formGroupLabel}>Họ và tên</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="Nhập họ và tên của bạn"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className={styles.formGroup} >
                    <label className={styles.formGroupLabel}>Số điện thoại</label>
                    <input
                      type="tel"
                      className={styles.formInput}
                      placeholder="Nhập số điện thoại"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formGroupLabel}>Địa chỉ Email</label>
                    <input
                      type="email"
                      className={styles.formInput}
                      placeholder="example@gmail.com"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formGroupLabel}>Vấn đề cần hỗ trợ</label>
                    <select
                      className={styles.formSelect}
                      value={contactForm.subject}
                      onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    >
                      <option value="Sự cố thanh toán">Sự cố thanh toán</option>
                      <option value="Lỗi đặt chỗ (Booking)">Lỗi đặt chỗ (Booking)</option>
                      <option value="Thẻ/Vé đỗ xe">Thẻ/Vé đỗ xe</option>
                      <option value="Gói tháng cố định">Gói tháng cố định</option>
                      <option value="Đóng góp ý kiến">Đóng góp ý kiến</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formGroupLabel}>Nội dung</label>
                    <textarea
                      className={styles.formTextarea}
                      placeholder="Mô tả chi tiết vấn đề bạn đang gặp phải..."
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      required
                    />
                  </div>
                  <button type="submit" className={styles.btnPrimary} disabled={contactSubmitting} style={{ marginTop: '0.5rem' }}>
                    {contactSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu hỗ trợ'}
                  </button>
                </form>
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Add vehicle form ─────────────────────────────────────
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [newType, setNewType] = useState<'CAR' | 'MOTORBIKE'>('CAR');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // ── Fetch session (casual users only) ────────────────────
  useEffect(() => {
    if (!user || hasPackage || pkgLoading) return;
    getCurrentSession().then(setSession);
  }, [user, hasPackage, pkgLoading]);

  // ── Add vehicle ──────────────────────────────────────────
  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlate.trim()) return;
    setAddLoading(true);
    setAddError('');
    try {
      await addVehicle({ plateNumber: newPlate.trim().toUpperCase(), type: newType });
      setShowAddVehicle(false);
      setNewPlate('');
      setNewType('CAR');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Thêm xe thất bại.');
    } finally {
      setAddLoading(false);
    }
  };

  // ── Loading screen while detecting user type ──────────────
  if (pkgLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f7ff' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #dae9f5', borderTopColor: '#2d5fd0', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <p style={{ color: '#8aacbf', fontSize: '0.9rem', margin: 0 }}>Đang chuyển hướng...</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  RENDER — LOGGED OUT: full public landing page
  // ═══════════════════════════════════════════════════════════
  if (!user) {
    return (
      <div className={styles.page}>
        {/* ── 1. NAV ─────────────────────────────────────── */}
        <nav className={styles.nav}>
          <div className={styles.navInner}>
            <div className={styles.logo} onClick={() => navigate('/')}>
              <img src="/logo.png" alt="ParkSmart Logo" className={styles.logoImg} />
              <span className={styles.logoText}>Park<span className={styles.logoTextAccent}>Smart</span></span>
            </div>
            <div className={styles.navRight}>
              {/* Dropdown Support */}
              <div className={styles.supportDropdownContainer}>
                <span className={styles.navSupport}>
                  Hỗ trợ <span style={{ fontSize: '0.75rem', marginLeft: '2px' }}>▼</span>
                </span>
                <div className={styles.supportDropdownMenu}>
                  <button className={styles.supportDropdownItem} onClick={() => setActiveSupportTab('help')}>
                    Trung tâm trợ giúp
                  </button>
                  <button className={styles.supportDropdownItem} onClick={() => setActiveSupportTab('faq')}>
                    Câu hỏi thường gặp
                  </button>
                  <button className={styles.supportDropdownItem} onClick={() => setActiveSupportTab('contact')}>
                    Liên hệ chúng tôi
                  </button>
                </div>
              </div>
              <button className={styles.btnGhost} onClick={() => navigate('/login')}>Đăng nhập</button>
              <button className={styles.btnPrimary} onClick={() => navigate('/register')}>Đăng ký</button>
            </div>
          </div>
        </nav>

        <HeroSection navigate={navigate} />
        <PricingSection navigate={navigate} onBooking={() => setBookingOpen(true)} />
        <FeaturesSection />
        <ProcessSection />
        <Footer navigate={navigate} />

        {renderSupportModal()}
        <BookingModal
          open={bookingOpen}
          onClose={() => setBookingOpen(false)}
          onSuccess={handleBookingSuccess}
        />
        {bookingSuccess && (
          <BookingSuccess
            bookingId={bookingSuccess.bookingId}
            slotCode={bookingSuccess.slotCode}
            onClose={() => setBookingSuccess(null)}
          />
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  RENDER — CASUAL LOGGED-IN USER (hasPackage=false, pkgLoading=false)
  // ═══════════════════════════════════════════════════════════
  return (
    <div className={styles.page}>
      {/* ── 1. NAV ─────────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.logo} onClick={() => { setActiveTab('home'); }}>
            <img src="/logo.png" alt="ParkSmart Logo" className={styles.logoImg} />
            <span className={styles.logoText}>Park<span className={styles.logoTextAccent}>Smart</span></span>
          </div>

          {/* Tab switcher */}
          <div className={styles.tabSwitcher}>
            <button className={`${styles.tabBtn} ${activeTab === 'home' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('home')}>
              Trang chủ
            </button>
            <button className={`${styles.tabBtn} ${activeTab === 'vehicles' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('vehicles')}>
              Xe của bạn
            </button>
            <button className={`${styles.tabBtn} ${activeTab === 'history' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('history')}>
              Lịch sử
            </button>
            <button className={`${styles.tabBtn} ${activeTab === 'monthly' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('monthly')}>
              Gói tháng
            </button>
            <button className={`${styles.tabBtn} ${activeTab === 'booking' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('booking')}>
              Đặt chỗ
            </button>
          </div>

          <div className={styles.navRight}>
            {/* Dropdown Support */}
            <div className={styles.supportDropdownContainer}>
              <span className={styles.navSupport}>
                Hỗ trợ <span style={{ fontSize: '0.75rem', marginLeft: '2px' }}>▼</span>
              </span>
              <div className={styles.supportDropdownMenu}>
                <button className={styles.supportDropdownItem} onClick={() => setActiveSupportTab('help')}>
                  Trung tâm trợ giúp
                </button>
                <button className={styles.supportDropdownItem} onClick={() => setActiveSupportTab('faq')}>
                  Câu hỏi thường gặp
                </button>
                <button className={styles.supportDropdownItem} onClick={() => setActiveSupportTab('contact')}>
                  Liên hệ chúng tôi
                </button>
              </div>
            </div>
            <div className={styles.supportDropdownContainer}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: '#2d5fd0', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
                }}>
                  {user.fullName.trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                  <span className={styles.userGreeting} style={{ fontWeight: 600 }}>{user.fullName}</span>
                  {hasPackage && (
                    <span style={{ fontSize: '0.72rem', color: '#2d5fd0', fontWeight: 600 }}>Cư dân</span>
                  )}
                </div>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '0.15rem' }}>▼</span>
              </div>
              <div className={styles.supportDropdownMenu}>
                <button className={styles.supportDropdownItem} onClick={() => setActiveTab('profile')}>
                  Hồ sơ của tôi
                </button>
                <button className={styles.supportDropdownItem} onClick={() => { logout(); navigate('/'); }}>
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ── TAB CONTENT ─────────────────────────────────── */}
      {activeTab === 'home' ? (
        <>
          <HeroLoggedIn user={user} session={session} navigate={navigate} onBooking={() => setBookingOpen(true)} />
          <PricingSection navigate={navigate} onBooking={() => setBookingOpen(true)} onSelectPackage={() => setActiveTab('monthly')} />
          <FeaturesSection />
          <ProcessSection />
        </>
      ) : activeTab === 'vehicles' ? (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' }}>
          <MyVehiclePage />
        </div>
      ) : null}

      {activeTab === 'profile' && (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' }}>
          <ProfilePage />
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' }}>
          <HistoryPage />
        </div>
      )}

      {activeTab === 'monthly' && (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' }}>
          <MonthlyPackagePage />
        </div>
      )}

      {activeTab === 'booking' && (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' }}>
          {hasPackage ? (
            <BookingPage />
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem' }}>Tính năng dành cho khách gói tháng</h2>
              <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Đặt chỗ trước chỉ áp dụng cho khách đã đăng ký gói tháng. Vui lòng mua gói tháng để sử dụng.</p>
              <button className={styles.btnPrimary} onClick={() => setActiveTab('monthly')}>Xem gói tháng</button>
            </div>
          )}
        </div>
      )}

      {/* ── Add Vehicle Modal ─────────────────────────────── */}
      {showAddVehicle && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowAddVehicle(false); }}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Thêm xe mới</h3>
              <button className={styles.modalClose} onClick={() => setShowAddVehicle(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleAddVehicle} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Biển số xe</label>
                <input className={styles.formInput} type="text" placeholder="VD: 30A-123.45" value={newPlate}
                  onChange={e => setNewPlate(e.target.value.toUpperCase())} maxLength={20} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Loại xe</label>
                <div className={styles.typeSelector}>
                  <button type="button" className={`${styles.typeOption} ${newType === 'CAR' ? styles.typeOptionActive : ''}`} onClick={() => setNewType('CAR')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    Ô tô
                  </button>
                  <button type="button" className={`${styles.typeOption} ${newType === 'MOTORBIKE' ? styles.typeOptionActive : ''}`} onClick={() => setNewType('MOTORBIKE')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M5 17H3V9h12l3 8h2"/><path d="M15 9h2l2 4-1 4H11"/></svg>
                    Xe máy
                  </button>
                </div>
              </div>
              {addError && <div className={styles.formError}>{addError}</div>}
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnGhost} onClick={() => setShowAddVehicle(false)}>Huỷ</button>
                <button type="submit" className={styles.btnPrimary} disabled={addLoading}>{addLoading ? 'Đang thêm...' : 'Thêm xe'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Footer (home tab only) ─────────────────────────── */}
      {activeTab === 'home' && <Footer navigate={navigate} />}

      {renderSupportModal()}
      <BookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onSuccess={handleBookingSuccess}
      />
      {bookingSuccess && (
        <BookingSuccess
          bookingId={bookingSuccess.bookingId}
          slotCode={bookingSuccess.slotCode}
          onClose={() => setBookingSuccess(null)}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function HeroSection({ navigate }: { navigate: (path: string) => void }) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroLeft}>
          <span className={styles.eyebrow}>Hệ thống quản lý bãi đỗ xe</span>
          <h1 className={styles.heroTitle}>Giải pháp đỗ xe<br /><span className={styles.titleAccent}>Thông minh &amp; Tối ưu</span></h1>
          <p className={styles.heroSubtitle}>Hệ thống quản lý bãi đỗ xe toàn diện. Đặt chỗ trước, check-in/out bằng mã QR, quản lý trực quan.</p>
          <div className={styles.chips}>
            <span className={styles.chip}>Đặt chỗ trước</span>
            <span className={styles.chip}>Mã QR check-in/out</span>
            <span className={styles.chip}>Báo cáo realtime</span>
          </div>
          <div className={styles.heroCtas}>
            <button className={styles.btnPrimary} onClick={() => navigate('/register')}>Đăng ký ngay</button>
            <button className={styles.btnOutline} onClick={() => navigate('/login')}>Đăng nhập</button>
          </div>
        </div>
        <div className={styles.heroRight}>
          <div className={styles.showcaseCard}>
            <img src="/parking_hero.png" alt="Mô hình tòa nhà đỗ xe ParkSmart" className={styles.heroImage} />
          </div>
          <div className={styles.legendCard}>
            <div className={styles.legendTitle}>Khu vực đỗ</div>
            <div className={styles.legendItems}>
              <div className={styles.legendItem}><span className={styles.legendDot} style={{ backgroundColor: '#2d5fd0' }} /><span>Vãng lai</span></div>
              <div className={styles.legendItem}><span className={styles.legendDot} style={{ backgroundColor: '#f59e0b' }} /><span>Gói tháng</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Personalised hero for logged-in casual users ──────────
function HeroLoggedIn({
  user,
  session,
  navigate,
  onBooking,
}: {
  user: { fullName: string; email: string };
  session: CurrentSession | null;
  navigate: (path: string) => void;
  onBooking: () => void;
}) {
  const firstName = user.fullName.trim().split(/\s+/)[0] ?? user.email;
  const greeting = getGreeting();
  const title = getTitle(new Date());

  return (
    <section className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroLeft}>
          <span className={styles.eyebrow}>
            {greeting === 'Buổi sáng' ? '🌤️' : greeting === 'Buổi chiều' ? '☀️' : '🌙'}
            {' '}{greeting}, {firstName}
          </span>
          <h1 className={styles.heroTitle}>{title}</h1>
          <p className={styles.heroSubtitle}>
            {session
              ? `Xe ${session.plateNumber} đang đỗ tại ${session.slotCode} · ${session.floor}. Phí ước tính: ${formatCurrencyInline(session.estimatedAmount ?? 0)}.`
              : 'Chưa có xe nào đang đỗ. Đặt chỗ ngay để giữ chỗ vào bãi!'}
          </p>
          <div className={styles.chips}>
            <span className={styles.chip}>{session ? `Đang đỗ: ${session.slotCode}` : 'Chưa đỗ xe'}</span>
            {session?.isMonthly
              ? <span className={`${styles.chip} ${styles.chipGreen}`}>Gói tháng</span>
              : <span className={styles.chip}>Khách vãng lai</span>}
          </div>
          <div className={styles.heroCtas}>
            <button
              className={styles.btnPrimary}
              onClick={() => session ? navigate('/driver-dashboard') : onBooking()}
            >
              {session ? 'Xem chi tiết' : 'Đặt chỗ ngay'}
            </button>
            <button
              className={styles.btnOutline}
              onClick={() => navigate(session ? '/driver-dashboard' : '#pricing')}
            >
              {session ? 'Thanh toán' : 'Tìm hiểu thêm'}
            </button>
          </div>
        </div>
        <div className={styles.heroRight}>
          <div className={styles.showcaseCard}>
            <img src="/parking_hero.png" alt="Mô hình tòa nhà đỗ xe ParkSmart" className={styles.heroImage} />
          </div>
          <div className={styles.legendCard}>
            <div className={styles.legendTitle}>Khu vực đỗ</div>
            <div className={styles.legendItems}>
              <div className={styles.legendItem}><span className={styles.legendDot} style={{ backgroundColor: '#2d5fd0' }} /><span>Vãng lai</span></div>
              <div className={styles.legendItem}><span className={styles.legendDot} style={{ backgroundColor: '#f59e0b' }} /><span>Gói tháng</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatCurrencyInline(n: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}

function FeaturesSection() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionInner}>
        <span className={styles.eyebrow}>Vì sao chọn ParkSmart</span>
        <h2 className={styles.sectionTitle}>Đỗ xe thông minh, tiện cho bạn</h2>
        <div className={styles.cardGrid3}>
          <FeatureCard
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            }
            title="Tiết kiệm thời gian"
            desc="Luôn có chỗ sẵn khi bạn đến — không vòng vòng tìm chỗ, không chờ đợi giờ cao điểm."
          />
          <FeatureCard
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="6" width="18" height="13" rx="2" />
                <path d="M3 10h18" />
                <path d="M16 14h2" />
                <path d="M7 6V4" />
                <path d="M17 6V4" />
              </svg>
            }
            title="Chi phí minh bạch"
            desc="Phí tính tự động theo thời gian thực tế, hiển thị rõ ràng, không lo tính sai."
          />
          <FeatureCard
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            }
            title="An tâm & an toàn"
            desc="Bãi có mái che, khu vực riêng cho ô tô và xe máy, chỗ đỗ luôn ổn định."
          />
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section className={styles.sectionAlt}>
      <div className={styles.sectionInner}>
        <span className={styles.eyebrow}>Quy trình vận hành</span>
        <h2 className={styles.sectionTitle}>Ba bước, từ đặt chỗ đến rời bãi</h2>
        <div className={styles.cardGrid3}>
          <ProcessCard num={1} title="Đặt chỗ trực tuyến" desc="Hệ thống tự xếp vị trí tối ưu và giữ chỗ tức thì." />
          <ProcessCard num={2} title="Check-in bằng QR" desc="Quét mã tại cổng, vé điện tử gắn biển số, không vé giấy." />
          <ProcessCard num={3} title="Rời bãi &amp; thanh toán" desc="Phí tính tự động theo thời gian, thanh toán QR." />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className={styles.featureCard}>
      <div className={styles.featureIcon}>{icon}</div>
      <h3 className={styles.featureCardTitle}>{title}</h3>
      <p className={styles.featureCardDesc}>{desc}</p>
    </div>
  );
}

function ProcessCard({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className={styles.processCard}>
      <div className={styles.stepCircle}>{num}</div>
      <h3 className={styles.processCardTitle}>{title}</h3>
      <p className={styles.processCardDesc}>{desc}</p>
    </div>
  );
}

function PricingSection({ navigate, onBooking, onSelectPackage }: { navigate: (path: string) => void; onBooking: () => void; onSelectPackage?: () => void }) {
  const [vtype, setVtype] = useState<VType>('CAR');
  const CAR_PERKS = ['Chỗ đỗ cố định riêng', 'Không tính phí theo lượt', 'Ra vào không giới hạn', 'Ưu tiên khu gói tháng'];
  const MOTO_PERKS = ['Đỗ ở ô trống bất kỳ', 'Không tính phí theo lượt', 'Ra vào không giới hạn', 'Khu xe máy riêng, có mái che'];
  const perks = vtype === 'CAR' ? CAR_PERKS : MOTO_PERKS;
  const casual = CASUAL_PRICING[vtype];
  return (
    <section className={styles.section}>
      <div className={styles.sectionInner}>
        <span className={styles.eyebrow}>Bảng giá</span>
        <h2 className={styles.sectionTitle}>Chọn cách đỗ phù hợp với bạn</h2>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.75rem' }}>
          <button type="button" className={`${styles.typeOption} ${vtype === 'CAR' ? styles.typeOptionActive : ''}`} onClick={() => setVtype('CAR')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            Ô tô
          </button>
          <button type="button" className={`${styles.typeOption} ${vtype === 'MOTORBIKE' ? styles.typeOptionActive : ''}`} onClick={() => setVtype('MOTORBIKE')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M5 17H3V9h12l3 8h2"/><path d="M15 9h2l2 4-1 4H11"/></svg>
            Xe máy
          </button>
        </div>

        <p className={styles.pricingNote} style={{ marginTop: 0 }}>
          {vtype === 'CAR'
            ? 'Khách gói tháng được ưu tiên chỗ đỗ cố định — tiết kiệm hơn hẳn so với trả theo lượt.'
            : 'Khách gói tháng ra vào không giới hạn — tiết kiệm hơn hẳn so với trả theo lượt.'}
        </p>
        <div className={styles.cardGrid3}>
          {PACKAGES.map((pkg, i) => (
            <PricingCard
              key={pkg.id}
              title={pkg.name}
              duration={`${pkg.durationDays} ngày`}
              price={pkg.prices[vtype].priceLabel}
              perDay={pkg.prices[vtype].pricePerDay}
              perks={perks}
              icon={i === 0 ? 'calendar' : i === 1 ? 'check' : 'star'}
              featured={i === 1}
              saving={i === 1 ? 'Tiết kiệm ~11%' : i === 2 ? 'Tiết kiệm ~17%' : undefined}
              onClick={onSelectPackage ?? (() => navigate('/monthly-package'))}
            />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: 520, margin: '2.75rem auto 1.5rem', color: '#94a3b8' }}>
          <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em' }}>HOẶC ĐỖ THEO LƯỢT</span>
          <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        </div>

        <p className={styles.pricingNote} style={{ marginTop: 0 }}>
          Chỉ đỗ một lần? Trả theo lượt, không cần tài khoản — tính phí theo thời gian thực.
        </p>
        <div className={styles.cardGrid2} style={{ maxWidth: 460, margin: '0 auto' }}>
          <div className={styles.casualCard}>
            <div className={styles.casualIcon}>
              {vtype === 'CAR' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2" ry="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M5 17H3V9h12l3 8h2"/><path d="M15 9h2l2 4-1 4H11"/></svg>
              )}
            </div>
            <h3 className={styles.casualTitle}>{casual.title} — vãng lai</h3>
            <div className={styles.casualTimeBlocks}>
              {casual.blocks.map(b => (
                <div key={b.label} className={`${styles.timeBlock} ${b.isNight ? styles.timeBlockNight : ''}`}>
                  <div className={styles.timeBlockLeft}>
                    <span className={styles.timeBlockLabel}>{b.label}</span>
                    <span className={styles.timeBlockHours}>{b.hours}</span>
                  </div>
                  <span className={styles.timeBlockPrice}>{b.price}</span>
                  <span className={styles.timeBlockUnit}>{b.unit}</span>
                </div>
              ))}
            </div>
            <button className={styles.casualBtn} onClick={onBooking}>Đặt chỗ ngay</button>
          </div>
        </div>
        <p className={styles.casualFootnote}>Quá giờ được tính theo block tiếp theo. Vé bị mất: phí 500.000đ.</p>
      </div>
    </section>
  );
}

function PricingCard({ title, duration, price, perDay, perks, icon, featured, saving, onClick }: {
  title: string; duration: string; price: string; perDay: string; perks: string[];
  icon: string; featured?: boolean; saving?: string; onClick: () => void;
}) {
  const icons: Record<string, React.ReactNode> = {
    calendar: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    check: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
    star: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  };
  return (
    <div className={`${styles.pricingCard} ${featured ? styles.pricingCardFeatured : ''}`}>
      {featured && <div className={styles.pricingBadge}>Tiết kiệm hơn</div>}
      <div className={styles.pricingIcon}>{icons[icon]}</div>
      <div className={styles.pricingHeader}><span className={styles.pricingTier}>{title}</span></div>
      <div className={styles.pricingDuration}>{duration}</div>
      <div className={styles.pricingPrice}>{price}</div>
      <div className={styles.pricingPerDay}>{perDay}</div>
      {saving && <div className={styles.savingTag}>{saving}</div>}
      <ul className={styles.pricingPerks}>{perks.map(p => <li key={p}>{p}</li>)}</ul>
      <button className={`${styles.pricingBtn} ${featured ? styles.pricingBtnFeatured : ''}`} onClick={onClick}>Chọn gói</button>
    </div>
  );
}

function Footer({ navigate }: { navigate: (path: string) => void }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <div className={styles.logo} onClick={() => navigate('/')}>
            <img src="/logo.png" alt="ParkSmart Logo" className={styles.logoImg} />
            <span className={`${styles.logoText} ${styles.logoTextFooter}`}>Park<span className={styles.logoTextAccent}>Smart</span></span>
          </div>
          <p className={styles.footerTagline}>Giải pháp đỗ xe thông minh &amp; tối ưu.</p>
        </div>
        <div className={styles.footerLinks}>
          <div className={styles.footerCol}><span className={styles.footerColTitle}>Sản phẩm</span><span>Đặt chỗ</span><span>Check-in QR</span><span>Báo cáo</span></div>
          <div className={styles.footerCol}><span className={styles.footerColTitle}>Công ty</span><span>Giới thiệu</span><span>Tuyển dụng</span><span>Liên hệ</span></div>
          <div className={styles.footerCol}><span className={styles.footerColTitle}>Hỗ trợ</span><span>Trung tâm trợ giúp</span><span>Câu hỏi thường gặp</span><span>Liên hệ</span></div>
        </div>
      </div>
      <div className={styles.footerBottom}>&copy; 2026 ParkSmart Vietnam</div>
    </footer>
  );
}
