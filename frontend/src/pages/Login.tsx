import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleHomePath } from '../utils/authRoutes';
import { AuthLayout } from '../components/AuthLayout';
import { PersonIcon, LockIcon, EyeIcon, EyeOffIcon } from '../components/ui/Icons';
import { getMyPackage } from '../api/driverDashboardApi';
import styles from '../styles/auth.module.css';

interface FormErrors {
  email?: string;
  password?: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.email.trim()) {
      newErrors.email = 'Vui lòng nhập email hoặc tên đăng nhập';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Email không đúng định dạng';
    }

    if (!form.password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
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
      await login(form.email, form.password);
      navigate('/dashboard-home');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const serverMessage = axiosErr.response?.data?.message;

      if (!axiosErr.response) {
        setApiError('Không thể kết nối tới máy chủ. Vui lòng thử lại.');
      } else if (serverMessage) {
        setApiError(serverMessage);
      } else {
        setApiError('Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.');
      }
      setForm((prev) => ({ ...prev, password: '' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      subtitle="Hệ thống quản lý bãi đỗ xe thông minh"
      footerText="Chưa có tài khoản?"
      footerLink={{ text: 'Đăng ký ngay', to: '/register' }}
    >
      <h2 className={styles.heading}>Đăng nhập</h2>
      <p className={styles.description}>Quản lý chỗ đỗ xe của bạn một cách dễ dàng.</p>

      {apiError && (
        <div className={`${styles.alert} ${styles['alert--error']}`}>{apiError}</div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Email */}
        <div className={styles.inputField}>
          <label className={styles.inputLabel}>Email or Username</label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon}>
              <PersonIcon size={15} />
            </span>
            <input
              type="email"
              placeholder="operator@parksmart.vn"
              className={`${styles.input} ${errors.email ? styles['input--error'] : ''}`}
              value={form.email}
              onChange={(e) => { setForm({ ...form, email: e.target.value }); setApiError(''); }}
              autoComplete="email"
            />
          </div>
          {errors.email && <p className={styles.inputError}>{errors.email}</p>}
        </div>

        {/* Password */}
        <div className={styles.inputField}>
          <label className={styles.inputLabel}>Mật khẩu</label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon}>
              <LockIcon size={15} />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Nhập mật khẩu của bạn"
              className={`${styles.input} ${errors.password ? styles['input--error'] : ''}`}
              value={form.password}
              onChange={(e) => { setForm({ ...form, password: e.target.value }); setApiError(''); }}
              autoComplete="current-password"
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

        {/* Remember + Forgot */}
        <div className={styles.checkboxRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Ghi nhớ đăng nhập
          </label>
          <button type="button" className={styles.linkBtn}>
            Quên mật khẩu?
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className={`${styles.btn} ${styles['btn--primary']}`}
          disabled={loading}
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </AuthLayout>
  );
}