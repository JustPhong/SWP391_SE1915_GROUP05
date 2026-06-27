import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { getRoleHomePath } from '../utils/authRoutes';
import { validatePlate } from '../utils/plate';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setApiError('');
    setLoading(true);

    try {
<<<<<<< HEAD
      const user = await register(form.fullName, form.email, form.password, form.licensePlate, form.vehicleType);
      navigate(getRoleHomePath(user.role), { replace: true });
=======
      await register(form.fullName, form.email, form.password, form.licensePlate, form.vehicleType);
      navigate('/welcome');
>>>>>>> 2f64c34383e92cdbc39ea1b579820378c71a0531
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
              <input
                type="text"
                placeholder="51A-123.45"
                className={`${styles.input} ${errors.licensePlate ? styles['input--error'] : ''}`}
                value={form.licensePlate}
                onChange={(e) => {
                  setForm({ ...form, licensePlate: e.target.value.toUpperCase() });
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
            <button type="button" className={styles.linkBtn}>
              Điều khoản sử dụng
            </button>
          </label>
        </div>
        {errors.agreeTerms && (
          <p className={styles.inputError}>{errors.agreeTerms}</p>
        )}

        {apiError && (
          <div className={`${styles.alert} ${styles['alert--error']}`}>{apiError}</div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className={`${styles.btn} ${styles['btn--primary']}`}
          disabled={loading || !!plateError}
        >
          {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
        </button>
      </form>
    </AuthLayout>
  );
}