import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../services/api';

// ═══════════════════════════════════════════════════════════
//  PALETTE — matches existing design system
// ═══════════════════════════════════════════════════════════
const C = {
  navy:      '#1E3A5F',
  navyDark:  '#152D4A',
  white:     '#FFFFFF',
  gray50:    '#F9FAFB',
  gray100:   '#F3F4F7',
  gray200:   '#E2E8F0',
  gray400:   '#9BA8B4',
  gray600:   '#5C6B7A',
  gray800:   '#2D3A45',
  blue:      '#3B82F6',
  blueBg:    '#EFF6FF',
  green:     '#22C55E',
  greenBg:   '#DCFCE7',
  amber:     '#F59E0B',
  amberBg:   '#FEF3C7',
  shadow:    '0 8px 32px rgba(30, 58, 95, 0.08)',
} as const;

// ═══════════════════════════════════════════════════════════
//  API TYPES
// ═══════════════════════════════════════════════════════════
interface KpiSummary {
  vehiclesParked: number;
  occupancyRate: number;
  monthlySubscribers: number;
  todayRevenue: number;
}

interface RevenueRow {
  date: string;
  amount: number;
}

interface VehiclesByType {
  car: number;
  motorbike: number;
}

interface OccupancyReport {
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  reservedSlots: number;
  occupancyRate: number;
  byFloor: FloorOccupancy[];
}

interface FloorOccupancy {
  floor: number;
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  occupancyRate: number;
}

// ═══════════════════════════════════════════════════════════
//  FLOOR DEFINITIONS (hardcoded — matches seed + schema)
// ═══════════════════════════════════════════════════════════
const FLOORS = [
  { floor: 0, label: 'Tầng G', vehicleType: 'Ô tô', sub: 'Gói tháng', capacity: 20 },
  { floor: 1, label: 'Tầng 1', vehicleType: 'Xe máy', sub: 'Gói tháng', capacity: 40 },
  { floor: 2, label: 'Tầng 2', vehicleType: 'Xe máy', sub: 'Khách lẻ', capacity: 40 },
  { floor: 3, label: 'Tầng 3', vehicleType: 'Ô tô', sub: 'Khách lẻ', capacity: 20 },
];

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════
function fmtVnd(amount: number): string {
  if (!amount && amount !== 0) return '0đ';
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getLast30Days(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().split('T')[0],
    to:   to.toISOString().split('T')[0],
  };
}

type DateRange = 'today' | 'week' | 'month' | 'custom';

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today:  'Hôm nay',
  week:   'Tuần này',
  month:  'Tháng này',
  custom: 'Tùy chọn',
};

function dateRangeToIso(range: DateRange): { from: string; to: string } {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const from = new Date(today);

  switch (range) {
    case 'today':
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString().split('T')[0], to: today.toISOString().split('T')[0] };
    case 'week':
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString().split('T')[0], to: today.toISOString().split('T')[0] };
    case 'month':
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString().split('T')[0], to: today.toISOString().split('T')[0] };
    default:
      return getLast30Days();
  }
}

// ═══════════════════════════════════════════════════════════
//  ICONS
// ═══════════════════════════════════════════════════════════
function IconSpinner({ size = 20, color = C.gray400 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
      style={{ animation: 'spin 0.8s linear infinite' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}

function IconMoney({ size = 20, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function IconCar({ size = 20, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 11l2-6h10l2 6" />
      <path d="M3 11h18v5a1 1 0 01-1 1H4a1 1 0 01-1-1v-5z" />
      <circle cx="7.5" cy="16" r="1.5" />
      <circle cx="16.5" cy="16" r="1.5" />
    </svg>
  );
}

function IconGauge({ size = 20, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22a10 10 0 100-20 10 10 0 000 20z" opacity="0.3" />
      <path d="M12 6v6l4 2" />
      <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </svg>
  );
}

function IconUsers({ size = 20, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

type AccentColor = 'green' | 'blue' | 'amber' | 'purple';

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent: AccentColor;
  Icon: (props: { size?: number; color?: string }) => JSX.Element;
  loading?: boolean;
}

const ACCENT_MAP: Record<AccentColor, { bg: string; text: string; bar: string; icon: string }> = {
  green:  { bg: C.greenBg,  text: '#15803D', bar: C.green,  icon: C.green  },
  blue:   { bg: C.blueBg,   text: '#1D4ED8', bar: C.blue,   icon: C.blue   },
  amber:  { bg: C.amberBg, text: '#92400E', bar: C.amber,  icon: C.amber  },
  purple: { bg: '#F5F3FF',  text: '#7C3AED', bar: '#8B5CF6', icon: '#8B5CF6' },
};

function KpiCard({ label, value, sub, accent, Icon, loading }: KpiCardProps) {
  const a = ACCENT_MAP[accent];
  return (
    <div style={{
      background: C.white,
      borderRadius: 16,
      boxShadow: C.shadow,
      border: '1px solid #E5E7EB',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.35rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: '-8px', right: '-8px',
        opacity: 0.08,
      }}>
        <Icon size={72} color={a.bar} />
      </div>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: a.text }}>
        {label}
      </span>
      {loading ? (
        <IconSpinner size={28} color={a.bar} />
      ) : (
        <span style={{ fontSize: '1.75rem', fontWeight: 800, color: a.text, lineHeight: 1 }}>
          {value}
        </span>
      )}
      {sub && !loading && (
        <span style={{ fontSize: '0.7rem', color: C.gray400, fontWeight: 500 }}>{sub}</span>
      )}
      <div style={{ marginTop: '0.2rem', opacity: 0.25 }}>
        <Icon size={22} color={a.icon} />
      </div>
    </div>
  );
}

interface FloorBarProps {
  label: string;
  vehicleType: string;
  sub: string;
  capacity: number;
  occupied: number;
  loading?: boolean;
}

function FloorBar({ label, vehicleType, sub, capacity, occupied, loading }: FloorBarProps) {
  const pct = capacity > 0 ? Math.min((occupied / capacity) * 100, 100) : 0;
  const barColor = pct >= 85 ? '#EF4444' : pct >= 60 ? C.amber : C.green;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: 4 }}>
        <div>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{label}</span>
          <span style={{ fontSize: '0.72rem', color: C.gray400, marginLeft: '0.4rem' }}>{vehicleType}</span>
          {sub && <span style={{ fontSize: '0.68rem', color: C.gray400, marginLeft: '0.25rem' }}>({sub})</span>}
        </div>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: barColor }}>
          {loading ? '…' : `${occupied}/${capacity} chỗ`}
        </span>
      </div>
      <div style={{ height: 8, background: C.gray200, borderRadius: 999 }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: barColor,
          borderRadius: 999,
          transition: 'width 0.6s ease',
          minWidth: pct > 0 ? 4 : 0,
        }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  CHART CONFIG
// ═══════════════════════════════════════════════════════════
const DONUT_COLORS = ['#1E3A5F', '#F59E0B'];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 10,
      padding: '0.5rem 0.85rem', fontSize: '0.8rem', boxShadow: C.shadow,
    }}>
      <p style={{ margin: 0, fontWeight: 700, color: C.gray800 }}>{label}</p>
      <p style={{ margin: 0, color: C.navy }}>{fmtVnd(payload[0].value)}</p>
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { name: string; value: number } }> }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 10,
      padding: '0.5rem 0.85rem', fontSize: '0.8rem', boxShadow: C.shadow,
    }}>
      <p style={{ margin: 0, fontWeight: 700, color: C.gray800 }}>{name}</p>
      <p style={{ margin: 0, color: C.navy }}>{value} lượt</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export function ManagerDashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [kpiData, setKpiData] = useState<KpiSummary | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueRow[]>([]);
  const [vehiclesData, setVehiclesData] = useState<VehiclesByType>({ car: 0, motorbike: 0 });
  const [occupancyData, setOccupancyData] = useState<OccupancyReport | null>(null);
  const [loadingKpi, setLoadingKpi] = useState(true);
  const [loadingRevenue, setLoadingRevenue] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [loadingOccupancy, setLoadingOccupancy] = useState(true);
  const [errorKpi, setErrorKpi] = useState('');
  const [errorRevenue, setErrorRevenue] = useState('');
  const [errorVehicles, setErrorVehicles] = useState('');

  const fetchKpi = useCallback(async () => {
    setLoadingKpi(true);
    setErrorKpi('');
    try {
      const res = await api.get<KpiSummary>('/reports/kpi-summary');
      setKpiData(res.data ?? { vehiclesParked: 0, occupancyRate: 0, monthlySubscribers: 0, todayRevenue: 0 });
    } catch {
      setKpiData({ vehiclesParked: 0, occupancyRate: 0, monthlySubscribers: 0, todayRevenue: 0 });
      setErrorKpi('Không tải được KPI.');
    } finally {
      setLoadingKpi(false);
    }
  }, []);

  const fetchRevenue = useCallback(async (range: DateRange) => {
    setLoadingRevenue(true);
    setErrorRevenue('');
    try {
      const { from, to } = dateRangeToIso(range);
      const res = await api.get<RevenueRow[]>('/reports/revenue-by-day', { params: { from, to } });
      setRevenueData(res.data ?? []);
    } catch {
      setRevenueData([]);
      setErrorRevenue('Không tải được dữ liệu doanh thu.');
    } finally {
      setLoadingRevenue(false);
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    setLoadingVehicles(true);
    setErrorVehicles('');
    try {
      const res = await api.get<{ success: boolean; data: VehiclesByType }>('/reports/vehicles-by-type');
      setVehiclesData(res.data.data ?? { car: 0, motorbike: 0 });
    } catch {
      setVehiclesData({ car: 0, motorbike: 0 });
      setErrorVehicles('Không tải được dữ liệu xe.');
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  const fetchOccupancy = useCallback(async () => {
    setLoadingOccupancy(true);
    try {
      const res = await api.get<{ success: boolean; data: OccupancyReport }>('/reports/occupancy');
      setOccupancyData(res.data.data ?? null);
    } catch {
      setOccupancyData(null);
    } finally {
      setLoadingOccupancy(false);
    }
  }, []);

  useEffect(() => {
    fetchKpi();
    fetchVehicles();
    fetchOccupancy();
  }, [fetchKpi, fetchVehicles, fetchOccupancy]);

  useEffect(() => {
    fetchRevenue(dateRange);
  }, [dateRange, fetchRevenue]);

  // Derive floor occupied counts from API data
  const floorOccupiedMap: Record<number, number> = {};
  if (occupancyData?.byFloor) {
    for (const f of occupancyData.byFloor) {
      floorOccupiedMap[f.floor] = f.occupied;
    }
  }

  const donutData = [
    { name: 'Ô tô', value: vehiclesData.car ?? 0 },
    { name: 'Xe máy', value: vehiclesData.motorbike ?? 0 },
  ];
  const donutTotal = (vehiclesData.car ?? 0) + (vehiclesData.motorbike ?? 0);

  const revenueChartData = revenueData.map((r) => ({
    ...r,
    amount: Number(r.amount) || 0,
  }));

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: C.navy }}>
          Tổng quan
        </h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: C.gray600 }}>
          Báo cáo hoạt động bãi đỗ xe — {new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── FILTER BAR ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
      }}>
        {/* Date range buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 10,
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: dateRange === r ? `1.5px solid ${C.navy}` : '1.5px solid #E5E7EB',
                background: dateRange === r ? C.navy : C.white,
                color: dateRange === r ? C.white : C.gray600,
                transition: 'all 0.15s',
              }}
            >
              {DATE_RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Export button stub */}
        <button
          style={{
            padding: '0.5rem 1.1rem',
            borderRadius: 10,
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: '1.5px solid #E5E7EB',
            background: C.white,
            color: C.gray600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
          onClick={() => alert('Tính năng xuất báo cáo đang được phát triển.')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Xuất báo cáo
        </button>
      </div>

      {/* ── KPI CARDS ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <KpiCard
          label="Doanh thu hôm nay"
          value={loadingKpi ? '…' : fmtVnd(kpiData?.todayRevenue ?? 0)}
          accent="green"
          Icon={IconMoney}
        />
        {errorKpi && (
          <div style={{
            gridColumn: '1 / -1',
            padding: '0.5rem 1rem',
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: 10,
            fontSize: '0.8rem',
            color: '#B91C1C',
          }}>
            {errorKpi}
          </div>
        )}
        <KpiCard
          label="Lượt xe hôm nay"
          value={loadingKpi ? '…' : String(kpiData?.vehiclesParked ?? 0)}
          sub="lượt"
          accent="blue"
          Icon={IconCar}
        />
        <KpiCard
          label="Tỉ lệ lấp đầy"
          value={loadingKpi ? '…' : `${((kpiData?.occupancyRate ?? 0)).toFixed(1)}%`}
          sub={`Sức chứa ${occupancyData?.occupiedSlots ?? '…'}/120 vị trí`}
          accent="amber"
          Icon={IconGauge}
        />
        <KpiCard
          label="Khách tháng active"
          value={loadingKpi ? '…' : String(kpiData?.monthlySubscribers ?? 0)}
          accent="purple"
          Icon={IconUsers}
        />
      </div>

      {/* ── CHARTS ROW ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>

        {/* Revenue line chart */}
        <div style={{
          background: C.white,
          borderRadius: 16,
          boxShadow: C.shadow,
          border: '1px solid #E5E7EB',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: C.gray800 }}>
                Doanh thu {DATE_RANGE_LABELS[dateRange].toLowerCase()}
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: C.gray400 }}>
                Đơn vị: đồng
              </p>
            </div>
            {!loadingRevenue && revenueChartData.length > 0 && (
              <span style={{
                fontSize: '0.82rem', fontWeight: 700, color: C.green,
                background: C.greenBg, padding: '0.2rem 0.65rem', borderRadius: 20,
              }}>
                {fmtVnd(revenueChartData.reduce((s, r) => s + r.amount, 0))}
              </span>
            )}
          </div>

          {loadingRevenue ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <IconSpinner size={32} />
            </div>
          ) : errorRevenue ? (
            <p style={{ padding: '2rem 0', textAlign: 'center', color: '#EF4444', fontSize: '0.875rem' }}>{errorRevenue}</p>
          ) : revenueChartData.length === 0 ? (
            <p style={{ padding: '3rem 0', textAlign: 'center', color: C.gray400, fontSize: '0.875rem' }}>
              Chưa có dữ liệu doanh thu.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenueChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.gray200} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtShortDate}
                  tick={{ fontSize: 11, fill: C.gray400 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: C.gray400 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke={C.navy}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: C.navy, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: C.navy }}
                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut: vehicles by type */}
        <div style={{
          background: C.white,
          borderRadius: 16,
          boxShadow: C.shadow,
          border: '1px solid #E5E7EB',
          padding: '1.5rem',
        }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: C.gray800, marginBottom: '0.25rem' }}>
            Cơ cấu loại xe
          </h2>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.78rem', color: C.gray400 }}>
            Phân bố xe đang đỗ theo loại
          </p>

          {loadingVehicles ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <IconSpinner size={32} />
            </div>
          ) : errorVehicles ? (
            <p style={{ padding: '2rem 0', textAlign: 'center', color: '#EF4444', fontSize: '0.875rem' }}>{errorVehicles}</p>
          ) : donutTotal === 0 ? (
            <p style={{ padding: '3rem 0', textAlign: 'center', color: C.gray400, fontSize: '0.875rem' }}>
              Chưa có xe trong bãi.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    isAnimationActive
                  >
                    {donutData.map((_, idx) => (
                      <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span style={{ fontSize: '0.8rem', color: C.gray600, fontWeight: 600 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center label */}
              <div style={{ textAlign: 'center', marginTop: '-0.5rem' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: C.navy }}>{donutTotal}</span>
                <span style={{ display: 'block', fontSize: '0.72rem', color: C.gray400, fontWeight: 500 }}>lượt vào</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── FLOOR OCCUPANCY ── */}
      <div style={{
        background: C.white,
        borderRadius: 16,
        boxShadow: C.shadow,
        border: '1px solid #E5E7EB',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: C.gray800 }}>
              Tỉ lệ lấp đầy theo tầng
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: C.gray400 }}>
              Tổng sức chứa 120 slot toàn bãi
            </p>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '0.85rem', fontSize: '0.72rem', color: C.gray400 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
              &lt; 60%
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.amber, display: 'inline-block' }} />
              60–84%
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
              ≥ 85%
            </span>
          </div>
        </div>

        {loadingOccupancy ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <IconSpinner size={32} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {FLOORS.map((f) => (
              <FloorBar
                key={f.floor}
                label={f.label}
                vehicleType={f.vehicleType}
                sub={f.sub}
                capacity={f.capacity}
                occupied={floorOccupiedMap[f.floor] ?? 0}
                loading={loadingOccupancy}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
