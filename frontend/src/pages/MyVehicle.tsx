import { useState, useEffect, useCallback, useRef } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { vehicleService } from '../services/vehicle.service';
import type { Vehicle } from '../types';
import { PlateInput } from '../components/PlateInput';
import styles from '../styles/driver.module.css';

// ═══════════════════════════════════════════════════════
//  PALETTE  (matches driver.module.css / DriverLayout)
// ═══════════════════════════════════════════════════════
const C = {
  navy: '#1E3A5F',
  bg: '#F3F4F6',
  white: '#FFFFFF',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray600: '#6B7280',
  gray900: '#111827',
  red: '#EF4444',
  redBg: '#FEF2F2',
  redBorder: '#FECACA',
  blue: '#3B82F6',
  blueBg: '#EFF6FF',
};

// ═══════════════════════════════════════════════════════
//  ICONS
// ═══════════════════════════════════════════════════════
function IconCar({ size = 16 }: { size?: number; color?: string }) {
  return (
    <span style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>🚗</span>
  );
}
function IconBike({ size = 16 }: { size?: number; color?: string }) {
  return (
    <span style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>🛵</span>
  );
}
function IconPlus({ size = 14, color = C.white }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconClose({ size = 14, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconTrash({ size = 14, color = C.gray600 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  );
}

function IconShieldCheck({ size = 16, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 11 2 2 4-4" />
    </svg>
  );
}

function IconSeat({ size = 16, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 18v-6a5 5 0 0 1 10 0v6" />
      <path d="M5 18h14" />
      <path d="M9 18v3" />
      <path d="M15 18v3" />
      <path d="M19 10h1a2 2 0 0 1 2 2v1" />
      <path d="M5 10H4a2 2 0 0 0-2 2v1" />
    </svg>
  );
}

function IconPaintBrush({ size = 16, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.35857 19.5 5.5 20 5.5 20.5C5.5 21.3284 6.17157 22 7 22H12Z" />
      <circle cx="7.5" cy="10.5" r="1.5" fill="currentColor" />
      <circle cx="11.5" cy="7.5" r="1.5" fill="currentColor" />
      <circle cx="16.5" cy="9.5" r="1.5" fill="currentColor" />
      <circle cx="15.5" cy="14.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconTag({ size = 16, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function IconBuilding({ size = 16, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <line x1="9" y1="22" x2="9" y2="16" />
      <line x1="15" y1="22" x2="15" y2="16" />
      <line x1="9" y1="16" x2="15" y2="16" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" />
    </svg>
  );
}

function IconCalendar({ size = 16, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════
type VehicleType = 'CAR' | 'MOTORBIKE';

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'CAR', label: 'Ô tô' },
  { value: 'MOTORBIKE', label: 'Xe máy' },
];

const TYPE_LABEL: Record<VehicleType, string> = {
  CAR: 'Ô tô',
  MOTORBIKE: 'Xe máy',
};

const VEHICLE_PROFILE_OPTIONS: Record<VehicleType, { label: string; models: string[] }[]> = {
  CAR: [
    { label: 'Toyota', models: ['Vios', 'Corolla Cross', 'Camry', 'Fortuner', 'Innova', 'Veloz Cross'] },
    { label: 'Honda', models: ['City', 'Civic', 'CR-V', 'HR-V', 'Accord'] },
    { label: 'Hyundai', models: ['Accent', 'Elantra', 'Tucson', 'Santa Fe', 'Creta'] },
    { label: 'Kia', models: ['Morning', 'K3', 'Seltos', 'Sonet', 'Carnival'] },
    { label: 'Mazda', models: ['Mazda 2', 'Mazda 3', 'CX-5', 'CX-8', 'BT-50'] },
    { label: 'Ford', models: ['Ranger', 'Everest', 'Territory', 'EcoSport'] },
    { label: 'VinFast', models: ['VF 3', 'VF 5', 'VF 6', 'VF 7', 'VF 8', 'VF 9'] },
  ],
  MOTORBIKE: [
    { label: 'Honda', models: ['Wave Alpha', 'Vision', 'Air Blade', 'Lead', 'SH Mode', 'SH'] },
    { label: 'Yamaha', models: ['Sirius', 'Jupiter', 'Grande', 'Janus', 'Exciter', 'NVX'] },
    { label: 'Suzuki', models: ['Raider', 'Satria', 'Address', 'Burgman Street'] },
    { label: 'Piaggio', models: ['Vespa Sprint', 'Vespa Primavera', 'Liberty', 'Medley'] },
    { label: 'SYM', models: ['Attila', 'Galaxy', 'Elite', 'Husky'] },
    { label: 'VinFast', models: ['Klara', 'Feliz', 'Evo200', 'Vento', 'Theon'] },
  ],
};

const VEHICLE_COLORS = ['Trắng', 'Đen', 'Bạc', 'Xám', 'Đỏ', 'Xanh dương', 'Xanh lá', 'Vàng', 'Nâu', 'Cam'];
const VEHICLE_YEARS = Array.from({ length: new Date().getFullYear() - 1989 }, (_, index) => new Date().getFullYear() - index);
const CAR_SEAT_OPTIONS = [2, 4, 5, 6, 7, 8, 9, 12];

// ═══════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

function VehicleCard({
  vehicle,
  phase,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
  onViewDetail,
}: {
  vehicle: Vehicle;
  phase: DeletePhase;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onViewDetail: () => void;
}) {
  const isCar = vehicle.type === 'CAR';
  const busy = phase === 'deleting';
  return (
    <div
      className={styles.card}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
        padding: '0.85rem 1rem',
        opacity: busy ? 0.6 : 1,
        cursor: phase === 'idle' ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
      }}
      onClick={() => { if (phase === 'idle') onViewDetail(); }}
      onMouseEnter={(e) => { if (phase === 'idle') (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 18px rgba(30,58,95,0.1)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          background: C.blueBg,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isCar ? <IconCar size={22} /> : <IconBike size={22} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: "'Consolas', monospace",
              fontSize: '1rem',
              fontWeight: 800,
              color: C.gray900,
              letterSpacing: '0.03em',
            }}
          >
            {vehicle.plateNumber}
          </span>
          {vehicle.isMonthly && (
            <span
              style={{
                background: C.greenBg,
                color: C.green,
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '0.15rem 0.55rem',
                borderRadius: 20,
                letterSpacing: '0.04em',
              }}
            >
              GÓI THÁNG
            </span>
          )}
        </div>
        <span style={{ fontSize: '0.78rem', color: C.gray600 }}>
          {TYPE_LABEL[vehicle.type]}
        </span>
      </div>

      {phase === 'confirming' ? (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <span style={{ fontSize: '0.78rem', color: C.gray900, fontWeight: 600 }}>Xác nhận xoá?</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onConfirmDelete(); }}
            disabled={busy}
            style={{ padding: '0.35rem 0.7rem', background: C.red, color: C.white, border: 'none', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}
          >Xoá</button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCancelDelete(); }}
            disabled={busy}
            style={{ padding: '0.35rem 0.7rem', background: C.white, color: C.gray600, border: `1px solid ${C.gray200}`, borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}
          >Huỷ</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAskDelete(); }}
          disabled={busy}
          aria-label={`Xoá xe ${vehicle.plateNumber}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '0.35rem 0.6rem', background: 'transparent', color: C.gray600,
            border: 'none', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.4 : 1, flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.red)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.gray600)}
        >
          <IconTrash size={13} color="currentColor" />
          {busy ? 'Đang xoá...' : 'Xoá'}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  VEHICLE DETAIL MODAL
// ═══════════════════════════════════════════════════════

function BookingStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    ACTIVE: { label: 'Đang hiệu lực', bg: '#DCFCE7', color: '#16A34A' },
    FULFILLED: { label: 'Đã hoàn thành', bg: '#EFF6FF', color: '#3B82F6' },
    NO_SHOW: { label: 'Không đến', bg: '#FEF3C7', color: '#D97706' },
    CANCELLED: { label: 'Đã hủy', bg: '#FEF2F2', color: '#EF4444' },
  };
  const s = map[status] ?? { label: status, bg: C.gray100, color: C.gray600 };
  return <span style={{ background: s.bg, color: s.color, fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 20 }}>{s.label}</span>;
}

function PackageStatusBadge({ status }: { status: string }) {
  const isActive = status === 'ACTIVE';
  return <span style={{ background: isActive ? '#DCFCE7' : '#F3F4F6', color: isActive ? '#16A34A' : '#6B7280', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 20 }}>{isActive ? 'Còn hiệu lực' : 'Hết hạn'}</span>;
}

function VehicleDetailModal({ vehicleId, onClose }: { vehicleId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'specs' | 'activity'>('specs');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    vehicleService.getDetail(vehicleId)
      .then((data) => { if (!cancelled) { setDetail(data); setLoading(false); } })
      .catch((e: any) => { if (!cancelled) { setError(e?.response?.data?.message ?? 'Không thể tải thông tin xe'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [vehicleId]);

  const fmt = (d: string) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtDatetime = (d: string) => new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const COLOR_MAP: Record<string, string> = {
    'Trắng': '#FFFFFF',
    'Đen': '#0F172A',
    'Bạc': '#CBD5E1',
    'Xám': '#64748B',
    'Đỏ': '#EF4444',
    'Xanh dương': '#3B82F6',
    'Xanh lá': '#10B981',
    'Vàng': '#F59E0B',
    'Nâu': '#78350F',
    'Cam': '#F97316',
  };

  const specs = detail
    ? [
        { label: 'Hãng xe', value: detail.brand || 'Chưa cập nhật', icon: <IconBuilding size={16} color={C.navy} /> },
        { label: 'Dòng xe', value: detail.model || 'Chưa cập nhật', icon: <IconTag size={16} color={C.navy} /> },
        { label: 'Màu sắc', value: detail.color || 'Chưa cập nhật', icon: <IconPaintBrush size={16} color={C.navy} />, isColor: !!detail.color },
        { label: 'Năm sản xuất', value: detail.year || 'Chưa cập nhật', icon: <IconCalendar size={16} color={C.navy} /> },
        ...(detail.type === 'CAR' ? [{ label: 'Số chỗ ngồi', value: detail.seats ? `${detail.seats} chỗ` : 'Chưa cập nhật', icon: <IconSeat size={16} color={C.navy} /> }] : []),
        { label: 'Ngày đăng ký', value: detail.createdAt ? fmt(detail.createdAt) : 'Chưa cập nhật', icon: <IconShieldCheck size={16} color={C.navy} /> },
      ]
    : [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div
        style={{
          background: C.white,
          borderRadius: '24px',
          width: '100%',
          maxWidth: 460,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Navy Gradient Header block */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1E3A5F 0%, #0F172A 100%)',
            padding: '2.25rem 1.5rem 1.75rem',
            textAlign: 'center',
            position: 'relative',
            color: '#FFFFFF',
          }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              borderRadius: '50%',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
            aria-label="Đóng"
          >
            <IconClose size={14} color="#FFFFFF" />
          </button>

          {/* Title */}
          <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', opacity: 0.8, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            Thông tin chi tiết
          </span>

          {detail && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              {/* Monospace Plate Number Mockup */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '2px solid #1E293B',
                  borderRadius: '10px',
                  boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.2)',
                  padding: '8px 20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'Consolas', 'Courier New', monospace",
                  fontWeight: 900,
                  color: '#0F172A',
                  fontSize: '1.4rem',
                  letterSpacing: '2px',
                  position: 'relative',
                  minWidth: '160px',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#CBD5E1',
                    border: '1px solid #94A3B8',
                  }}
                />
                {detail.plateNumber}
              </div>

              {/* Type Badge */}
              <span
                style={{
                  marginTop: '4px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '3px 12px',
                  borderRadius: '20px',
                  letterSpacing: '0.04em',
                }}
              >
                {detail.type === 'CAR' ? '🚗 Ô TÔ' : '🛵 XE MÁY'}
              </span>
            </div>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '3.5rem', color: C.gray600, fontSize: '0.9rem', fontWeight: 600 }}>
            Đang tải dữ liệu...
          </div>
        )}
        {error && (
          <div style={{ padding: '1.5rem' }}>
            <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 12, padding: '1rem', color: '#B91C1C', fontSize: '0.85rem', fontWeight: 500 }}>
              {error}
            </div>
          </div>
        )}

        {detail && !loading && (
          <>
            {/* Sliding Tabs Bar */}
            <div
              style={{
                display: 'flex',
                background: '#F1F5F9',
                borderRadius: '12px',
                padding: '4px',
                margin: '1.25rem 1.25rem 0.5rem',
              }}
            >
              <button
                onClick={() => setActiveTab('specs')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'specs' ? '#FFFFFF' : 'transparent',
                  color: activeTab === 'specs' ? '#1E3A5F' : '#64748B',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: activeTab === 'specs' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Thông số xe
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'activity' ? '#FFFFFF' : 'transparent',
                  color: activeTab === 'activity' ? '#1E3A5F' : '#64748B',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: activeTab === 'activity' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Hoạt động & Gói
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.25rem 2rem' }}>
              {activeTab === 'specs' ? (
                /* Specs Tab (Grid Layout) */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {specs.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '14px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            background: '#EFF6FF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {s.icon}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>{s.label}</span>
                      </div>
                      {s.isColor ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '2px' }}>
                          <div
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              background: COLOR_MAP[s.value] ?? '#94A3B8',
                              border: s.value === 'Trắng' ? '1px solid #CBD5E1' : 'none',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            }}
                          />
                          <span style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 700 }}>{s.value}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 700, paddingLeft: '2px' }}>
                          {s.value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Activity Tab (Bookings, Monthly Packages, Check-in Timeline) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Monthly Package VIP Card */}
                  {detail.monthlyPackage ? (
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #1E3A5F 0%, #3B82F6 100%)',
                        borderRadius: '16px',
                        padding: '1.25rem',
                        color: '#FFFFFF',
                        boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.25)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          right: '-20px',
                          bottom: '-20px',
                          width: '120px',
                          height: '120px',
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.08)',
                        }}
                      />
                      <div style={{ position: 'absolute', right: '16px', top: '16px', opacity: 0.15 }}>
                        {detail.type === 'CAR' ? <IconCar size={56} /> : <IconBike size={56} />}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div>
                          <span
                            style={{
                              background: 'rgba(255, 255, 255, 0.2)',
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '20px',
                              letterSpacing: '0.05em',
                            }}
                          >
                            GÓI ĐỖ XE THÁNG
                          </span>
                          <h3 style={{ margin: '6px 0 0 0', fontSize: '1.1rem', fontWeight: 800 }}>
                            {detail.monthlyPackage.planName ?? 'Gói VIP'}
                          </h3>
                        </div>
                        <PackageStatusBadge status={detail.monthlyPackage.status} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', opacity: 0.9 }}>
                        <div>
                          Thời hạn: <strong>{fmt(detail.monthlyPackage.startDate)}</strong> –{' '}
                          <strong>{fmt(detail.monthlyPackage.expiryDate)}</strong>
                        </div>
                        {detail.monthlyPackage.slot && (
                          <div>
                            Vị trí cố định:{' '}
                            <strong>
                              Tầng {detail.monthlyPackage.slot.floor?.name ?? '—'} · Ô {detail.monthlyPackage.slot.code}
                            </strong>
                          </div>
                        )}
                        <div
                          style={{
                            marginTop: '8px',
                            fontSize: '1rem',
                            fontWeight: 800,
                            color: '#FCD34D',
                            borderTop: '1px solid rgba(255,255,255,0.15)',
                            paddingTop: '8px',
                          }}
                        >
                          {Number(detail.monthlyPackage.price).toLocaleString('vi-VN')} đ
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: '#F8FAFC',
                        border: '1.5px dashed #E2E8F0',
                        borderRadius: '16px',
                        padding: '1.25rem',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '6px' }}>🎫</span>
                      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: C.navy }}>
                        Chưa đăng ký gói tháng
                      </p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                        Mua gói tháng giúp tối ưu chi phí đỗ xe.
                      </p>
                    </div>
                  )}

                  {/* Bookings */}
                  {detail.bookings?.length > 0 && (
                    <div>
                      <h4
                        style={{
                          margin: '0 0 0.6rem',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          color: C.navy,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Lịch đặt chỗ gần đây
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {detail.bookings.map((b: any) => (
                          <div
                            key={b.id}
                            style={{
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: '12px',
                              padding: '10px 14px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>
                                Tầng {b.slot?.floor?.name ?? '—'} · Ô {b.slot?.code ?? '—'}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                                Dự kiến đến: {b.expectedArrival ? fmtDatetime(b.expectedArrival) : '—'}
                              </div>
                            </div>
                            <BookingStatusBadge status={b.status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Check-in records timeline */}
                  {detail.checkInRecords?.length > 0 && (
                    <div>
                      <h4
                        style={{
                          margin: '0 0 0.8rem',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          color: C.navy,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Lịch sử gửi xe gần đây
                      </h4>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          paddingLeft: '10px',
                          borderLeft: '2px solid #E2E8F0',
                          gap: '16px',
                          marginLeft: '6px',
                          marginTop: '6px',
                        }}
                      >
                        {detail.checkInRecords.map((r: any) => {
                          const isCurrentlyParked = !r.checkOutTime;
                          return (
                            <div key={r.id} style={{ position: 'relative', paddingLeft: '14px' }}>
                              {/* Pulse indicator dot */}
                              <div
                                style={{
                                  position: 'absolute',
                                  left: '-21px',
                                  top: '4px',
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  background: isCurrentlyParked ? '#10B981' : '#94A3B8',
                                  border: '2px solid #FFFFFF',
                                  boxShadow: `0 0 0 2px ${isCurrentlyParked ? '#A7F3D0' : '#E2E8F0'}`,
                                  animation: isCurrentlyParked ? 'pulse 2s infinite' : 'none',
                                }}
                              />

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                <div>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>
                                    Tầng {r.slot?.floor?.name ?? '—'} · Ô {r.slot?.code ?? '—'}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                                    Vào: {fmtDatetime(r.checkInTime)}
                                  </div>
                                  {r.checkOutTime && (
                                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                      Ra: {fmtDatetime(r.checkOutTime)}
                                    </div>
                                  )}
                                </div>
                                <span
                                  style={{
                                    background: isCurrentlyParked ? '#D1FAE5' : '#F1F5F9',
                                    color: isCurrentlyParked ? '#065F46' : '#475569',
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    flexShrink: 0,
                                  }}
                                >
                                  {isCurrentlyParked ? 'Đang đỗ' : 'Đã ra'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {detail.bookings?.length === 0 && !detail.monthlyPackage && detail.checkInRecords?.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94A3B8' }}>
                      <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '8px' }}>📭</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Chưa có hoạt động gửi xe nào gần đây</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type DeletePhase = 'idle' | 'confirming' | 'deleting';

function DeleteErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      style={{
        background: C.redBg,
        border: `1.5px solid ${C.redBorder}`,
        borderRadius: 10,
        padding: '0.55rem 0.85rem',
        fontSize: '0.8rem',
        color: '#B91C1C',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      <span style={{ flex: 1, lineHeight: 1.4 }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Đóng thông báo"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#B91C1C',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
        }}
      >
        <IconClose size={12} color="#B91C1C" />
      </button>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      className={styles.card}
      style={{
        background: C.gray50,
        border: `1.5px dashed ${C.gray300}`,
        padding: '2rem 1.25rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          background: C.white,
          border: `1.5px solid ${C.gray200}`,
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 0.75rem',
        }}
      >
        <IconCar size={24} color={C.gray400} />
      </div>
      <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: C.gray900 }}>
        Bạn chưa có xe nào
      </p>
      <p style={{ margin: '0.25rem 0 1rem', fontSize: '0.82rem', color: C.gray600 }}>
        Nhấn "Thêm xe" bên dưới để đăng ký phương tiện
      </p>
      <button
        onClick={onAdd}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '0.55rem 1.1rem',
          background: C.navy,
          color: C.white,
          border: 'none',
          borderRadius: 10,
          fontSize: '0.85rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <IconPlus size={13} color={C.white} />
        Thêm xe ngay
      </button>
    </div>
  );
}

function AddVehicleForm({
  submitting,
  error,
  onCancel,
  onSubmit,
}: {
  submitting: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (
    plateNumber: string,
    type: VehicleType,
    brand?: string,
    model?: string,
    color?: string,
    year?: number,
    seats?: number,
  ) => Promise<void>;
}) {
  const [plateNumber, setPlateNumber] = useState('');
  const [type, setType] = useState<VehicleType>('CAR');
  const [brand, setBrand] = useState(VEHICLE_PROFILE_OPTIONS.CAR[0].label);
  const [model, setModel] = useState(VEHICLE_PROFILE_OPTIONS.CAR[0].models[0]);
  const [color, setColor] = useState(VEHICLE_COLORS[0]);
  const [year, setYear] = useState<number | ''>(VEHICLE_YEARS[0]);
  const [seats, setSeats] = useState<number | ''>(CAR_SEAT_OPTIONS[2] ?? 5);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    const brandEntries = VEHICLE_PROFILE_OPTIONS[type];
    const currentBrand = brandEntries.find((item) => item.label === brand) ?? brandEntries[0];
    if (currentBrand.label !== brand) {
      setBrand(currentBrand.label);
    }
    if (!currentBrand.models.includes(model)) {
      setModel(currentBrand.models[0]);
    }
  }, [type, brand]);

  const availableModels = VEHICLE_PROFILE_OPTIONS[type].find((item) => item.label === brand)?.models ?? VEHICLE_PROFILE_OPTIONS[type][0].models;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = plateNumber.trim();
    if (!trimmed) {
      setLocalError('Vui lòng nhập biển số xe');
      return;
    }
    if (type === 'CAR' && seats === '') {
      setLocalError('Vui lòng chọn số chỗ cho ô tô');
      return;
    }
    setLocalError('');
    const yearVal = year === '' ? undefined : Number(year);
    const seatsVal = type === 'CAR' && seats !== '' ? Number(seats) : undefined;
    await onSubmit(trimmed, type, brand?.trim() || undefined, model?.trim() || undefined, color?.trim() || undefined, yearVal, seatsVal);
  };

  const displayError = localError || error;

  return (
    <form onSubmit={handleSubmit} className={styles.card}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.85rem',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>
          Thêm xe mới
        </p>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: submitting ? 0.5 : 1,
          }}
          aria-label="Đóng"
        >
          <IconClose size={16} color={C.gray600} />
        </button>
      </div>

      {displayError && (
        <div
          style={{
            background: C.redBg,
            border: `1.5px solid ${C.redBorder}`,
            borderRadius: 10,
            padding: '0.6rem 0.85rem',
            marginBottom: '0.85rem',
            fontSize: '0.8rem',
            color: '#B91C1C',
            fontWeight: 500,
          }}
        >
          {displayError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.9rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Biển số xe</span>
          <PlateInput
            value={plateNumber}
            onChange={setPlateNumber}
            placeholder="VD: 51A-12345"
            disabled={submitting}
            autoFocus
            style={{
              padding: '0.65rem 0.85rem',
              border: `1.5px solid ${C.gray200}`,
              borderRadius: 10,
              fontSize: '0.95rem',
              fontFamily: "'Consolas', monospace",
              fontWeight: 600,
              color: C.gray900,
              background: C.white,
              outline: 'none',
            }}
          />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Loại xe</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {VEHICLE_TYPES.map((opt) => {
              const selected = type === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '0.6rem 0.85rem',
                    borderRadius: 10,
                    border: `1.5px solid ${selected ? C.navy : C.gray200}`,
                    background: selected ? C.navy : C.white,
                    color: selected ? C.white : C.navy,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.value === 'CAR' ? (
                    <IconCar size={14} color={selected ? C.white : '#3B82F6'} />
                  ) : (
                    <IconBike size={14} color={selected ? C.white : '#F97316'} />
                  )}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.9rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Hãng</span>
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            disabled={submitting}
            style={{ padding: '0.65rem 0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 10, background: C.white }}
          >
            {VEHICLE_PROFILE_OPTIONS[type].map((brandOption) => (
              <option key={brandOption.label} value={brandOption.label}>
                {brandOption.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Mẫu</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={submitting}
            style={{ padding: '0.65rem 0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 10, background: C.white }}
          >
            {availableModels.map((modelOption) => (
              <option key={modelOption} value={modelOption}>
                {modelOption}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Màu</span>
          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={submitting}
            style={{ padding: '0.65rem 0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 10, background: C.white }}
          >
            {VEHICLE_COLORS.map((colorOption) => (
              <option key={colorOption} value={colorOption}>
                {colorOption}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Năm</span>
          <select
            value={year === '' ? '' : year.toString()}
            onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={submitting}
            style={{ padding: '0.65rem 0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 10, background: C.white }}
          >
            {VEHICLE_YEARS.map((yearOption) => (
              <option key={yearOption} value={yearOption}>
                {yearOption}
              </option>
            ))}
          </select>
        </label>
        {type === 'CAR' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Số chỗ</span>
            <select
              value={seats === '' ? '' : seats.toString()}
              onChange={(e) => setSeats(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={submitting}
              style={{ padding: '0.65rem 0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 10, background: C.white }}
            >
              <option value="">Chọn số chỗ</option>
              {CAR_SEAT_OPTIONS.map((seatCount) => (
                <option key={seatCount} value={seatCount}>
                  {seatCount} chỗ
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting || !plateNumber.trim()}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: submitting || !plateNumber.trim() ? C.gray300 : C.navy,
          color: submitting || !plateNumber.trim() ? C.gray400 : C.white,
          border: 'none',
          borderRadius: 10,
          fontSize: '0.9rem',
          fontWeight: 700,
          cursor: submitting || !plateNumber.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? 'Đang thêm...' : 'Thêm xe'}
      </button>
    </form>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export function MyVehiclePage() {
  const { user, isLoading: authLoading } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deleteState, setDeleteState] = useState<Record<string, { phase: DeletePhase; error: string }>>({});
  const loadEpoch = useRef(0);

  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [detailVehicleId, setDetailVehicleId] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    const epoch = ++loadEpoch.current;
    setLoading(true);
    setLoadError('');
    try {
      const data = await vehicleService.getMyVehicles();
      if (epoch !== loadEpoch.current) return;
      setVehicles(data ?? []);
    } catch (e: any) {
      if (epoch !== loadEpoch.current) return;
      setLoadError(
        e?.response?.data?.message ?? 'Không thể tải danh sách xe. Vui lòng thử lại.'
      );
    } finally {
      if (epoch === loadEpoch.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    loadVehicles();
  }, [authLoading, user, loadVehicles]);

  const handleAddVehicle = async (
    plateNumber: string,
    type: VehicleType,
    brand?: string,
    model?: string,
    color?: string,
    year?: number,
    seats?: number,
  ) => {
    setSubmitting(true);
    setFormError('');
    try {
      await vehicleService.create({ plateNumber, type, brand, model, color, year, seats });
      setFormOpen(false);
      setFormError('');
      await loadVehicles();
    } catch (e: any) {
      setFormError(e?.response?.data?.message ?? 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  const askDelete = (id: string) => {
    setDeleteState((prev) => ({
      ...prev,
      [id]: { phase: 'confirming', error: '' },
    }));
  };

  const cancelDelete = (id: string) => {
    setDeleteState((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const clearDeleteError = (id: string) => {
    setDeleteState((prev) => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { phase: 'idle', error: '' } };
    });
  };

  const handleDelete = async (id: string) => {
    setDeleteState((prev) => ({
      ...prev,
      [id]: { phase: 'deleting', error: '' },
    }));
    try {
      await vehicleService.remove(id);
      setDeleteState((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadVehicles();
    } catch (e: any) {
      const message = e?.response?.data?.message ?? 'Không thể xoá xe';
      setDeleteState((prev) => ({
        ...prev,
        [id]: { phase: 'idle', error: message },
      }));
    }
  };

  if (authLoading) {
    return (
      <div
        style={{
          padding: '3rem',
          textAlign: 'center',
          color: C.gray400,
          fontSize: '0.9rem',
          fontWeight: 600,
        }}
      >
        Đang tải...
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          padding: '3rem',
          textAlign: 'center',
          color: C.gray600,
          fontSize: '0.9rem',
        }}
      >
        Vui lòng đăng nhập để xem danh sách xe của bạn.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: C.navy }}>
          Xe của tôi
        </h1>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: C.gray600 }}>
          Quản lý các phương tiện đã đăng ký với tài khoản {user.email}
        </p>
      </div>

      {loadError && (
        <div
          style={{
            background: C.redBg,
            border: `1.5px solid ${C.redBorder}`,
            borderRadius: 10,
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            color: '#B91C1C',
            fontWeight: 500,
          }}
        >
          {loadError}
        </div>
      )}

      {loading ? (
        <div
          className={styles.card}
          style={{
            padding: '2.5rem',
            textAlign: 'center',
            color: C.gray400,
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          Đang tải danh sách xe...
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState onAdd={() => setFormOpen(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {vehicles.map((v) => {
            const cardState = deleteState[v.id];
            const phase: DeletePhase = cardState?.phase ?? 'idle';
            const error = cardState?.error ?? '';
            return (
              <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <VehicleCard
                  vehicle={v}
                  phase={phase}
                  onAskDelete={() => askDelete(v.id)}
                  onConfirmDelete={() => handleDelete(v.id)}
                  onCancelDelete={() => cancelDelete(v.id)}
                  onViewDetail={() => setDetailVehicleId(v.id)}
                />
                {error && phase !== 'deleting' && (
                  <DeleteErrorBanner message={error} onDismiss={() => clearDeleteError(v.id)} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {vehicles.length > 0 && !formOpen && (
        <button
          onClick={() => setFormOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '0.85rem',
            background: C.navy,
            color: C.white,
            border: 'none',
            borderRadius: 12,
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(30, 58, 95, 0.25)',
          }}
        >
          <IconPlus size={15} color={C.white} />
          Thêm xe
        </button>
      )}

      {formOpen && (
        <AddVehicleForm
          submitting={submitting}
          error={formError}
          onCancel={() => {
            setFormOpen(false);
            setFormError('');
          }}
          onSubmit={handleAddVehicle}
        />
      )}

      {detailVehicleId && (
        <VehicleDetailModal vehicleId={detailVehicleId} onClose={() => setDetailVehicleId(null)} />
      )}
    </div>
  );
}
