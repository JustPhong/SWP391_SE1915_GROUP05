import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStaffDashboard } from '../api/dashboardApi';
import type { DashboardData, DashboardRecentCheckin } from '../api/dashboardApi';
import { PlateInput } from '../components/PlateInput';

type Accent = 'green' | 'orange' | 'gray' | 'blue';

// ── Style tokens ────────────────────────────────────────
const C = {
  navy:     '#1E3A5F',
  navyDark:  '#152D4A',
  bg:       '#F0F4F8',
  white:    '#FFFFFF',
  gray100:  '#F7F9FC',
  gray200:  '#E8ECF0',
  gray400:  '#9BA8B4',
  gray600:  '#5C6B7A',
  gray800:  '#2D3A45',
  green:    '#22C55E',
  greenBg:  '#F0FDF4',
  orange:   '#F59E0B',
  orangeBg: '#FFFBEB',
  pink:     '#EC4899',
  red:      '#EF4444',
  shadow:   '0 2px 12px rgba(30, 58, 95, 0.10)',
  shadowMd: '0 4px 14px rgba(30, 58, 95, 0.15)',
  radius:   12,
} as const;

const ACCENT_COLORS: Record<Accent, { bar: string; bg: string; text: string; icon: string }> = {
  green:  { bar: C.green,    bg: C.greenBg,  text: '#15803D', icon: C.green    },
  orange: { bar: C.orange,  bg: C.orangeBg, text: '#B45309', icon: C.orange   },
  gray:   { bar: C.gray400, bg: C.gray100,  text: C.gray600, icon: C.gray400 },
  blue:   { bar: '#3B82F6', bg: '#EFF6FF',  text: '#1D4ED8', icon: '#3B82F6' },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${MM}/${yyyy} ${HH}:${mm}`;
}

// ── Icons ────────────────────────────────────────────────
function IconCar({ size = 20 }: { size?: number; color?: string }) {
  return (
    <span style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>🚗</span>
  );
}

function IconP({ size = 20, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <text x="12" y="18" textAnchor="middle" fontSize="20" fontWeight="800" fill={color} fontFamily="Arial, sans-serif">P</text>
    </svg>
  );
}

function IconEnter({ size = 20, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

function IconExit({ size = 20, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconMinus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconSearch({ size = 16, color = C.gray600 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconSpinner({ size = 20, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function IconDots({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.gray400} strokeWidth="2">
      <circle cx="12" cy="5" r="1" fill={C.gray400} />
      <circle cx="12" cy="12" r="1" fill={C.gray400} />
      <circle cx="12" cy="19" r="1" fill={C.gray400} />
    </svg>
  );
}

// ── Sub-components ───────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent: Accent;
  Icon: (props: { size?: number; color?: string }) => JSX.Element;
}

function KpiCard({ label, value, sub, accent, Icon }: KpiCardProps) {
  const c = ACCENT_COLORS[accent];

  return (
    <div style={{
      background: C.white,
      borderRadius: C.radius,
      boxShadow: C.shadow,
      padding: '1.1rem 1.25rem',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: c.bar }} />
      <div style={{ paddingLeft: '0.35rem' }}>
        <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600, color: C.gray600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </p>
        <p style={{ margin: '0.2rem 0 0', fontSize: '1.75rem', fontWeight: 800, color: C.navy, lineHeight: 1.1 }}>
          {value}
        </p>
        {sub && (
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: C.gray600 }}>
            {sub}
          </p>
        )}
      </div>
      <div style={{ marginTop: '0.25rem' }}>
        <Icon size={28} color={c.icon} />
      </div>
    </div>
  );
}

interface FloorGridProps {
  label: string;
  percent: number;
  occupied: number;
  capacity: number;
}

function FloorGrid({ label, percent, occupied, capacity }: FloorGridProps) {
  const filled = occupied;
  const empty  = Math.max(0, capacity - occupied);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.75rem', color: C.gray600 }}>
          <span>{filled}/{capacity} xe trong bãi</span>
          <span style={{ fontWeight: 700, color: percent >= 85 ? C.red : percent >= 60 ? C.orange : C.green }}>
            {percent}% đầy
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {Array.from({ length: Math.min(filled, 40) }, (_, i) => (
          <div key={`f-${i}`} style={{ width: 14, height: 14, borderRadius: 3, background: C.pink, opacity: 0.7 }} />
        ))}
        {Array.from({ length: Math.min(empty, 40) }, (_, i) => (
          <div key={`e-${i}`} style={{ width: 14, height: 14, borderRadius: 3, background: C.green, opacity: 0.7 }} />
        ))}
      </div>
    </div>
  );
}

interface VehicleRowProps {
  v: DashboardRecentCheckin;
}

function VehicleRow({ v }: VehicleRowProps) {
  const isCar = v.vehicleType === 'CAR';
  const statusLabel = v.parked ? 'Đang đỗ' : 'Đã ra';
  const dotColor = v.parked ? C.green : C.gray400;

  return (
    <tr style={{ borderBottom: `1px solid ${C.gray200}` }}>
      <td style={{ padding: '0.7rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: C.navy, letterSpacing: '0.02em' }}>
        {v.plate}
      </td>
      <td style={{ padding: '0.7rem 1rem', fontSize: '0.82rem', color: C.gray600 }}>
        {formatDateTime(v.checkInTime)}
      </td>
      <td style={{ padding: '0.7rem 1rem' }}>
        <span style={{
          display: 'inline-block',
          padding: '0.2rem 0.6rem',
          borderRadius: 20,
          fontSize: '0.72rem',
          fontWeight: 700,
          background: isCar ? '#EFF6FF' : '#FEF9C3',
          color: isCar ? C.navy : '#854D0E',
        }}>
          {isCar ? 'Ô tô' : 'Xe máy'}
        </span>
      </td>
      <td style={{ padding: '0.7rem 1rem', fontSize: '0.82rem', color: C.gray600 }}>
        {v.slotCode || 'Chưa gán slot'}
      </td>
      <td style={{ padding: '0.7rem 1rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', color: C.gray600 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
          {statusLabel}
        </span>
      </td>
      <td style={{ padding: '0.7rem 1rem', textAlign: 'center' }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 4px' }}>
          <IconDots size={18} />
        </button>
      </td>
    </tr>
  );
}

// ── Main component ───────────────────────────────────────
export function StaffDashboardPage() {
  const [plate, setPlate] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const { user } = useAuth();
  const displayName = user?.fullName ?? 'Nhân viên';
  const navigate = useNavigate();

  useEffect(() => {
    getStaffDashboard()
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setFetchError('Không thể tải dữ liệu tổng quan.'); setLoading(false); });
  }, []);

  const navigateWithPlate = (path: string) => {
    if (!plate.trim()) return;
    navigate(`${path}?plate=${encodeURIComponent(plate.trim())}`);
  };

  return (
    <div style={{
      minHeight: '100%',
      background: C.bg,
      fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
      padding: '1.5rem',
      boxSizing: 'border-box',
    }}>

      {/* ── PAGE TITLE + GREETING ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: C.navy }}>
          Trang tổng quan
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: C.gray600 }}>
          {getGreeting()}, {displayName}
        </p>
      </div>

      {/* ── TOP ROW: 4 KPI Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        marginBottom: '1.25rem',
      }}>
        <KpiCard
          label="Tổng xe trong bãi"
          value={data ? String(data.vehiclesInLot) : '…'}
          accent="green"
          Icon={(p) => <IconCar {...p} />}
          sub="Xe hiện đang đỗ"
        />
        <KpiCard
          label="Chỗ trống khả dụng"
          value={data ? `${data.freeCar + data.freeMotorbike} / ${data.totalSlots}` : '…'}
          accent="blue"
          Icon={(p) => <IconP {...p} />}
          sub={data ? `Ô tô: ${data.freeCar} · Xe máy: ${data.freeMotorbike}` : '…'}
        />
        <KpiCard
          label="Số xe vào hôm nay"
          value={data ? String(data.checkedInToday) : '…'}
          accent="orange"
          Icon={(p) => <IconEnter {...p} />}
        />
        <KpiCard
          label="Số xe ra hôm nay"
          value={data ? String(data.checkedOutToday) : '…'}
          accent="gray"
          Icon={(p) => <IconExit {...p} />}
        />
      </div>

      {/* ── MIDDLE ROW: 2 columns ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        marginBottom: '1.25rem',
      }}>

        {/* Left: Quick Action */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            background: C.white,
            borderRadius: C.radius,
            boxShadow: C.shadow,
            padding: '1.25rem',
          }}>
            <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: C.gray800 }}>
              Xử lý nhanh
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <PlateInput
                placeholder="VD: 30A-123.45"
                value={plate}
                onChange={setPlate}
                onKeyDown={(e) => { if (e.key === 'Enter') navigateWithPlate('/staff/checkin'); }}
                style={{
                  flex: 1,
                  padding: '0.6rem 0.85rem',
                  border: `1.5px solid ${C.gray200}`,
                  borderRadius: 10,
                  fontSize: '0.875rem',
                  outline: 'none',
                  color: C.gray800,
                  background: C.white,
                  boxSizing: 'border-box',
                }}
              />
              <button
                style={{
                  padding: '0.6rem 0.85rem',
                  background: C.gray100,
                  border: `1.5px solid ${C.gray200}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onClick={() => navigateWithPlate('/staff/checkin')}
              >
                <IconSearch color={C.gray600} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  background: C.navy,
                  color: C.white,
                  border: 'none',
                  borderRadius: 10,
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 8px rgba(30, 58, 95, 0.25)',
                }}
                onClick={() => navigateWithPlate('/staff/checkin')}
              >
                <IconPlus size={15} />
                Check-in
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  background: C.white,
                  color: C.gray600,
                  border: `1.5px solid ${C.gray200}`,
                  borderRadius: 10,
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
                onClick={() => navigateWithPlate('/staff/checkout')}
              >
                <IconMinus size={15} />
                Check-out
              </button>
            </div>
          </div>
        </div>

        {/* Right: Mật độ đỗ xe */}
        <div style={{
          background: C.white,
          borderRadius: C.radius,
          boxShadow: C.shadow,
          padding: '1.25rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: C.gray800 }}>
              Mật độ đỗ xe
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.75rem', color: C.gray600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
                Trống
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.pink, display: 'inline-block' }} />
                Đã đỗ
              </span>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <IconSpinner size={24} color={C.gray400} />
            </div>
          ) : fetchError ? (
            <p style={{ margin: 0, padding: '1rem 0', fontSize: '0.82rem', color: C.red }}>{fetchError}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {data!.floors.map((f) => (
                <FloorGrid
                  key={f.floorCode}
                  label={`${f.name} (${f.floorCode})`}
                  percent={f.percent}
                  occupied={f.occupied}
                  capacity={f.capacity}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM: Hoạt động gần đây ── */}
      <div style={{
        background: C.white,
        borderRadius: C.radius,
        boxShadow: C.shadow,
        padding: '1.25rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: C.gray800 }}>
            Hoạt động gần đây
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <IconSpinner size={24} color={C.gray400} />
            </div>
          ) : fetchError ? (
            <p style={{ margin: 0, padding: '1rem 0', fontSize: '0.82rem', color: C.red }}>{fetchError}</p>
          ) : data!.recentCheckins.length === 0 ? (
            <p style={{ margin: 0, padding: '1.5rem 0', fontSize: '0.875rem', color: C.gray400, textAlign: 'center' }}>
              Chưa có hoạt động nào hôm nay.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.gray200}` }}>
                  {['Biển số', 'Thời gian vào', 'Loại xe', 'Vị trí', 'Trạng thái', ''].map((col) => (
                    <th key={col} style={{
                      padding: '0.6rem 1rem',
                      textAlign: 'left',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: C.gray400,
                      background: C.gray100,
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data!.recentCheckins.map((v, i) => (
                  <VehicleRow key={i} v={v} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
