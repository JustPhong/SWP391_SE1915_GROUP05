import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
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
  { value: 'MOTORBIKE', label: 'Motorbike' },
  { value: 'CAR', label: 'Car' },
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
      newErrors.fullName = 'Full Name is required';
    }

    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!form.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10,11}$/.test(form.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Invalid phone number';
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
      newErrors.vehicleType = 'Please select vehicle type';
    }

    if (!form.password) {
      newErrors.password = 'Password is required';
    } else if (form.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!form.agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the Terms and Conditions';
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
      await register(form.fullName, form.email, form.password, form.licensePlate, form.vehicleType);
      navigate('/welcome');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Registration failed. Please try again.';
      setApiError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      subtitle="Create your account to start managing your parking"
      footerText="Already have an account?"
      footerLink={{ text: 'Log in', to: '/login' }}
    >
      <form onSubmit={handleSubmit} noValidate>

        {/* Full Name - full width */}
        <div className={styles.inputField}>
          <label className={styles.inputLabel}>Full Name</label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon}><PersonIcon size={15} /></span>
            <input
              type="text"
              placeholder="Nguyen Van A"
              className={`${styles.input} ${errors.fullName ? styles['input--error'] : ''}`}
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          {errors.fullName && <p className={styles.inputError}>{errors.fullName}</p>}
        </div>

        {/* Email + Phone - two columns */}
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
            <label className={styles.inputLabel}>Phone Number</label>
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

        {/* License Plate + Vehicle Type - two columns */}
        <div className={styles.fieldGrid}>
          <div className={styles.inputField}>
            <label className={styles.inputLabel}>License Plate Number</label>
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
            <label className={styles.inputLabel}>Vehicle Type</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}><CarIcon size={15} /></span>
              <select
                className={`${styles.input} ${styles['input--select']} ${errors.vehicleType ? styles['input--error'] : ''}`}
                value={form.vehicleType}
                onChange={(e) => setForm({ ...form, vehicleType: e.target.value as FormData['vehicleType'] })}
              >
                <option value="" disabled>Select type</option>
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

        {/* Password + Confirm - two columns */}
        <div className={styles.fieldGrid}>
          <div className={styles.inputField}>
            <label className={styles.inputLabel}>Password</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}><LockIcon size={15} /></span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 6 characters"
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
            <label className={styles.inputLabel}>Confirm Password</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}><LockIcon size={15} /></span>
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter password"
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
            I agree to the{' '}
            <button type="button" className={styles.linkBtn}>
              Terms and Conditions
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
          className={styles.btn}
          disabled={loading || !!plateError}
          style={{
            background: '#1E3A5F',
            color: '#fff',
            width: '100%',
            padding: '12px',
            border: 'none',
            borderRadius: '10px',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 14px rgba(30, 58, 95, 0.25)',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
    </AuthLayout>
  );
}
