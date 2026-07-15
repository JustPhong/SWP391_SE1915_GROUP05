import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listBookings,
  markNoShow,
  type BookingItem,
  type FloorInfo,
} from '../api/bookingApi';

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

function getAreaDisplay(slot: BookingItem['slot']): string {
  const floor: FloorInfo | undefined = (slot as any).floor;
  if (floor) {
    return `${floor.name}`;
  }
  // Fallback: just show the floor code extracted from slot code
  const code = slot.code;
  const floorCode = code.split('-')[0] ?? '';
  return `Tầng ${floorCode}`;
}

function getCustomerTypeDisplay(slot: BookingItem['slot']): string {
  const floor: FloorInfo | undefined = (slot as any).floor;
  if (floor) {
    const vType = floor.vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy';
    const cType = floor.customerType === 'MONTHLY' ? 'khách tháng' : 'khách lẻ';
    return `${vType} ${cType}`;
  }
  return '';
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

function VehicleTypeBadge({ type }: { type: string }) {
  const isCar = type === 'CAR';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '0.2rem 0.55rem', borderRadius: 6,
      fontSize: '0.75rem', fontWeight: 600,
      background: isCar ? '#EFF6FF' : '#FEF3C7',
      color: isCar ? '#1E40AF' : '#92400E',
      border: `1px solid ${isCar ? '#BFDBFE' : '#FDE68A'}`,
      whiteSpace: 'nowrap',
    }}>
      {isCar ? '🚗' : '🛵'} {isCar ? 'Ô tô' : 'Xe máy'}
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

function AreaDisplay({ slot }: { slot: BookingItem['slot'] }) {
  const area = getAreaDisplay(slot);
  const sub = getCustomerTypeDisplay(slot);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.gray800 }}>{area}</span>
      {sub && <span style={{ fontSize: '0.68rem', color: C.gray400 }}>{sub}</span>}
    </div>
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

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '3rem 1rem',
      color: C.gray400,
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{icon}</div>
      <p style={{ margin: '0 0 0.3rem', fontSize: '0.95rem', fontWeight: 700, color: C.gray600 }}>{title}</p>
      {subtitle && <p style={{ margin: 0, fontSize: '0.82rem' }}>{subtitle}</p>}
    </div>
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
  const [dateFilter, setDateFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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
      const q = searchPlate.trim().toUpperCase();
      result = result.filter((b) => b.vehicle.plateNumber.toUpperCase().includes(q));
    }

    // Date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      if (!isNaN(filterDate.getTime())) {
        const fdStart = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate()).getTime();
        const fdEnd = fdStart + 86400000;
        result = result.filter((b) => {
          const ad = new Date(b.expectedArrival).getTime();
          return ad >= fdStart && ad < fdEnd;
        });
      }
    }

    // Area filter
    if (areaFilter) {
      result = result.filter((b) => {
        const area = getAreaDisplay(b.slot).toLowerCase();
        return area.includes(areaFilter.toLowerCase());
      });
    }

    // Vehicle type filter
    if (vehicleTypeFilter) {
      result = result.filter((b) => b.vehicle.type === vehicleTypeFilter);
    }

    // Status filter
    if (statusFilter) {
      result = result.filter((b) => b._derivedStatus === statusFilter);
    }

    return result;
  }, [tabFiltered, searchPlate, dateFilter, areaFilter, vehicleTypeFilter, statusFilter]);

  // Pagination
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  // Reset page when filters or tab change
  useEffect(() => { setPage(1); }, [searchPlate, dateFilter, areaFilter, vehicleTypeFilter, statusFilter, tab]);

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

  const handleClearFilters = () => {
    setSearchPlate('');
    setDateFilter('');
    setAreaFilter('');
    setVehicleTypeFilter('');
    setStatusFilter('');
  };

  const hasFilters = searchPlate || dateFilter || areaFilter || vehicleTypeFilter || statusFilter;

  // Area options for filter
  const areaOptions = useMemo(() => {
    const areas = new Set<string>();
    bookings.forEach((b) => {
      areas.add(getAreaDisplay(b.slot));
    });
    return Array.from(areas).sort();
  }, [bookings]);

  // Filter status options based on active tab
  const statusOptions = useMemo(() => {
    if (tab === 'DANG_CHO') {
      return [
        { value: 'SAP_DEN', label: 'Sắp đến' },
        { value: 'QUA_GIO', label: 'Quá giờ' },
      ];
    }
    return [];
  }, [tab]);

  // ── Render ─────────────────────────────────────────
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
          Xem, xác nhận khách đến và theo dõi trạng thái các lượt đặt trước.
        </p>
      </div>

      {/* ══ TABS ════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', gap: 4, background: C.gray100, padding: 4,
        borderRadius: 12, marginBottom: '1rem', width: 'fit-content',
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
                border: 'none', borderRadius: 8,
                fontSize: '0.85rem', fontWeight: 700,
                cursor: 'pointer',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
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

      {/* ══ FILTER TOOLBAR ═══════════════════════════════ */}
      <div style={{
        background: C.white, borderRadius: C.radius, boxShadow: C.cardShadow,
        border: `1px solid ${C.border}`, padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}>
        <div style={{
          display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end',
        }}>
          {/* Search by plate */}
          <div style={{ flex: '1 1 160px', minWidth: 140 }}>
            <label style={{
              display: 'block', fontSize: '0.7rem', fontWeight: 700,
              color: C.gray500, marginBottom: 4, textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              Tìm theo biển số
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value)}
                placeholder="Tìm theo biển số"
                style={{
                  width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem',
                  border: `1.5px solid ${C.border}`, borderRadius: 8,
                  fontSize: '0.82rem', color: C.gray800,
                  background: C.white, outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => e.target.style.borderColor = C.activeBlue}
                onBlur={(e) => e.target.style.borderColor = C.border}
              />
              <span style={{
                position: 'absolute', left: 8, top: '50%',
                transform: 'translateY(-50%)',
                color: C.gray400, display: 'flex',
              }}>
                <IconSearch size={14} />
              </span>
            </div>
          </div>

          {/* Date filter */}
          <div style={{ flex: '0 1 150px' }}>
            <label style={{
              display: 'block', fontSize: '0.7rem', fontWeight: 700,
              color: C.gray500, marginBottom: 4, textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              Ngày hẹn đến
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                width: '100%', padding: '0.5rem 0.75rem',
                border: `1.5px solid ${C.border}`, borderRadius: 8,
                fontSize: '0.82rem', color: C.gray800,
                background: C.white, outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => e.target.style.borderColor = C.activeBlue}
              onBlur={(e) => e.target.style.borderColor = C.border}
            />
          </div>

          {/* Area filter */}
          <div style={{ flex: '0 1 160px' }}>
            <label style={{
              display: 'block', fontSize: '0.7rem', fontWeight: 700,
              color: C.gray500, marginBottom: 4, textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              Khu vực
            </label>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              style={{
                width: '100%', padding: '0.5rem 0.75rem',
                border: `1.5px solid ${C.border}`, borderRadius: 8,
                fontSize: '0.82rem', color: C.gray800,
                background: C.white, outline: 'none',
                boxSizing: 'border-box',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => e.target.style.borderColor = C.activeBlue}
              onBlur={(e) => e.target.style.borderColor = C.border}
            >
              <option value="">Tất cả khu vực</option>
              {areaOptions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Vehicle type filter */}
          <div style={{ flex: '0 1 130px' }}>
            <label style={{
              display: 'block', fontSize: '0.7rem', fontWeight: 700,
              color: C.gray500, marginBottom: 4, textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              Loại xe
            </label>
            <select
              value={vehicleTypeFilter}
              onChange={(e) => setVehicleTypeFilter(e.target.value)}
              style={{
                width: '100%', padding: '0.5rem 0.75rem',
                border: `1.5px solid ${C.border}`, borderRadius: 8,
                fontSize: '0.82rem', color: C.gray800,
                background: C.white, outline: 'none',
                boxSizing: 'border-box',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => e.target.style.borderColor = C.activeBlue}
              onBlur={(e) => e.target.style.borderColor = C.border}
            >
              <option value="">Tất cả</option>
              <option value="CAR">Ô tô</option>
              <option value="MOTORBIKE">Xe máy</option>
            </select>
          </div>

          {/* Status filter (tab-specific) */}
          {tab === 'DANG_CHO' && (
            <div style={{ flex: '0 1 130px' }}>
              <label style={{
                display: 'block', fontSize: '0.7rem', fontWeight: 700,
                color: C.gray500, marginBottom: 4, textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                Trạng thái
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: '100%', padding: '0.5rem 0.75rem',
                  border: `1.5px solid ${C.border}`, borderRadius: 8,
                  fontSize: '0.82rem', color: C.gray800,
                  background: C.white, outline: 'none',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => e.target.style.borderColor = C.activeBlue}
                onBlur={(e) => e.target.style.borderColor = C.border}
              >
                <option value="">Tất cả</option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', paddingBottom: 1 }}>
            <button
              onClick={handleClearFilters}
              disabled={!hasFilters}
              style={{
                padding: '0.5rem 0.85rem',
                background: C.white,
                color: hasFilters ? C.navy : C.gray400,
                border: `1.5px solid ${hasFilters ? C.border : C.gray200}`,
                borderRadius: 8,
                fontSize: '0.78rem', fontWeight: 600,
                cursor: hasFilters ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              <IconX size={12} /> Xóa bộ lọc
            </button>
            <button
              onClick={load}
              disabled={loading}
              style={{
                padding: '0.5rem 0.85rem',
                background: C.navy,
                color: C.white,
                border: 'none',
                borderRadius: 8,
                fontSize: '0.78rem', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.15s',
              }}
            >
              <IconRefresh size={14} /> Làm mới
            </button>
          </div>
        </div>
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
                  {['Biển số', 'Loại xe', 'Khu vực đặt', 'Giờ hẹn đến', 'Thời gian còn lại', 'Trạng thái', 'Thao tác'].map((h) => (
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
          <div>
            {tab === 'DANG_CHO' && (
              <EmptyState
                icon="🕐"
                title={hasFilters ? 'Không tìm thấy lượt đặt trước phù hợp với bộ lọc.' : 'Không có lượt đặt trước đang chờ.'}
                subtitle={hasFilters ? undefined : 'Khi khách đặt chỗ trước, thông tin sẽ hiển thị tại đây.'}
              />
            )}
            {tab === 'DA_VAO' && (
              <EmptyState
                icon="✅"
                title={hasFilters ? 'Không tìm thấy lượt đặt trước phù hợp với bộ lọc.' : 'Chưa có lượt đặt trước nào đã check-in.'}
              />
            )}
            {tab === 'VANG_MAT' && (
              <EmptyState
                icon="🚫"
                title={hasFilters ? 'Không tìm thấy lượt đặt trước phù hợp với bộ lọc.' : 'Không có lượt đặt trước nào được ghi nhận vắng mặt.'}
              />
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
                      'Biển số', 'Loại xe', 'Khu vực đặt',
                      'Giờ hẹn đến', 'Thời gian còn lại', 'Trạng thái', 'Thao tác',
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
                  {paginated.map((b) => (
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: `1px solid ${C.gray100}`,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.gray50; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {/* Biển số */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <PlateDisplay plate={b.vehicle.plateNumber} />
                      </td>

                      {/* Loại xe */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <VehicleTypeBadge type={b.vehicle.type} />
                      </td>

                      {/* Khu vực đặt */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <AreaDisplay slot={b.slot} />
                      </td>

                      {/* Giờ hẹn đến */}
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: C.gray800 }}>
                          {formatDate(b.expectedArrival)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: C.gray400 }}>
                          {formatTime(b.expectedArrival)}
                        </div>
                      </td>

                      {/* Thời gian còn lại */}
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                        {b._derivedStatus === 'DA_VAO' || b._derivedStatus === 'VANG_MAT' ? (
                          <span style={{ fontSize: '0.82rem', color: C.gray400 }}>—</span>
                        ) : (
                          <CountdownCell expectedArrival={b.expectedArrival} tick={tick} />
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <StatusBadge derivedStatus={b._derivedStatus} />
                      </td>

                      {/* Thao tác */}
                      <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                        {b._derivedStatus === 'SAP_DEN' && (
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
                            <IconCheck size={12} /> Xác nhận khách đến
                          </button>
                        )}
                        {b._derivedStatus === 'QUA_GIO' && (
                          <button
                            onClick={() => setConfirm({ kind: 'noShow', booking: b })}
                            disabled={busyId === b.id}
                            style={{
                              padding: '0.4rem 0.85rem',
                              background: busyId === b.id ? C.gray200 : C.danger,
                              color: busyId === b.id ? C.gray400 : C.white,
                              border: 'none', borderRadius: 8,
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
                          <span style={{ fontSize: '0.78rem', color: C.gray400 }}>
                            —
                          </span>
                        )}
                        {b._derivedStatus === 'VANG_MAT' && (
                          <span style={{ fontSize: '0.78rem', color: C.gray400 }}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
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
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        marginTop: '1.25rem',
      }}>
        {/* Hướng dẫn */}
        <div style={{
          background: C.white, borderRadius: C.radius,
          border: `1px solid ${C.border}`, padding: '1rem 1.25rem',
          boxShadow: C.cardShadow,
        }}>
          <h3 style={{
            margin: '0 0 0.6rem', fontSize: '0.85rem', fontWeight: 800,
            color: C.navy, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            📖 Hướng dẫn sử dụng
          </h3>
          <ul style={{
            margin: 0, padding: '0 0 0 1.1rem',
            fontSize: '0.78rem', color: C.gray600, lineHeight: 1.7,
          }}>
            <li><strong>Sắp đến:</strong> Khách dự kiến đến trong thời gian sắp tới.</li>
            <li><strong>Quá giờ:</strong> Khách đã vượt thời gian hẹn đến nhưng chưa được xử lý.</li>
            <li>Khi xác nhận khách đến, hệ thống mở trang Check-in với thông tin đặt trước đã điền sẵn.</li>
            <li>Sau khi Check-in thành công, lượt đặt trước chuyển sang trạng thái <strong>"Đã vào"</strong>.</li>
            <li>Chỉ đánh dấu <strong>Vắng mặt</strong> sau khi đã xác minh khách không đến.</li>
          </ul>
        </div>

        {/* Chú thích */}
        <div style={{
          background: C.white, borderRadius: C.radius,
          border: `1px solid ${C.border}`, padding: '1rem 1.25rem',
          boxShadow: C.cardShadow,
        }}>
          <h3 style={{
            margin: '0 0 0.6rem', fontSize: '0.85rem', fontWeight: 800,
            color: C.navy, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            🏷️ Chú thích trạng thái
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge derivedStatus="SAP_DEN" />
              <span style={{ fontSize: '0.78rem', color: C.gray500 }}>Khách đặt trước và đang trong thời gian chờ</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge derivedStatus="QUA_GIO" />
              <span style={{ fontSize: '0.78rem', color: C.gray500 }}>Đã quá giờ hẹn nhưng chưa xử lý</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge derivedStatus="DA_VAO" />
              <span style={{ fontSize: '0.78rem', color: C.gray500 }}>Khách đã check-in thành công</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge derivedStatus="VANG_MAT" />
              <span style={{ fontSize: '0.78rem', color: C.gray500 }}>Khách không đến, đã hủy đặt chỗ</span>
            </div>
          </div>
        </div>
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