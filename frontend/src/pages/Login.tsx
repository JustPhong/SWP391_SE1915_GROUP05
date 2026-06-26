import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
      newErrors.email = 'Email or Username is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!form.password) {
      newErrors.password = 'Password is required';
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
      const pkg = await getMyPackage();
      navigate(pkg ? '/dashboard-home' : '/welcome');
    } catch (err: unknown) {
      const isNetwork =
        !err ||
        (err as { response?: unknown }).response === undefined;

      if (isNetwork) {
        setApiError('Không thể kết nối tới máy chủ. Vui lòng thử lại.');
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
      footerText="Don't have an account?"
      footerLink={{ text: 'Sign up', to: '/register' }}
    >
      <h2 className={styles.heading}>Sign in</h2>
      <p className={styles.description}>Manage your parking slots with ease.</p>

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
          <label className={styles.inputLabel}>Password</label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon}>
              <LockIcon size={15} />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
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
            Remember me
          </label>
          <button type="button" className={styles.linkBtn}>
            Forgot password?
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className={`${styles.btn} ${styles['btn--primary']}`}
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </AuthLayout>
  );
}
