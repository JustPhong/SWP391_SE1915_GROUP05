import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import * as XLSX from 'xlsx';
import api from '../services/api';

// ═══════════════════════════════════════════════════════════
//  DESIGN TOKENS
// ═══════════════════════════════════════════════════════════
const C = {
  navy:      '#1E3A5F',
  navyDark:  '#152D4A',
  blue:      '#2563EB',
  blueMid:   '#3B82F6',
  blueBg:    '#EFF6FF',
  white:     '#FFFFFF',
  pageBg:    '#F0F4FB',
  gray50:    '#F9FAFB',
  gray100:   '#F3F4F7',
  gray200:   '#E2E8F0',
  gray400:   '#9BA8B4',
  gray500:   '#6B7280',
  gray600:   '#5C6B7A',
  gray800:   '#1F2937',
  green:     '#16A34A',
  greenMid:  '#22C55E',
  greenBg:   '#DCFCE7',
  amber:     '#D97706',
  amberMid:  '#F59E0B',
  amberBg:   '#FEF3C7',
  purple:    '#7C3AED',
  purpleMid: '#8B5CF6',
  purpleBg:  '#F5F3FF',
  red:       '#EF4444',
  cardBorder:'#E2E8F0',
  shadow:    '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(30,58,95,0.06)',
} as const;

// Donut chart colors: index 0 → Ô tô (amber/orange), index 1 → Xe máy (blue)
const DONUT_COLORS = [C.amberMid, C.blueMid];

// ═══════════════════════════════════════════════════════════
//  API TYPES
// ═══════════════════════════════════════════════════════════
interface KpiSummary {
  vehiclesParked:     number;
  occupancyRate:      number;
  monthlySubscribers: number;
  todayRevenue:       number;
  sessionRevenue:     number;
  monthlyRevenue:     number;
}

interface RevenueRow {
  date:   string;
  amount: number;
}

interface VehiclesByType {
  car:       number;
  motorbike: number;
}

interface OccupancyReport {
  totalSlots:     number;
  availableSlots: number;
  occupiedSlots:  number;
  reservedSlots:  number;
  occupancyRate:  number;
  byFloor:        FloorOccupancy[];
}

interface FloorOccupancy {
  floor:        number;
  total:        number;
  available:    number;
  occupied:     number;
  reserved:     number;
  occupancyRate: number;
}

// ═══════════════════════════════════════════════════════════
//  FLOOR DEFINITIONS (matches seed + schema)
// ═══════════════════════════════════════════════════════════
const FLOORS = [
  { floor: 0, label: 'Tầng G', vehicleType: 'Ô tô',   sub: 'Gói tháng', capacity: 20 },
  { floor: 1, label: 'Tầng 1', vehicleType: 'Xe máy', sub: 'Gói tháng', capacity: 40 },
  { floor: 2, label: 'Tầng 2', vehicleType: 'Xe máy', sub: 'Khách lẻ',  capacity: 40 },
  { floor: 3, label: 'Tầng 3', vehicleType: 'Ô tô',   sub: 'Khách lẻ',  capacity: 20 },
];

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════
function fmtVnd(amount: number): string {
  if (!amount && amount !== 0) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════
//  DATE RANGE
// ═══════════════════════════════════════════════════════════
type DateRange = 'today' | 'week' | 'month' | 'custom';

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today:  'Hôm nay',
  week:   'Tuần này',
  month:  'Tháng này',
  custom: 'Tùy chọn',
};

function dateRangeToIso(
  range: DateRange,
  custom?: { from: string; to: string },
): { from: string; to: string } {
  const now     = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (range === 'custom' && custom) return { from: custom.from, to: custom.to };
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (range) {
    case 'today':
      return {
        from: todayMidnight.toISOString().split('T')[0],
        to:   todayEnd.toISOString().split('T')[0],
      };
    case 'week': {
      const start = new Date(now);
      const day   = start.getDay();
      const diff  = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);
      start.setHours(0, 0, 0, 0);
      return { from: start.toISOString().split('T')[0], to: todayEnd.toISOString().split('T')[0] };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString().split('T')[0], to: todayEnd.toISOString().split('T')[0] };
    }
    default:
      return {
        from: todayMidnight.toISOString().split('T')[0],
        to:   todayEnd.toISOString().split('T')[0],
      };
  }
}

// ═══════════════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════════════
function exportToOverviewExcel(
  kpi:        KpiSummary | null,
  revenue:    RevenueRow[],
  occupancy:  OccupancyReport | null,
  dateRange:  DateRange,
  customFrom: string,
  customTo:   string,
): void {
  const { from, to } = dateRangeToIso(
    dateRange,
    customFrom && customTo ? { from: customFrom, to: customTo } : undefined,
  );
  const rangeLabel = DATE_RANGE_LABELS[dateRange];
  const k = kpi ?? {
    vehiclesParked: 0, occupancyRate: 0, monthlySubscribers: 0,
    todayRevenue: 0, sessionRevenue: 0, monthlyRevenue: 0,
  };

  const overviewData: (string | number)[][] = [
    ['BÁO CÁO TỔNG QUAN BÃI ĐỖ XE'],
    [`Kỳ báo cáo: ${rangeLabel}  (${from} → ${to})`],
    [],
    ['CHỈ SỐ CHÍNH'],
    ['Doanh thu', k.todayRevenue],
    ['Lượt xe vào', k.vehiclesParked],
    ['Tỉ lệ lấp đầy', `${k.occupancyRate.toFixed(1)}%`],
    ['Khách tháng', k.monthlySubscribers],
    [],
    ['TẦNG', 'LOẠI XE', 'LOẠI KHÁCH', 'ĐANG DÙNG / SỨC CHỨA', 'TỈ LỆ %'] as (string | number)[],
  ];

  const floorLabels: Record<number, { label: string; vehicleType: string; customerType: string }> = {
    0: { label: 'Tầng G', vehicleType: 'Ô tô',   customerType: 'Gói tháng' },
    1: { label: 'Tầng 1', vehicleType: 'Xe máy', customerType: 'Gói tháng' },
    2: { label: 'Tầng 2', vehicleType: 'Xe máy', customerType: 'Khách lẻ'  },
    3: { label: 'Tầng 3', vehicleType: 'Ô tô',   customerType: 'Khách lẻ'  },
  };

  const floorMap: Record<number, FloorOccupancy> = {};
  for (const f of occupancy?.byFloor ?? []) floorMap[f.floor] = f;

  for (const floor of [0, 1, 2, 3]) {
    const def      = floorLabels[floor];
    const fData    = floorMap[floor];
    const total    = fData?.total    ?? (def.label === 'Tầng G' || def.label === 'Tầng 3' ? 20 : 40);
    const occupied = fData?.occupied ?? 0;
    const rate     = total > 0 ? ((occupied / total) * 100).toFixed(1) : '0.0';
    overviewData.push([def.label, def.vehicleType, def.customerType, `${occupied} / ${total}`, `${rate}%`]);
  }

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  wsOverview['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 10 }];

  const revenueRows: (string | number)[][] = [['Ngày', 'Doanh thu (VND)']];
  for (const r of revenue) revenueRows.push([r.date, r.amount]);
  revenueRows.push(['TỔNG', revenue.reduce((s, r) => s + (r.amount || 0), 0)]);

  const wsRevenue = XLSX.utils.aoa_to_sheet(revenueRows);
  wsRevenue['!cols'] = [{ wch: 22 }, { wch: 20 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Tổng quan');
  XLSX.utils.book_append_sheet(wb, wsRevenue, 'Doanh thu theo ngày');
  XLSX.writeFile(wb, `TongQuan_${from}_${to}.xlsx`);
}

// ═══════════════════════════════════════════════════════════
//  INLINE SVG ICONS  (self-contained, no external deps)
// ═══════════════════════════════════════════════════════════
function IconSpinner({ size = 20, color = C.gray400 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round"
      style={{ animation: 'mgr-spin 0.8s linear infinite', display: 'block' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <style>{`@keyframes mgr-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </svg>
  );
}

function IconMoney({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function IconCar({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h1l2-4h10l2 4h1a2 2 0 012 2v6a2 2 0 01-2 2h-2" />
      <circle cx="7.5" cy="17" r="2.5" />
      <circle cx="16.5" cy="17" r="2.5" />
    </svg>
  );
}

function IconGauge({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z" opacity=".25" />
      <path d="M12 6v1M6 12H5M18 12h1M7.757 8.243l.707.707M16.243 8.243l-.707.707" />
      <line x1="12" y1="12" x2="9" y2="9" strokeWidth="2.5" />
      <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
    </svg>
  );
}

function IconUsers({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconParking({ size = 48, color = C.gray400 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="4" />
      <path d="M8 6h5a3 3 0 010 6H8V6z" />
      <path d="M8 12v6" />
    </svg>
  );
}

function IconDownload({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════
//  KPI CARD
// ═══════════════════════════════════════════════════════════
type AccentColor = 'green' | 'blue' | 'amber' | 'purple';

interface KpiCardProps {
  label:   string;
  value:   string;
  sub?:    string;
  accent:  AccentColor;
  Icon:    (props: { size?: number; color?: string }) => JSX.Element;
  loading?: boolean;
}

const ACCENT_MAP: Record<AccentColor, { bg: string; text: string; accent: string; light: string }> = {
  green:  { bg: C.greenBg,  text: '#14532D', accent: C.greenMid, light: '#BBF7D0' },
  blue:   { bg: C.blueBg,   text: '#1E40AF', accent: C.blueMid,  light: '#BFDBFE' },
  amber:  { bg: C.amberBg,  text: '#92400E', accent: C.amberMid, light: '#FDE68A' },
  purple: { bg: C.purpleBg, text: '#5B21B6', accent: C.purpleMid,light: '#DDD6FE' },
};

function KpiCard({ label, value, sub, accent, Icon, loading }: KpiCardProps) {
  const a = ACCENT_MAP[accent];
  return (
    <div style={{
      background:    C.white,
      borderRadius:  14,
      boxShadow:     C.shadow,
      border:        `1px solid ${C.cardBorder}`,
      padding:       '1.25rem 1.25rem 1rem',
      display:       'flex',
      flexDirection: 'column',
      gap:           '0.3rem',
      position:      'relative',
      overflow:      'hidden',
      minWidth:      0,
    }}>
      {/* Watermark icon — decorative only */}
      <div style={{
        position:  'absolute',
        bottom:    '-6px',
        right:     '-6px',
        opacity:   0.06,
        pointerEvents: 'none',
        lineHeight: 1,
      }}>
        <Icon size={80} color={a.accent} />
      </div>

      {/* Accent dot + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: a.accent, flexShrink: 0, display: 'inline-block',
        }} />
        <span style={{
          fontSize:      '0.7rem',
          fontWeight:    700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color:         a.text,
          whiteSpace:    'nowrap',
          overflow:      'hidden',
          textOverflow:  'ellipsis',
        }}>
          {label}
        </span>
      </div>

      {/* Value */}
      {loading ? (
        <div style={{ paddingTop: 6 }}>
          <IconSpinner size={24} color={a.accent} />
        </div>
      ) : (
        <span style={{
          fontSize:   '1.9rem',
          fontWeight: 800,
          color:      C.gray800,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}>
          {value}
        </span>
      )}

      {/* Sub-label */}
      {sub && !loading && (
        <span style={{ fontSize: '0.72rem', color: C.gray500, fontWeight: 500 }}>
          {sub}
        </span>
      )}

      {/* Bottom accent bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 3, background: `linear-gradient(90deg, ${a.accent}, ${a.light})`,
        borderRadius: '0 0 14px 14px',
      }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  FLOOR PROGRESS BAR ROW
// ═══════════════════════════════════════════════════════════
interface FloorBarProps {
  label:       string;
  vehicleType: string;
  sub:         string;
  capacity:    number;
  occupied:    number;
  loading?:    boolean;
}

function FloorBar({ label, vehicleType, sub, capacity, occupied, loading }: FloorBarProps) {
  const pct      = capacity > 0 ? Math.min((occupied / capacity) * 100, 100) : 0;
  const barColor = pct >= 85 ? C.red : pct >= 60 ? C.amberMid : C.greenMid;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      {/* Left: floor label */}
      <div style={{ minWidth: 100, flexShrink: 0 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: C.gray800 }}>{label}</div>
        <div style={{ fontSize: '0.71rem', color: C.gray400, marginTop: 1 }}>
          {vehicleType}{sub && <span style={{ opacity: 0.8 }}> ({sub})</span>}
        </div>
      </div>

      {/* Middle: progress bar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          height: 8, background: C.gray200, borderRadius: 999, overflow: 'hidden',
        }}>
          <div style={{
            height:     '100%',
            width:      `${pct}%`,
            background: barColor,
            borderRadius: 999,
            transition: 'width 0.6s ease',
            minWidth:   pct > 0 ? 4 : 0,
          }} />
        </div>
      </div>

      {/* Right: count + pct */}
      <div style={{ minWidth: 90, flexShrink: 0, textAlign: 'right' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: barColor }}>
          {loading ? '…' : `${occupied}/${capacity} chỗ`}
        </span>
        {!loading && (
          <span style={{
            display: 'block', fontSize: '0.68rem', color: C.gray400, fontWeight: 500,
          }}>
            {pct.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  CHART TOOLTIPS
// ═══════════════════════════════════════════════════════════
function RevenueTooltip({
  active, payload, label,
}: {
  active?:  boolean;
  payload?: Array<{ value: number }>;
  label?:   string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:   C.white,
      border:       `1px solid ${C.cardBorder}`,
      borderRadius: 10,
      padding:      '0.5rem 0.9rem',
      fontSize:     '0.8rem',
      boxShadow:    C.shadow,
    }}>
      <p style={{ margin: 0, fontWeight: 600, color: C.gray500, marginBottom: 2 }}>{label}</p>
      <p style={{ margin: 0, fontWeight: 800, color: C.navy, fontSize: '0.88rem' }}>
        {fmtVnd(payload[0].value)}
      </p>
    </div>
  );
}

function DonutTooltip({
  active, payload,
}: {
  active?:  boolean;
  payload?: Array<{ name: string; value: number }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:   C.white,
      border:       `1px solid ${C.cardBorder}`,
      borderRadius: 10,
      padding:      '0.5rem 0.9rem',
      fontSize:     '0.8rem',
      boxShadow:    C.shadow,
    }}>
      <p style={{ margin: 0, fontWeight: 700, color: C.gray800 }}>{payload[0].name}</p>
      <p style={{ margin: 0, color: C.navy }}>{payload[0].value} xe</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  VEHICLE DISTRIBUTION CARD
// ═══════════════════════════════════════════════════════════
interface VehicleDistCardProps {
  loading:  boolean;
  error:    string;
  car:      number;
  motorbike: number;
}

function VehicleDistCard({ loading, error, car, motorbike }: VehicleDistCardProps) {
  // Ô tô → index 0 (amber), Xe máy → index 1 (blue)
  const donutData  = [
    { name: 'Ô tô',   value: car },
    { name: 'Xe máy', value: motorbike },
  ];
  const total = car + motorbike;

  const mPct = total > 0 ? ((motorbike / total) * 100).toFixed(1) : '0.0';
  const cPct = total > 0 ? ((car      / total) * 100).toFixed(1) : '0.0';

  return (
    <div style={{
      background:    C.white,
      borderRadius:  14,
      boxShadow:     C.shadow,
      border:        `1px solid ${C.cardBorder}`,
      padding:       '1.5rem',
      display:       'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: C.gray800 }}>
          Phân bố phương tiện đang đỗ
        </h2>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: C.gray400 }}>
          Tỷ lệ xe máy và ô tô hiện có trong bãi
        </p>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2.5rem 0' }}>
          <IconSpinner size={32} />
        </div>
      ) : error ? (
        <p style={{ textAlign: 'center', color: C.red, fontSize: '0.875rem', padding: '2rem 0' }}>
          {error}
        </p>
      ) : total === 0 ? (
        /* ── Empty state ── */
        <div style={{
          flex:           1,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '2rem 1rem',
          gap:            '0.75rem',
          textAlign:      'center',
        }}>
          <IconParking size={52} color={C.gray200} />
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: C.gray500 }}>
            Chưa có xe trong bãi.
          </span>
          <span style={{ fontSize: '0.75rem', color: C.gray400, lineHeight: 1.5 }}>
            Dữ liệu phân bố sẽ xuất hiện<br />khi có phương tiện check-in.
          </span>
        </div>
      ) : (
        /* ── Donut + legend ── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          {/* Donut */}
          <div style={{ position: 'relative', width: '100%' }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={82}
                  paddingAngle={3}
                  dataKey="value"
                  isAnimationActive
                >
                  {donutData.map((_, idx) => (
                    <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div style={{
              position:   'absolute',
              inset:      0,
              display:    'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: C.gray800, lineHeight: 1 }}>
                {total}
              </span>
              <span style={{ fontSize: '0.68rem', color: C.gray400, fontWeight: 500, marginTop: 2 }}>
                xe trong bãi
              </span>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
            {/* Xe máy */}
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              padding:        '0.5rem 0.75rem',
              background:     C.blueBg,
              borderRadius:   8,
              border:         `1px solid #BFDBFE`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: 3,
                  background: C.blueMid, display: 'inline-block', flexShrink: 0,
                }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: C.gray800 }}>🛵 Xe máy</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1E40AF' }}>{motorbike}</span>
                <span style={{ fontSize: '0.72rem', color: C.gray500, marginLeft: 4 }}>({mPct}%)</span>
              </div>
            </div>

            {/* Ô tô */}
            <div style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              padding:        '0.5rem 0.75rem',
              background:     C.amberBg,
              borderRadius:   8,
              border:         `1px solid #FDE68A`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: 3,
                  background: C.amberMid, display: 'inline-block', flexShrink: 0,
                }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: C.gray800 }}>🚗 Ô tô</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#92400E' }}>{car}</span>
                <span style={{ fontSize: '0.72rem', color: C.gray500, marginLeft: 4 }}>({cPct}%)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export function ManagerDashboardPage() {
  const [dateRange,    setDateRange]    = useState<DateRange>('today');
  const [customFrom,   setCustomFrom]   = useState('');
  const [customTo,     setCustomTo]     = useState('');

  const [kpiData,      setKpiData]      = useState<KpiSummary | null>(null);
  const [revenueData,  setRevenueData]  = useState<RevenueRow[]>([]);
  const [vehiclesData, setVehiclesData] = useState<VehiclesByType>({ car: 0, motorbike: 0 });
  const [occupancyData,setOccupancyData]= useState<OccupancyReport | null>(null);

  const [loadingKpi,      setLoadingKpi]      = useState(true);
  const [loadingRevenue,  setLoadingRevenue]  = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [loadingOccupancy,setLoadingOccupancy]= useState(true);

  const [errorKpi,      setErrorKpi]      = useState('');
  const [errorRevenue,  setErrorRevenue]  = useState('');
  const [errorVehicles, setErrorVehicles] = useState('');

  // ── Fetch KPI ──
  const fetchKpi = useCallback(async (from: string, to: string) => {
    setLoadingKpi(true);
    setErrorKpi('');
    try {
      const res = await api.get<KpiSummary>('/reports/kpi-summary', { params: { from, to } });
      setKpiData(res.data ?? {
        vehiclesParked: 0, occupancyRate: 0, monthlySubscribers: 0,
        todayRevenue: 0, sessionRevenue: 0, monthlyRevenue: 0,
      });
    } catch {
      setKpiData({
        vehiclesParked: 0, occupancyRate: 0, monthlySubscribers: 0,
        todayRevenue: 0, sessionRevenue: 0, monthlyRevenue: 0,
      });
      setErrorKpi('Không tải được KPI.');
    } finally {
      setLoadingKpi(false);
    }
  }, []);

  // ── Fetch Revenue ──
  const fetchRevenue = useCallback(async (from: string, to: string) => {
    setLoadingRevenue(true);
    setErrorRevenue('');
    try {
      const res = await api.get<RevenueRow[]>('/reports/revenue-by-day', { params: { from, to } });
      setRevenueData(res.data ?? []);
    } catch {
      setRevenueData([]);
      setErrorRevenue('Không tải được dữ liệu doanh thu.');
    } finally {
      setLoadingRevenue(false);
    }
  }, []);

  // ── Fetch Vehicles by type (currently parked) ──
  const fetchVehicles = useCallback(async (from: string, to: string) => {
    setLoadingVehicles(true);
    setErrorVehicles('');
    try {
      const res = await api.get<{ success: boolean; data: VehiclesByType }>(
        '/reports/vehicles-by-type',
        { params: { from, to } },
      );
      setVehiclesData(res.data.data ?? { car: 0, motorbike: 0 });
    } catch {
      setVehiclesData({ car: 0, motorbike: 0 });
      setErrorVehicles('Không tải được dữ liệu xe.');
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  // ── Fetch Occupancy (current snapshot, no date filter) ──
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

  useEffect(() => { fetchOccupancy(); }, [fetchOccupancy]);

  useEffect(() => {
    const { from, to } = dateRangeToIso(
      dateRange,
      customFrom && customTo ? { from: customFrom, to: customTo } : undefined,
    );
    fetchKpi(from, to);
    fetchRevenue(from, to);
    fetchVehicles(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, customFrom, customTo]);

  // ── Derived data ──
  const floorOccupiedMap: Record<number, number> = {};
  if (occupancyData?.byFloor) {
    for (const f of occupancyData.byFloor) floorOccupiedMap[f.floor] = f.occupied;
  }

  const revenueChartData = revenueData.map((r) => ({
    ...r,
    amount: Number(r.amount) || 0,
  }));

  const revenueTotal = revenueChartData.reduce((s, r) => s + r.amount, 0);
  const dynamicTotalSlots = occupancyData?.totalSlots ?? FLOORS.reduce((s, f) => s + f.capacity, 0);
  const todayStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // ── Render ──
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <style>{`
        .mgr-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.25rem; }
        .mgr-charts-row { display: grid; grid-template-columns: 3fr 2fr; gap: 1rem; margin-bottom: 1.25rem; align-items: start; }
        @media (max-width: 1100px) {
          .mgr-kpi-grid { grid-template-columns: repeat(2, 1fr); }
          .mgr-charts-row { grid-template-columns: 1fr; }
        }
        @media (max-width: 580px) {
          .mgr-kpi-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{
          margin: 0, fontSize: '1.5rem', fontWeight: 800,
          color: C.navy, letterSpacing: '-0.02em',
        }}>
          Tổng quan
        </h1>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: C.gray500 }}>
          Báo cáo hoạt động bãi đỗ xe — {todayStr}
        </p>
      </div>

      {/* ── FILTER BAR ── */}
      <div style={{
        display:     'flex',
        alignItems:  'center',
        gap:         '0.75rem',
        marginBottom:'1.25rem',
        flexWrap:    'wrap',
      }}>
        {/* Period buttons */}
        <div style={{
          display:      'flex',
          gap:          '0.35rem',
          background:   C.white,
          border:       `1px solid ${C.cardBorder}`,
          borderRadius: 10,
          padding:      '0.2rem',
        }}>
          {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((r) => {
            const active = dateRange === r;
            return (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                style={{
                  padding:      '0.38rem 0.9rem',
                  borderRadius: 8,
                  fontSize:     '0.8rem',
                  fontWeight:   600,
                  cursor:       'pointer',
                  border:       'none',
                  background:   active ? C.blue : 'transparent',
                  color:        active ? C.white : C.gray600,
                  transition:   'all 0.15s',
                  whiteSpace:   'nowrap',
                }}
              >
                {DATE_RANGE_LABELS[r]}
              </button>
            );
          })}
        </div>

        {/* Custom date picker */}
        {dateRange === 'custom' && (
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          8,
            background:   C.white,
            padding:      '6px 14px',
            borderRadius: 10,
            border:       `1.5px solid ${C.blue}`,
          }}>
            <input
              type="date" value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{
                border: 'none', outline: 'none',
                fontSize: 13, color: C.gray800, fontFamily: 'inherit',
              }}
            />
            <span style={{ fontSize: 12, color: C.gray400, fontWeight: 600 }}>→</span>
            <input
              type="date" value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{
                border: 'none', outline: 'none',
                fontSize: 13, color: C.gray800, fontFamily: 'inherit',
              }}
            />
            {customFrom && customTo && (
              <button style={{
                padding:    '4px 12px',
                borderRadius: 7,
                background: C.blue,
                color:      C.white,
                border:     'none',
                fontSize:   12,
                fontWeight: 600,
                cursor:     'pointer',
              }}>
                Áp dụng
              </button>
            )}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Export button */}
        <button
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          '0.4rem',
            padding:      '0.45rem 1.1rem',
            borderRadius: 9,
            fontSize:     '0.82rem',
            fontWeight:   700,
            cursor:       'pointer',
            border:       `1.5px solid ${C.cardBorder}`,
            background:   C.white,
            color:        C.gray600,
            transition:   'border-color 0.15s, color 0.15s',
          }}
          onClick={() =>
            exportToOverviewExcel(kpiData, revenueData, occupancyData, dateRange, customFrom, customTo)
          }
        >
          <IconDownload size={14} />
          Xuất báo cáo
        </button>
      </div>

      {/* ── KPI ERROR ── */}
      {errorKpi && (
        <div style={{
          padding:      '0.5rem 1rem',
          background:   '#FEF2F2',
          border:       '1px solid #FCA5A5',
          borderRadius: 10,
          fontSize:     '0.8rem',
          color:        '#B91C1C',
          marginBottom: '1rem',
        }}>
          {errorKpi}
        </div>
      )}

      {/* ── KPI CARDS ── */}
      <div className="mgr-kpi-grid">
        <KpiCard
          label={
            dateRange === 'today' ? 'Doanh thu hôm nay'
            : dateRange === 'week'  ? 'Doanh thu tuần này'
            : dateRange === 'month' ? 'Doanh thu tháng này'
            : 'Doanh thu'
          }
          value={loadingKpi ? '…' : fmtVnd(kpiData?.todayRevenue ?? 0)}
          accent="green"
          Icon={IconMoney}
          loading={loadingKpi}
        />
        <KpiCard
          label={
            dateRange === 'today' ? 'Lượt xe hôm nay'
            : dateRange === 'week'  ? 'Lượt xe tuần này'
            : dateRange === 'month' ? 'Lượt xe tháng này'
            : 'Lượt xe'
          }
          value={loadingKpi ? '…' : String(kpiData?.vehiclesParked ?? 0)}
          sub="lượt vào"
          accent="blue"
          Icon={IconCar}
          loading={loadingKpi}
        />
        <KpiCard
          label="Tỉ lệ lấp đầy"
          value={loadingKpi ? '…' : `${(kpiData?.occupancyRate ?? 0).toFixed(1)}%`}
          sub={
            loadingOccupancy
              ? 'Đang tải…'
              : `Sức chứa ${occupancyData?.occupiedSlots ?? 0}/${dynamicTotalSlots} vị trí`
          }
          accent="amber"
          Icon={IconGauge}
          loading={loadingKpi}
        />
        <KpiCard
          label="Khách tháng"
          value={loadingKpi ? '…' : String(kpiData?.monthlySubscribers ?? 0)}
          sub="gói đang hoạt động"
          accent="purple"
          Icon={IconUsers}
          loading={loadingKpi}
        />
      </div>

      {/* ── CHARTS ROW ── */}
      <div className="mgr-charts-row">

        {/* ── Revenue line chart ── */}
        <div style={{
          background:    C.white,
          borderRadius:  14,
          boxShadow:     C.shadow,
          border:        `1px solid ${C.cardBorder}`,
          padding:       '1.5rem',
        }}>
          <div style={{
            display:       'flex',
            justifyContent:'space-between',
            alignItems:    'flex-start',
            marginBottom:  '1.25rem',
            gap:           '0.5rem',
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: C.gray800 }}>
                Doanh thu {DATE_RANGE_LABELS[dateRange].toLowerCase()}
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: C.gray400 }}>
                Đơn vị: đồng
              </p>
            </div>
            {!loadingRevenue && revenueChartData.length > 0 && (
              <div style={{
                background:   C.greenBg,
                border:       `1px solid #BBF7D0`,
                borderRadius: 20,
                padding:      '0.25rem 0.8rem',
                fontSize:     '0.82rem',
                fontWeight:   700,
                color:        '#14532D',
                whiteSpace:   'nowrap',
                flexShrink:   0,
              }}>
                {fmtVnd(revenueTotal)}
              </div>
            )}
          </div>

          {loadingRevenue ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 260 }}>
              <IconSpinner size={32} />
            </div>
          ) : errorRevenue ? (
            <p style={{ textAlign: 'center', color: C.red, fontSize: '0.875rem', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}>
              {errorRevenue}
            </p>
          ) : revenueChartData.length === 0 ? (
            <div style={{
              height:         260,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '0.5rem',
            }}>
              <IconParking size={40} color={C.gray200} />
              <p style={{ margin: 0, color: C.gray400, fontSize: '0.875rem' }}>
                Chưa có dữ liệu doanh thu.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenueChartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 4" stroke={C.gray200} vertical={false} />
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
                  tickFormatter={(v: number) =>
                    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
                    : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K`
                    : String(v)
                  }
                />
                <Tooltip content={<RevenueTooltip />} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke={C.blue}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: C.blue, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: C.blue, stroke: C.white, strokeWidth: 2 }}
                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Vehicle distribution donut ── */}
        <VehicleDistCard
          loading={loadingVehicles}
          error={errorVehicles}
          car={vehiclesData.car ?? 0}
          motorbike={vehiclesData.motorbike ?? 0}
        />
      </div>

      {/* ── FLOOR OCCUPANCY ── */}
      <div style={{
        background:    C.white,
        borderRadius:  14,
        boxShadow:     C.shadow,
        border:        `1px solid ${C.cardBorder}`,
        padding:       '1.5rem',
        marginBottom:  '1.5rem',
      }}>
        {/* Header */}
        <div style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          marginBottom:   '1.25rem',
          gap:            '0.5rem',
          flexWrap:       'wrap',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: C.gray800 }}>
              Tỉ lệ lấp đầy theo tầng
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: C.gray400 }}>
              Tổng sức chứa {dynamicTotalSlots} slot toàn bãi
            </p>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '0.85rem', fontSize: '0.72rem', color: C.gray500, flexShrink: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.greenMid, display: 'inline-block' }} />
              &lt; 60%
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.amberMid, display: 'inline-block' }} />
              60–84%
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.red, display: 'inline-block' }} />
              ≥ 85%
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: C.cardBorder, marginBottom: '1.25rem' }} />

        {loadingOccupancy ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <IconSpinner size={32} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
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
