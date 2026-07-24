import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listBookings,
  markNoShow,
  type BookingItem,
} from '../api/bookingApi';
import { normalize as normalizePlate } from '../utils/plate';

// ═════════════════════════════════════════════════════
//  DESIGN TOKENS  (approved palette matching CheckIn)
// ═════════════════════════════════════════════════════
const C = {
  navy:        '#0B2F6B',
  navyLight:   '#153B75',
  activeBlue:  '#1F5EFF',
  bg:          '#F5F8FE',
  white:       '#FFFFFF',
  green:       '#16A34A',
  greenBg:     '#EFFAF2',
  greenBorder: '#BBF7D0',
  warning:     '#D97706',
  warningBg:   '#FEF3C3',
  warningBorder:'#FDE68A',
  danger:      '#DC2626',
  dangerBg:    '#FEE2E2',
  dangerBorder:'#FECACA',
  gray50:      '#F8FAFC',
  gray100:     '#F1F5F9',
  gray200:     '#E3EAF5',
  gray400:     '#94A3B8',
  gray500:     '#64748B',
  gray600:     '#5C6B7A',
  gray800:     '#10264F',
  border:      '#E3EAF5',
  shadow:      '0 8px 30px rgba(11,47,107,0.08)',
  cardShadow:  '0 1px 3px rgba(11,47,107,0.04), 0 6px 18px rgba(11,47,107,0.06)',
  radius:      16,
};

// ═════════════════════════════════════════════════════
//  DERIVED STATUS TYPE
// ═════════════════════════════════════════════════════
type DerivedStatus = 'SAP_DEN' | 'QUA_GIO' | 'DA_VAO' | 'VANG_MAT';
type TabKey = 'DANG_CHO' | 'DA_VAO' | 'VANG_MAT';

const TAB_CONFIG: { key: TabKey; label: string; icon: string }[] = [
  { key: 'DANG_CHO', label: 'Đang chờ', icon: '🕐' },
  { key: 'DA_VAO',   label: 'Đã vào',   icon: '✅' },
  { key: 'VANG_MAT', label: 'Vắng mặt', icon: '🚫' },
];

type Toast = { message: string; type: 'success' | 'error' } | null;

// ═════════════════════════════════════════════════════
//  HELPERS
// ═════════════════════════════════════════════════════

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


/** Centralized countdown formatting */
function formatCountdown(expectedArrival: string): {
  text: string;
  isOverdue: boolean;
} {
  const arrival = new Date(expectedArrival).getTime();
  const now = Date.now();
  if (isNaN(arrival)) return { text: '—', isOverdue: false };

  const diffMs = arrival - now;

  if (diffMs > 0) {
    // Future — show remaining time
    const totalSec = Math.floor(diffMs / 1000);
    const totalMin = Math.floor(totalSec / 60);
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return { text: `Còn ${days} ngày`, isOverdue: false };
    }
    if (hours > 0) {
      return { text: `Còn ${hours} giờ ${mins} phút`, isOverdue: false };
    }
    return { text: `Còn ${mins} phút`, isOverdue: false };
  }

  // Past — show overdue duration
  const overdueSec = Math.floor(-diffMs / 1000);
  const overdueMin = Math.floor(overdueSec / 60);
  const overdueHours = Math.floor(overdueMin / 60);
  const overdueMins = overdueMin % 60;

  if (overdueHours > 0) {
    return { text: `Quá giờ ${overdueHours} giờ ${overdueMins} phút`, isOverdue: true };
  }
  return { text: `Quá giờ ${overdueMins} phút`, isOverdue: true };
}

function deriveStatus(
  b: BookingItem,
  _now: number
): DerivedStatus {
  if (b.status === 'FULFILLED') return 'DA_VAO';
  if (b.status === 'NO_SHOW') return 'VANG_MAT';
  // ACTIVE — derive from expected arrival
  const arrival = new Date(b.expectedArrival).getTime();
  if (isNaN(arrival) || arrival > _now) return 'SAP_DEN';
  return 'QUA_GIO';
}



const PAGE_SIZE_OPTIONS = [10, 20, 50];

// ═════════════════════════════════════════════════════
//  ICONS  (minimal inline SVGs)
// ═════════════════════════════════════════════════════

function IconSearch({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconRefresh({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconChevronLeft({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconChevronRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconClock({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconAlertCircle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconUserX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="18" y1="8" x2="23" y2="13" /><line x1="23" y1="8" x2="18" y2="13" />
    </svg>
  );
}

// ═════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═════════════════════════════════════════════════════

function ToastBanner({ toast, onClear }: { toast: Toast; onClear: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClear, 3500);
    return () => clearTimeout(t);
  }, [toast, onClear]);
  if (!toast) return null;
  const bg = toast.type === 'success' ? C.greenBg : C.dangerBg;
  const text = toast.type === 'success' ? '#15803D' : C.danger;
  const border = toast.type === 'success' ? C.greenBorder : C.dangerBorder;
  return (
    <div style={{
      position: 'fixed', top: 20, right: 24, zIndex: 9999,
      background: bg, border: `1.5px solid ${border}`, borderRadius: 12,
      padding: '12px 20px', color: text, fontWeight: 600, fontSize: '0.9rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxWidth: 400,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {toast.type === 'success' ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
      {toast.message}
    </div>
  );
}

function StatusBadge({ derivedStatus }: { derivedStatus: DerivedStatus }) {
  const config: Record<DerivedStatus, { bg: string; border: string; color: string; icon: React.ReactNode; label: string }> = {
    SAP_DEN: {
      bg: C.warningBg, border: C.warningBorder, color: '#92400E',
      icon: <IconClock size={12} />,
      label: 'Sắp đến',
    },
    QUA_GIO: {
      bg: C.dangerBg, border: C.dangerBorder, color: '#991B1B',
      icon: <IconAlertCircle size={12} />,
      label: 'Quá giờ',
    },
    DA_VAO: {
      bg: C.greenBg, border: C.greenBorder, color: '#15803D',
      icon: <IconCheck size={12} />,
      label: 'Đã vào',
    },
    VANG_MAT: {
      bg: '#F1F5F9', border: '#E2E8F0', color: '#64748B',
      icon: <IconUserX size={12} />,
      label: 'Vắng mặt',
    },
  };
  const s = config[derivedStatus];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '0.25rem 0.65rem', borderRadius: 20,
      fontSize: '0.75rem', fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {s.icon}
      {s.label}
    </span>
  );
}



function PlateDisplay({ plate }: { plate: string }) {
  return (
    <span style={{
      fontFamily: "'Consolas','Courier New',monospace",
      fontWeight: 700, fontSize: '0.88rem',
      color: C.navy, letterSpacing: '0.03em',
    }}>
      {plate}
    </span>
  );
}



function CountdownCell({ expectedArrival, tick }: { expectedArrival: string; tick: number }) {
  void tick; // force re-render
  const { text, isOverdue } = formatCountdown(expectedArrival);
  return (
    <span style={{
      fontSize: '0.82rem', fontWeight: 700,
      color: isOverdue ? C.danger : C.navy,
    }}>
      {text}
    </span>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmColor,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(17,24,39,0.45)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div style={{
        background: C.white, borderRadius: 16, padding: '1.5rem',
        width: 420, boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h3 id="confirm-title" style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', fontWeight: 800, color: C.navy }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: C.gray600, lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '0.6rem 1.1rem', background: C.white, color: C.gray600,
              border: `1.5px solid ${C.gray200}`, borderRadius: 10,
              fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.6rem 1.1rem', background: confirmColor, color: C.white,
              border: 'none', borderRadius: 10,
              fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} style={{ borderBottom: `1px solid ${C.gray100}` }}>
          {Array.from({ length: 7 }).map((_, j) => (
            <td key={j} style={{ padding: '0.85rem 1rem' }}>
              <div style={{
                height: 14, width: j === 0 ? 100 : j === 6 ? 80 : 60,
                background: C.gray100, borderRadius: 6,
                animation: 'pulse 1.5s infinite',
              }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}



// ═════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════

export function BookingManagementPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('DANG_CHO');
  const [toast, setToast] = useState<Toast>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    kind: 'noShow';
    booking: BookingItem;
  } | null>(null);
  const [tick, setTick] = useState(0);

  // Filter state
  const [searchPlate, setSearchPlate] = useState('');
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBookings();
      setBookings(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách đặt trước.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live countdown for DANG_CHO tab (update every 60 seconds for performance)
  const tickRef = useRef<number | null>(null);
  useEffect(() => {
    if (tab !== 'DANG_CHO') return;
    tickRef.current = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [tab]);

  // Derive statuses
  const bookingsWithStatus = useMemo(() => {
    return bookings.map((b) => ({
      ...b,
      _derivedStatus: deriveStatus(b, Date.now()),
    }));
  }, [bookings, tick]);

  // Filter by tab
  const tabFiltered = useMemo(() => {
    if (tab === 'DANG_CHO') {
      return bookingsWithStatus.filter(
        (b) => b._derivedStatus === 'SAP_DEN' || b._derivedStatus === 'QUA_GIO'
      );
    }
    if (tab === 'DA_VAO') {
      return bookingsWithStatus.filter((b) => b._derivedStatus === 'DA_VAO');
    }
    // VANG_MAT
    return bookingsWithStatus.filter((b) => b._derivedStatus === 'VANG_MAT');
  }, [bookingsWithStatus, tab]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = tabFiltered;

    // Search by plate
    if (searchPlate.trim()) {
      const q = normalizePlate(searchPlate);
      result = result.filter((b) => normalizePlate(b.vehicle.plateNumber).includes(q));
    }

    return result;
  }, [tabFiltered, searchPlate]);

  // Pagination
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  // Reset page when filters or tab change
  useEffect(() => { setPage(1); }, [searchPlate, tab]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      DANG_CHO: bookingsWithStatus.filter(
        (b) => b._derivedStatus === 'SAP_DEN' || b._derivedStatus === 'QUA_GIO'
      ).length,
      DA_VAO: bookingsWithStatus.filter((b) => b._derivedStatus === 'DA_VAO').length,
      VANG_MAT: bookingsWithStatus.filter((b) => b._derivedStatus === 'VANG_MAT').length,
    };
  }, [bookingsWithStatus]);

  // Handlers
  const handleConfirmArrival = (booking: BookingItem) => {
    // Navigate to Check-in page with plate pre-filled
    const plate = encodeURIComponent(booking.vehicle.plateNumber);
    navigate(`/staff/checkin?plate=${plate}`);
  };

  const handleMarkNoShow = async () => {
    if (!confirm || confirm.kind !== 'noShow') return;
    const id = confirm.booking.id;
    setBusyId(id);
    setConfirm(null);
    try {
      await markNoShow(id);
      showToast('Đã đánh dấu vắng mặt.', 'success');
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể đánh dấu vắng mặt.';
      showToast(msg, 'error');
    } finally {
      setBusyId(null);
    }
  };


  const timeHeaderLabel = tab === 'DA_VAO' ? 'Thời gian Check-in' : 'Hết hạn lúc';

  return (
    <div style={{
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>
      <ToastBanner toast={toast} onClear={() => setToast(null)} />

      {/* ══ PAGE HEADER ════════════════════════════════════ */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{
          margin: 0, fontSize: '1.4rem', fontWeight: 800, color: C.navy,
        }}>
          Quản lý lượt đặt trước
        </h1>
        <p style={{
          margin: '0.2rem 0 0', fontSize: '0.875rem', color: C.gray500,
        }}>
          Tiếp nhận và theo dõi các lượt đặt chỗ của khách hàng.
        </p>
      </div>

      {/* ══ TABS ════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', gap: 4, background: C.gray100, padding: 4,
        borderRadius: 12, marginBottom: '1rem', width: 'fit-content',
        boxShadow: 'none', border: '1px solid #E3EAF5',
      }}>
        {TAB_CONFIG.map((t) => {
          const isActive = tab === t.key;
          const count = tabCounts[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '0.55rem 1.1rem',
                background: isActive ? C.white : 'transparent',
                color: isActive ? C.navy : C.gray600,
                border: isActive ? '1px solid #E3EAF5' : '1px solid transparent',
                borderRadius: 8,
                fontSize: '0.85rem', fontWeight: 700,
                cursor: 'pointer',
                boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                transition: 'all 0.15s',
              }}
            >
              {t.icon} {t.label}
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 22, height: 22,
                padding: '0 0.45rem', borderRadius: 999,
                fontSize: '0.72rem', fontWeight: 700,
                background: isActive ? C.navy : C.gray200,
                color: isActive ? C.white : C.gray600,
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ══ COMPACT SEARCH TOOLBAR ════════════════════════ */}
      <div style={{
        background: C.white,
        borderRadius: C.radius,
        boxShadow: C.cardShadow,
        border: `1px solid ${C.border}`,
        padding: '0.85rem 1.25rem',
        marginBottom: '1rem',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
      }}>
        {/* Search by plate */}
        <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
          <span style={{
            position: 'absolute',
            left: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: C.gray400,
            display: 'flex',
            alignItems: 'center',
          }}>
            <IconSearch size={16} />
          </span>
          <input
            type="text"
            value={searchPlate}
            onChange={(e) => setSearchPlate(e.target.value)}
            placeholder="Nhập biển số xe..."
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem 0.55rem 2.25rem',
              border: `1.5px solid ${C.border}`,
              borderRadius: 10,
              fontSize: '0.875rem',
              color: C.gray800,
              background: C.white,
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => e.target.style.borderColor = C.activeBlue}
            onBlur={(e) => e.target.style.borderColor = C.border}
          />
          {searchPlate && (
            <button
              onClick={() => setSearchPlate('')}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: C.gray400,
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        {/* Refresh button */}
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '0.55rem 1.25rem',
            background: C.navy,
            color: C.white,
            border: 'none',
            borderRadius: 10,
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.15s',
          }}
        >
          <IconRefresh size={14} /> Làm mới
        </button>
      </div>

      {/* ══ TABLE CARD ════════════════════════════════════ */}
      <div style={{
        background: C.white, borderRadius: C.radius, boxShadow: C.cardShadow,
        border: `1px solid ${C.border}`, overflow: 'hidden',
      }}>
        {error ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
            <p style={{ fontSize: '0.9rem', color: C.danger, fontWeight: 600 }}>
              {error}
            </p>
            <button
              onClick={load}
              style={{
                marginTop: '0.75rem', padding: '0.5rem 1.25rem',
                background: C.navy, color: C.white,
                border: 'none', borderRadius: 8,
                fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Thử lại
            </button>
          </div>
        ) : loading ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: C.gray50, borderBottom: `2px solid ${C.gray200}` }}>
                  {['Mã đặt chỗ', 'Biển số', 'Khách hàng', 'Khu vực', timeHeaderLabel, 'Trạng thái', 'Thao tác'].map((h) => (
                    <th key={h} style={{
                      padding: '0.75rem 1rem', textAlign: 'left',
                      fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.05em', color: C.gray500, whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <SkeletonRows count={5} />
              </tbody>
            </table>
          </div>
        ) : paginated.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2.5rem 1rem',
            color: C.gray500,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <div style={{ fontSize: '2rem' }}>🔍</div>
            <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: C.gray600 }}>
              {searchPlate.trim()
                ? 'Không tìm thấy lượt đặt trước phù hợp với biển số đã nhập.'
                : 'Không có lượt đặt trước trong trạng thái này.'}
            </p>
            {searchPlate.trim() && (
              <button
                type="button"
                onClick={() => setSearchPlate('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.activeBlue,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  textDecoration: 'underline',
                }}
              >
                Xóa tìm kiếm
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem',
                minWidth: 700,
              }}>
                <thead>
                  <tr style={{ background: C.gray50, borderBottom: `2px solid ${C.gray200}` }}>
                    {[
                      'Mã đặt chỗ', 'Biển số', 'Khách hàng', 'Khu vực', timeHeaderLabel, 'Trạng thái', 'Thao tác'
                    ].map((h) => (
                      <th key={h} style={{
                        padding: '0.75rem 1rem', textAlign: 'left',
                        fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.05em', color: C.gray500, whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((b) => {
                    let timeVal: string | null = null;
                    if (tab === 'DA_VAO') {
                      timeVal = b.checkInRecords?.[0]?.checkInTime ?? null;
                    } else {
                      if (b.expiresAt) {
                        timeVal = b.expiresAt;
                      } else if (b.confirmedAt) {
                        timeVal = new Date(new Date(b.confirmedAt).getTime() + 30 * 60 * 1000).toISOString();
                      } else {
                        timeVal = null;
                      }
                    }

                    return (
                      <tr
                        key={b.id}
                        style={{
                          borderBottom: `1px solid ${C.gray100}`,
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.gray50; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        {/* Mã đặt chỗ */}
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'Consolas, monospace', fontWeight: 600, color: C.navy, fontSize: '0.8rem' }}>
                          {b.id.substring(0, 8).toUpperCase()}
                        </td>

                        {/* Biển số */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <PlateDisplay plate={b.vehicle.plateNumber} />
                        </td>

                        {/* Khách hàng */}
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: C.gray800 }}>
                          {b.vehicle.owner?.fullName ?? b.createdBy?.fullName ?? 'Khách vãng lai'}
                        </td>

                        {/* Khu vực */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.gray800 }}>
                              {b.floor ? `${b.floor.name} · Khu ${b.floor.vehicleType === 'CAR' ? 'ô tô' : 'xe máy'}` : 'Chưa xác định'}
                            </span>
                            {b.floor?.floorCode?.toUpperCase() === 'G' && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                fontSize: '0.68rem',
                                color: C.warning,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.02em',
                              }}>
                                ⚠️ Dữ liệu lịch sử (Tầng G)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Thời gian hiệu lực / Hết hạn lúc / Thời gian Check-in */}
                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                          {timeVal ? (
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: C.gray800 }}>
                              {formatDate(timeVal)} {formatTime(timeVal)}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: '0.82rem', color: C.gray400 }}>—</span>
                              {tab === 'DA_VAO' && (
                                <span
                                  title="Không có dữ liệu Check-in liên kết"
                                  style={{
                                    cursor: 'help',
                                    fontSize: '0.7rem',
                                    color: C.warning,
                                    background: C.warningBg,
                                    border: `1px solid ${C.warningBorder}`,
                                    borderRadius: 999,
                                    width: 14,
                                    height: 14,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  i
                                </span>
                              )}
                            </div>
                          )}
                          {tab === 'DANG_CHO' && (
                            <div style={{ fontSize: '0.75rem', marginTop: 2 }}>
                              <CountdownCell expectedArrival={b.expectedArrival} tick={tick} />
                            </div>
                          )}
                        </td>

                        {/* Trạng thái */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <StatusBadge derivedStatus={b._derivedStatus} />
                        </td>

                        {/* Thao tác */}
                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {(b._derivedStatus === 'SAP_DEN' || b._derivedStatus === 'QUA_GIO') && (
                              <button
                                onClick={() => handleConfirmArrival(b)}
                                disabled={busyId === b.id}
                                style={{
                                  padding: '0.4rem 0.85rem',
                                  background: busyId === b.id ? C.gray200 : C.activeBlue,
                                  color: busyId === b.id ? C.gray400 : C.white,
                                  border: 'none', borderRadius: 8,
                                  fontSize: '0.75rem', fontWeight: 700,
                                  cursor: busyId === b.id ? 'not-allowed' : 'pointer',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  transition: 'all 0.15s',
                                }}
                              >
                                <IconCheck size={12} /> Tiếp nhận xe
                              </button>
                            )}
                            {b._derivedStatus === 'QUA_GIO' && (
                              <button
                                onClick={() => setConfirm({ kind: 'noShow', booking: b })}
                                disabled={busyId === b.id}
                                style={{
                                  padding: '0.4rem 0.85rem',
                                  background: busyId === b.id ? C.gray200 : C.white,
                                  color: busyId === b.id ? C.gray400 : C.danger,
                                  border: `1px solid ${C.dangerBorder}`,
                                  borderRadius: 8,
                                  fontSize: '0.75rem', fontWeight: 700,
                                  cursor: busyId === b.id ? 'not-allowed' : 'pointer',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  transition: 'all 0.15s',
                                }}
                              >
                                <IconUserX size={12} /> Đánh dấu vắng mặt
                              </button>
                            )}
                            {b._derivedStatus === 'DA_VAO' && (
                              <span style={{ fontSize: '0.78rem', color: C.gray400 }}>—</span>
                            )}
                            {b._derivedStatus === 'VANG_MAT' && (
                              <span style={{ fontSize: '0.78rem', color: C.gray400 }}>—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ══ PAGINATION ════════════════════════════════ */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.75rem 1.25rem',
              borderTop: `1px solid ${C.gray200}`,
              background: C.gray50,
              flexWrap: 'wrap', gap: '0.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: C.gray500 }}>
                <span>
                  Hiển thị {Math.min((safePage - 1) * pageSize + 1, totalCount)}–{Math.min(safePage * pageSize, totalCount)} trong {totalCount} lượt đặt trước
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  style={{
                    padding: '0.3rem 0.5rem', border: `1px solid ${C.border}`,
                    borderRadius: 6, fontSize: '0.78rem', color: C.gray800,
                    background: C.white, cursor: 'pointer', outline: 'none',
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}/trang</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  style={{
                    padding: '0.35rem 0.65rem', borderRadius: 6,
                    border: `1px solid ${C.border}`, background: C.white,
                    color: safePage <= 1 ? C.gray400 : C.gray800,
                    fontSize: '0.78rem', fontWeight: 600,
                    cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center',
                  }}
                >
                  <IconChevronLeft size={14} />
                </button>
                <span style={{
                  padding: '0.35rem 0.75rem', fontSize: '0.8rem',
                  fontWeight: 700, color: C.navy,
                }}>
                  {safePage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  style={{
                    padding: '0.35rem 0.65rem', borderRadius: 6,
                    border: `1px solid ${C.border}`, background: C.white,
                    color: safePage >= totalPages ? C.gray400 : C.gray800,
                    fontSize: '0.78rem', fontWeight: 600,
                    cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center',
                  }}
                >
                  <IconChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ══ GUIDANCE PANEL ════════════════════════════════ */}
      <div style={{ marginTop: '1.25rem' }}>
        <button
          type="button"
          onClick={() => setIsHelpOpen(!isHelpOpen)}
          style={{
            background: 'none',
            border: 'none',
            color: C.navy,
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>📖 Hướng dẫn sử dụng & Chú thích</span>
          <svg
            width="14"
            height="14"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{
              transform: isHelpOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isHelpOpen && (
          <div style={{
            background: C.white,
            borderRadius: C.radius,
            border: `1px solid ${C.border}`,
            padding: '1.25rem',
            boxShadow: C.cardShadow,
            marginTop: '0.5rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.5rem',
          }}>
            <div>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', fontWeight: 800, color: C.navy }}>
                Quy trình xử lý
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: C.gray600, lineHeight: 1.7 }}>
                <li><strong>Tiếp nhận xe:</strong> Mở trang Check-in để nhân viên xác minh biển số và hình ảnh.</li>
                <li>Sau khi Check-in thành công, lượt đặt trước sẽ tự động chuyển sang trạng thái <strong>"Đã vào"</strong>.</li>
                <li>Chỉ đánh dấu vắng mặt sau khi đã hết hạn thời gian chờ và xác minh khách không đến.</li>
              </ul>
            </div>
            <div>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', fontWeight: 800, color: C.navy }}>
                Chú thích trạng thái
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: C.gray500 }}>
                  <StatusBadge derivedStatus="SAP_DEN" />
                  <span>Khách đã thanh toán cọc và lượt đặt chỗ vẫn còn hiệu lực.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: C.gray500 }}>
                  <StatusBadge derivedStatus="QUA_GIO" />
                  <span>Đã quá giờ hẹn nhưng khách chưa Check-in.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: C.gray500 }}>
                  <StatusBadge derivedStatus="DA_VAO" />
                  <span>Khách đã hoàn tất Check-in.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: C.gray500 }}>
                  <StatusBadge derivedStatus="VANG_MAT" />
                  <span>Lượt đặt chỗ đã hết hạn nhưng khách chưa Check-in.</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ CONFIRM DIALOG ════════════════════════════════ */}
      {confirm?.kind === 'noShow' && (
        <ConfirmDialog
          title="Đánh dấu vắng mặt"
          message={`Xác nhận khách biển số "${confirm.booking.vehicle.plateNumber}" không đến và đánh dấu đặt chỗ này là vắng mặt? Slot sẽ được giải phóng.`}
          confirmLabel="Xác nhận vắng mặt"
          confirmColor={C.danger}
          onCancel={() => setConfirm(null)}
          onConfirm={handleMarkNoShow}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}