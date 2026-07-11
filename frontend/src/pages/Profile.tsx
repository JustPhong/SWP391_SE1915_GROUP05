import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile, changePassword, uploadAvatar, removeAvatar, deleteAccount } from '../api/profileApi';
import { getMyPackage } from '../api/driverDashboardApi';

const C = {
  navy:       '#1E3A5F',
  white:      '#FFFFFF',
  gray50:     '#F9FAFB',
  gray100:    '#F3F4F6',
  gray200:    '#E5E7EB',
  gray400:    '#9CA3AF',
  gray600:    '#5C6B7A',
  gray800:    '#2D3A45',
  purple:     '#7C3AED',
  green:      '#16A34A',
  red:        '#DC2626',
  shadow:     '0 10px 40px rgba(30,58,95,0.08)',
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return (parts[0]![0] ?? '').toUpperCase();
  const first = parts[0]![0] ?? '';
  const last  = parts[parts.length - 1]![0] ?? '';
  return (first + last).toUpperCase();
}

function getRoleLabel(role: string | undefined): string {
  switch (role) {
    case 'ADMIN':   return 'Quản trị viên';
    case 'MANAGER': return 'Quản lý';
    case 'STAFF':   return 'Nhân viên';
    case 'DRIVER':  return 'Tài xế';
    default:        return 'Người dùng';
  }
}

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasPackage, setHasPackage] = useState(false);

  const [updatingName, setUpdatingName] = useState(false);
  const [updatingPwd, setUpdatingPwd] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  useEffect(() => {
    if (user?.fullName) {
      setFullName(user.fullName);
    }
  }, [user]);

 useEffect(() => {
  if (user?.role === 'DRIVER') {
    getMyPackage().then(pkg => setHasPackage(!!pkg)).catch(() => {});
  }
}, [user]);

  if (!user) return null;

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setNameError('Họ tên không được để trống');
      return;
    }
    setNameError('');
    setNameSuccess('');
    setUpdatingName(true);

    try {
      const updatedUser = await updateProfile({ fullName: fullName.trim() });
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setNameSuccess('Cập nhật họ tên thành công!');
    } catch (err: any) {
      setNameError(err.response?.data?.message ?? err.message ?? 'Cập nhật thất bại');
    } finally {
      setUpdatingName(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setPwdError('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (newPassword.length < 6) {
      setPwdError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('Mật khẩu mới và xác nhận mật khẩu không khớp');
      return;
    }

    setPwdError('');
    setPwdSuccess('');
    setUpdatingPwd(true);

    try {
      await changePassword({ currentPassword, newPassword });
      setPwdSuccess('Đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdError(err.response?.data?.message ?? err.message ?? 'Đổi mật khẩu thất bại');
    } finally {
      setUpdatingPwd(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const updated = await uploadAvatar(file);
      setUser(updated);
    } catch (err) {
      alert('Tải ảnh lên thất bại. Vui lòng thử lại.');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!confirm('Xoá ảnh đại diện và quay lại chữ viết tắt?')) return;
    setUploadingAvatar(true);
    try {
      const updated = await removeAvatar();
      setUser(updated);
    } catch {
      alert('Xoá ảnh thất bại. Vui lòng thử lại.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmPasswordInput) return;
    setDeletingAccount(true);
    setDeleteError('');
    try {
      await deleteAccount(confirmPasswordInput);
      setShowDeleteConfirm(false);
      setConfirmPasswordInput('');
      setDeleteStep(1);
      logout();
      navigate('/');
    } catch (err: any) {
      setDeleteError(err.response?.data?.message ?? err.message ?? 'Không thể xóa tài khoản');
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '12px 0 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: C.navy }}>Thông tin cá nhân</h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: C.gray600 }}>Quản lý thông tin tài khoản và bảo mật</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        {/* Profile Card */}
        <div style={{
          background: C.white, borderRadius: 20, padding: '32px 24px',
          boxShadow: C.shadow, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap'
        }}>
          <div style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()} title="Đổi ảnh đại diện">
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: '#2d5fd0', color: C.white, display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700,
              boxShadow: hasPackage ? '0 0 0 3px #fff, 0 0 0 6px #e6b422' : 'none', overflow: 'hidden',
            }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : getInitials(user.fullName || user.email)
              }
            </div>
            {hasPackage && (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="#f0b429" stroke="#b8860b" strokeWidth="0.6"
                style={{ position: 'absolute', top: -12, right: -10, transform: 'rotate(28deg)' }}>
                <path d="M3 7l4 4 5-7 5 7 4-4-1.5 11h-15L3 7z" />
                <circle cx="3" cy="7" r="1.4" /><circle cx="21" cy="7" r="1.4" /><circle cx="12" cy="4" r="1.4" />
              </svg>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 26, height: 26, borderRadius: '50%',
              background: '#f1f5f9', border: '2px solid #fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            {uploadingAvatar && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(0,0,0,0.45)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#fff',
                fontSize: '0.7rem', fontWeight: 600,
              }}>
                Đang tải...
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: C.gray800 }}>{user.fullName}</h2>
            <p style={{ margin: '4px 0 8px', fontSize: '0.9rem', color: C.gray600 }}>{user.email}</p>
            {hasPackage ? (
              <span style={{
                display: 'inline-block', padding: '3px 12px', borderRadius: 12,
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                background: '#fdf4d8', color: '#9a7400', border: '1px solid #f0dca0'
              }}>
                Cư dân
              </span>
            ) : (
              <span style={{
                display: 'inline-block', padding: '3px 12px', borderRadius: 12,
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                background: '#EDE9FE', color: C.purple, border: `1px solid #C4B5FD`
              }}>
                {getRoleLabel(user.role)}
              </span>
            )}
            {user.avatarUrl && (
              <button onClick={handleRemoveAvatar} style={{
                marginTop: 8, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600,
                color: '#64748b', background: 'transparent', border: '1px solid #e2e8f0',
                borderRadius: 8, cursor: 'pointer',
              }}>
                Xoá ảnh đại diện
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
          {/* Edit Info Form */}
          <div style={{ background: C.white, borderRadius: 20, padding: 28, boxShadow: C.shadow }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 700, color: C.navy }}>Chỉnh sửa thông tin</h3>
            <form onSubmit={handleUpdateName} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {nameError && (
                <div style={{ background: '#FEE2E2', border: '1.5px solid #FECACA', borderRadius: 10, padding: '10px 14px', color: C.red, fontSize: '0.82rem', fontWeight: 600 }}>
                  {nameError}
                </div>
              )}
              {nameSuccess && (
                <div style={{ background: '#DCFCE7', border: '1.5px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', color: C.green, fontSize: '0.82rem', fontWeight: 600 }}>
                  {nameSuccess}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: C.gray600, marginBottom: 6 }}>Địa chỉ Email</label>
                <input
                  type="text"
                  value={user.email}
                  disabled
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 12,
                    border: `1.5px solid ${C.gray200}`, fontSize: '0.9rem', color: C.gray400,
                    background: C.gray50, cursor: 'not-allowed', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: C.gray600, marginBottom: 6 }}>Họ và tên</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ tên"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 12,
                    border: `1.5px solid ${C.gray200}`, fontSize: '0.9rem', color: C.gray800,
                    outline: 'none', boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = C.navy}
                  onBlur={(e) => e.target.style.borderColor = C.gray200}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={updatingName}
                  style={{
                    padding: '10px 24px', borderRadius: 12, border: 'none',
                    background: updatingName ? C.gray200 : C.navy, color: C.white,
                    fontWeight: 700, fontSize: '0.88rem', cursor: updatingName ? 'not-allowed' : 'pointer',
                    boxShadow: updatingName ? 'none' : '0 4px 12px rgba(30,58,95,0.15)',
                    transition: 'all 0.15s'
                  }}
                >
                  {updatingName ? 'Đang lưu...' : 'Lưu thông tin'}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Form */}
          <div style={{ background: C.white, borderRadius: 20, padding: 28, boxShadow: C.shadow }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 700, color: C.navy }}>Đổi mật khẩu</h3>
            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {pwdError && (
                <div style={{ background: '#FEE2E2', border: '1.5px solid #FECACA', borderRadius: 10, padding: '10px 14px', color: C.red, fontSize: '0.82rem', fontWeight: 600 }}>
                  {pwdError}
                </div>
              )}
              {pwdSuccess && (
                <div style={{ background: '#DCFCE7', border: '1.5px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', color: C.green, fontSize: '0.82rem', fontWeight: 600 }}>
                  {pwdSuccess}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: C.gray600, marginBottom: 6 }}>Mật khẩu hiện tại</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 12,
                    border: `1.5px solid ${C.gray200}`, fontSize: '0.9rem', color: C.gray800,
                    outline: 'none', boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = C.navy}
                  onBlur={(e) => e.target.style.borderColor = C.gray200}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: C.gray600, marginBottom: 6 }}>Mật khẩu mới</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 12,
                    border: `1.5px solid ${C.gray200}`, fontSize: '0.9rem', color: C.gray800,
                    outline: 'none', boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = C.navy}
                  onBlur={(e) => e.target.style.borderColor = C.gray200}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: C.gray600, marginBottom: 6 }}>Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 12,
                    border: `1.5px solid ${C.gray200}`, fontSize: '0.9rem', color: C.gray800,
                    outline: 'none', boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = C.navy}
                  onBlur={(e) => e.target.style.borderColor = C.gray200}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={updatingPwd}
                  style={{
                    padding: '10px 24px', borderRadius: 12, border: 'none',
                    background: updatingPwd ? C.gray200 : C.navy, color: C.white,
                    fontWeight: 700, fontSize: '0.88rem', cursor: updatingPwd ? 'not-allowed' : 'pointer',
                    boxShadow: updatingPwd ? 'none' : '0 4px 12px rgba(30,58,95,0.15)',
                    transition: 'all 0.15s'
                  }}
                >
                  {updatingPwd ? 'Đang đổi...' : 'Đổi mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Danger Zone */}
        <div style={{
          background: '#FFF5F5',
          border: '1.5px solid #FEB2B2',
          borderRadius: 20,
          padding: 28,
          boxShadow: C.shadow,
          marginTop: 8
        }}>
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="button"
              onClick={() => {
                setShowDeleteConfirm(true);
                setDeleteStep(1);
                setDeleteError('');
                setConfirmPasswordInput('');
              }}
              style={{
                padding: '10px 24px',
                borderRadius: 12,
                border: 'none',
                background: C.red,
                color: C.white,
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)',
                transition: 'all 0.15s'
              }}
            >
              Xóa tài khoản
            </button>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: C.white,
            borderRadius: 24,
            padding: 32,
            maxWidth: 480,
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          }}>
            {deleteStep === 1 ? (
              <>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.25rem', fontWeight: 800, color: C.red, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  Cảnh báo xóa tài khoản
                </h3>
                
                <div style={{
                  background: '#FFF5F5',
                  border: '1px solid #FEB2B2',
                  borderRadius: 12,
                  padding: '16px',
                  color: '#C53030',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  marginBottom: 24
                }}>
                  <strong>Hành động này không thể hoàn tác!</strong> Một khi bạn xóa tài khoản, tất cả dữ liệu liên quan (xe của bạn, gói tháng, lịch sử đặt chỗ, lịch sử thanh toán) sẽ bị xóa vĩnh viễn và không thể khôi phục.
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 12,
                      border: 'none',
                      background: C.gray100,
                      color: C.gray800,
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer'
                    }}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(2)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 12,
                      border: 'none',
                      background: C.red,
                      color: C.white,
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)'
                    }}
                  >
                    Tiếp tục xóa
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ margin: '0 0 16px', fontSize: '1.25rem', fontWeight: 800, color: C.navy }}>
                  Xác nhận mật khẩu
                </h3>
                <p style={{ margin: '0 0 20px', fontSize: '0.9rem', color: C.gray600, lineHeight: 1.6 }}>
                  Vui lòng nhập mật khẩu tài khoản của bạn để xác nhận hành động xóa tài khoản:
                </p>

                <input
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu xác nhận"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: `1.5px solid ${confirmPasswordInput.length >= 6 ? C.green : C.gray200}`,
                    fontSize: '0.9rem',
                    color: C.gray800,
                    outline: 'none',
                    boxSizing: 'border-box',
                    marginBottom: 20
                  }}
                />

                {deleteError && (
                  <div style={{
                    background: '#FEE2E2',
                    border: '1.5px solid #FECACA',
                    borderRadius: 12,
                    padding: '12px 16px',
                    color: C.red,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    marginBottom: 20,
                    lineHeight: 1.4
                  }}>
                    {deleteError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    disabled={deletingAccount}
                    onClick={() => {
                      setDeleteStep(1);
                      setDeleteError('');
                      setConfirmPasswordInput('');
                    }}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 12,
                      border: 'none',
                      background: C.gray100,
                      color: C.gray800,
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer'
                    }}
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    disabled={deletingAccount || !confirmPasswordInput}
                    onClick={handleDeleteAccount}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 12,
                      border: 'none',
                      background: (deletingAccount || !confirmPasswordInput) ? C.gray200 : C.red,
                      color: C.white,
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: (deletingAccount || !confirmPasswordInput) ? 'not-allowed' : 'pointer',
                      boxShadow: (deletingAccount || !confirmPasswordInput) ? 'none' : '0 4px 12px rgba(220, 38, 38, 0.2)'
                    }}
                  >
                    {deletingAccount ? 'Đang xóa...' : 'Xác nhận xóa'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
