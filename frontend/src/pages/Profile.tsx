import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/profileApi';

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

  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [updatingName, setUpdatingName] = useState(false);
  const [updatingPwd, setUpdatingPwd] = useState(false);
  
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  useEffect(() => {
    if (user?.fullName) {
      setFullName(user.fullName);
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
      await updateProfile({ currentPassword, newPassword });
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
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: C.purple, color: C.white, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700
          }}>
            {getInitials(user.fullName || user.email)}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: C.gray800 }}>{user.fullName}</h2>
            <p style={{ margin: '4px 0 8px', fontSize: '0.9rem', color: C.gray600 }}>{user.email}</p>
            <span style={{
              display: 'inline-block', padding: '3px 12px', borderRadius: 12,
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
              background: '#EDE9FE', color: C.purple, border: `1px solid #C4B5FD`
            }}>
              {getRoleLabel(user.role)}
            </span>
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
      </div>
    </div>
  );
}
