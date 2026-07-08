import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  lookupPlate,
  getAvailableSlots,
  submitCheckIn,
  getCheckinStats,
  type LookupResult,
  type AvailableSlot,
  type CheckinStats,
} from '../api/checkinApi';

// ═══════════════════════════════════════════════════════
//  DESIGN TOKENS  (matches codebase palette)
// ═══════════════════════════════════════════════════════
const C = {
  navy: '#1E3A5F',
  navyLight: '#2C4F78',
  bg: 'linear-gradient(160deg,#EFF6FF 0%,#DBEAFE 50%,#EFF6FF 100%)',
  white: '#FFFFFF',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  greenBorder: '#86EFAC',
  yellow: '#D97706',
  yellowBg: '#FEF9C3',
  yellowBorder: '#FDE047',
  red: '#DC2626',
  redBg: '#FEE2E2',
  redBorder: '#FECACA',
  gray50: '#F9FAFB',
  gray100: '#F3F5F7',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray800: '#111827',
  shadow: '0 8px 32px rgba(30,58,95,0.08)',
};

const VALID_PROVINCE_CODES = [
  11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
  30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41,
  43,
  47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
  60, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
  81, 82, 83, 84, 85, 86, 88, 89, 90,
  92, 93, 94, 95, 97, 98, 99,
];

/** Strip spaces/dots/dashes and uppercase. */
function normalizePlate(raw: string): string {
  return raw.replace(/[\s.\-]/g, '').toUpperCase();
}

type VehicleTypeFmt = 'CAR' | 'MOTORBIKE';

function formatPlate(raw: string, vehicleType: VehicleTypeFmt): { valid: boolean; formatted: string } {
  const upper = raw.toUpperCase().trim();
  if (!upper) return { valid: false, formatted: '' };

  const dashIndex = upper.indexOf('-');
  let prefix: string;
  let suffix: string;

  if (dashIndex !== -1) {
    // Respect the dash position the user actually typed.
    prefix = upper.slice(0, dashIndex).replace(/[\s.]/g, '');
    suffix = upper.slice(dashIndex + 1).replace(/[\s.\-]/g, '');
  } else {
    const s = upper.replace(/[\s.]/g, '');
    if (vehicleType === 'CAR') {
      const m = s.match(/^(\d{2}[A-Z])(\d{4,5})$/);
      if (!m) return { valid: false, formatted: '' };
      prefix = m[1];
      suffix = m[2];
    } else {
      const m = s.match(/^(\d{2}C[0-9A-Z])(\d{4,5})$/);
      if (!m) return { valid: false, formatted: '' };
      prefix = m[1];
      suffix = m[2];
    }
  }

  if (!/^\d{4,5}$/.test(suffix)) return { valid: false, formatted: '' };

  let prov: string;
  let letterPart: string;

  if (vehicleType === 'CAR') {
    const m = prefix.match(/^(\d{2})([A-Z])$/);
    if (!m) return { valid: false, formatted: '' };
    prov = m[1];
    letterPart = m[2];
  } else {
    const m = prefix.match(/^(\d{2})C([0-9A-Z])$/);
    if (!m) return { valid: false, formatted: '' };
    prov = m[1];
    letterPart = 'C' + m[2];
  }

  const provNum = parseInt(prov, 10);
  if (!VALID_PROVINCE_CODES.includes(provNum)) {
    return { valid: false, formatted: '' };
  }

  const numbers = suffix;
  let formatted: string;
  if (numbers.length === 5) {
    formatted = `${prov}${letterPart}-${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  } else {
    formatted = `${prov}${letterPart}-${numbers}`;
  }
  return { valid: true, formatted };
}

function isPlateValid(raw: string, vehicleType: VehicleTypeFmt): boolean {
  return formatPlate(raw, vehicleType).valid;
}


type PageState = 'idle' | 'monthly_valid' | 'monthly_expired' | 'casual';

const now = (): string => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatDateTime = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// ═══════════════════════════════════════════════════════
//  ICONS
// ═══════════════════════════════════════════════════════
function IconCar({ size = 16 }: { size?: number; color?: string }) {
  return (
    <span style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>🚗</span>
  );
}
function IconMoto({ size = 16 }: { size?: number; color?: string }) {
  return (
    <span style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>🛵</span>
  );
}
function IconLock({ size = 14, color = '#6B7280' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}
function IconStar({ size = 12, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
function IconCheck({ size = 14, color = C.green }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconX({ size = 14, color = C.red }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function IconAlert({ size = 16, color = C.red }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function IconUsers({ size = 14, color = '#6B7280' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function IconSearch({ size = 16, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IconGrid({ size = 14, color = '#6B7280' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

/** Mini card showing owner/customer info when vehicle is found in DB */
function OwnerInfoCard({ data }: { data: LookupResult }) {
  if (!data.ownerName && !data.ownerPhone && !data.ownerEmail) return null;
  return (
    <div style={{
      background: '#F0F4F8',
      border: '1px solid #D1D9E6',
      borderRadius: 10,
      padding: '0.7rem 0.85rem',
    }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
        Thông tin chủ xe
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem 0.7rem' }}>
        <div>
          <span style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>Họ tên</span>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A5F' }}>{data.ownerName ?? '—'}</div>
        </div>
        <div>
          <span style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>SĐT</span>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A5F' }}>{data.ownerPhone ?? '—'}</div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <span style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>Email</span>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A5F' }}>{data.ownerEmail ?? '—'}</div>
        </div>
        {data.note && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>Ghi chú</span>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#D97706' }}>{data.note}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Shared card wrapper
function Card({ title, children, style }: { title?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.white,
      borderRadius: 18,
      boxShadow: C.shadow,
      padding: '1.25rem 1.5rem',
      ...style,
    }}>
      {title && (
        <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 800, color: C.navy, letterSpacing: '0.01em' }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

// Vehicle type toggle
function VehicleTypeToggle({
  value,
  onChange,
  locked,
  vehicleType,
}: {
  value: 'CAR' | 'MOTORBIKE';
  onChange: (v: 'CAR' | 'MOTORBIKE') => void;
  locked: boolean;
  vehicleType?: 'CAR' | 'MOTORBIKE';
}) {
  const selected = vehicleType ?? value;
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      {(['CAR', 'MOTORBIKE'] as const).map((type) => {
        const active = selected === type;
        const disabled = locked && vehicleType !== undefined && vehicleType !== type;
        return (
          <button
            key={type}
            onClick={() => !disabled && onChange(type)}
            disabled={disabled}
            style={{
              flex: 1,
              padding: '0.55rem 0.75rem',
              borderRadius: 10,
              border: `1.5px solid ${active ? C.navy : disabled ? C.gray200 : C.gray400}`,
              background: active ? C.navy : disabled ? C.gray50 : C.white,
              color: active ? C.white : disabled ? C.gray400 : C.gray800,
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: disabled ? 0.7 : 1,
              transition: 'all 0.15s',
            }}
          >
            {type === 'CAR'
              ? <IconCar size={13} color={active ? C.white : disabled ? C.gray400 : '#3B82F6'} />
              : <IconMoto size={13} color={active ? C.white : disabled ? C.gray400 : '#F97316'} />
            }
            {type === 'CAR' ? 'Ô tô' : 'Xe máy'}
            {locked && disabled && <IconLock size={11} color={C.gray400} />}
          </button>
        );
      })}
    </div>
  );
}

// Slot selector chip row
function SlotChipRow({
  slots,
  selectedCode,
  onSelect,
}: {
  slots: AvailableSlot[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
}) {
  if (slots.length === 0) {
    return (
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: C.red }}>
        Không có ô trống nào khả dụng.
      </p>
    );
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
      {slots.map((s) => {
        const active = selectedCode === s.code;
        return (
          <button
            key={s.code}
            onClick={() => onSelect(s.code)}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 20,
              border: `1.5px solid ${active ? C.navy : s.suggested ? '#93C5FD' : C.gray200}`,
              background: active ? C.navy : s.suggested ? '#EFF6FF' : C.white,
              color: active ? C.white : s.suggested ? '#1D4ED8' : C.gray800,
              fontSize: '0.78rem',
              fontWeight: active || s.suggested ? 700 : 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.15s',
              position: 'relative',
            }}
          >
            {s.code}
            {s.suggested && !active && <IconStar size={10} />}
          </button>
        );
      })}
    </div>
  );
}

// Inline alert banner
function AlertBanner({
  type,
  children,
}: {
  type: 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
}) {
  const map = {
    success: { bg: C.greenBg, border: C.greenBorder, color: '#15803D' },
    warning: { bg: C.yellowBg, border: C.yellowBorder, color: '#92400E' },
    error: { bg: C.redBg, border: C.redBorder, color: '#991B1B' },
    info: { bg: '#EFF6FF', border: '#BFDBFE', color: C.navy },
  };
  const s = map[type];
  return (
    <div style={{
      background: s.bg,
      border: `1.5px solid ${s.border}`,
      borderRadius: 10,
      padding: '0.6rem 0.85rem',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.5rem',
      marginTop: '0.75rem',
    }}>
      <span style={{ color: s.color, fontSize: '0.9rem', lineHeight: 1.4, flexShrink: 0 }}>
        {type === 'success' ? <IconCheck size={14} color={s.color} />
          : type === 'warning' ? <IconAlert size={14} color={C.yellow} />
            : type === 'error' ? <IconAlert size={14} color={s.color} />
              : <IconAlert size={14} color={s.color} />}
      </span>
      <span style={{ color: s.color, fontSize: '0.8rem', lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

// Info row in right panel
function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.45rem 0',
      borderBottom: `1px solid ${C.gray100}`,
    }}>
      <span style={{ fontSize: '0.8rem', color: C.gray500 }}>{label}</span>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: valueColor ?? C.gray800 }}>{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export function CheckInPage() {

  // ── Form state ──────────────────────────────────────
  const [plateInput, setPlateInput] = useState('');
  const [vehicleType, setVehicleType] = useState<'CAR' | 'MOTORBIKE'>('CAR');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [motorbikeAutoSlot, setMotorbikeAutoSlot] = useState<string | null>(null);

  // ── Page / lookup state ────────────────────────────
  const [pageState, setPageState] = useState<PageState>('idle');
  const [lookupData, setLookupData] = useState<LookupResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Success ────────────────────────────────────────
  const [successData, setSuccessData] = useState<{ slotCode: string; plate: string; checkInTime: string } | null>(null);

  // ── Error ──────────────────────────────────────────
  const [apiError, setApiError] = useState('');
  const [plateError, setPlateError] = useState('');

  // ── Footer stats ───────────────────────────────────
  const [stats, setStats] = useState<CheckinStats | null>(null);

  // ── Query param access (must be at component top level) ──
  const [searchParams] = useSearchParams();
  const autoLookupRan = useRef(false);

  // ── Load stats on mount ────────────────────────────
  useEffect(() => {
    getCheckinStats().then(setStats).catch(() => { });
  }, []);

  // ── Auto-lookup if plate was passed via ?plate= ─────
  // Guarded with a ref so it runs exactly once and is not affected by
  // other useEffects resetting state during the render cycle.
  useEffect(() => {
    if (autoLookupRan.current) return;
    autoLookupRan.current = true;

    const raw = searchParams.get('plate');
    if (!raw) return;
    const { valid, formatted } = formatPlate(raw, vehicleType);
    if (!valid) return;


    setPlateInput(formatted);

    lookupPlate(normalizePlate(formatted))
      .then((result) => {
        setLookupData(result);
        if (result.alreadyParked) {
          setApiError(`Xe đang trong bãi (slot ${result.slotCode ?? '?'}) — không thể check-in.`);
          setPageState('idle');
          return;
        }
        if (result.found && result.customerType === 'monthly') {
          if (result.isExpired) setPageState('monthly_expired');
          else {
            setPageState('monthly_valid');
            if (result.vehicleType) setVehicleType(result.vehicleType);
          }
        } else {
          setPageState('casual');
          if (result.vehicleType) setVehicleType(result.vehicleType);
        }
      })
      .catch(() => {
        setApiError('Không thể tra cứu biển số. Vui lòng thử lại.');
      });
  }, []); // run once on mount after useSearchParams stabilizes

  // ── Load available slots when entering casual state ─

  useEffect(() => {
    if (pageState === 'casual' || pageState === 'monthly_expired') {
      getAvailableSlots(vehicleType).then((slots) => {
        setAvailableSlots(slots);
        if (vehicleType === 'MOTORBIKE') {
          const first = slots[0]?.code ?? null;
          setMotorbikeAutoSlot(first);
        } else {
          setMotorbikeAutoSlot(null);
        }
      }).catch(() => { });
    }
  }, [pageState, vehicleType]);

  // ── Handlers ───────────────────────────────────────
  const handleBlur = () => {
    if (!plateInput.trim()) {
      setPlateError('');
      return;
    }
    const { valid, formatted } = formatPlate(plateInput, vehicleType);


    if (!valid) {
      setPlateError('Biển số không hợp lệ (sai mã tỉnh hoặc định dạng)');
    } else {
      setPlateError('');
      setPlateInput(formatted);
    }
  };

  const handleSearch = async () => {
    const raw = plateInput.trim();
    if (!raw) return;

    // Normalize + re-validate so the display always shows the correctly formatted value
    const { valid, formatted } = formatPlate(raw, vehicleType);

    if (!valid) {
      setPlateError('Biển số không hợp lệ (sai mã tỉnh hoặc định dạng)');
      return;
    }

    setPlateInput(formatted);
    setApiError('');
    setPlateError('');
    setSearching(true);
    setSuccessData(null);
    setPageState('idle');
    setLookupData(null);
    setSelectedSlot(null);

    try {
      const result = await lookupPlate(normalizePlate(formatted));
      setLookupData(result);

      if (result.alreadyParked) {
        setApiError(`Xe đang trong bãi (slot ${result.slotCode ?? '?'}) — không thể check-in.`);
        setPageState('idle');
        return;
      }

      if (result.found && result.customerType === 'monthly') {
        if (result.isExpired) {
          setPageState('monthly_expired');
        } else {
          setPageState('monthly_valid');
          // Auto-set vehicle type if returned
          if (result.vehicleType) setVehicleType(result.vehicleType);
        }
      } else {
        // Casual: unknown plate or found=false
        setPageState('casual');
        if (result.vehicleType) setVehicleType(result.vehicleType);
      }
    } catch {
      setApiError('Không thể tra cứu biển số. Vui lòng thử lại.');
      setPageState('idle');
    } finally {
      setSearching(false);
    }
  };

  const handleConvertToCasual = () => {
    if (!lookupData) return;
    setLookupData((prev: LookupResult | null) => prev ? { ...prev, customerType: 'casual' } : null);
    setPageState('casual');
    setApiError('');
    setSelectedSlot(null);
    setMotorbikeAutoSlot(null);
  };

  const handleSubmit = async () => {
    const plate = plateInput.trim().toUpperCase();
    if (!plate) return;
    const isCasual = pageState === 'casual';
    const isMotorbikeCasual = isCasual && vehicleType === 'MOTORBIKE';
    if (isCasual && !isMotorbikeCasual && !selectedSlot) return;

    setApiError('');
    setSubmitting(true);

    try {
      const isMonthly = lookupData?.customerType === 'monthly' && !isCasual;
      const slotCode = isCasual
        ? (isMotorbikeCasual ? motorbikeAutoSlot : selectedSlot)
        : (lookupData?.fixedSlot ?? 'G-01');
      const result = await submitCheckIn({
        plateNumber: plate,
        slotCode: slotCode ?? 'G-01',
        vehicleType,
        isMonthly,
      });
      setSuccessData(result);
      setPageState('idle');
      setLookupData(null);
      setSelectedSlot(null);
      setMotorbikeAutoSlot(null);
      setPlateInput('');
      const fresh = await getCheckinStats();
      setStats(fresh);
    } catch {
      setApiError('Check-in thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setPageState('idle');
    setLookupData(null);
    setSelectedSlot(null);
    setMotorbikeAutoSlot(null);
    setPlateInput('');
    setApiError('');
    setPlateError('');
    setSuccessData(null);
    setAvailableSlots([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  // ── Derived ───────────────────────────────────────
  const isCasual = pageState === 'casual';
  const isMotorbikeCasual = isCasual && vehicleType === 'MOTORBIKE';

  const isConfirmDisabled =
    submitting ||
    (isCasual && !isMotorbikeCasual && !selectedSlot) ||
    (isCasual && isMotorbikeCasual && !motorbikeAutoSlot) ||
    (pageState === 'monthly_valid' && !lookupData?.fixedSlot);

  const expiryLabel = lookupData?.packageExpiry
    ? new Date(lookupData.packageExpiry).toLocaleDateString('vi-VN')
    : '—';

  // ── Render ─────────────────────────────────────────
  return (
    <div style={{
      background: C.bg,
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>

      {/* ══ MAIN BODY ════════════════════════════════════ */}
      <main style={{ padding: '1.5rem', maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* Page title */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: C.navy }}>
            Check-in (Xe vào)
          </h1>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: C.gray500 }}>
            Tra cứu biển số → Xác nhận xe vào bãi đỗ
          </p>
        </div>

        {/* API error banner */}
        {apiError && (
          <div style={{
            background: C.redBg,
            border: `1.5px solid ${C.redBorder}`,
            borderRadius: 10,
            padding: '0.7rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            marginBottom: '1rem',
          }}>
            <IconAlert size={15} color={C.red} />
            <span style={{ fontSize: '0.82rem', color: C.red, fontWeight: 500 }}>{apiError}</span>
            <button
              onClick={() => setApiError('')}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
            >
              <IconX size={14} color={C.red} />
            </button>
          </div>
        )}

        {/* SUCCESS — shown after successful check-in */}
        {successData && (
          <div style={{
            background: C.greenBg,
            border: `2px solid ${C.greenBorder}`,
            borderRadius: 16,
            padding: '1.25rem 1.5rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <IconCheck size={24} color={C.green} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#15803D' }}>
                Check-in thành công!
              </p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#166534' }}>
                Biển số <strong>{successData.plate}</strong> · Vị trí <strong>{successData.slotCode}</strong> · {formatDateTime(successData.checkInTime)}
              </p>
            </div>
            <button
              onClick={() => setSuccessData(null)}
              style={{
                padding: '0.45rem 1rem',
                background: C.green,
                color: C.white,
                border: 'none',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Check-in xe mới
            </button>
          </div>
        )}

        {/* TWO-COLUMN LAYOUT */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr',
          gap: '1.25rem',
          alignItems: 'start',
        }}>

          {/* ══ LEFT CARD — Nhận diện biển số ═════════════ */}
          <Card title="Nhận diện biển số">
            {/* Search row */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                value={plateInput}
                onChange={(e) => { setPlateInput(e.target.value.toUpperCase()); setApiError(''); setPlateError(''); }}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder="VD: 51A-11111"
                disabled={searching}
                style={{
                  flex: 1,
                  padding: '0.65rem 0.85rem',
                  border: `1.5px solid ${plateError ? C.redBorder : C.gray200}`,
                  borderRadius: 10,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  fontFamily: "'Consolas','Courier New',monospace",
                  color: C.gray800,
                  background: C.white,
                  outline: 'none',
                  boxSizing: 'border-box',
                  letterSpacing: '0.04em',
                }}
              />
              {plateError && (
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: C.red }}>
                  {plateError}
                </p>
              )}
              <button
                onClick={handleSearch}
                disabled={!isPlateValid(plateInput, vehicleType) || searching}

                style={{

                  padding: '0.65rem 1rem',
                  background: isPlateValid(plateInput, vehicleType) && !searching ? C.navy : C.gray200,
                  color: isPlateValid(plateInput, vehicleType) && !searching ? C.white : C.gray400,
                  border: 'none',
                  borderRadius: 10,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: isPlateValid(plateInput, vehicleType) && !searching ? 'pointer' : 'not-allowed',

                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {searching ? 'Đang tra...' : <><IconSearch size={14} />Tra cứu</>}
              </button>
            </div>

            {/* Plate display box */}
            <div style={{
              border: `2px dashed ${C.gray200}`,
              borderRadius: 12,
              padding: '1rem 1.25rem',
              background: C.gray50,
              textAlign: 'center',
              minHeight: 70,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              flexDirection: 'column',
            }}>
              {lookupData ? (
                <>
                  <p style={{
                    margin: 0,
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    fontFamily: "'Consolas','Courier New',monospace",
                    color: C.navy,
                    letterSpacing: '0.06em',
                  }}>
                    {plateInput.trim().toUpperCase()}
                  </p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: C.gray500 }}>
                    {vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy'} · {lookupData.customerType === 'monthly' ? 'Khách tháng' : lookupData.found ? 'Khách quen' : 'Khách lẻ'}
                    {lookupData.customerType === 'monthly' && lookupData.fixedSlot ? ` · Cố định: ${lookupData.fixedSlot}` : ''}
                  </p>
                  {/* Show vehicle details for found customers */}
                  {(lookupData.brand || lookupData.model || lookupData.color || lookupData.year || lookupData.seats) && (
                    <div style={{
                      background: '#F0F4F8',
                      border: '1px solid #D1D9E6',
                      borderRadius: 10,
                      padding: '0.7rem 0.85rem',
                      marginTop: '0.6rem',
                    }}>
                      <p style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Thông tin xe
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem 0.7rem' }}>
                        {lookupData.brand && (
                          <div>
                            <span style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>Hãng</span>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A5F' }}>{lookupData.brand}</div>
                          </div>
                        )}
                        {lookupData.model && (
                          <div>
                            <span style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>Mẫu</span>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A5F' }}>{lookupData.model}</div>
                          </div>
                        )}
                        {lookupData.color && (
                          <div>
                            <span style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>Màu</span>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A5F' }}>{lookupData.color}</div>
                          </div>
                        )}
                        {lookupData.year && (
                          <div>
                            <span style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>Năm</span>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A5F' }}>{lookupData.year}</div>
                          </div>
                        )}
                        {lookupData.seats != null && (
                          <div>
                            <span style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>Số chỗ</span>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E3A5F' }}>{lookupData.seats} chỗ</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Show owner info card for found customers */}
                  <div style={{ width: '100%', marginTop: '0.75rem' }}>
                    <OwnerInfoCard data={lookupData} />
                  </div>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: '0.82rem', color: C.gray400 }}>
                  Nhập biển số và nhấn Tra cứu
                </p>
              )}
            </div>

          </Card>

          {/* ══ RIGHT CARD — Thông tin Check-in ═══════════ */}
          <Card title="Thông tin Check-in">

            {/* ── MONTHLY VALID ─────────────────────── */}
            {pageState === 'monthly_valid' && lookupData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Badge */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: C.greenBg,
                  border: `1.5px solid ${C.greenBorder}`,
                  borderRadius: 20,
                  padding: '0.3rem 0.75rem',
                  width: 'fit-content',
                }}>
                  <IconCheck size={13} color={C.green} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803D' }}>
                    KHÁCH THÁNG · Còn hạn
                  </span>
                </div>

                {/* Info rows */}
                <div>
                  {[
                    { label: 'Loại xe', value: vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy' },
                    { label: 'Ngày hết hạn', value: expiryLabel, valueColor: C.green },
                    ...(lookupData.fixedSlot ? [{ label: 'Slot cố định', value: `${lookupData.fixedSlot} (cố định)`, valueColor: C.navy }] : []),
                    { label: 'Giờ vào', value: now() },
                  ].map((r) => <InfoRow key={r.label} {...r} />)}
                </div>

                {/* Banner */}
                <AlertBanner type="success">
                  Khách tháng — không thu phí vào.
                </AlertBanner>

                {/* Vehicle type (locked) */}
                <div>
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Loại xe (khóa)
                  </p>
                  <VehicleTypeToggle
                    value={vehicleType}
                    onChange={setVehicleType}
                    locked={true}
                    vehicleType={lookupData.vehicleType}
                  />
                </div>

                {/* Slot info */}
                {lookupData.fixedSlot && (
                  <div>
                    <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Vị trí
                    </p>
                    <div style={{
                      padding: '0.6rem 0.85rem',
                      background: '#EFF6FF',
                      border: '1.5px solid #BFDBFE',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <IconLock size={13} color={C.navy} />
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: C.navy }}>
                        {lookupData.fixedSlot} — Cố định
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── MONTHLY EXPIRED ───────────────────── */}
            {pageState === 'monthly_expired' && lookupData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Top red banner */}
                <AlertBanner type="error">
                  Gói tháng hết hạn (ngày {expiryLabel}). Slot cố định tạm khóa.
                </AlertBanner>

                {/* Badge */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: C.redBg,
                  border: `1.5px solid ${C.redBorder}`,
                  borderRadius: 20,
                  padding: '0.3rem 0.75rem',
                  width: 'fit-content',
                }}>
                  <IconX size={13} color={C.red} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: C.red }}>
                    ĐÃ HẾT HẠN
                  </span>
                </div>

                {/* Info rows */}
                <div>
                  {[
                    { label: 'Loại xe', value: vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy' },
                    { label: 'Ngày hết hạn', value: expiryLabel, valueColor: C.red },
                    { label: 'Giờ vào', value: now() },
                  ].map((r) => <InfoRow key={r.label} {...r} />)}
                </div>

                {/* Vehicle type (locked) */}
                <div>
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Loại xe (khóa)
                  </p>
                  <VehicleTypeToggle
                    value={vehicleType}
                    onChange={setVehicleType}
                    locked={true}
                    vehicleType={lookupData.vehicleType}
                  />
                </div>
              </div>
            )}

            {/* ── CASUAL ─────────────────────────────── */}
            {pageState === 'casual' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Badge */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#EFF6FF',
                  border: '1.5px solid #BFDBFE',
                  borderRadius: 20,
                  padding: '0.3rem 0.75rem',
                  width: 'fit-content',
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: C.navy }}>KHÁCH LẺ</span>
                </div>

                {/* Vehicle type toggle (enabled) */}
                <div>
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Loại xe
                  </p>
                  <VehicleTypeToggle
                    value={vehicleType}
                    onChange={(t) => { setVehicleType(t); setSelectedSlot(null); }}
                    locked={false}
                  />
                </div>

                {/* ── MOTORBIKE: auto-assign, no slot grid ── */}
                {vehicleType === 'MOTORBIKE' ? (
                  <>
                    <div style={{
                      padding: '0.65rem 0.9rem',
                      background: '#F0FDF4',
                      border: '1.5px solid #BBF7D0',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <IconMoto size={14} color={C.navy} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.navy }}>
                        Xe máy — đỗ ô trống bất kỳ (Tầng 2)
                      </span>
                    </div>
                    <div>
                      {[{ label: 'Giờ vào', value: now() }].map((r) => <InfoRow key={r.label} {...r} />)}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Slot selector — car casual */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Chọn vị trí đỗ
                        </p>
                        {availableSlots.find((s) => s.suggested) && (
                          <span style={{
                            background: '#EFF6FF',
                            border: '1px solid #BFDBFE',
                            borderRadius: 12,
                            padding: '0.15rem 0.5rem',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: C.navy,
                          }}>
                            Gợi ý: {availableSlots.find((s) => s.suggested)?.code}
                          </span>
                        )}
                      </div>
                      <SlotChipRow
                        slots={availableSlots}
                        selectedCode={selectedSlot}
                        onSelect={setSelectedSlot}
                      />
                      <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: C.gray400 }}>
                        Khách có thể đỗ ở ô trống khác còn trống.
                      </p>
                    </div>

                    {/* Info rows */}
                    <div>
                      {[
                        ...(selectedSlot ? [{ label: 'Vị trí', value: selectedSlot, valueColor: C.navy }] : []),
                        { label: 'Giờ vào', value: now() },
                      ].map((r) => <InfoRow key={r.label} {...r} />)}
                    </div>
                  </>
                )}

                {/* Banner — conditional: khách quen (found in DB) vs khách lẻ mới */}
                <AlertBanner type={lookupData?.found ? 'success' : 'info'}>
                  {lookupData?.found
                    ? 'Khách quen — áp dụng giá vé tháng nếu có gói.'
                    : 'Khách lẻ — thanh toán khi xe ra.'}
                </AlertBanner>
              </div>
            )}

            {/* ── IDLE ───────────────────────────────── */}
            {pageState === 'idle' && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: C.gray400 }}>
                  Tra cứu biển số để bắt đầu check-in
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* ══ ACTION BUTTONS (below two-column) ═══════════ */}
        {(pageState === 'monthly_valid' || pageState === 'monthly_expired' || pageState === 'casual') && (
          <div style={{
            marginTop: '1rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            {/* Primary confirm button */}
            <button
              onClick={handleSubmit}
              disabled={isConfirmDisabled || submitting}
              style={{
                padding: '0.75rem 1.5rem',
                background: !isConfirmDisabled ? C.navy : C.gray200,
                color: !isConfirmDisabled ? C.white : C.gray400,
                border: 'none',
                borderRadius: 12,
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: !isConfirmDisabled ? 'pointer' : 'not-allowed',
                boxShadow: !isConfirmDisabled ? '0 4px 14px rgba(30,58,95,0.25)' : 'none',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {submitting ? 'Đang xử lý...' : 'Xác nhận cho xe vào'}
            </button>

            {/* Expired-specific: convert to casual */}
            {pageState === 'monthly_expired' && (
              <button
                onClick={handleConvertToCasual}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: C.yellowBg,
                  color: C.yellow,
                  border: `1.5px solid ${C.yellowBorder}`,
                  borderRadius: 12,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Chuyển sang khách lẻ & cho vào
              </button>
            )}

            {/* Secondary actions */}
            {pageState === 'monthly_expired' && (
              <button
                onClick={() => { }}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: C.white,
                  color: C.navy,
                  border: `1.5px solid ${C.gray200}`,
                  borderRadius: 12,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hướng dẫn gia hạn gói
              </button>
            )}

            {/* Cancel */}
            <button
              onClick={handleReset}
              style={{
                padding: '0.75rem 1.25rem',
                background: C.white,
                color: C.gray500,
                border: `1.5px solid ${C.gray200}`,
                borderRadius: 12,
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Hủy / Nhập lại
            </button>
          </div>
        )}

        {/* ══ FOOTER STAT TILES ══════════════════════════ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          marginTop: '1.5rem',
        }}>
          {[
            {
              label: 'Sức chứa hiện tại',
              value: stats ? `${stats.capacityUsed}/${stats.capacityTotal}` : '—',
              sub: 'xe trong bãi',
              icon: <IconGrid size={16} color={C.navy} />,
              bg: '#EFF6FF',
              border: '#BFDBFE',
            },
            {
              label: 'Lượt khách tháng hôm nay',
              value: stats ? String(stats.monthlyToday) : '—',
              sub: 'xe',
              icon: <IconUsers size={16} color={C.navy} />,
              bg: '#F0FDF4',
              border: '#BBF7D0',
            },
          ].map((tile) => (
            <div
              key={tile.label}
              style={{
                background: tile.bg,
                border: `1.5px solid ${tile.border}`,
                borderRadius: 14,
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div style={{
                width: 40, height: 40,
                background: C.white,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(30,58,95,0.06)',
              }}>
                {tile.icon}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.gray500 }}>
                  {tile.label}
                </p>
                <p style={{ margin: '0.1rem 0 0', fontSize: '1.5rem', fontWeight: 800, color: C.navy, lineHeight: 1.2 }}>
                  {tile.value}
                </p>
                <p style={{ margin: 0, fontSize: '0.72rem', color: C.gray500 }}>{tile.sub}</p>
              </div>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}
