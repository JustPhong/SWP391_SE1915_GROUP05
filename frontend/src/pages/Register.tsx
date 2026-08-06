import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { getRoleHomePath } from '../utils/authRoutes';
import { validatePlate } from '../utils/plate';
import { authService } from '../services/auth.service';
import { PlateInput } from '../components/PlateInput';
import {
  PersonIcon,
  EmailIcon,
  PhoneIcon,
  LicensePlateIcon,
  CarIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  ChevronDownIcon,
} from '../components/ui/Icons';
import styles from '../styles/auth.module.css';

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  licensePlate: string;
  vehicleType: 'MOTORBIKE' | 'CAR';
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  licensePlate?: string;
  vehicleType?: string;
  password?: string;
  confirmPassword?: string;
  agreeTerms?: string;
}

const VEHICLE_OPTIONS = [
  { value: 'MOTORBIKE', label: 'Xe máy' },
  { value: 'CAR', label: 'Ô tô' },
];

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    licensePlate: '',
    vehicleType: 'CAR',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [plateError, setPlateError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // ── OTP State ──
  const [otpStep, setOtpStep] = useState(false); // true = show OTP input
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0); // resend cooldown
  const [otpExpiry, setOtpExpiry] = useState(0); // 5-min expiry countdown
  const [otpSuccess, setOtpSuccess] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timers
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const t = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCountdown]);

  useEffect(() => {
    if (otpExpiry <= 0) return;
    const t = setTimeout(() => setOtpExpiry((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpExpiry]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.fullName.trim()) {
      newErrors.fullName = 'Vui lòng nhập họ và tên';
    }

    if (!form.email.trim()) {
      newErrors.email = 'Vui lòng nhập email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Email không đúng định dạng';
    }

    if (!form.phone.trim()) {
      newErrors.phone = 'Vui lòng nhập số điện thoại';
    } else if (!/^\d{10,11}$/.test(form.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Số điện thoại không hợp lệ';
    }

    if (!form.licensePlate.trim()) {
      newErrors.licensePlate = 'Vui lòng nhập biển số xe.';
    } else {
      const plateResult = validatePlate(form.licensePlate, form.vehicleType);
      if (!plateResult.valid) {
        newErrors.licensePlate = plateResult.message!;
      }
    }

    if (!form.vehicleType) {
      newErrors.vehicleType = 'Vui lòng chọn loại xe';
    }

    if (!form.password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (form.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    if (!form.agreeTerms) {
      newErrors.agreeTerms = 'Bạn cần đồng ý với Điều khoản sử dụng';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step 1: Send OTP
  const handleSendOtp = async () => {
    if (otpSending) return;
    if (!validate()) return;
    setApiError('');
    setOtpSending(true);
    try {
      await authService.sendOtp({ email: form.email, fullName: form.fullName });
      setOtpStep(true);
      setOtpCountdown(60);
      setOtpExpiry(300);
      setOtp(['', '', '', '', '', '']);
      setOtpSuccess('Mã xác nhận đã được gửi đến ' + form.email);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Không thể gửi mã xác nhận. Vui lòng thử lại.';
      setApiError(message);
    } finally {
      setOtpSending(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (otpCountdown > 0) return;
    if (otpSending) return;
    setApiError('');
    setOtpSending(true);
    try {
      await authService.sendOtp({ email: form.email, fullName: form.fullName });
      setOtpCountdown(60);
      setOtpExpiry(300);
      setOtp(['', '', '', '', '', '']);
      setOtpSuccess('Đã gửi lại mã xác nhận');
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Không thể gửi lại mã.';
      setApiError(message);
    } finally {
      setOtpSending(false);
    }
  };

  // OTP input handler
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  const otpCode = otp.join('');

  // Step 2: Submit with OTP
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!otpStep) {
      handleSendOtp();
      return;
    }
    if (otpCode.length !== 6) {
      setApiError('Vui lòng nhập đủ 6 số mã xác nhận');
      return;
    }

    setApiError('');
    setLoading(true);

    try {
      const user = await register(
        form.fullName,
        form.email,
        form.password,
        form.phone,
        form.licensePlate,
        form.vehicleType,
        otpCode
      );
      navigate(getRoleHomePath(user.role), { replace: true });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Đăng ký thất bại. Vui lòng thử lại.';
      setApiError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      subtitle="Tạo tài khoản để bắt đầu sử dụng dịch vụ đỗ xe thông minh"
      footerText="Đã có tài khoản?"
      footerLink={{ text: 'Đăng nhập ngay', to: '/login' }}
    >
      <h2 className={styles.heading}>Tạo tài khoản</h2>
      <p className={styles.description}>Tham gia ParkSmart và quản lý chỗ đỗ xe dễ dàng.</p>

      <form onSubmit={handleSubmit} noValidate>

        {/* Full Name */}
        <div className={styles.inputField}>
          <label className={styles.inputLabel}>Họ và tên</label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon}><PersonIcon size={15} /></span>
            <input
              type="text"
              placeholder="Nguyễn Văn A"
              className={`${styles.input} ${errors.fullName ? styles['input--error'] : ''}`}
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          {errors.fullName && <p className={styles.inputError}>{errors.fullName}</p>}
        </div>

        {/* Email + Phone */}
        <div className={styles.fieldGrid}>
          <div className={styles.inputField}>
            <label className={styles.inputLabel}>Email</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}><EmailIcon size={15} /></span>
              <input
                type="email"
                placeholder="you@example.com"
                className={`${styles.input} ${errors.email ? styles['input--error'] : ''}`}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
              />
            </div>
            {errors.email && <p className={styles.inputError}>{errors.email}</p>}
          </div>

          <div className={styles.inputField}>
            <label className={styles.inputLabel}>Số điện thoại</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}><PhoneIcon size={15} /></span>
              <input
                type="tel"
                placeholder="0901 234 567"
                className={`${styles.input} ${errors.phone ? styles['input--error'] : ''}`}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                autoComplete="tel"
              />
            </div>
            {errors.phone && <p className={styles.inputError}>{errors.phone}</p>}
          </div>
        </div>

        {/* License Plate + Vehicle Type */}
        <div className={styles.fieldGrid}>
          <div className={styles.inputField}>
            <label className={styles.inputLabel}>Biển số xe</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}><LicensePlateIcon size={15} /></span>
              <PlateInput
                placeholder={form.vehicleType === 'CAR' ? 'Ví dụ: 51A-731.89' : 'Ví dụ: 59-AB 234.56'}
                className={`${styles.input} ${errors.licensePlate ? styles['input--error'] : ''}`}
                value={form.licensePlate}
                vehicleType={form.vehicleType}
                onChange={(formatted) => {
                  setForm({ ...form, licensePlate: formatted });
                  if (plateError) setPlateError('');
                }}
                onBlur={(e) => {
                  const result = validatePlate(e.target.value, form.vehicleType);
                  if (!result.valid && e.target.value.trim()) {
                    setPlateError(result.message!);
                  } else {
                    setPlateError('');
                  }
                }}
              />
            </div>
            {(errors.licensePlate || plateError) && (
              <p className={styles.inputError}>{errors.licensePlate || plateError}</p>
            )}
          </div>

          <div className={styles.inputField}>
            <label className={styles.inputLabel}>Loại xe</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}><CarIcon size={15} /></span>
              <select
                className={`${styles.input} ${styles['input--select']} ${errors.vehicleType ? styles['input--error'] : ''}`}
                value={form.vehicleType}
                onChange={(e) => setForm({ ...form, vehicleType: e.target.value as FormData['vehicleType'] })}
              >
                <option value="" disabled>Chọn loại xe</option>
                {VEHICLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: 12, color: '#9CA3AF', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <ChevronDownIcon size={14} />
              </span>
            </div>
            {errors.vehicleType && <p className={styles.inputError}>{errors.vehicleType}</p>}
          </div>
        </div>

        {/* Password + Confirm */}
        <div className={styles.fieldGrid}>
          <div className={styles.inputField}>
            <label className={styles.inputLabel}>Mật khẩu</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}><LockIcon size={15} /></span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Tối thiểu 6 ký tự"
                className={`${styles.input} ${errors.password ? styles['input--error'] : ''}`}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.inputToggle}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
              </button>
            </div>
            {errors.password && <p className={styles.inputError}>{errors.password}</p>}
          </div>

          <div className={styles.inputField}>
            <label className={styles.inputLabel}>Xác nhận mật khẩu</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}><LockIcon size={15} /></span>
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Nhập lại mật khẩu"
                className={`${styles.input} ${errors.confirmPassword ? styles['input--error'] : ''}`}
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.inputToggle}
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
              </button>
            </div>
            {errors.confirmPassword && <p className={styles.inputError}>{errors.confirmPassword}</p>}
          </div>
        </div>

        {/* Terms */}
        <div className={styles.checkboxRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={form.agreeTerms}
              onChange={(e) => setForm({ ...form, agreeTerms: e.target.checked })}
            />
            Tôi đồng ý với{' '}
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => setShowTermsModal(true)}
            >
              Điều khoản sử dụng
            </button>
          </label>
        </div>
        {errors.agreeTerms && (
          <p className={styles.inputError}>{errors.agreeTerms}</p>
        )}

        {/* OTP Verification Step */}
        {otpStep && (
          <div style={{
            background: '#F0F9FF', border: '1.5px solid #BAE6FD', borderRadius: 14,
            padding: '1.25rem', marginTop: '0.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0C4A6E' }}>Xác minh email</span>
            </div>

            {otpSuccess && (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#059669', fontWeight: 600 }}>
                ✓ {otpSuccess}
              </p>
            )}

            <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#475569' }}>
              Nhập mã xác nhận 6 số đã gửi đến <strong>{form.email}</strong>
            </p>

            {/* OTP Input */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: '0.75rem' }}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  style={{
                    width: 44, height: 52, textAlign: 'center', fontSize: '1.35rem',
                    fontWeight: 800, fontFamily: "'Consolas', monospace",
                    border: digit ? '2px solid #1E3A5F' : '1.5px solid #CBD5E1',
                    borderRadius: 10, outline: 'none', background: '#fff',
                    color: '#1E3A5F', transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#1E3A5F'; e.target.style.boxShadow = '0 0 0 3px rgba(30,58,95,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = digit ? '#1E3A5F' : '#CBD5E1'; e.target.style.boxShadow = 'none'; }}
                />
              ))}
            </div>

            {/* Expiry + Resend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
              <span style={{ color: otpExpiry <= 60 ? '#DC2626' : '#6B7280', fontWeight: 600 }}>
                {otpExpiry > 0
                  ? `Hết hạn sau ${Math.floor(otpExpiry / 60)}:${String(otpExpiry % 60).padStart(2, '0')}`
                  : 'Mã đã hết hạn'}
              </span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={otpCountdown > 0 || otpSending}
                style={{
                  background: 'none', border: 'none', cursor: otpCountdown > 0 ? 'not-allowed' : 'pointer',
                  color: otpCountdown > 0 ? '#9CA3AF' : '#1E3A5F', fontWeight: 700, fontSize: '0.78rem',
                  textDecoration: otpCountdown > 0 ? 'none' : 'underline', padding: 0,
                }}
              >
                {otpSending ? 'Đang gửi...' : otpCountdown > 0 ? `Gửi lại (${otpCountdown}s)` : 'Gửi lại mã'}
              </button>
            </div>
          </div>
        )}

        {apiError && (
          <div className={`${styles.alert} ${styles['alert--error']}`}>{apiError}</div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className={`${styles.btn} ${styles['btn--primary']}`}
          disabled={loading || otpSending || !!plateError || (otpStep && (otpCode.length !== 6 || otpExpiry <= 0))}
        >
          {loading
            ? 'Đang tạo tài khoản...'
            : otpSending
              ? 'Đang gửi mã...'
              : otpStep
                ? 'Xác nhận & Tạo tài khoản'
                : 'Gửi mã xác nhận'}
        </button>

        {otpStep && (
          <button
            type="button"
            onClick={() => { setOtpStep(false); setApiError(''); setOtpSuccess(''); }}
            style={{
              width: '100%', padding: '0.65rem', background: '#fff', border: '1.5px solid #D1D5DB',
              borderRadius: 10, fontSize: '0.85rem', fontWeight: 600, color: '#6B7280',
              cursor: 'pointer', marginTop: '0.25rem',
            }}
          >
            ← Quay lại chỉnh sửa thông tin
          </button>
        )}
      </form>

      {/* Render Terms Modal */}
      {showTermsModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowTermsModal(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(10, 25, 60, 0.55)',
              backdropFilter: 'blur(4px)',
              zIndex: 9998,
              animation: 'fadeIn 0.2s ease',
            }}
          />

          {/* Modal Box */}
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%', maxWidth: 500,
            zIndex: 9999,
            boxSizing: 'border-box',
          }}>
            <div style={{
              background: '#FFFFFF',
              borderRadius: 20,
              boxShadow: '0 24px 64px rgba(10, 25, 60, 0.20)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh',
            }}>
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, #1E3A5F 0%, #2C4F78 100%)',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#FFFFFF',
              }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  Điều khoản sử dụng dịch vụ
                </h3>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: 'none', borderRadius: 8,
                    width: 30, height: 30,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#FFFFFF', fontSize: '1.1rem',
                    fontWeight: 700,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content */}
              <div style={{
                padding: '1.5rem',
                overflowY: 'auto',
                fontSize: '0.88rem',
                color: '#4B5563',
                lineHeight: 1.6,
                textAlign: 'left',
              }}>
                <p style={{ marginTop: 0, fontWeight: 700, color: '#1E3A5F' }}>
                  Hệ thống quản lý đỗ xe thông minh ParkSmart là một sản phẩm phần mềm bản quyền chính thức được nghiên cứu và phát triển bởi Nhóm 05 (SWP391 SE1915 FPT University). Mọi quyền sở hữu trí tuệ, thương hiệu, và tài liệu liên quan đều được bảo hộ nghiêm ngặt.
                </p>
                <p style={{ color: '#4B5563', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                  Bằng việc đăng ký tài khoản thành viên hoặc sử dụng bất kỳ dịch vụ nào của hệ thống ParkSmart, quý khách (sau đây gọi là "Lái xe" hoặc "Khách hàng") cam kết đã đọc, hiểu và đồng ý vô điều kiện với toàn bộ các điều khoản sử dụng dưới đây:
                </p>

                <h4 style={{ color: '#1E3A5F', margin: '1.25rem 0 0.5rem', fontSize: '0.95rem', fontWeight: 800 }}>
                  1. Quy định chung về đỗ xe
                </h4>
                <ul style={{ margin: '0 0 1rem', paddingLeft: '1.25rem' }}>
                  <li>Khách hàng được sử dụng khu vực đỗ xe tương ứng với loại gói hoặc đặt chỗ đã đăng ký. Hệ thống không gán hoặc xác lập quyền sở hữu riêng đối với một ô đỗ cố định. Khi vào bãi, khách hàng có thể đỗ tại bất kỳ vị trí còn trống nào trong khu vực được phân bổ hoặc theo hướng dẫn an toàn từ nhân viên trực ca trực bãi xe.</li>
                  <li>Tuân thủ tốc độ giới hạn (tối đa 10km/h) và các biển chỉ dẫn an toàn, biển cảnh báo giao thông trong khu vực hầm đỗ xe.</li>
                </ul>

                <h4 style={{ color: '#1E3A5F', margin: '1.25rem 0 0.5rem', fontSize: '0.95rem', fontWeight: 800 }}>
                  2. Quy định đặt chỗ trước (Booking) và phí đặt cọc
                </h4>
                <ul style={{ margin: '0 0 1rem', paddingLeft: '1.25rem' }}>
                  <li>Đặt chỗ trước giúp hệ thống giữ một suất chứa trong khu vực phù hợp. Vị trí đỗ cụ thể được lựa chọn theo tình trạng chỗ trống thực tế khi khách đến bãi. Khách vãng lai khi đặt chỗ trước qua ứng dụng phải nộp khoản tiền đặt cọc là <strong>15.000đ</strong>. Khoản cọc này sẽ được khấu trừ vào phí gửi xe thực tế khi khách hàng check-out.</li>
                  <li>Nếu quá giờ hẹn dự kiến <strong>30 phút</strong> mà xe chưa vào bãi (No-show), lượt đặt chỗ sẽ bị hủy tự động và tiền đặt cọc sẽ không được hoàn lại nhằm bù đắp chi phí giữ chỗ của hệ thống.</li>
                  <li>Cư dân đã đăng ký gói tháng được miễn phí tiền đặt cọc đặt chỗ, nhưng lượt đặt chỗ cũng sẽ tự động hủy sau 30 phút quá hạn để bảo đảm tối ưu hóa công suất khai thác bãi đỗ.</li>
                </ul>

                <h4 style={{ color: '#1E3A5F', margin: '1.25rem 0 0.5rem', fontSize: '0.95rem', fontWeight: 800 }}>
                  3. Thẻ xe và Đền bù mất mát
                </h4>
                <ul style={{ margin: '0 0 1rem', paddingLeft: '1.25rem' }}>
                  <li>Tài xế có trách nhiệm tự bảo quản thẻ/vé gửi xe (đối với khách sử dụng vé lượt giấy hoặc thẻ RFID).</li>
                  <li>Trong trường hợp làm mất thẻ xe, tài xế phải đền bù chi phí phát hành lại thẻ: <strong>80.000đ đối với xe máy</strong> và <strong>200.000đ đối với ô tô</strong>, đồng thời thanh toán phí gửi xe tính từ thời điểm xe check-in thực tế dựa trên dữ liệu đối soát camera bãi xe.</li>
                </ul>

                <h4 style={{ color: '#1E3A5F', margin: '1.25rem 0 0.5rem', fontSize: '0.95rem', fontWeight: 800 }}>
                  4. Miễn trừ trách nhiệm về tài sản cá nhân
                </h4>
                <ul style={{ margin: '0 0 1rem', paddingLeft: '1.25rem' }}>
                  <li>Ban quản lý và đơn vị vận hành hệ thống đỗ xe không chịu trách nhiệm bảo quản hay bồi thường đối với các tài sản cá nhân có giá trị (tiền mặt, trang sức, điện thoại, máy tính...) để lại bên trong xe của quý khách.</li>
                </ul>

                <h4 style={{ color: '#1E3A5F', margin: '1.25rem 0 0.5rem', fontSize: '0.95rem', fontWeight: 800 }}>
                  5. Quyền sở hữu trí tuệ và Bản quyền phát triển
                </h4>
                <ul style={{ margin: '0 0 1rem', paddingLeft: '1.25rem' }}>
                  <li>Toàn bộ mã nguồn, cấu trúc phần mềm, cơ sở dữ liệu, giao diện người dùng (UI/UX), nhãn hiệu thương mại "ParkSmart" đều thuộc sở hữu độc quyền của ParkSmart DevTeam. Mọi hành vi sao chép, đảo ngược mã nguồn (reverse engineering), phân phối trái phép đều bị nghiêm cấm theo luật Sở hữu trí tuệ hiện hành.</li>
                </ul>

                <h4 style={{ color: '#1E3A5F', margin: '1.25rem 0 0.5rem', fontSize: '0.95rem', fontWeight: 800 }}>
                  6. Chính sách bảo mật dữ liệu khách hàng
                </h4>
                <ul style={{ margin: '0 0 1rem', paddingLeft: '1.25rem', marginBottom: 0 }}>
                  <li>Dữ liệu cá nhân (Họ tên, số điện thoại, biển số xe) và hình ảnh biển số ghi nhận từ camera tại cổng ra/vào chỉ được dùng cho mục đích quản lý đỗ xe, đối soát tài chính, bảo đảm an ninh bãi đỗ và hỗ trợ cơ quan điều tra khi được yêu cầu. Chúng tôi cam kết không bán hoặc chia sẻ thông tin cho các bên thứ ba vì mục đích thương mại ngoài luồng.</li>
                </ul>
              </div>

              {/* Footer Action */}
              <div style={{
                background: '#F9FAFB',
                borderTop: '1px solid #E5E7EB',
                padding: '1rem 1.5rem',
                display: 'flex',
                justifyContent: 'flex-end',
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...form, agreeTerms: true });
                    setShowTermsModal(false);
                  }}
                  style={{
                    background: '#1E3A5F',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 10,
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(30, 58, 95, 0.15)',
                    transition: 'background 0.2s',
                  }}
                >
                  Đồng ý &amp; Đóng
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </AuthLayout>
  );
}