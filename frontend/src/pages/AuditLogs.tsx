import { useState, useEffect, useCallback } from 'react';
import { getAuditLogs, type AuditLogItem } from '../api/auditLogApi';
import { HistoryIcon } from '../components/ui/Icons';

// ── Design tokens (mirror UserManagement page) ─────────────────
const C = {
  navy:       '#1E3A5F',
  purple:     '#7C3AED',
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
  system:     { bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
} as const;

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  DRIVER:  C.driver,
  STAFF:   C.staff,
  MANAGER: C.manager,
  ADMIN:   C.admin,
};

const ROLE_LABELS: Record<string, string> = {
  DRIVER:  'Người lái',
  STAFF:   'Nhân viên',
  MANAGER: 'Quản lý',
  ADMIN:   'Quản trị',
};

function RoleBadge({ role }: { role: string | null }) {
  if (!role) {
    return (
      <span style={{
        display: 'inline-block', padding: '3px 10px', borderRadius: 999,
        fontSize: 12, fontWeight: 700, background: C.system.bg, color: C.system.text,
        border: `1px solid ${C.system.border}`, whiteSpace: 'nowrap',
      }}>
        Hệ thống
      </span>
    );
  }
  const col = ROLE_COLORS[role] ?? C.driver;
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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

const PAGE_SIZE = 20;

export function AuditLogsPage() {
  const [rows, setRows]       = useState<AuditLogItem[]>([]);
  const [total, setTotal]     = useState(0);
  const [skip, setSkip]       = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchPage = useCallback(async (offset: number) => {
    setLoading(true); setError('');
    try {
      const data = await getAuditLogs(offset, PAGE_SIZE);
      setRows(data.rows);
      setTotal(data.total);
      setSkip(offset);
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.message ?? 'Không tải được nhật ký';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPage(0); }, [fetchPage]);

  const pageStart = total === 0 ? 0 : skip + 1;
  const pageEnd   = Math.min(skip + PAGE_SIZE, total);
  const canPrev   = skip > 0;
  const canNext   = skip + PAGE_SIZE < total;

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: C.navy }}>Nhật ký hệ thống</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: C.gray600 }}>
            {loading ? '…' : `${total} bản ghi`}
          </p>
        </div>
        <button
          onClick={() => fetchPage(skip)}
          style={{
            padding: '10px 20px', borderRadius: 12, border: `1.5px solid ${C.gray200}`,
            background: C.white, color: C.navy, fontWeight: 700, fontSize: '0.88rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s',
          }}
          onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = C.gray50; }}
          onMouseOut={(e)  => { (e.currentTarget as HTMLButtonElement).style.background = C.white; }}
        >
          <HistoryIcon size={14} />
          Làm mới
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
        ) : error && rows.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#DC2626', fontSize: '0.95rem' }}>
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: C.gray400, fontSize: '0.95rem' }}>
            Chưa có nhật ký nào.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.gray50 }}>
                {['Thời gian', 'Người thực hiện', 'Hành động', 'Đối tượng'].map((h) => (
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
              {rows.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: `1px solid ${C.gray100}`, transition: 'background 0.1s' }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = C.gray50; }}
                  onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: C.gray600, whiteSpace: 'nowrap' }}>
                    {formatDateTime(r.createdAt)}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: C.gray800 }}>
                        {r.actorName ?? '—'}
                      </span>
                      <RoleBadge role={r.actorRole} />
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.875rem', color: C.gray800 }}>
                    {r.description}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: C.gray600, fontFamily: 'monospace' }}>
                    {r.targetType ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {!loading && total > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: '1rem', fontSize: '0.85rem', color: C.gray600,
        }}>
          <span>
            Hiển thị <strong style={{ color: C.gray800 }}>{pageStart}</strong>–
            <strong style={{ color: C.gray800 }}>{pageEnd}</strong> trong tổng số{' '}
            <strong style={{ color: C.gray800 }}>{total}</strong> bản ghi
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => fetchPage(Math.max(0, skip - PAGE_SIZE))}
              disabled={!canPrev}
              style={{
                padding: '8px 16px', borderRadius: 10,
                border: `1.5px solid ${C.gray200}`,
                background: C.white, color: canPrev ? C.navy : C.gray400,
                fontWeight: 600, fontSize: '0.85rem',
                cursor: canPrev ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              ‹ Trước
            </button>
            <button
              onClick={() => fetchPage(skip + PAGE_SIZE)}
              disabled={!canNext}
              style={{
                padding: '8px 16px', borderRadius: 10,
                border: `1.5px solid ${C.gray200}`,
                background: C.white, color: canNext ? C.navy : C.gray400,
                fontWeight: 600, fontSize: '0.85rem',
                cursor: canNext ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              Sau ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
