import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/AuthLayout';
import { PersonIcon, LockIcon, EyeIcon, EyeOffIcon } from '../components/ui/Icons';
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
      newErrors.email = 'Vui lÃ²ng nháº­p email hoáº·c tÃªn Ä‘Äƒng nháº­p';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Email khÃ´ng Ä‘Ãºng Ä‘á»‹nh dáº¡ng';
    }

    if (!form.password) {
      newErrors.password = 'Vui lÃ²ng nháº­p máº­t kháº©u';
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
        setApiError('KhÃ´ng thá»ƒ káº¿t ná»‘i tá»›i mÃ¡y chá»§. Vui lÃ²ng thá»­ láº¡i.');
      } else if (serverMessage) {
        setApiError(serverMessage);
      } else {
        setApiError('Email hoáº·c máº­t kháº©u khÃ´ng Ä‘Ãºng. Vui lÃ²ng kiá»ƒm tra láº¡i.');
      }
      setForm((prev) => ({ ...prev, password: '' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      subtitle="Há»‡ thá»‘ng quáº£n lÃ½ bÃ£i Ä‘á»— xe thÃ´ng minh"
      footerText="ChÆ°a cÃ³ tÃ i khoáº£n?"
      footerLink={{ text: 'ÄÄƒng kÃ½ ngay', to: '/register' }}
    >
      <h2 className={styles.heading}>ÄÄƒng nháº­p</h2>
      <p className={styles.description}>Quáº£n lÃ½ chá»— Ä‘á»— xe cá»§a báº¡n má»™t cÃ¡ch dá»… dÃ ng.</p>

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
          <label className={styles.inputLabel}>Máº­t kháº©u</label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon}>
              <LockIcon size={15} />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Nháº­p máº­t kháº©u cá»§a báº¡n"
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
            Ghi nhá»› Ä‘Äƒng nháº­p
          </label>
          <button type="button" className={styles.linkBtn}>
            QuÃªn máº­t kháº©u?
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className={`${styles.btn} ${styles['btn--primary']}`}
          disabled={loading}
        >
          {loading ? 'Äang Ä‘Äƒng nháº­p...' : 'ÄÄƒng nháº­p'}
        </button>
      </form>
    </AuthLayout>
  );
}
