import React, { useState, useEffect } from 'react';
import { useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PackagePurchaseModal } from '../components/PackagePurchaseModal';
import {
  HomeIcon,
  CalendarIcon,
  LayoutIcon,
  HistoryIcon,
  ShoppingBagIcon,
} from '../components/ui/Icons';
import { getCurrentSession, getMyPackage, CurrentSession } from '../api/driverDashboardApi';
import { addVehicle } from '../api/vehicleApi';
import { getPublicAvailability, type AvailabilityData } from '../api/publicApi';
import { ProfilePage } from './Profile';
import { HistoryPage } from './History';
import { MyVehiclePage } from './MyVehicle';
import { MonthlyPackagePage } from './MonthlyPackage';
import { BookingPage } from './Booking';
import { FloorMapPage } from './FloorMap';
import { BookingModal, BookingSuccess } from '../components/BookingModal';
import type { Floor } from '../types/index';
import { PACKAGES, CASUAL_PRICING, type VType } from '../constants/packages';
import styles from '../styles/welcome.module.css';
import motorbikeWatermark from '../assets/motorbike-watermark.png';
import carWatermark from '../assets/car-watermark.png';

type Tab = 'home' | 'vehicles' | 'profile' | 'history' | 'monthly' | 'booking' | 'floormap';

type VehicleType = 'CAR' | 'MOTORBIKE';

const VEHICLE_PROFILE_OPTIONS: Record<VehicleType, { brands: { label: string; models: string[] }[] }> = {
  CAR: {
    brands: [
      { label: 'Toyota', models: ['Vios', 'Corolla Cross', 'Camry', 'Fortuner', 'Innova', 'Veloz Cross'] },
      { label: 'Honda', models: ['City', 'Civic', 'CR-V', 'HR-V', 'Accord'] },
      { label: 'Hyundai', models: ['Accent', 'Elantra', 'Tucson', 'Santa Fe', 'Creta'] },
      { label: 'Kia', models: ['Morning', 'K3', 'Seltos', 'Sonet', 'Carnival'] },
      { label: 'Mazda', models: ['Mazda 2', 'Mazda 3', 'CX-5', 'CX-8', 'BT-50'] },
      { label: 'Ford', models: ['Ranger', 'Everest', 'Territory', 'EcoSport'] },
      { label: 'VinFast', models: ['VF 3', 'VF 5', 'VF 6', 'VF 7', 'VF 8', 'VF 9'] },
    ],
  },
  MOTORBIKE: {
    brands: [
      { label: 'Honda', models: ['Wave Alpha', 'Vision', 'Air Blade', 'Lead', 'SH Mode', 'SH'] },
      { label: 'Yamaha', models: ['Sirius', 'Jupiter', 'Grande', 'Janus', 'Exciter', 'NVX'] },
      { label: 'Suzuki', models: ['Raider', 'Satria', 'Address', 'Burgman Street'] },
      { label: 'Piaggio', models: ['Vespa Sprint', 'Vespa Primavera', 'Liberty', 'Medley'] },
      { label: 'SYM', models: ['Attila', 'Galaxy', 'Elite', 'Husky'] },
      { label: 'VinFast', models: ['Klara', 'Feliz', 'Evo200', 'Vento', 'Theon'] },
    ],
  },
};

const VEHICLE_COLORS = ['Trắng', 'Đen', 'Bạc', 'Xám', 'Đỏ', 'Xanh dương', 'Xanh lá', 'Vàng', 'Nâu', 'Cam'];
const VEHICLE_YEARS = Array.from({ length: new Date().getFullYear() - 1989 }, (_, index) => new Date().getFullYear() - index);

// ── Component ──────────────────────────────────────────────
export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchasePlanId, setPurchasePlanId] = useState('');
  const [purchaseVtype, setPurchaseVtype] = useState<'CAR' | 'MOTORBIKE'>('CAR');

  useEffect(() => {
    const state = location.state as { reopenPlanId?: string; reopenVtype?: 'CAR' | 'MOTORBIKE' } | null;
    if (state?.reopenPlanId && state?.reopenVtype && user) {
      setPurchasePlanId(state.reopenPlanId);
      setPurchaseVtype(state.reopenVtype);
      setPurchaseModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location, user]);

  const handleSelectPackage = (planId: string, vtype: 'CAR' | 'MOTORBIKE') => {
    if (!user) {
      navigate('/login', {
        state: {
          redirectFrom: '/',
          selectedPlanId: planId,
          selectedVtype: vtype
        }
      });
    } else {
      setPurchasePlanId(planId);
      setPurchaseVtype(vtype);
      setPurchaseModalOpen(true);
    }
  };

  // ── User type detection ──────────────────────────────────
  // All users stay on the Welcome page (including monthly customers) — no redirect.
  const [pkgLoading, setPkgLoading] = useState(true);
  const [hasPackage, setHasPackage] = useState(false); // true = has ACTIVE non-expired package

  useEffect(() => {
    if (!user) { setPkgLoading(false); return; }
    getMyPackage().then(pkg => {
      // Active-package condition: status MUST be ACTIVE and expiry MUST be in the future.
      // !!pkg alone is wrong — an expired/cancelled package is also truthy.
      if (!pkg) {
        setHasPackage(false);
      } else {
        const expiryTime = new Date(pkg.expiryDate).getTime();
        const isActive =
          pkg.status === 'ACTIVE' &&
          Number.isFinite(expiryTime) &&
          expiryTime > Date.now();
        setHasPackage(isActive);
      }
      setPkgLoading(false);
    }).catch(() => { setHasPackage(false); setPkgLoading(false); });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live availability for the public StatusStrip ────────────────
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [availLoading, setAvailLoading] = useState(true);
  const [availError, setAvailError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAvailLoading(true);
    setAvailError(false);
    getPublicAvailability()
      .then((data) => {
        if (cancelled) return;
        setAvailability(data);
        setAvailLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAvailError(true);
        setAvailLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Tab state (casual users only) ─────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = sessionStorage.getItem('welcomeActiveTab');
    const valid: Tab[] = ['home', 'vehicles', 'profile', 'history', 'monthly', 'booking', 'floormap'];
    return saved && valid.includes(saved as Tab) ? (saved as Tab) : 'home';
  });
  const [session, setSession] = useState<CurrentSession | null>(null);

  // ── Support Modal & FAQ states ────────────────────────────
  const [activeSupportTab, setActiveSupportTab] = useState<'help' | 'faq' | 'contact' | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', email: '', subject: 'Sự cố thanh toán', message: '' });
  const [isContactSubmitted, setIsContactSubmitted] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);

  // ── Booking modal state ─────────────────────────────────────
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<{ bookingId: string; areaName: string } | null>(null);

  useEffect(() => {
    sessionStorage.setItem('welcomeActiveTab', activeTab);
  }, [activeTab]);

  const handleBookingSuccess = (floor: Floor, bookingId: string) => {
    setBookingOpen(false);
    setBookingSuccess({ bookingId, areaName: floor.name });
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
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 9.21v3z" /></svg>
                    <span>Hotline 24/7</span>
                  </div>
                  <div className={styles.helpCardContent}>
                    <p style={{ fontWeight: 600, color: '#16293f', fontSize: '1.1rem', margin: '0.2rem 0' }}>1900 6868</p>
                    <p>Hỗ trợ khẩn cấp, giải quyết sự cố ra vào bãi và lỗi thanh toán mọi lúc mọi nơi.</p>
                  </div>
                </div>

                <div className={styles.helpCard}>
                  <div className={styles.helpCardTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                    <span>Hỗ trợ qua Email</span>
                  </div>
                  <div className={styles.helpCardContent}>
                    <p style={{ fontWeight: 600, color: '#16293f', fontSize: '1rem', margin: '0.2rem 0' }}>support@parksmart.vn</p>
                    <p>Tiếp nhận các phản hồi, đề xuất, yêu cầu hóa đơn hoặc đăng ký gói tháng cho doanh nghiệp.</p>
                  </div>
                </div>

                <div className={styles.helpCard}>
                  <div className={styles.helpCardTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                    <span>Thời gian phục vụ</span>
                  </div>
                  <div className={styles.helpCardContent}>
                    <p style={{ fontWeight: 600, color: '#16293f', margin: '0.2rem 0' }}>Thứ 2 - Chủ Nhật</p>
                    <p>Mở cửa phục vụ liên tục 24 giờ mỗi ngày, kể cả các ngày lễ Tết.</p>
                  </div>
                </div>

                <div className={styles.helpCard}>
                  <div className={styles.helpCardTitle}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d5fd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
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
                    a: "Hãy liên hệ ngay với nhân viên Staff tại bốt trực cổng ra hoặc phòng điều hành tầng B1. Phí đền bù mất thẻ là 80.000đ cho xe máy và 200.000đ cho ô tô, cộng thêm phí đỗ xe thực tế tính từ thời điểm xe check-in vào bãi dựa trên lịch sử ghi nhận camera."
                  },
                  {
                    q: "Hệ thống hỗ trợ những phương thức thanh toán nào?",
                    a: "ParkSmart hỗ trợ các hình thức thanh toán đa dạng bao gồm: tiền mặt trực tiếp tại quầy, quẹt thẻ ngân hàng (ATM/Visa/Mastercard), hoặc quét mã QR thanh toán qua MoMo, ZaloPay, VNPAY."
                  },
                  {
                    q: "Tôi mua vé tháng có được đỗ vị trí cố định không?",
                    a: "Gói tháng cấp quyền sử dụng tầng và phân hạng tương ứng. Khách hàng không sở hữu một ô đỗ cố định và có thể đỗ tại vị trí còn trống bất kỳ trong khu vực được phân bổ."
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
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
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
                      <option value="Gói tháng">Gói tháng</option>
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
  const [newBrand, setNewBrand] = useState(VEHICLE_PROFILE_OPTIONS.CAR.brands[0].label);
  const [newModel, setNewModel] = useState(VEHICLE_PROFILE_OPTIONS.CAR.brands[0].models[0]);
  const [newColor, setNewColor] = useState(VEHICLE_COLORS[0]);
  const [newYear, setNewYear] = useState<number | null>(VEHICLE_YEARS[0]);

  const availableBrands = VEHICLE_PROFILE_OPTIONS[newType].brands;
  const availableModels = availableBrands.find((brand) => brand.label === newBrand)?.models ?? availableBrands[0].models;

  useEffect(() => {
    const selectedBrand = VEHICLE_PROFILE_OPTIONS[newType].brands.find((item) => item.label === newBrand);
    if (!selectedBrand) {
      const defaultBrand = VEHICLE_PROFILE_OPTIONS[newType].brands[0];
      setNewBrand(defaultBrand.label);
      setNewModel(defaultBrand.models[0]);
      return;
    }

    if (!selectedBrand.models.includes(newModel)) {
      setNewModel(selectedBrand.models[0]);
    }
  }, [newType, newBrand]);

  // ── Fetch session (casual users only) ────────────────────
  useEffect(() => {
    if (!user || hasPackage || pkgLoading) return;
    getCurrentSession().then(setSession);
  }, [user, hasPackage, pkgLoading]);

  // ── Add vehicle ──────────────────────────────────────────
  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const plate = newPlate.trim().toUpperCase();
    if (!plate) return;

    // Ensure required fields are not empty strings (some APIs treat "" as invalid)
    const payload = {
      plateNumber: plate,
      type: newType,
      brand: newBrand || undefined,
      model: newModel || undefined,
      color: newColor || undefined,
      year: newYear ?? undefined,
    };

    setAddLoading(true);
    setAddError('');
    try {
      await addVehicle(payload);
      setShowAddVehicle(false);
      setNewPlate('');
      setNewType('CAR');

      // Reset using a valid default (avoid empty-string state that can break select rendering)
      const defaultCarBrand = VEHICLE_PROFILE_OPTIONS.CAR.brands[0];
      setNewBrand(defaultCarBrand.label);
      setNewModel(defaultCarBrand.models[0]);
      setNewColor(VEHICLE_COLORS[0]);
      setNewYear(VEHICLE_YEARS[0]);
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

        <HeroSection />
        <StatusStrip
          availability={availability}
          availLoading={availLoading}
          availError={availError}
        />
        <GuestBannerSection />
        <ProcessSection />
        <FeaturesSection />
        <PricingSection navigate={navigate} onSelectPackage={handleSelectPackage} />
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
            areaName={bookingSuccess.areaName}
            onClose={() => setBookingSuccess(null)}
          />
        )}
        <PackagePurchaseModal
          isOpen={purchaseModalOpen}
          onClose={() => setPurchaseModalOpen(false)}
          planId={purchasePlanId}
          vehicleType={purchaseVtype}
        />
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
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `${styles.tabBtn} ${(isActive && activeTab === 'home') ? styles.tabBtnActive : ''}`
              }
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('home');
              }}
            >
              <HomeIcon size={16} />
              <span>Trang chủ</span>
            </NavLink>
            <NavLink
              to="/my-vehicle"
              className={() =>
                `${styles.tabBtn} ${activeTab === 'vehicles' ? styles.tabBtnActive : ''}`
              }
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('vehicles');
              }}
            >
              <span className={styles.navCarIconBox}>
                <img
                  src="/oto.png"
                  alt=""
                  aria-hidden="true"
                  className={`${styles.navCarIcon} ${activeTab === 'vehicles' ? styles.navCarIconActive : styles.navCarIconInactive}`}
                />
              </span>
              <span>Xe của bạn</span>
            </NavLink>
            <NavLink
              to="/history"
              className={() =>
                `${styles.tabBtn} ${activeTab === 'history' ? styles.tabBtnActive : ''}`
              }
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('history');
              }}
            >
              <HistoryIcon size={16} />
              <span>Lịch sử</span>
            </NavLink>
            {/* "Gói tháng" tab: only rendered when user has an active, non-expired monthly package */}
            {!pkgLoading && hasPackage && (
              <NavLink
                to="/monthly-package"
                className={() =>
                  `${styles.tabBtn} ${activeTab === 'monthly' ? styles.tabBtnActive : ''}`
                }
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('monthly');
                }}
              >
                <ShoppingBagIcon size={16} />
                <span>Gói tháng</span>
              </NavLink>
            )}
            <NavLink
              to="/booking"
              className={() =>
                `${styles.tabBtn} ${activeTab === 'booking' ? styles.tabBtnActive : ''}`
              }
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('booking');
              }}
            >
              <CalendarIcon size={16} />
              <span>Đặt chỗ</span>
            </NavLink>
            {/* "Sơ đồ tầng" tab: only rendered when user has an active, non-expired monthly package */}
            {!pkgLoading && hasPackage && (
              <NavLink
                to="/floor-map"
                className={() =>
                  `${styles.tabBtn} ${activeTab === 'floormap' ? styles.tabBtnActive : ''}`
                }
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('floormap');
                }}
              >
                <LayoutIcon size={16} />
                <span>Sơ đồ tầng</span>
              </NavLink>
            )}
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

            {/* Vertical Divider */}
            <div className={styles.navDivider}></div>

            <div className={styles.supportDropdownContainer}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <div style={{ position: 'relative', flexShrink: 0, display: 'flex', overflow: 'visible' }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: '#2d5fd0', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.9rem',
                    boxShadow: hasPackage ? '0 0 0 2px #fff, 0 0 0 4px #e6b422' : 'none',
                  }}>
                    {user.avatarUrl
                      ? <img src={user.avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      : user.fullName.trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase()}
                  </div>
                  {hasPackage && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#f0b429" stroke="#b8860b" strokeWidth="0.6"
                      style={{ position: 'absolute', top: -7, right: -7, transform: 'rotate(28deg)', zIndex: 3 }}>
                      <path d="M3 7l4 4 5-7 5 7 4-4-1.5 11h-15L3 7z" />
                      <circle cx="3" cy="7" r="1.4" /><circle cx="21" cy="7" r="1.4" /><circle cx="12" cy="4" r="1.4" />
                    </svg>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.3, gap: 2 }}>
                  <span className={styles.userGreeting} style={{ fontWeight: 600 }}>{user.fullName}</span>
                  {hasPackage && (
                    <span style={{
                      alignSelf: 'flex-start',
                      fontSize: '0.66rem', fontWeight: 700,
                      color: '#9a7400', background: '#fdf4d8',
                      border: '1px solid #f0dca0',
                      padding: '1px 7px', borderRadius: 999,
                      letterSpacing: '0.02em',
                    }}>Cư dân</span>
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
          <HeroLoggedIn user={user} session={session} hasPackage={hasPackage} />
          <StatusStrip
            availability={availability}
            availLoading={availLoading}
            availError={availError}
          />
          <GuestBannerSection />
          <ProcessSection />
          <FeaturesSection />
          <PricingSection navigate={navigate} onSelectPackage={handleSelectPackage} />
        </>
      ) : activeTab === 'vehicles' ? (
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '44px 24px' }}>
          <MyVehiclePage />
        </div>
      ) : null}

      {activeTab === 'profile' && (
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '44px 24px' }}>
          <ProfilePage />
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '44px 24px' }}>
          <HistoryPage />
        </div>
      )}

      {activeTab === 'monthly' && (
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '44px 24px' }}>
          <MonthlyPackagePage onAddVehicle={() => setActiveTab('vehicles')} />
        </div>
      )}

      {activeTab === 'booking' && (
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '44px 24px' }}>
          <BookingPage />
        </div>
      )}

      {activeTab === 'floormap' && (
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '44px 24px' }}>
          {hasPackage ? (
            <FloorMapPage />
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem' }}>Tính năng dành cho khách gói tháng</h2>
              <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Sơ đồ tầng chỉ áp dụng cho khách đã đăng ký gói tháng. Vui lòng mua gói tháng để sử dụng.</p>
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <form onSubmit={handleAddVehicle} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Biển số xe</label>
                <input
                  className={styles.formInput}
                  placeholder="VD: 30A-123.45"
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value)}
                  maxLength={20}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Hãng</label>
                <select className={styles.formSelect} value={newBrand} onChange={(e) => setNewBrand(e.target.value)} required>
                  {availableBrands.map((brand) => (
                    <option key={brand.label} value={brand.label}>{brand.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Mẫu</label>
                <select className={styles.formSelect} value={newModel} onChange={(e) => setNewModel(e.target.value)} required>
                  {availableModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Màu</label>
                <select className={styles.formSelect} value={newColor} onChange={(e) => setNewColor(e.target.value)} required>
                  {VEHICLE_COLORS.map((color) => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Năm</label>
                <select className={styles.formSelect} value={newYear?.toString() ?? ''} onChange={(e) => setNewYear(Number(e.target.value))} required>
                  {VEHICLE_YEARS.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Loại xe</label>
                <div className={styles.typeSelector}>
                  <button type="button" className={`${styles.typeOption} ${newType === 'CAR' ? styles.typeOptionActive : ''}`} onClick={() => setNewType('CAR')} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ color: '#3B82F6', display: 'flex', alignItems: 'center' }}><CarIconFilled size={18} /></span>
                    XE HƠI
                  </button>
                  <button type="button" className={`${styles.typeOption} ${newType === 'MOTORBIKE' ? styles.typeOptionActive : ''}`} onClick={() => setNewType('MOTORBIKE')} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ color: '#F97316', display: 'flex', alignItems: 'center' }}><MotorbikeIcon size={18} /></span>
                    XE MÁY
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
        onRedirectToVehicles={() => setActiveTab('vehicles')}
      />
      {bookingSuccess && (
        <BookingSuccess
          bookingId={bookingSuccess.bookingId}
          areaName={bookingSuccess.areaName}
          onClose={() => setBookingSuccess(null)}
        />
      )}
      <PackagePurchaseModal
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        planId={purchasePlanId}
        vehicleType={purchaseVtype}
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function HeroSection() {
  return (
    <section className={styles.hero}>
      {/* Decorative Circles */}
      <div className={styles.circleDeco1} aria-hidden="true" />
      <div className={styles.circleDeco2} aria-hidden="true" />
      <div className={styles.circleDeco3} aria-hidden="true" />
      {/* Hero background image — absolute layer */}
      <div className={styles.heroImageLayer} aria-hidden="true">
        <img src="/Parking.png" alt="" className={styles.heroImage} />
      </div>
      <div className={styles.heroInner}>
        <div className={styles.heroLeft}>
          <h1 className={styles.heroTitle}>
            ParkSmart – Đỗ xe thông minh, cuộc sống thuận tiện
          </h1>
          <p className={styles.heroSubtitle}>
            Quản lý xe, đặt chỗ nhanh chóng và theo dõi lịch sử chỉ với vài thao tác. Tất cả trong một nền tảng duy nhất.
          </p>
          <div className={styles.heroHighlights}>
            <div className={styles.heroHighlightBlock}>
              <div className={styles.heroHighlightIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
              </div>
              <div className={styles.heroHighlightContent}>
                <h3 className={styles.heroHighlightTitle}>Quản lý xe</h3>
                <p className={styles.heroHighlightDesc}>Thêm và quản lý phương tiện</p>
              </div>
            </div>
            <div className={styles.heroHighlightBlock}>
              <div className={styles.heroHighlightIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <div className={styles.heroHighlightContent}>
                <h3 className={styles.heroHighlightTitle}>Giữ chỗ nhanh</h3>
                <p className={styles.heroHighlightDesc}>Giữ chỗ đỗ trước chỉ với vài thao tác đơn giản.</p>
              </div>
            </div>
            <div className={styles.heroHighlightBlock}>
              <div className={styles.heroHighlightIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div className={styles.heroHighlightContent}>
                <h3 className={styles.heroHighlightTitle}>An toàn & tin cậy</h3>
                <p className={styles.heroHighlightDesc}>Bảo mật thông tin, yên tâm sử dụng</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Guest walk-in banner — shown on landing page for quick access ──────────
function GuestBannerSection() {
  return (
    <section style={{
      background: 'linear-gradient(135deg, #0B2F6B 0%, #1F5EFF 100%)',
      padding: '3rem 1.5rem',
    }}>
      <div style={{
        maxWidth: 1100,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '2rem',
        flexWrap: 'wrap',
      }}>
        {/* Left: info */}
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 999,
            padding: '4px 14px',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: '#93C5FD',
            letterSpacing: '0.04em',
            marginBottom: '0.85rem',
          }}>
            <img src="/logo.png" alt="ParkSmart Logo" style={{ width: 16, height: 16, objectFit: 'contain' }} />
            KHÁCH VÃNG LAI
          </div>
          <h2 style={{
            margin: '0 0 0.65rem',
            fontSize: 'clamp(1.35rem, 3vw, 1.75rem)',
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.2,
          }}>
            Gửi xe ngay — không cần đăng ký
          </h2>
          <p style={{
            margin: 0,
            fontSize: '0.95rem',
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.6,
            maxWidth: 480,
          }}>
            Chỉ cần biển số xe và số điện thoại. Chọn vị trí đỗ, nhận xác nhận ngay lập tức — không cần tài khoản.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: '1.1rem' }}>
            {[
              { icon: '⚡', text: 'Xử lý trong 30 giây' },
              { icon: '🚗', text: 'Ô tô & Xe máy' },
              { icon: '💰', text: 'Trả phí khi ra xe' },
            ].map(item => (
              <span key={item.text} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 999,
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#E0EAFF',
              }}>
                <span>{item.icon}</span>
                {item.text}
              </span>
            ))}
          </div>
        </div>

        {/* Right: CTA card */}
        <div style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.18)',
          backdropFilter: 'blur(12px)',
          borderRadius: 20,
          padding: '1.75rem 1.75rem',
          minWidth: 260,
          maxWidth: 320,
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <img src="/logo.png" alt="ParkSmart Logo" style={{ width: 42, height: 42, objectFit: 'contain' }} />
            <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
              Park<span style={{ color: '#93C5FD' }}>Smart</span>
            </span>
          </div>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.88rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
            Bấm vào đây để gửi xe ngay bây giờ. Hoàn tất chỉ trong vài bước.
          </p>
          <a
            href="/guest-parking"
            style={{
              display: 'block',
              width: '100%',
              padding: '0.85rem 1.5rem',
              background: '#FFFFFF',
              color: '#0B2F6B',
              borderRadius: 12,
              fontSize: '1rem',
              fontWeight: 800,
              textDecoration: 'none',
              boxSizing: 'border-box',
              transition: 'all 0.15s',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#E8EEFF'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#FFFFFF'; }}
          >
            🚀 Gửi xe ngay
          </a>
          <a
            href="/guest-parking"
            style={{
              display: 'block',
              marginTop: '0.6rem',
              padding: '0.65rem 1.5rem',
              background: 'transparent',
              color: 'rgba(255,255,255,0.75)',
              borderRadius: 12,
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.25)',
              boxSizing: 'border-box',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.55)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.25)'; }}
          >
            🔍 Tra cứu phí ra xe
          </a>
        </div>
      </div>
    </section>
  );
}
function HeroLoggedIn({
  user,
  session,
  hasPackage,
}: {
  user: { fullName: string; email: string };
  session: CurrentSession | null;
  hasPackage: boolean;
}) {
  const isLoggedIn = Boolean(user);
  const userName = user?.fullName || user?.email;
  const currentHour = new Date().getHours();
  const isMorning = currentHour >= 5 && currentHour < 12;
  const isAfternoon = currentHour >= 12 && currentHour < 18;

  const greetingTitle =
    isMorning
      ? 'Chào buổi sáng'
      : isAfternoon
        ? 'Chào buổi chiều'
        : 'Chào buổi tối';

  const heroContent = {
    title: isLoggedIn && userName ? `${greetingTitle}, ${userName}` : greetingTitle,
    description: isMorning
      ? 'Chúc bạn khởi đầu ngày mới thuận lợi và di chuyển an toàn cùng ParkSmart.'
      : isAfternoon
        ? 'ParkSmart luôn sẵn sàng hỗ trợ bạn quản lý xe và đặt chỗ nhanh chóng.'
        : 'Chúc bạn lái xe an toàn và có một hành trình về nhà thật thuận lợi.',
  };

  const hasActiveMonthlyPackage = hasPackage;

  return (
    <section className={styles.hero}>
      {/* Decorative Circles */}
      <div className={styles.circleDeco1} aria-hidden="true" />
      <div className={styles.circleDeco2} aria-hidden="true" />
      <div className={styles.circleDeco3} aria-hidden="true" />
      {/* Hero background image — absolute layer */}
      <div className={styles.heroImageLayer} aria-hidden="true">
        <img src="/Parking.png" alt="" className={styles.heroImage} />
      </div>
      <div className={styles.heroInner}>
        <div className={styles.heroLeft}>
          {(hasActiveMonthlyPackage || session) && (
            <div className={styles.welcomePillContainer}>
              {hasActiveMonthlyPackage && (
                <span className={styles.heroStatusBadge} style={{ background: 'rgba(234, 179, 8, 0.18)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#fef08a' }}>
                  🏠 Cư dân ParkSmart
                </span>
              )}
              {session && (
                <span className={styles.heroStatusBadge}>🚗 Đang đỗ: {session.slotCode}</span>
              )}
            </div>
          )}
          <h1 className={styles.heroTitle}>
            {heroContent.title}
          </h1>
          <p className={styles.heroSubtitle}>
            {session
              ? `Xe ${session.plateNumber} đang đỗ tại ${session.slotCode} · ${session.floor}. Phí ước tính: ${formatCurrencyInline(session.estimatedAmount ?? 0)}.`
              : heroContent.description}
          </p>
          <div className={styles.heroHighlights}>
            <div className={styles.heroHighlightBlock}>
              <div className={styles.heroHighlightIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
              </div>
              <div className={styles.heroHighlightContent}>
                <h3 className={styles.heroHighlightTitle}>Quản lý xe</h3>
                <p className={styles.heroHighlightDesc}>Thêm và quản lý phương tiện</p>
              </div>
            </div>
            <div className={styles.heroHighlightBlock}>
              <div className={styles.heroHighlightIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <div className={styles.heroHighlightContent}>
                <h3 className={styles.heroHighlightTitle}>Giữ chỗ nhanh</h3>
                <p className={styles.heroHighlightDesc}>Giữ chỗ đỗ trước chỉ với vài thao tác đơn giản.</p>
              </div>
            </div>
            <div className={styles.heroHighlightBlock}>
              <div className={styles.heroHighlightIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div className={styles.heroHighlightContent}>
                <h3 className={styles.heroHighlightTitle}>An toàn & tin cậy</h3>
                <p className={styles.heroHighlightDesc}>Bảo mật thông tin, yên tâm sử dụng</p>
              </div>
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
    <section className={styles.featuresSection}>
      <div className={styles.sectionInner}>
        <span className={styles.eyebrow}>Vì sao chọn ParkSmart</span>
        <h2 className={styles.sectionTitle}>Đỗ xe thông minh, tiện cho bạn</h2>
        <div className={styles.cardGrid3}>
          <FeatureCard
            icon={<span style={{ fontSize: '1.6rem', lineHeight: 1 }}>⏱️</span>}
            title="Tiết kiệm thời gian"
            desc="Luôn có chỗ sẵn khi bạn đến — không vòng vòng tìm chỗ, không chờ đợi giờ cao điểm."
          />
          <FeatureCard
            icon={<span style={{ fontSize: '1.6rem', lineHeight: 1 }}>💳</span>}
            title="Chi phí minh bạch"
            desc="Phí tính tự động theo thời gian thực tế, hiển thị rõ ràng, không lo tính sai."
          />
          <FeatureCard
            icon={<span style={{ fontSize: '1.6rem', lineHeight: 1 }}>🛡️</span>}
            title="An tâm & an toàn"
            desc="Bãi có mái che, khu vực riêng cho ô tô và xe máy, chỗ đỗ luôn ổn định."
          />
        </div>
      </div>
    </section>
  );
}


function StatusStrip({
  availability,
  availLoading,
  availError,
}: {
  availability: AvailabilityData | null;
  availLoading: boolean;
  availError: boolean;
}) {
  const ZoneStat = ({ available, total, label }: { available: number; total: number; label: string }) => {
    const full = available <= 0;
    return (
      <span className={styles.zoneStat}>
        <span className={`${styles.liveDot} ${full ? styles.liveDotFull : ''}`} aria-hidden="true" />
        {label} {available}/{total}
      </span>
    );
  };

  const ZoneValue = ({ zone }: { zone: { car: { available: number; total: number }; motorbike: { available: number; total: number } } | undefined }) => {
    if (availLoading) return <span className={styles.statusStripValue}>Đang tải...</span>;
    if (availError || !zone) return <span className={styles.statusStripValue}>—</span>;
    return (
      <span className={`${styles.statusStripValue} ${styles.zoneValueWrap}`}>
        <ZoneStat available={zone.car.available} total={zone.car.total} label="Ô tô" />
        <ZoneStat available={zone.motorbike.available} total={zone.motorbike.total} label="Xe máy" />
      </span>
    );
  };

  const items: { emoji: string; label: string; render: () => React.ReactNode }[] = [
    { emoji: '🕐', label: 'Giờ mở cửa', render: () => <span className={styles.statusStripValue}>Hoạt động 24/7</span> },
    { emoji: '🛡️', label: 'Tiện ích', render: () => <span className={styles.statusStripValue}>Mái che · Camera 24/7</span> },
    { emoji: '🅿️', label: 'Khu vãng lai', render: () => <ZoneValue zone={availability?.casual} /> },
    { emoji: '📅', label: 'Khu gói tháng', render: () => <ZoneValue zone={availability?.monthly} /> },
  ];
  return (
    <div className={styles.statusStrip}>
      <div className={styles.statusStripInner}>
        {items.map(item => (
          <div key={item.label} className={styles.statusStripItem}>
            <span className={styles.statusStripEmoji}>{item.emoji}</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className={styles.statusStripLabel}>{item.label}</span>
              {item.render()}
            </div>
          </div>
        ))}
      </div>
    </div>
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

function PricingSection({ navigate, onSelectPackage }: { navigate: (path: string) => void; onSelectPackage?: (planId: string, vtype: VType) => void }) {
  const [vtype, setVtype] = useState<VType>('MOTORBIKE');
  const handleSelect = (planId: string, planVtype: VType) => {
    if (onSelectPackage) {
      onSelectPackage(planId, planVtype);
    } else {
      navigate('/monthly-package');
    }
  };
  return (
    <section id="pricing" className={styles.section}>
      <div className={styles.sectionInner}>
        <div style={{ textAlign: 'center' }}>
          <span className={styles.eyebrow}>Bảng giá</span>
          <h2 className={styles.sectionTitle}>Đỗ một lần, hay đỗ thường xuyên?</h2>
          <p className={styles.pricingNote} style={{ marginTop: '0.75rem', maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
            Chỉ đỗ một lần? Trả theo lượt, không cần tài khoản — tính phí theo thời gian thực.
          </p>
        </div>

        {/* ── Unified Casual Pricing Table: Xe máy | Ô tô ── */}
        <div className={styles.casualTableGrid}>
          {/* Xe máy column */}
          <div
            className={`${styles.casualTableCol} ${vtype === 'MOTORBIKE' ? styles.casualTableColActive : styles.casualTableColInactive}`}
            onClick={() => setVtype('MOTORBIKE')}
          >
            <div className={styles.casualTableColHead}>
              <span className={styles.casualTableEmoji} aria-hidden="true">🛵</span>
              <span>Xe máy</span>
            </div>
            <div className={styles.casualTableRows}>
              {CASUAL_PRICING.MOTORBIKE.blocks.map((b) => (
                <div key={b.label} className={styles.casualTableRow}>
                  <div className={styles.casualTableRowLeft}>
                    <div className={styles.casualTableLabel}>{b.label}</div>
                    <div className={styles.casualTableHours}>{b.hours}</div>
                  </div>
                  <div className={styles.casualTableRowRight}>
                    <span className={styles.casualTablePriceVal}>{b.price}</span>
                    <span className={styles.casualTablePriceUnit}>{b.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ô tô column */}
          <div
            className={`${styles.casualTableCol} ${vtype === 'CAR' ? styles.casualTableColActive : styles.casualTableColInactive}`}
            onClick={() => setVtype('CAR')}
          >
            <div className={styles.casualTableColHead}>
              <span className={styles.casualTableEmoji} aria-hidden="true">🚗</span>
              <span>Ô tô</span>
            </div>
            <div className={styles.casualTableRows}>
              {CASUAL_PRICING.CAR.blocks.map((b) => (
                <div key={b.label} className={`${styles.casualTableRow} ${b.isNight ? styles.casualTableRowNight : ''}`}>
                  <div className={styles.casualTableRowLeft}>
                    <div className={styles.casualTableLabel}>{b.label}</div>
                    <div className={styles.casualTableHours}>{b.hours}</div>
                  </div>
                  <div className={styles.casualTableRowRight}>
                    <span className={styles.casualTablePriceVal}>{b.price}</span>
                    <span className={styles.casualTablePriceUnit}>{b.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className={styles.casualFooterNote}>
          Vé bị mất: xe máy 80.000đ · ô tô 200.000đ
        </p>


        <h3 className={styles.sectionSubtitle}>Đỗ thường xuyên? Tiết kiệm với gói tháng</h3>

        <div className={styles.pricingWrapper}>
          {/* ── Gói Xe máy (top, blue) ─────────────────────── */}
          <PricingGroup
            vtype="MOTORBIKE"
            onClickCard={handleSelect}
          />

          {/* ── Gói Ô tô (bottom, green) ───────────────────── */}
          <PricingGroup
            vtype="CAR"
            onClickCard={handleSelect}
          />
        </div>
      </div>
    </section>
  );
}

// ── Perk icon helper ─────────────────────────────────────
function PerkIcon({ name, color }: { name: string; color: string }) {
  const commonProps = {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (name) {
    case 'parking':
      return (
        <svg {...commonProps}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="17" x2="9" y2="7" />
          <path d="M9 7h4a3 3 0 0 1 0 6H9" />
        </svg>
      );
    case 'checklist':
      return (
        <svg {...commonProps}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case 'infinity':
      return (
        <svg {...commonProps}>
          <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4zm0 0c2 2.67 4 4 6 4a4 4 0 1 0 0-8c-2 0-4 1.33-6 4z" />
        </svg>
      );
    case 'support':
      return (
        <svg {...commonProps}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M12 7v5" />
          <path d="M12 16h.01" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...commonProps}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'star':
      return (
        <svg {...commonProps}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'umbrella':
      return (
        <svg {...commonProps}>
          <path d="M23 12a11.02 11.02 0 0 0-22 0zm-11 0v9a2 2 0 0 0 4 0h-4z" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...commonProps}>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );
    case 'location':
      return (
        <svg {...commonProps}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case 'zap':
      return (
        <svg {...commonProps}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'crown':
      return (
        <svg {...commonProps}>
          <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
          <path d="M3 20h18" />
        </svg>
      );
    case 'key':
      return (
        <svg {...commonProps}>
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...commonProps}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...commonProps}>
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      );
    case 'map':
      return (
        <svg {...commonProps}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
  }
}

// ── Single vehicle-type group (3 plan cards in a row, inside a panel) ─
// Each tier has its own perks with icon names
interface TierPerk { icon: string; text: string; }

const MOTO_TIER_PERKS: TierPerk[][] = [
  // 1 tháng
  [
    { icon: 'parking', text: 'Đỗ xe máy tại khu Cơ bản' },
    { icon: 'infinity', text: 'Ra vào không giới hạn' },
    { icon: 'checklist', text: 'Không tính phí theo lượt' },
    { icon: 'map', text: 'Xem sơ đồ tầng' },
    { icon: 'camera', text: 'Camera giám sát 24/7' },
  ],
  // 3 tháng
  [
    { icon: 'parking', text: 'Đỗ xe máy tại khu Phổ biến' },
    { icon: 'infinity', text: 'Ra vào không giới hạn' },
    { icon: 'checklist', text: 'Không tính phí theo lượt' },
    { icon: 'map', text: 'Xem sơ đồ tầng' },
    { icon: 'camera', text: 'Camera giám sát 24/7' },
  ],
  // 1 năm
  [
    { icon: 'parking', text: 'Đỗ xe máy tại khu VIP' },
    { icon: 'infinity', text: 'Ra vào không giới hạn' },
    { icon: 'checklist', text: 'Không tính phí theo lượt' },
    { icon: 'map', text: 'Xem sơ đồ tầng' },
    { icon: 'camera', text: 'Camera giám sát 24/7' },
    { icon: 'zap', text: 'Ưu tiên check-in' },
  ],
];

const CAR_TIER_PERKS: TierPerk[][] = [
  // CƠ BẢN (1 tháng)
  [
    { icon: 'location', text: 'Sử dụng Khu Cơ bản' },
    { icon: 'infinity', text: 'Ra vào không giới hạn' },
    { icon: 'checklist', text: 'Không tính phí theo lượt' },
    { icon: 'map', text: 'Xem sơ đồ tầng' },
    { icon: 'camera', text: 'Camera giám sát 24/7' },
  ],
  // PHỔ BIẾN (3 tháng)
  [
    { icon: 'location', text: 'Sử dụng Khu Phổ biến' },
    { icon: 'infinity', text: 'Ra vào không giới hạn' },
    { icon: 'checklist', text: 'Không tính phí theo lượt' },
    { icon: 'map', text: 'Xem sơ đồ tầng' },
    { icon: 'camera', text: 'Camera giám sát 24/7' },
  ],
  // VIP (1 năm)
  [
    { icon: 'crown', text: 'Sử dụng Khu VIP' },
    { icon: 'infinity', text: 'Ra vào không giới hạn' },
    { icon: 'checklist', text: 'Không tính phí theo lượt' },
    { icon: 'map', text: 'Xem sơ đồ tầng' },
    { icon: 'camera', text: 'Camera giám sát 24/7' },
    { icon: 'zap', text: 'Ưu tiên check-in' },
  ],
];

const MOTO_TIER_LABELS = ['CƠ BẢN', 'PHỔ BIẾN', 'CAO CẤP'];
const CAR_TIER_LABELS = ['CƠ BẢN', 'PHỔ BIẾN', 'VIP'];

function PricingGroup({ vtype, onClickCard }: { vtype: VType; onClickCard: (planId: string, vtype: VType) => void }) {
  const isCar = vtype === 'CAR';
  const groupClass = isCar ? styles.pricingGroupIconGreen : styles.pricingGroupIconBlue;
  const cardFeatured = isCar ? styles.planCardFeaturedGreen : styles.planCardFeaturedBlue;
  const panelClass = isCar ? styles.pricingPanelGreen : styles.pricingPanelBlue;
  const title = isCar ? 'Gói ô tô' : 'Gói xe máy';
  const subtitle = isCar ? 'Đỗ linh hoạt trong khu vực phù hợp với gói đã chọn' : 'Đỗ linh hoạt, tiết kiệm cho người gửi xe thường xuyên';
  const watermarkSrc = isCar ? carWatermark : motorbikeWatermark;
  const watermarkClass = `${styles.vehicleWatermark} ${isCar ? styles.vehicleWatermarkCar : ''}`;
  const tierPerks = isCar ? CAR_TIER_PERKS : MOTO_TIER_PERKS;
  const tierLabels = isCar ? CAR_TIER_LABELS : MOTO_TIER_LABELS;
  const HeaderIcon = isCar ? (
    <div className={styles.carSectionIcon} />
  ) : (
    <div className={styles.motorbikeSectionIcon} />
  );

  return (
    <div className={styles.pricingGroup}>
      <div className={`${styles.pricingGroupHeader} ${isCar ? styles.pricingGroupHeaderCar : ''}`}>
        <div className={`${styles.pricingGroupIcon} ${groupClass}`}>{HeaderIcon}</div>
        <div>
          <h4 className={styles.pricingGroupTitle}>{title}</h4>
          <p className={styles.pricingGroupSubtitle}>{subtitle}</p>
        </div>
      </div>
      <div className={`${styles.pricingPanel} ${panelClass}`}>
        <img
          src={watermarkSrc}
          alt=""
          aria-hidden="true"
          className={watermarkClass}
          draggable={false}
        />
        <div className={styles.pricingCardsRow}>
          {PACKAGES.map((pkg, idx) => {
            const isFeatured = idx === 1;
            const isAnnual = idx === 2;
            const price = pkg.prices[vtype];
            const perks = tierPerks[idx];
            const tierLabel = tierLabels[idx];
            return (
              <div
                key={pkg.id}
                className={`${styles.planCard} ${isFeatured ? `${styles.planCardFeatured} ${cardFeatured}` : ''}`}
              >
                {isFeatured && (
                  <span className={styles.planBadge}>★ Tiết kiệm nhất</span>
                )}

                <div className={`${styles.planCardHeader}`}>
                  {/* Tier label */}
                  <span className={`${styles.planTierLabel} ${isFeatured ? styles.planTierLabelFeatured :
                    isAnnual ? (isCar ? styles.planTierLabelVip : styles.planTierLabelPremium) :
                      styles.planTierLabelBasic
                    }`}>
                    {isAnnual && isCar ? '👑 ' : ''}{tierLabel}
                  </span>

                  {/* Duration + Name */}
                  <p className={`${styles.planDuration} ${isFeatured ? styles.planDurationLight : styles.planDurationMuted}`}>
                    {pkg.durationDays} NGÀY
                  </p>
                  <p className={`${styles.planName} ${isFeatured ? styles.planNameLight : ''}`}>
                    {pkg.name}
                  </p>

                  {/* Price */}
                  <div className={styles.planPrice}>
                    <span className={`${styles.planPriceValue} ${isFeatured ? styles.planPriceValueLight : ''}`}>
                      {price.priceLabel}
                    </span>
                  </div>
                  <p className={`${styles.planPerDay} ${isFeatured ? styles.planPerDayLight : ''}`}>
                    ~ {price.pricePerDay}
                  </p>

                  {/* Saving badge */}
                  {isFeatured && (
                    <span className={`${styles.planSaving} ${styles.planSavingFeatured}`}>
                      Tiết kiệm ~11%
                    </span>
                  )}
                  {isAnnual && (
                    <span className={styles.planSaving}>
                      Tiết kiệm ~17%
                    </span>
                  )}
                </div>

                <hr className={`${styles.planDivider} ${isFeatured ? styles.planDividerLight : ''}`} />

                {/* Checklist with tier-specific icons */}
                <ul className={`${styles.planPerks} ${isFeatured ? styles.planPerksLight : ''}`}>
                  {perks.map((p) => (
                    <li key={p.text}>
                      <span className={`${styles.perkIconWrap} ${isFeatured ? styles.perkIconWrapFeatured : ''}`}>
                        <PerkIcon name={p.icon} color={isFeatured ? '#ffffff' : (isCar ? '#16a34a' : '#2563eb')} />
                      </span>
                      <span>{p.text}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => onClickCard(pkg.id, vtype)}
                  className={`${styles.planCta} ${isFeatured ? styles.planCtaGold : styles.planCtaOutline}`}
                >
                  {'Chọn gói này'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CarIconFilled({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5.5 11 7 6.8A3 3 0 0 1 9.82 5h4.36A3 3 0 0 1 17 6.8l1.5 4.2H19a2 2 0 0 1 2 2v4.5a1 1 0 0 1-1 1h-1.2a2.3 2.3 0 0 1-4.6 0H9.8a2.3 2.3 0 0 1-4.6 0H4a1 1 0 0 1-1-1V13a2 2 0 0 1 2-2h.5Zm3.4-3.55L7.75 11h8.5L15.1 7.45A1.2 1.2 0 0 0 13.96 6.6H10.04a1.2 1.2 0 0 0-1.14.85ZM7.5 19.2a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm9 0a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Z" />
    </svg>
  );
}

function MotorbikeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5" cy="17" r="3" />
      <circle cx="19" cy="17" r="3" />
      <path d="M8 17h4l3-6h2" />
      <path d="M12 17V9l4-4" />
      <path d="M12 5h3l2 4" />
    </svg>
  );
}

function Footer({ navigate }: { navigate: (path: string) => void }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <div className={styles.logo} onClick={() => navigate('/')}>
              <img src="/logo.png" alt="ParkSmart Logo" className={styles.logoImg} />
              <span className={`${styles.logoText} ${styles.logoTextFooter}`}>Park<span className={styles.logoTextAccent}>Smart</span></span>
            </div>
            <p className={styles.footerTagline}>Giải pháp đỗ xe thông minh &amp; tối ưu.</p>
          </div>

          <div className={styles.footerColumn}>
            <h4 className={styles.footerColumnTitle}>SẢN PHẨM</h4>
            <div className={styles.footerNav}>
              <span className={styles.footerLink}>Đặt chỗ</span>
              <span className={styles.footerLink}>Check-in QR</span>
              <span className={styles.footerLink}>Báo cáo</span>
            </div>
          </div>

          <div className={styles.footerColumn}>
            <h4 className={styles.footerColumnTitle}>CÔNG TY</h4>
            <div className={styles.footerNav}>
              <span className={styles.footerLink}>Giới thiệu</span>
              <span className={styles.footerLink}>Tuyển dụng</span>
              <span className={styles.footerLink}>Liên hệ</span>
            </div>
          </div>

          <div className={styles.footerColumn}>
            <h4 className={styles.footerColumnTitle}>HỖ TRỢ</h4>
            <div className={styles.footerNav}>
              <span className={styles.footerLink}>Trung tâm trợ giúp</span>
              <span className={styles.footerLink}>Câu hỏi thường gặp</span>
              <span className={styles.footerLink}>Liên hệ</span>
            </div>
          </div>
        </div>

        <div className={styles.footerDivider} />

        <div className={styles.footerBottom}>
          © 2026 ParkSmart Vietnam
        </div>
      </div>
    </footer>
  );
}
