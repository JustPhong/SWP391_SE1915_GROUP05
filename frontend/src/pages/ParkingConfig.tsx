import { useState, useEffect, useCallback } from 'react';
import { getPermissions, togglePermission, type PermissionMatrix, type PermissionItem } from '../api/permissionApi';

// ── Design tokens ──────────────────────────────────────────────────
const C = {
  navy: '#1E3A5F',
  white: '#FFFFFF',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  gray600: '#5C6B7A',
  gray800: '#2D3A45',
  shadow: '0 8px 32px rgba(30,58,95,0.10)',
  // Role badge colours
  driver: { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' },
  staff: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  manager: { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
  admin: { bg: '#EDE9FE', text: '#7C3AED', border: '#C4B5FD' },
} as const;

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  DRIVER: C.driver,
  STAFF: C.staff,
  MANAGER: C.manager,
  ADMIN: C.admin,
};

const ROLE_LABELS: Record<string, string> = {
  DRIVER: 'Người lái',
  STAFF: 'Nhân viên',
  MANAGER: 'Quản lý',
  ADMIN: 'Quản trị',
};

// Core permissions that ADMIN column locks
const LOCKED_ADMIN_PERMS = ['account.manage', 'permission.manage'];

// ── Toast ───────────────────────────────────────────────────────────
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
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxWidth: 400,
    }}>
      {toast.message}
    </div>
  );
}

// ── Toggle cell ────────────────────────────────────────────────────
function ToggleCell({
  role,
  permKey,
  allowed,
  pending,
  onToggle,
}: {
  role: string;
  permKey: string;
  allowed: boolean;
  pending: boolean;
  onToggle: (permKey: string, role: string, allowed: boolean) => void;
}) {
  const isLocked = role === 'ADMIN' && LOCKED_ADMIN_PERMS.includes(permKey);
  const isPending = pending;

  const handleToggle = () => {
    if (isLocked || isPending) return;
    onToggle(permKey, role, !allowed);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <button
        onClick={handleToggle}
        disabled={isLocked || isPending}
        title={
          isLocked
            ? 'Quyền cốt lõi, không thể tắt'
            : isPending
              ? 'Đang cập nhật…'
              : allowed
                ? 'Nhấn để tắt'
                : 'Nhấn để bật'
        }
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          border: 'none',
          background: isLocked
            ? C.gray200
            : isPending
              ? C.gray200
              : allowed
                ? '#7C3AED'
                : C.gray200,
          cursor: isLocked || isPending ? 'not-allowed' : 'pointer',
          position: 'relative',
          transition: 'background 0.2s',
          display: 'flex',
          alignItems: 'center',
          padding: 0,
          flexShrink: 0,
        }}
      >
        <span style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: C.white,
          position: 'absolute',
          left: isLocked || isPending
            ? allowed ? 20 : 2
            : allowed ? 20 : 2,
          transform: 'translateX(-50%)',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {(allowed || (isLocked && allowed)) && !isPending && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {isLocked && (
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={C.gray400} strokeWidth="3" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}

// ── Role column header ─────────────────────────────────────────────
function RoleColHeader({ role }: { role: string }) {
  const col = ROLE_COLORS[role] ?? C.driver;
  return (
    <div style={{ textAlign: 'center', minWidth: 80 }}>
      <div style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: col.bg,
        color: col.text,
        border: `1px solid ${col.border}`,
        whiteSpace: 'nowrap',
      }}>
        {ROLE_LABELS[role] ?? role}
      </div>
    </div>
  );
}

// ── Category section ───────────────────────────────────────────────
function CategorySection({
  category,
  permissions,
  roleMatrix,
  roles,
  pendingKey,
  onToggle,
}: {
  category: string;
  permissions: PermissionItem[];
  roleMatrix: Record<string, Record<string, boolean>>;
  roles: string[];
  pendingKey: string | null;
  onToggle: (permKey: string, role: string, allowed: boolean) => void;
}) {
  return (
    <>
      {/* Category header row */}
      <tr>
        <td
          colSpan={roles.length + 1}
          style={{
            background: '#EFF6FF',
            padding: '10px 16px',
            fontWeight: 800,
            fontSize: '0.8rem',
            color: '#1E40AF',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            borderTop: '1px solid #BFDBFE',
            borderBottom: '1px solid #BFDBFE',
          }}
        >
          {category}
        </td>
      </tr>
      {/* Permission rows */}
      {permissions.map((perm) => (
        <tr
          key={perm.key}
          style={{ transition: 'background 0.1s' }}
          onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = C.gray50; }}
          onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {/* Label cell */}
          <td style={{ padding: '12px 16px', borderBottom: `1px solid ${C.gray100}` }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: C.gray800 }}>{perm.label}</div>
            <div style={{ fontSize: '0.72rem', color: C.gray400, fontFamily: 'monospace', marginTop: 2 }}>{perm.key}</div>
          </td>
          {/* Toggle cells */}
          {roles.map((role) => (
            <td
              key={role}
              style={{
                padding: '12px 8px',
                borderBottom: `1px solid ${C.gray100}`,
                borderLeft: `1px solid ${C.gray100}`,
              }}
            >
              <ToggleCell
                role={role}
                permKey={perm.key}
                allowed={roleMatrix[role]?.[perm.key] ?? false}
                pending={pendingKey === `${role}:${perm.key}`}
                onToggle={onToggle}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export function PermissionsPage() {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<Toast>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type });

  const fetchMatrix = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await getPermissions();
      setMatrix(data);
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.message ?? 'Không tải được ma trận phân quyền';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMatrix(); }, [fetchMatrix]);

  const handleToggle = async (permKey: string, role: string, allowed: boolean) => {
    const key = `${role}:${permKey}`;
    setPendingKey(key);

    // Optimistic update
    setMatrix((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      next.roleMatrix = { ...next.roleMatrix };
      next.roleMatrix[role] = { ...next.roleMatrix[role], [permKey]: allowed };
      return next;
    });

    try {
      await togglePermission({ role, permissionKey: permKey, allowed });
      showToast('Cập nhật quyền thành công!', 'success');
    } catch (err: any) {
      // Revert optimistic update
      setMatrix((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        next.roleMatrix = { ...next.roleMatrix };
        next.roleMatrix[role] = { ...next.roleMatrix[role], [permKey]: !allowed };
        return next;
      });
      const msg = err.response?.data?.message ?? err.message ?? 'Cập nhật quyền thất bại';
      showToast(msg, 'error');
    } finally {
      setPendingKey(null);
    }
  };

  const categories = matrix ? Object.keys(matrix.permissions) : [];
  const totalPerms = categories.reduce((sum, cat) => sum + (matrix?.permissions[cat]?.length ?? 0), 0);

  return (
    <div>
      <ToastBanner toast={toast} onClear={() => setToast(null)} />

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: C.navy }}>Phân quyền</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: C.gray600 }}>
            {loading ? '…' : `${totalPerms} quyền · ${categories.length} nhóm`}
          </p>
        </div>
        <button
          onClick={fetchMatrix}
          style={{
            padding: '10px 20px', borderRadius: 12, border: `1.5px solid ${C.gray200}`,
            background: C.white, color: C.navy, fontWeight: 700, fontSize: '0.88rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s',
          }}
          onMouseOver={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = C.gray50; }}
          onMouseOut={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = C.white; }}
        >
          ⟳ Làm mới
        </button>
      </div>

      {/* ── Info banner ── */}
      <div style={{
        background: '#FFF7ED',
        border: '1.5px solid #FED7AA',
        borderRadius: 12,
        padding: '12px 16px',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        fontSize: '0.82rem',
        color: '#9A3412',
        lineHeight: 1.6,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A3412" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Admin luôn có đầy đủ mọi quyền. Những quyền cốt lõi (
        <code style={{ background: '#FED7AA', borderRadius: 4, padding: '1px 4px' }}>account.manage</code>,{' '}
        <code style={{ background: '#FED7AA', borderRadius: 4, padding: '1px 4px' }}>permission.manage</code>) không thể tắt cho Admin.
      </div>

      {/* ── Matrix card ── */}
      <div style={{
        background: C.white,
        borderRadius: 16,
        boxShadow: C.shadow,
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: C.gray400, fontSize: '0.95rem' }}>
            Đang tải ma trận phân quyền…
          </div>
        ) : error && !matrix ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#DC2626', fontSize: '0.95rem' }}>
            {error}
          </div>
        ) : matrix ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr style={{ background: C.gray50 }}>
                  <th style={{
                    padding: '14px 16px',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: C.gray600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    borderBottom: `2px solid ${C.gray200}`,
                    minWidth: 200,
                  }}>
                    Quyền
                  </th>
                  {matrix.roles.map((role) => (
                    <th key={role} style={{
                      padding: '14px 8px',
                      textAlign: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: C.gray600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: `2px solid ${C.gray200}`,
                      borderLeft: `1px solid ${C.gray100}`,
                    }}>
                      <RoleColHeader role={role} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <CategorySection
                    key={category}
                    category={category}
                    permissions={matrix.permissions[category]}
                    roleMatrix={matrix.roleMatrix}
                    roles={matrix.roles}
                    pendingKey={pendingKey}
                    onToggle={handleToggle}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
