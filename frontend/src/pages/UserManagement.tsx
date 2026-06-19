import { useState, useEffect, useCallback } from 'react';
import {
  getUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  resetUserPassword,
  deleteUser,
  type UserItem,
} from '../api/adminApi';
import { useAuth } from '../context/AuthContext';

// ── Design tokens (mirror manager page) ───────────────────────────
const C = {
  navy:       '#1E3A5F',
  white:      '#FFFFFF',
  gray50:     '#F9FAFB',
  gray100:    '#F3F4F6',
  gray200:    '#E5E7EB',
  gray400:    '#9CA3AF',
  gray600:    '#5C6B7A',
  gray800:    '#2D3A45',
  shadow:     '0 8px 32px rgba(30,58,95,0.10)',
  // Role badge colours
  driver:     { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' },
  staff:      { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  manager:    { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
  admin:      { bg: '#EDE9FE', text: '#7C3AED', border: '#C4B5FD' },
} as const;

// ── Toast ─────────────────────────────────────────────────────────
type Toast = { message: string; type: 'success' | 'error' } | null;

function ToastBanner({ toast, onClear }: { toast: Toast; onClear: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClear, 3500);
    return () => clearTimeout(t);
  }, [toast, onClear]);

  if (!toast) return null;
  const bg = toast.type === 'success' ? '#DCFCE7' : '#FEE2E2';
  const text = toast.type === 'success' ? '#15803D' : '#DC2626';
  const border = toast.type === 'success' ? '#BBF7D0' : '#FECACA';
  return (
    <div style={{
      position: 'fixed', top: 20, right: 24, zIndex: 9999,
      background: bg, border: `1.5px solid ${border}`, borderRadius: 12,
      padding: '12px 20px', color: text, fontWeight: 600, fontSize: '0.9rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxWidth: 360,
    }}>
      {toast.message}
    </div>
  );
}

// ── Confirm dialog ─────────────────────────────────────────────────
function ConfirmDialog({
  title, message, confirmLabel, danger,
  onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(17,24,39,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div style={{
        background: C.white, borderRadius: 16, padding: '28px 32px', maxWidth: 400, width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', textAlign: 'center',
      }} onClick={(e) => e.stopPropagation()}>
        <p style={{ fontSize: '1.1rem', fontWeight: 700, color: C.gray800, margin: '0 0 10px' }}>{title}</p>
        <p style={{ fontSize: '0.9rem', color: C.gray600, margin: '0 0 24px', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{
            padding: '9px 24px', borderRadius: 10, border: `1.5px solid ${C.gray200}`,
            background: C.white, color: C.gray600, fontWeight: 600, fontSize: '0.88rem',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            Hủy
          </button>
          <button onClick={onConfirm} style={{
            padding: '9px 24px', borderRadius: 10, border: 'none',
            background: danger ? '#DC2626' : C.navy, color: C.white,
            fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
            boxShadow: danger ? '0 4px 12px rgba(220,38,38,0.3)' : 'none',
            transition: 'all 0.15s',
          }}>
            {confirmLabel ?? 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Base modal ────────────────────────────────────────────────────
function Modal({
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(17,24,39,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: C.white, borderRadius: 18, padding: '28px 32px', maxWidth: 460, width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: C.navy }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: C.gray400,
            fontSize: '1.4rem', lineHeight: 1, padding: '2px 6px', borderRadius: 6,
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: C.gray600, marginBottom: 6 }}>
      {children}
    </label>
  );
}

function TextInput({
  value, onChange, placeholder, type = 'text', style,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; style?: React.CSSProperties;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '9px 12px', borderRadius: 10,
        border: `1.5px solid ${C.gray200}`, fontSize: '0.88rem', color: C.gray800,
        outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
        transition: 'border-color 0.15s', ...style,
      }}
      onFocus={(e) => { e.target.style.borderColor = C.navy; }}
      onBlur={(e) => { e.target.style.borderColor = C.gray200; }}
    />
  );
}

function SelectInput({
  value, onChange, options, style,
}: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  style?: React.CSSProperties;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', padding: '9px 12px', borderRadius: 10,
        border: `1.5px solid ${C.gray200}`, fontSize: '0.88rem', color: C.gray800,
        outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
        background: C.white, cursor: 'pointer', ...style,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── Role badge ─────────────────────────────────────────────────────
const ROLE_COLORS = {
  DRIVER:  { bg: C.driver.bg,  text: C.driver.text,  border: C.driver.border },
  STAFF:   { bg: C.staff.bg,   text: C.staff.text,   border: C.staff.border },
  MANAGER: { bg: C.manager.bg, text: C.manager.text, border: C.manager.border },
  ADMIN:   { bg: C.admin.bg,   text: C.admin.text,   border: C.admin.border },
} as const;

const ROLE_LABELS: Record<string, string> = {
  DRIVER: 'Người lái', STAFF: 'Nhân viên', MANAGER: 'Quản lý', ADMIN: 'Quản trị',
};

function RoleBadge({ role }: { role: string }) {
  const col = ROLE_COLORS[role as keyof typeof ROLE_COLORS] ?? C.driver;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 700, background: col.bg, color: col.text,
      border: `1px solid ${col.border}`, whiteSpace: 'nowrap',
    }}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ── Action icons ──────────────────────────────────────────────────
function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function LockToggleIcon({ locked }: { locked: boolean }) {
  if (locked) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 019.9-1"/>
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return (parts[0]![0] ?? '').toUpperCase();
  const first = parts[0]![0] ?? '';
  const last  = parts[parts.length - 1]![0] ?? '';
  return (first + last).toUpperCase();
}

function ViewUserModal({ user, onClose }: { user: UserItem; onClose: () => void }) {
  return (
    <Modal title="Thông tin tài khoản chi tiết" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: C.navy, color: C.white, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 700
          }}>
            {getInitials(user.fullName)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ borderBottom: `1px solid ${C.gray100}`, paddingBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', color: C.gray400, fontWeight: 700, textTransform: 'uppercase' }}>ID tài khoản</span>
            <div style={{ fontSize: '0.88rem', color: C.gray800, fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 2 }}>{user.id}</div>
          </div>
          <div style={{ borderBottom: `1px solid ${C.gray100}`, paddingBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', color: C.gray400, fontWeight: 700, textTransform: 'uppercase' }}>Họ tên</span>
            <div style={{ fontSize: '0.9rem', color: C.gray800, fontWeight: 600, marginTop: 2 }}>{user.fullName}</div>
          </div>
          <div style={{ borderBottom: `1px solid ${C.gray100}`, paddingBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', color: C.gray400, fontWeight: 700, textTransform: 'uppercase' }}>Địa chỉ Email</span>
            <div style={{ fontSize: '0.9rem', color: C.gray800, marginTop: 2 }}>{user.email}</div>
          </div>
          <div style={{ borderBottom: `1px solid ${C.gray100}`, paddingBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: C.gray400, fontWeight: 700, textTransform: 'uppercase' }}>Vai trò</span>
              <div style={{ marginTop: 2 }}><RoleBadge role={user.role} /></div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: C.gray400, fontWeight: 700, textTransform: 'uppercase', display: 'block', textAlign: 'right' }}>Trạng thái</span>
              <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: user.isActive ? '#22C55E' : '#EF4444',
                  display: 'inline-block'
                }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: user.isActive ? '#15803D' : '#DC2626' }}>
                  {user.isActive ? 'Đang hoạt động' : 'Đang bị khóa'}
                </span>
              </div>
            </div>
          </div>
          <div style={{ paddingBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', color: C.gray400, fontWeight: 700, textTransform: 'uppercase' }}>Ngày tạo tài khoản</span>
            <div style={{ fontSize: '0.88rem', color: C.gray800, marginTop: 2 }}>
              {new Date(user.createdAt).toLocaleString('vi-VN', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
              })}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onClose} style={{
            padding: '9px 24px', borderRadius: 10, border: 'none',
            background: C.navy, color: C.white, fontWeight: 600, fontSize: '0.88rem',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(30,58,95,0.2)'
          }}>
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Add / Edit modals ─────────────────────────────────────────────
function AddUserModal({ onAdd, onClose }: {
  onAdd: (input: { fullName: string; email: string; role: string; password: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [role, setRole]         = useState<string>('STAFF');
  const [password, setPassword]  = useState('');
  const [saving, setSaving]      = useState(false);
  const [error, setError]        = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { setError('Vui lòng nhập họ tên'); return; }
    if (!email.trim())    { setError('Vui lòng nhập email');   return; }
    if (!password.trim()) { setError('Vui lòng nhập mật khẩu'); return; }
    setError(''); setSaving(true);
    try {
      await onAdd({ fullName: fullName.trim(), email: email.trim(), role, password: password.trim() });
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.message ?? 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Thêm tài khoản mới" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && (
          <div style={{ background: '#FEE2E2', border: '1.5px solid #FECACA', borderRadius: 8, padding: '8px 12px', color: '#DC2626', fontSize: '0.82rem', fontWeight: 600 }}>
            {error}
          </div>
        )}
        <div>
          <FieldLabel>Họ tên</FieldLabel>
          <TextInput value={fullName} onChange={setFullName} placeholder="Ví dụ: Nguyễn Văn A" />
        </div>
        <div>
          <FieldLabel>Email</FieldLabel>
          <TextInput value={email} onChange={setEmail} placeholder=" Ví dụ: nvantest@parksmart.vn" type="email" />
        </div>
        <div>
          <FieldLabel>Vai trò</FieldLabel>
          <SelectInput value={role} onChange={setRole} options={[
            { value: 'STAFF',   label: 'Nhân viên (STAFF)' },
            { value: 'MANAGER', label: 'Quản lý (MANAGER)' },
            { value: 'ADMIN',   label: 'Quản trị viên (ADMIN)' },
          ]} />
        </div>
        <div>
          <FieldLabel>Mật khẩu</FieldLabel>
          <TextInput value={password} onChange={setPassword} placeholder="Nhập mật khẩu" type="password" />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={{
            padding: '9px 22px', borderRadius: 10, border: `1.5px solid ${C.gray200}`,
            background: C.white, color: C.gray600, fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
          }}>Hủy</button>
          <button type="submit" disabled={saving} style={{
            padding: '9px 22px', borderRadius: 10, border: 'none',
            background: saving ? C.gray200 : C.navy, color: C.white,
            fontWeight: 600, fontSize: '0.88rem', cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Đang lưu…' : 'Tạo tài khoản'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({
  user, onSave, onClose,
}: { user: UserItem; onSave: (id: string, data: { fullName: string; role: string }) => void; onClose: () => void }) {
  const [fullName, setFullName] = useState(user.fullName);
  const [role, setRole]         = useState<string>(user.role);
  const [saving, setSaving]      = useState(false);
  const [error, setError]        = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { setError('Họ tên không được để trống'); return; }
    setError(''); setSaving(true);
    try {
      await onSave(user.id, { fullName: fullName.trim(), role });
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.message ?? 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Chỉnh sửa tài khoản" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: C.gray50, borderRadius: 10, padding: '10px 14px', fontSize: '0.82rem', color: C.gray600 }}>
          <strong>Email:</strong> {user.email}
        </div>
        {error && (
          <div style={{ background: '#FEE2E2', border: '1.5px solid #FECACA', borderRadius: 8, padding: '8px 12px', color: '#DC2626', fontSize: '0.82rem', fontWeight: 600 }}>
            {error}
          </div>
        )}
        <div>
          <FieldLabel>Họ tên</FieldLabel>
          <TextInput value={fullName} onChange={setFullName} placeholder="Nhập họ tên" />
        </div>
        <div>
          <FieldLabel>Vai trò</FieldLabel>
          <SelectInput value={role} onChange={setRole} options={[
            { value: 'STAFF',   label: 'Nhân viên (STAFF)' },
            { value: 'MANAGER', label: 'Quản lý (MANAGER)' },
            { value: 'ADMIN',   label: 'Quản trị viên (ADMIN)' },
          ]} />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={{
            padding: '9px 22px', borderRadius: 10, border: `1.5px solid ${C.gray200}`,
            background: C.white, color: C.gray600, fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
          }}>Hủy</button>
          <button type="submit" disabled={saving} style={{
            padding: '9px 22px', borderRadius: 10, border: 'none',
            background: saving ? C.gray200 : C.navy, color: C.white,
            fontWeight: 600, fontSize: '0.88rem', cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Reset password dialog ─────────────────────────────────────────
function ResetPasswordDialog({
  tempPassword, onClose,
}: { tempPassword: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(tempPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Modal title="Mật khẩu mới" onClose={onClose}>
      <p style={{ color: C.gray600, fontSize: '0.88rem', margin: '0 0 20px', lineHeight: 1.6 }}>
        Đây là mật khẩu tạm thời. Hãy gửi cho người dùng và yêu cầu đổi mật khẩu sau khi đăng nhập.
        Mật khẩu này chỉ hiển thị <strong>một lần duy nhất</strong>.
      </p>
      <div style={{
        background: '#FFF7ED', border: '1.5px solid #FED7AA',
        borderRadius: 12, padding: '16px 20px', textAlign: 'center', marginBottom: 20,
      }}>
        <p style={{ margin: '0 0 8px', fontSize: '0.75rem', fontWeight: 700, color: '#9A3412', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Mật khẩu tạm thời
        </p>
        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#C2410C', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
          {tempPassword}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button onClick={copy} style={{
          padding: '9px 22px', borderRadius: 10, border: 'none',
          background: copied ? '#16A34A' : C.navy, color: C.white,
          fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
          transition: 'background 0.2s',
        }}>
          {copied ? 'Đã sao chép!' : 'Sao chép mật khẩu'}
        </button>
        <button onClick={onClose} style={{
          padding: '9px 22px', borderRadius: 10, border: `1.5px solid ${C.gray200}`,
          background: C.white, color: C.gray600, fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
        }}>Đóng</button>
      </div>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export function UserManagementPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers]         = useState<UserItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [toast, setToast]         = useState<Toast>(null);
  const [search, setSearch]       = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState('');

  // Modals
  const [showAdd, setShowAdd]       = useState(false);
  const [editTarget, setEditTarget]  = useState<UserItem | null>(null);
  const [resetPasswordFor, setResetPasswordFor] = useState<UserItem | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [viewTarget, setViewTarget] = useState<UserItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);

  // Confirm dialog
  const [confirmTarget, setConfirmTarget] = useState<UserItem | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type });

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await getUsers({
        ...(filterRole   ? { role: filterRole }   : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      let result = data;
      if (filterActive === 'active')   result = result.filter((u) => u.isActive);
      if (filterActive === 'locked')  result = result.filter((u) => !u.isActive);
      setUsers(result);
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.message ?? 'Không tải được danh sách';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRole, search, filterActive]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleAdd = async (input: { fullName: string; email: string; role: string; password: string }) => {
    await createUser(input as any);
    setShowAdd(false);
    showToast('Tạo tài khoản thành công!', 'success');
    await fetchUsers();
  };

  const handleSave = async (id: string, data: { fullName: string; role: string }) => {
    await updateUser(id, data as any);
    setEditTarget(null);
    showToast('Cập nhật thành công!', 'success');
    await fetchUsers();
  };

  const handleToggleStatus = async () => {
    if (!confirmTarget) return;
    const user = confirmTarget;
    setConfirmTarget(null);
    try {
      await toggleUserStatus(user.id, !user.isActive);
      showToast(
        user.isActive ? `Đã khóa tài khoản "${user.fullName}"` : `Đã mở khóa tài khoản "${user.fullName}"`,
        'success'
      );
      await fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Không thể thay đổi trạng thái';
      showToast(msg, 'error');
    }
  };

  const handleResetPassword = async (user: UserItem) => {
    try {
      const { tempPassword: pwd } = await resetUserPassword(user.id);
      setTempPassword(pwd);
      setResetPasswordFor(user);
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.message ?? 'Lỗi đặt lại mật khẩu';
      showToast(msg, 'error');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    const user = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteUser(user.id);
      showToast(`Đã xóa tài khoản "${user.fullName}" thành công!`, 'success');
      await fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.message ?? 'Không thể xóa tài khoản';
      showToast(msg, 'error');
    }
  };

  // Count active admins
  const activeAdminCount = users.filter((u) => u.role === 'ADMIN' && u.isActive).length;

  const canToggleLock = (u: UserItem) => {
    if (u.id === currentUser?.id) return false; // own account
    if (u.role === 'ADMIN' && u.isActive && activeAdminCount <= 1) return false; // last admin
    return true;
  };

  const canDelete = (u: UserItem) => {
    if (u.id === currentUser?.id) return false; // own account
    if (u.role === 'ADMIN' && activeAdminCount <= 1) return false; // last admin
    return true;
  };

  return (
    <div>
      <ToastBanner toast={toast} onClear={() => setToast(null)} />

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: C.navy }}>Quản lý tài khoản</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: C.gray600 }}>
            {loading ? '…' : `${users.length} tài khoản`}
            {filterRole && ` · Vai trò: ${ROLE_LABELS[filterRole]}`}
            {filterActive === 'active' && ' · Đang hoạt động'}
            {filterActive === 'locked' && ' · Đã khóa'}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            padding: '10px 20px', borderRadius: 12, border: 'none',
            background: C.navy, color: C.white, fontWeight: 700, fontSize: '0.88rem',
            cursor: 'pointer', boxShadow: '0 4px 14px rgba(30,58,95,0.25)',
            display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
          }}
          onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#152D4A'; }}
          onMouseOut={(e)  => { (e.currentTarget as HTMLButtonElement).style.background = C.navy; }}
        >
          <span style={{ fontSize: '1.2rem', fontWeight: 700, lineHeight: 1 }}>+</span>
          Thêm tài khoản
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
        background: C.white, borderRadius: 14, padding: '14px 16px',
        boxShadow: C.shadow, marginBottom: '1rem',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 360 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.gray400 }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text" placeholder="Tìm theo tên hoặc email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 32px', borderRadius: 10,
              border: `1.5px solid ${C.gray200}`, fontSize: '0.875rem', color: C.gray800,
              outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Role filter */}
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${C.gray200}`,
            fontSize: '0.875rem', color: C.gray800, outline: 'none',
            background: C.white, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <option value="">Tất cả vai trò</option>
          <option value="STAFF">Nhân viên</option>
          <option value="MANAGER">Quản lý</option>
          <option value="ADMIN">Quản trị viên</option>
        </select>

        {/* Status filter */}
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${C.gray200}`,
            fontSize: '0.875rem', color: C.gray800, outline: 'none',
            background: C.white, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="locked">Đã khóa</option>
        </select>

        {/* Refresh */}
        <button
          onClick={fetchUsers}
          style={{
            padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${C.gray200}`,
            background: C.white, color: C.gray600, fontSize: '0.875rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          ⟳ Làm mới
        </button>
      </div>

      {/* ── Table card ── */}
      <div style={{
        background: C.white, borderRadius: 16, boxShadow: C.shadow,
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: C.gray400, fontSize: '0.95rem' }}>
            Đang tải…
          </div>
        ) : error && users.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#DC2626', fontSize: '0.95rem' }}>
            {error}
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: C.gray400, fontSize: '0.95rem' }}>
            Không có tài khoản nào phù hợp với bộ lọc.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.gray50 }}>
                {['Họ tên', 'Email', 'Vai trò', 'Trạng thái', 'Ngày tạo', 'Hành động'].map((h) => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: '0.75rem', fontWeight: 700, color: C.gray600,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    borderBottom: `1px solid ${C.gray200}`,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${C.gray100}`, transition: 'background 0.1s' }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = C.gray50; }}
                  onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: C.gray800 }}>{u.fullName}</span>
                    {u.id === currentUser?.id && (
                      <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#EDE9FE', color: '#7C3AED', border: '1px solid #C4B5FD', borderRadius: 999, padding: '1px 7px', fontWeight: 700 }}>
                        (Bạn)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.875rem', color: C.gray600 }}>{u.email}</td>
                  <td style={{ padding: '14px 16px' }}><RoleBadge role={u.role} /></td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 12, fontWeight: 700,
                      color: u.isActive ? '#15803D' : '#DC2626',
                    }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: u.isActive ? '#22C55E' : '#EF4444',
                        display: 'inline-block', flexShrink: 0,
                      }} />
                      {u.isActive ? 'Hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: C.gray600 }}>
                    {new Date(u.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {/* View Details */}
                      <button
                        onClick={() => setViewTarget(u)}
                        title="Xem chi tiết"
                        style={{
                          padding: 7, borderRadius: 8, border: '1.5px solid #E5E7EB',
                          background: C.white, color: C.gray600, cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                        }}
                        onMouseOver={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#F3F4F6'; b.style.borderColor = C.gray600; }}
                        onMouseOut={(e)  => { const b = e.currentTarget as HTMLButtonElement; b.style.background = C.white; b.style.borderColor = '#E5E7EB'; }}
                      >
                        <EyeIcon />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => setEditTarget(u)}
                        title="Sửa"
                        style={{
                          padding: 7, borderRadius: 8, border: '1.5px solid #E5E7EB',
                          background: C.white, color: C.navy, cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                        }}
                        onMouseOver={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#EFF6FF'; b.style.borderColor = C.navy; }}
                        onMouseOut={(e)  => { const b = e.currentTarget as HTMLButtonElement; b.style.background = C.white; b.style.borderColor = '#E5E7EB'; }}
                      >
                        <PencilIcon />
                      </button>

                      {/* Lock / Unlock */}
                      {(() => {
                        const lockable = canToggleLock(u);
                        return (
                          <button
                            onClick={() => lockable && setConfirmTarget(u)}
                            title={lockable
                              ? (u.isActive ? 'Khóa tài khoản' : 'Mở khóa')
                              : (u.id === currentUser?.id
                                ? 'Không thể tự khóa chính mình'
                                : 'Admin hoạt động cuối cùng')
                            }
                            disabled={!lockable}
                            style={{
                              padding: 7, borderRadius: 8,
                              border: lockable ? '1.5px solid #E5E7EB' : '1.5px solid #F3F4F6',
                              background: lockable ? C.white : '#F9FAFB',
                              color: lockable ? (u.isActive ? '#DC2626' : '#15803D') : '#D1D5DB',
                              cursor: lockable ? 'pointer' : 'not-allowed',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}
                          >
                            <LockToggleIcon locked={!u.isActive} />
                          </button>
                        );
                      })()}

                      {/* Reset password */}
                      <button
                        onClick={() => handleResetPassword(u)}
                        title="Đặt lại mật khẩu"
                        style={{
                          padding: 7, borderRadius: 8, border: '1.5px solid #E5E7EB',
                          background: C.white, color: C.gray600, cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                        }}
                        onMouseOver={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#FFF7ED'; b.style.borderColor = '#FED7AA'; }}
                        onMouseOut={(e)  => { const b = e.currentTarget as HTMLButtonElement; b.style.background = C.white; b.style.borderColor = '#E5E7EB'; }}
                      >
                        <KeyIcon />
                      </button>

                      {/* Delete */}
                      {(() => {
                        const deletable = canDelete(u);
                        return (
                          <button
                            onClick={() => deletable && setDeleteTarget(u)}
                            title={deletable ? 'Xóa tài khoản' : 'Không thể xóa chính mình hoặc admin duy nhất'}
                            disabled={!deletable}
                            style={{
                              padding: 7, borderRadius: 8,
                              border: deletable ? '1.5px solid #E5E7EB' : '1.5px solid #F9FAFB',
                              background: deletable ? C.white : '#F9FAFB',
                              color: deletable ? '#DC2626' : '#D1D5DB',
                              cursor: deletable ? 'pointer' : 'not-allowed',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}
                            onMouseOver={(e) => { if (deletable) { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#FEE2E2'; b.style.borderColor = '#FCA5A5'; } }}
                            onMouseOut={(e)  => { if (deletable) { const b = e.currentTarget as HTMLButtonElement; b.style.background = C.white; b.style.borderColor = '#E5E7EB'; } }}
                          >
                            <TrashIcon />
                          </button>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modals ── */}
      {showAdd && (
        <AddUserModal
          onAdd={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
        />
      )}

      {confirmTarget && (
        <ConfirmDialog
          title={confirmTarget.isActive ? 'Khóa tài khoản?' : 'Mở khóa tài khoản?'}
          message={
            confirmTarget.isActive
              ? `Bạn có chắc muốn khóa tài khoản "${confirmTarget.fullName}"? Người dùng sẽ không thể đăng nhập cho đến khi được mở khóa.`
              : `Mở khóa tài khoản "${confirmTarget.fullName}" để người dùng có thể đăng nhập lại?`
          }
          confirmLabel={confirmTarget.isActive ? 'Khóa' : 'Mở khóa'}
          danger={confirmTarget.isActive}
          onConfirm={handleToggleStatus}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {resetPasswordFor && tempPassword && (
        <ResetPasswordDialog
          tempPassword={tempPassword}
          onClose={() => { setResetPasswordFor(null); setTempPassword(''); }}
        />
      )}

      {viewTarget && (
        <ViewUserModal
          user={viewTarget}
          onClose={() => setViewTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Xóa tài khoản vĩnh viễn?"
          message={`Bạn có chắc chắn muốn xóa tài khoản "${deleteTarget.fullName}" (${deleteTarget.email})? Thao tác này sẽ xóa tất cả các dữ liệu liên quan (xe, đặt chỗ, gói tháng) và không thể hoàn tác.`}
          confirmLabel="Xóa vĩnh viễn"
          danger={true}
          onConfirm={handleDeleteUser}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
