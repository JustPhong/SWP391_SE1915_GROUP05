import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { PersonIcon, LockIcon, EyeIcon, EyeOffIcon } from '../components/ui/Icons';
import { authService } from '../services/auth.service';
import styles from '../styles/auth.module.css';

type Step = 'email' | 'reset';

export function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setApiError('Vui lòng nhập email hợp lệ');
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPasswordSendOtp({ email: email.trim().toLowerCase() });
      setSuccessMsg('Mã xác nhận đã được gửi đến email của bạn');
      setStep('reset');
    } catch (err: any) {
      setApiError(err?.response?.data?.message || 'Không thể gửi mã. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');

    if (!otp.trim()) {
      setApiError('Vui lòng nhập mã OTP');
      return;
    }
    if (newPassword.length < 6) {
      setApiError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setApiError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword,
      });
      setSuccessMsg('Đặt lại mật khẩu thành công! Đang chuyển đến trang đăng nhập...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      setApiError(err?.response?.data?.message || 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      subtitle="Hệ thống quản lý bãi đỗ xe thông minh"
      footerText="Nhớ mật khẩu rồi?"
      footerLink={{ text: 'Quay lại đăng nhập', to: '/login' }}
    >
      <h2 className={styles.heading}>Quên mật khẩu</h2>
      <p className={styles.description}>
        {step === 'email'
          ? 'Nhập email của bạn để nhận mã xác nhận.'
          : `Nhập mã xác nhận đã gửi tới ${email} và mật khẩu mới.`}
      </p>

      {apiError && (
        <div className={`${styles.alert} ${styles['alert--error']}`}>{apiError}</div>
      )}
      {successMsg && !apiError && (
        <div className={`${styles.alert} ${styles['alert--success']}`}>{successMsg}</div>
      )}

      {step === 'email' && (
        <form onSubmit={handleSendOtp} noValidate>
          <div className={styles.inputField}>
            <label className={styles.inputLabel}>Email</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <PersonIcon size={15} />
              </span>
              <input
                type="email"
                placeholder="operator@parksmart.vn"
                className={styles.input}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setApiError(''); }}
                autoComplete="email"
              />
            </div>
          </div>

          <button
            type="submit"
            className={`${styles.btn} ${styles['btn--primary']}`}
            disabled={loading}
          >
            {loading ? 'Đang gửi...' : 'Gửi mã xác nhận'}
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={handleResetPassword} noValidate>
          <div className={styles.inputField}>
            <label className={styles.inputLabel}>Mã xác nhận (OTP)</label>
            <div className={styles.inputWrapper}>
              <input
                type="text"
                placeholder="Nhập mã 6 số"
                className={styles.input}
                value={otp}
                onChange={(e) => { setOtp(e.target.value); setApiError(''); }}
                maxLength={6}
              />
            </div>
          </div>

          <div className={styles.inputField}>
            <label className={styles.inputLabel}>Mật khẩu mới</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <LockIcon size={15} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập mật khẩu mới"
                className={styles.input}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setApiError(''); }}
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
          </div>

          <div className={styles.inputField}>
            <label className={styles.inputLabel}>Xác nhận mật khẩu mới</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <LockIcon size={15} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập lại mật khẩu mới"
                className={styles.input}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setApiError(''); }}
                autoComplete="new-password"
              />
            </div>
          </div>

          <button
            type="submit"
            className={`${styles.btn} ${styles['btn--primary']}`}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
          </button>

          <button
            type="button"
            className={styles.linkBtn}
            style={{ marginTop: '0.75rem', width: '100%', textAlign: 'center' }}
            onClick={() => { setStep('email'); setApiError(''); setSuccessMsg(''); }}
          >
            Gửi lại mã / Đổi email
          </button>
        </form>
      )}
    </AuthLayout>
  );
}