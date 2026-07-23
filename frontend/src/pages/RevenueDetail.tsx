import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { RevenueChatbotWidget } from '../components/RevenueChatbotWidget';

// ═══════════════════════════════════════════════════════════
//  DESIGN TOKENS — aligned with ParkSmart design system
// ═══════════════════════════════════════════════════════════
const C = {
  navy:       '#1E3A5F',
  navyDark:   '#152D4A',
  blue:       '#2563EB',
  blueMid:    '#3B82F6',
  blueBg:     '#EFF6FF',
  white:      '#FFFFFF',
  pageBg:     '#F0F4FB',
  gray50:     '#F9FAFB',
  gray100:    '#F3F4F7',
  gray200:    '#E2E8F0',
  gray400:    '#9BA8B4',
  gray500:    '#6B7280',
  gray600:    '#5C6B7A',
  gray800:    '#1F2937',
  green:      '#16A34A',
  greenMid:   '#22C55E',
  greenBg:    '#DCFCE7',
  amber:      '#D97706',
  amberMid:   '#F59E0B',
  amberBg:    '#FEF3C7',
  red:        '#EF4444',
  redBg:      '#FEE2E2',
  cardBorder: '#E2E8F0',
  shadow:     '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(30,58,95,0.06)',
  casual:     '#2563EB',
  monthly:    '#16A34A',
} as const;

// ═══════════════════════════════════════════════════════════
//  API TYPES
// ═══════════════════════════════════════════════════════════
interface RevenueDetail {
  total:        number;
  casualTotal:  number;
  monthlyTotal: number;
  byMethod?:    Record<string, number>;
  series:       SeriesRow[];
  transactions: Transaction[];
}

interface ComparisonGroup {
  total:   number;
  casual:  number;
  monthly: number;
}

interface RevenueComparison {
  thisMonth:           ComparisonGroup;
  lastMonthSamePeriod: ComparisonGroup;
  lastMonthFull:       ComparisonGroup;
  metadata: {
    thisMonthName:                 string;
    lastMonthName:                 string;
    thisMonthSamePeriodRange:      string;
    lastMonthSamePeriodRangeLabel: string;
  };
}

interface SeriesRow {
  date:    string;
  casual:  number;
  monthly: number;
}

interface Transaction {
  date:         string;
  source:       'CASUAL' | 'MONTHLY';
  plateNumber:  string | null;
  customerName: string | null;
  amount:       number;
}

type DateRange = 'today' | 'week' | 'month' | 'custom';

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════
function fmtVnd(amount: number): string {
  if (!amount && amount !== 0) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
}

function exportToExcel(data: RevenueDetail, from: string, to: string): void {
  const headerRow: (string | number)[] = ['Thời gian', 'Nguồn', 'Biển số', 'Khách hàng', 'Số tiền (VND)'];
  const dataRows = data.transactions.map((tx) => [
    tx.date,
    tx.source === 'CASUAL' ? 'Khách lẻ' : 'Gói tháng',
    tx.plateNumber ?? '',
    tx.customerName ?? '',
    tx.amount,
  ]);
  const summaryRow: (string | number)[] = ['TỔNG', '', '', '', ''];
  const casualRow:  (string | number)[] = ['Khách lẻ',  '', '', '', data.casualTotal];
  const monthlyRow: (string | number)[] = ['Gói tháng', '', '', '', data.monthlyTotal];

  const wsData = [headerRow, ...dataRows, [], summaryRow, casualRow, monthlyRow];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Doanh thu');
  XLSX.writeFile(wb, `DoanhThu_${from}_${to}.xlsx`);
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function pctOf(total: number, part: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateRangeToIso(range: DateRange, custom?: { from: string; to: string }): { from: string; to: string } {
  const now = new Date();

  if (range === 'custom' && custom) return { from: custom.from, to: custom.to };

  switch (range) {
    case 'today': {
      const formatted = formatLocalDate(now);
      return { from: formatted, to: formatted };
    }
    case 'week': {
      const start = new Date(now);
      const day = start.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);
      return { from: formatLocalDate(start), to: formatLocalDate(now) };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: formatLocalDate(start), to: formatLocalDate(now) };
    }
    default:
      const formatted = formatLocalDate(now);
      return { from: formatted, to: formatted };
  }
}



// ═══════════════════════════════════════════════════════════
//  ICONS
// ═══════════════════════════════════════════════════════════
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
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function IconCalendar({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
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

function IconEmptyDoc({ size = 48, color = '#D1D5DB' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9"  y1="12" x2="15" y2="12" />
      <line x1="9"  y1="16" x2="13" y2="16" />
    </svg>
  );
}

function IconBarChart({ size = 48, color = '#D1D5DB' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <rect x="3"  y="12" width="4" height="9" rx="1" />
      <rect x="10" y="7"  width="4" height="14" rx="1" />
      <rect x="17" y="3"  width="4" height="18" rx="1" />
    </svg>
  );
}

function IconSpinner({ size = 24, color = C.gray400 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round"
      style={{ animation: 'rev-spin 0.8s linear infinite', display: 'block' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <style>{`@keyframes rev-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════
//  CHART TOOLTIP
// ═══════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, e: { value: number }) => s + (e.value ?? 0), 0);
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.cardBorder}`,
      borderRadius: 10, padding: '10px 14px',
      boxShadow: C.shadow, fontSize: 13,
    }}>
      <p style={{ fontWeight: 600, color: C.gray800, marginBottom: 6, margin: '0 0 6px' }}>{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color, margin: '2px 0' }}>
          {entry.name}: <strong>{fmtVnd(entry.value)}</strong>
        </p>
      ))}
      {payload.length > 1 && (
        <p style={{ color: C.navy, marginTop: 6, borderTop: `1px solid ${C.gray200}`, paddingTop: 6, margin: '6px 0 0' }}>
          Tổng: <strong>{fmtVnd(total)}</strong>
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SOURCE BADGE
// ═══════════════════════════════════════════════════════════
function SourceBadge({ source }: { source: 'CASUAL' | 'MONTHLY' }) {
  const isCasual = source === 'CASUAL';
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
      background: isCasual ? C.blueBg  : C.greenBg,
      color:      isCasual ? C.blueMid : C.greenMid,
      border: `1px solid ${isCasual ? '#BFDBFE' : '#BBF7D0'}`,
    }}>
      {isCasual ? 'Khách lẻ' : 'Gói tháng'}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════
//  SUMMARY KPI CARD
// ═══════════════════════════════════════════════════════════
interface SummaryCardProps {
  label:   string;
  value:   string;
  sub?:    string;
  accent:  string;
  iconBg:  string;
  icon:    React.ReactNode;
  loading?: boolean;
}

function SummaryCard({ label, value, sub, accent, iconBg, icon, loading }: SummaryCardProps) {
  return (
    <div style={{
      background:    C.white,
      borderRadius:  14,
      border:        `1px solid ${C.cardBorder}`,
      boxShadow:     C.shadow,
      padding:       '20px 24px',
      display:       'flex',
      flexDirection: 'column',
      gap:           6,
      position:      'relative',
      overflow:      'hidden',
      minWidth:      0,
    }}>
      {/* Top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
        background: accent, borderRadius: '14px 14px 0 0',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.gray500, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </p>
          {loading ? (
            <div style={{ marginTop: 8 }}><IconSpinner size={22} color={accent} /></div>
          ) : (
            <p style={{
              fontSize: 28, fontWeight: 800, color: accent,
              margin: '6px 0 0', lineHeight: 1.1, letterSpacing: '-0.02em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {value}
            </p>
          )}
          {sub && !loading && (
            <p style={{ fontSize: 12, color: C.gray400, margin: '4px 0 0', fontWeight: 500 }}>{sub}</p>
          )}
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginLeft: 12,
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SKELETON LOADER
// ═══════════════════════════════════════════════════════════
function Skeleton({ height = 20, width = '100%', radius = 6 }: { height?: number; width?: number | string; radius?: number }) {
  return (
    <div style={{
      height, width, borderRadius: radius,
      background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)',
      backgroundSize: '200% 100%',
      animation: 'rev-shimmer 1.4s infinite',
    }}>
      <style>{`@keyframes rev-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════
export function RevenueDetailPage() {
  const [range, setRange] = useState<DateRange>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo,   setCustomTo]   = useState('');
  const [currentFrom, setCurrentFrom] = useState('');
  const [currentTo,   setCurrentTo]   = useState('');

  const [data,    setData]    = useState<RevenueDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const [comparisonData, setComparisonData] = useState<RevenueComparison | null>(null);
  const [loadingComp,    setLoadingComp]    = useState(false);
  const [activePieTab,   setActivePieTab]   = useState<'source' | 'method'>('source');



  // ── Fetch detail by date range ──
  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setData(null);
    setComparisonData(null);
    setCurrentFrom(from);
    setCurrentTo(to);

    try {
      if (range === 'custom') {
        setLoadingComp(false);
        const resp = await api.get<{ success: boolean; data: RevenueDetail }>('/reports/revenue-detail', { params: { from, to } });
        setData(resp.data.data);
      } else {
        setLoadingComp(true);
        const [detailResponse, comparisonResponse] = await Promise.all([
          api.get<{ success: boolean; data: RevenueDetail }>('/reports/revenue-detail', { params: { from, to } }),
          api.get<{ success: boolean; data: RevenueComparison }>('/reports/revenue-comparison', { params: { from, to, range } }),
        ]);
        setData(detailResponse.data.data);
        setComparisonData(comparisonResponse.data.data);
      }
    } catch (err) {
      console.error('[Revenue] fetchData ERROR', err);
      setData({ total: 0, casualTotal: 0, monthlyTotal: 0, series: [], transactions: [] });
      setComparisonData(null);
    } finally {
      setLoading(false);
      setLoadingComp(false);
    }
  }, [range]);

  useEffect(() => {
    if (range === 'custom') {
      setData(null);
      setComparisonData(null);
      setCurrentFrom('');
      setCurrentTo('');
      return;
    }
    const { from, to } = dateRangeToIso(range);
    fetchData(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const handleCustomApply = () => {
    if (!customFrom || !customTo || customFrom > customTo) {
      alert('Vui lòng chọn khoảng ngày hợp lệ');
      return;
    }
    fetchData(customFrom, customTo);
  };

  // ── Derived values ──
  const t            = data ?? { total: 0, casualTotal: 0, monthlyTotal: 0, series: [], transactions: [] };
  const filteredSeries = t.series.filter((row) => row.date >= currentFrom && row.date <= currentTo);
  const shareCasual  = pctOf(t.total, t.casualTotal);
  const shareMonthly = pctOf(t.total, t.monthlyTotal);

  const renderCompGrowth = (current: number, previous: number) => {
    if (current === 0 && previous === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
          <span style={{ color: C.gray400, fontWeight: 600, fontSize: 13 }}>Không thay đổi</span>
        </div>
      );
    }
    if (current > 0 && previous === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
          <span style={{ color: C.greenMid, fontWeight: 700, fontSize: 13 }}>Phát sinh mới</span>
        </div>
      );
    }

    const diff = current - previous;

    if (diff === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
          <span style={{ color: C.gray400, fontWeight: 600, fontSize: 13 }}>Không thay đổi</span>
        </div>
      );
    }

    const isPositive = diff > 0;
    const arrow = isPositive ? '↑' : '↓';
    const absDiffStr = fmtVnd(Math.abs(diff));
    const color = isPositive ? C.greenMid : C.red;

    const pct = Math.round((diff / previous) * 100);
    const pctStr = isPositive ? `+${pct}%` : `${pct}%`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', lineHeight: '1.3' }}>
        <span style={{ color, fontWeight: 600, fontSize: 13 }}>
          {arrow} {absDiffStr}
        </span>
        <span style={{ color, fontSize: 11, fontWeight: 500 }}>
          {pctStr}
        </span>
      </div>
    );
  };

  const renderFullPeriodRatio = (current: number, previousFull: number) => {
    if (current === 0 && previousFull === 0) {
      return 'Không thay đổi';
    }
    if (current > 0 && previousFull === 0) {
      return 'Phát sinh mới';
    }
    if (current === 0 && previousFull > 0) {
      return '0%';
    }
    return `${Math.round((current / previousFull) * 100)}%`;
  };

  const pieSourceData = [
    { name: 'Khách lẻ',  value: t.casualTotal,  color: C.casual  },
    { name: 'Gói tháng', value: t.monthlyTotal,  color: C.monthly },
  ];

  const methodColors: Record<string, string> = {
    'CASH':    '#2563EB',
    'CARD':    '#10B981',
    'EWALLET': '#F59E0B',
    'Tiền mặt': '#2563EB',
    'Thẻ':      '#10B981',
    'Ví điện tử': '#F59E0B',
  };

  const rawMethodData  = t.byMethod ?? {};
  const pieMethodData = Object.entries(rawMethodData)
    .map(([key, value]) => {
      let displayName = key;
      if (key === 'CASH')   displayName = 'Tiền mặt';
      else if (key === 'CARD')   displayName = 'Thẻ';
      else if (key === 'EWALLET') displayName = 'Ví điện tử';
      return {
        name:  displayName,
        value: Number(value),
        color: methodColors[key] ?? methodColors[displayName] ?? '#8B5CF6',
      };
    });

  const rangeOptions: { value: DateRange; label: string }[] = [
    { value: 'today',  label: 'Hôm nay'   },
    { value: 'week',   label: 'Tuần này'  },
    { value: 'month',  label: 'Tháng này' },
    { value: 'custom', label: 'Tùy chọn' },
  ];

  const getCol1Label = () => {
    switch (range) {
      case 'today':  return 'Hôm nay';
      case 'week':   return 'Tuần này';
      case 'month':  return 'Tháng này';
      case 'custom': return 'Kỳ đang chọn';
      default:       return 'Kỳ đang chọn';
    }
  };

  const getCol2Label = () => {
    switch (range) {
      case 'today':  return 'Hôm qua';
      case 'week':   return 'Cùng kỳ tuần trước';
      case 'month':  return 'Cùng kỳ tháng trước';
      case 'custom': return 'Kỳ trước';
      default:       return 'Kỳ trước';
    }
  };

  const getCol3Label = () => {
    switch (range) {
      case 'today':  return 'So với hôm qua';
      case 'week':   return 'Thay đổi so với cùng kỳ';
      case 'month':  return 'Thay đổi so với cùng kỳ';
      case 'custom': return 'So với kỳ trước';
      default:       return 'Thay đổi so với cùng kỳ';
    }
  };

  const getCol4Label = () => {
    switch (range) {
      case 'week':   return 'Cả tuần trước';
      case 'month':  return 'Cả tháng trước';
      default:       return '';
    }
  };

  const getCol5Label = () => {
    switch (range) {
      case 'week':   return 'So với cả tuần trước';
      case 'month':  return 'So với cả tháng trước';
      default:       return '';
    }
  };

  const showFull = range === 'week' || range === 'month';

  const getCompTitle = () => {
    switch (range) {
      case 'today':  return 'So sánh doanh thu hôm nay với hôm qua';
      case 'week':   return 'So sánh doanh thu tuần này với tuần trước';
      case 'month':  return 'So sánh doanh thu tháng này với tháng trước';
      case 'custom': return 'Tổng hợp doanh thu theo khoảng đã chọn';
      default:       return 'So sánh doanh thu';
    }
  };
  const compTitle = getCompTitle();

  // ── Render ──
  return (
    <div style={{ padding: '28px 32px', minHeight: '100%', background: C.pageBg, boxSizing: 'border-box' }}>
      <style>{`
        .rev-kpi-grid    { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:20px; }
        .rev-analytics   { display:grid; grid-template-columns:1.15fr 1fr; gap:16px; margin-bottom:20px; }
        @media(max-width:1100px){
          .rev-kpi-grid  { grid-template-columns:repeat(2,1fr); }
          .rev-analytics { grid-template-columns:1fr; }
        }
        @media(max-width:640px){
          .rev-kpi-grid  { grid-template-columns:1fr; }
        }
      `}</style>

      {/* ── PAGE HEADER ───────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        {/* Title */}
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.navy, margin: 0, letterSpacing: '-0.02em' }}>
            Doanh thu
          </h1>
          <p style={{ fontSize: 14, color: C.gray500, margin: '4px 0 0', fontWeight: 500 }}>
            Báo cáo chi tiết theo nguồn thu
          </p>
        </div>

        {/* Filter toolbar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
          {/* Unified pill bar: range buttons + export */}
          <div style={{
            display:      'flex',
            gap:          4,
            background:   C.white,
            padding:      '4px 6px',
            borderRadius: 12,
            border:       `1px solid ${C.cardBorder}`,
            flexWrap:     'wrap',
            justifyContent: 'flex-end',
          }}>
            {rangeOptions.map(({ value, label }) => {
              const active = range === value;
              return (
                <button
                  key={value}
                  onClick={() => {
                    setRange(value);
                    if (value !== 'custom') { setCustomFrom(''); setCustomTo(''); }
                  }}
                  style={{
                    padding:      '6px 14px',
                    borderRadius: 8,
                    border:       'none',
                    cursor:       'pointer',
                    fontSize:     13,
                    fontWeight:   600,
                    background:   active ? C.navy : 'transparent',
                    color:        active ? C.white : C.gray600,
                    transition:   'all 0.15s',
                    whiteSpace:   'nowrap',
                    fontFamily:   'inherit',
                  }}
                >
                  {label}
                </button>
              );
            })}
            {/* Divider */}
            <div style={{ width: 1, background: C.gray200, margin: '4px 2px', flexShrink: 0 }} />
            {/* Export button */}
            <button
              onClick={() => exportToExcel(t, currentFrom, currentTo)}
              disabled={t.transactions.length === 0}
              title={t.transactions.length === 0 ? 'Không có dữ liệu để xuất' : 'Xuất Excel'}
              style={{
                padding:    '6px 14px',
                borderRadius: 8,
                border:     'none',
                cursor:     t.transactions.length === 0 ? 'not-allowed' : 'pointer',
                fontSize:   13,
                fontWeight: 600,
                background: 'transparent',
                color:      t.transactions.length === 0 ? C.gray400 : C.gray600,
                display:    'flex',
                alignItems: 'center',
                gap:        6,
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
            >
              <IconDownload size={13} />
              Xuất báo cáo
            </button>
          </div>

          {/* Custom date range — shown only when "Tùy chọn" selected */}
          {range === 'custom' && (
            <div style={{
              display:      'flex',
              alignItems:   'center',
              gap:          8,
              background:   C.white,
              padding:      '8px 14px',
              borderRadius: 12,
              border:       `1.5px solid ${C.navy}`,
            }}>
              <label style={{ fontSize: 13, color: C.gray600, fontWeight: 500, whiteSpace: 'nowrap' }}>
                Từ ngày:
              </label>
              <input
                type="date" value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{ border: `1.5px solid ${C.gray200}`, borderRadius: 8, padding: '5px 10px', fontSize: 13, color: C.gray800, outline: 'none' }}
              />
              <label style={{ fontSize: 13, color: C.gray600, fontWeight: 500, whiteSpace: 'nowrap' }}>
                Đến ngày:
              </label>
              <input
                type="date" value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{ border: `1.5px solid ${C.gray200}`, borderRadius: 8, padding: '5px 10px', fontSize: 13, color: C.gray800, outline: 'none' }}
              />
              <button
                onClick={handleCustomApply}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: 'none',
                  background: C.navy, color: C.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Áp dụng
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── SUMMARY KPI CARDS ──────────────────────────────────── */}
      <div className="rev-kpi-grid">
        {/* Card 1: Tổng doanh thu */}
        <SummaryCard
          label="Tổng doanh thu"
          value={loading ? '…' : fmtVnd(t.total)}
          accent={C.navy}
          iconBg="#EEF2F8"
          icon={<IconMoney size={22} color={C.navy} />}
          loading={loading}
        />
        {/* Card 2: Khách lẻ */}
        <SummaryCard
          label="Khách lẻ"
          value={loading ? '…' : fmtVnd(t.casualTotal)}
          sub={loading ? undefined : `Thu khi xe ra • ${shareCasual} tổng`}
          accent={C.casual}
          iconBg={C.blueBg}
          icon={<IconCar size={22} color={C.casual} />}
          loading={loading}
        />
        {/* Card 3: Gói tháng */}
        <SummaryCard
          label="Gói tháng"
          value={loading ? '…' : fmtVnd(t.monthlyTotal)}
          sub={loading ? undefined : `Thu khi mua gói • ${shareMonthly} tổng`}
          accent={C.monthly}
          iconBg={C.greenBg}
          icon={<IconCalendar size={22} color={C.monthly} />}
          loading={loading}
        />
      </div>

      {/* ── ANALYTICS ROW: Comparison table | Donut chart ──────── */}
      <div className="rev-analytics">

        {/* LEFT: Bảng so sánh ────────────────────────────────── */}
        <div style={{
          background:    C.white,
          borderRadius:  14,
          border:        `1px solid ${C.cardBorder}`,
          boxShadow:     C.shadow,
          padding:       '20px 24px',
          display:       'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: C.gray800, margin: 0 }}>
                {compTitle}
              </h2>
              {range === 'custom' && currentFrom && currentTo && (
                <div style={{ fontSize: 11, color: C.gray400, marginTop: 4, fontWeight: 500 }}>
                  {(() => {
                    const [y1, m1, d1] = currentFrom.split('-');
                    const [y2, m2, d2] = currentTo.split('-');
                    return `${d1}/${m1}/${y1} – ${d2}/${m2}/${y2}`;
                  })()}
                </div>
              )}
            </div>
          </div>

          {loadingComp ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
              <Skeleton height={14} width="60%" />
              <Skeleton height={40} />
              <Skeleton height={36} />
              <Skeleton height={36} />
            </div>
          ) : range === 'custom' ? (
            !currentFrom || !currentTo ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 0', gap: 10 }}>
                <IconEmptyDoc size={40} />
                <p style={{ color: C.gray400, fontSize: 14, margin: 0, fontWeight: 600 }}>Chọn khoảng thời gian và nhấn Áp dụng</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.gray200}` }}>
                      <th style={{ textAlign: 'left', padding: '0 8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.gray500, whiteSpace: 'nowrap' }}>
                        Khoản mục
                      </th>
                      <th style={{ textAlign: 'right', padding: '0 8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.gray500, whiteSpace: 'nowrap' }}>
                        Doanh thu
                      </th>
                      <th style={{ textAlign: 'right', padding: '0 8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.gray500, whiteSpace: 'nowrap' }}>
                        Tỷ trọng trong tổng doanh thu
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: `1px solid ${C.gray100}` }}>
                      <td style={{ padding: '11px 8px', fontWeight: 700, color: C.gray800, whiteSpace: 'nowrap' }}>Tổng doanh thu</td>
                      <td style={{ padding: '11px 8px', textAlign: 'right', fontWeight: 700, color: C.navy, whiteSpace: 'nowrap' }}>
                        {fmtVnd(t.total)}
                      </td>
                      <td style={{ padding: '11px 8px', textAlign: 'right', fontWeight: 600, color: C.gray800, whiteSpace: 'nowrap' }}>
                        100%
                      </td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${C.gray100}` }}>
                      <td style={{ padding: '11px 8px', paddingLeft: 20, color: C.gray800, whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: C.casual, marginRight: 7 }} />
                        Khách lẻ
                      </td>
                      <td style={{ padding: '11px 8px', textAlign: 'right', fontWeight: 600, color: C.gray800, whiteSpace: 'nowrap' }}>
                        {fmtVnd(t.casualTotal)}
                      </td>
                      <td style={{ padding: '11px 8px', textAlign: 'right', color: C.gray800, whiteSpace: 'nowrap' }}>
                        {shareCasual}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '11px 8px', paddingLeft: 20, color: C.gray800, whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: C.monthly, marginRight: 7 }} />
                        Gói tháng
                      </td>
                      <td style={{ padding: '11px 8px', textAlign: 'right', fontWeight: 600, color: C.gray800, whiteSpace: 'nowrap' }}>
                        {fmtVnd(t.monthlyTotal)}
                      </td>
                      <td style={{ padding: '11px 8px', textAlign: 'right', color: C.gray800, whiteSpace: 'nowrap' }}>
                        {shareMonthly}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          ) : !comparisonData ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 0', gap: 10 }}>
              <IconEmptyDoc size={40} />
              <p style={{ color: C.gray400, fontSize: 14, margin: 0 }}>Chưa có dữ liệu đối so sánh</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.gray200}` }}>
                    <th style={{ textAlign: 'left', padding: '0 8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.gray500, whiteSpace: 'nowrap' }}>
                      Khoản mục
                    </th>
                    <th style={{ textAlign: 'right', padding: '0 8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.gray500, whiteSpace: 'nowrap' }}>
                      <div>{getCol1Label()}</div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: C.gray400, textTransform: 'none', letterSpacing: 0 }}>
                        {comparisonData.metadata.thisMonthSamePeriodRange}
                      </div>
                    </th>
                    <th style={{ textAlign: 'right', padding: '0 8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.gray500, whiteSpace: 'nowrap' }}>
                      <div>{getCol2Label()}</div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: C.gray400, textTransform: 'none', letterSpacing: 0 }}>
                        {comparisonData.metadata.lastMonthSamePeriodRangeLabel}
                      </div>
                    </th>
                    <th style={{ textAlign: 'right', padding: '0 8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.gray500, whiteSpace: 'nowrap' }}>
                      {getCol3Label()}
                    </th>
                    {showFull && (
                      <>
                        <th style={{ textAlign: 'right', padding: '0 8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.gray500, whiteSpace: 'nowrap' }}>
                          <div>{getCol4Label()}</div>
                          <div style={{ fontSize: 10, fontWeight: 500, color: C.gray400, textTransform: 'none', letterSpacing: 0 }}>
                            {range === 'month' ? `Full ${comparisonData.metadata.lastMonthName}` : ''}
                          </div>
                        </th>
                        <th style={{ textAlign: 'right', padding: '0 8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.gray500, whiteSpace: 'nowrap' }}>
                          {getCol5Label()}
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {/* Tổng doanh thu */}
                  <tr style={{ borderBottom: `1px solid ${C.gray100}` }}>
                    <td style={{ padding: '11px 8px', fontWeight: 700, color: C.gray800, whiteSpace: 'nowrap' }}>Tổng doanh thu</td>
                    <td style={{ padding: '11px 8px', textAlign: 'right', fontWeight: 700, color: C.navy, whiteSpace: 'nowrap' }}>
                      {fmtVnd(comparisonData.thisMonth.total)}
                    </td>
                    <td style={{ padding: '11px 8px', textAlign: 'right', color: C.gray600, whiteSpace: 'nowrap' }}>
                      {fmtVnd(comparisonData.lastMonthSamePeriod.total)}
                    </td>
                    <td style={{ padding: '11px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {renderCompGrowth(comparisonData.thisMonth.total, comparisonData.lastMonthSamePeriod.total)}
                    </td>
                    {showFull && (
                      <>
                        <td style={{ padding: '11px 8px', textAlign: 'right', color: C.gray600, whiteSpace: 'nowrap' }}>
                          {fmtVnd(comparisonData.lastMonthFull.total)}
                        </td>
                        <td style={{ padding: '11px 8px', textAlign: 'right', fontWeight: 600, color: C.gray800, whiteSpace: 'nowrap' }}>
                          {renderFullPeriodRatio(comparisonData.thisMonth.total, comparisonData.lastMonthFull.total)}
                        </td>
                      </>
                    )}
                  </tr>
                  {/* Khách lẻ */}
                  <tr style={{ borderBottom: `1px solid ${C.gray100}` }}>
                    <td style={{ padding: '11px 8px', paddingLeft: 20, color: C.gray800, whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: C.casual, marginRight: 7 }} />
                      Khách lẻ
                    </td>
                    <td style={{ padding: '11px 8px', textAlign: 'right', fontWeight: 600, color: C.gray800, whiteSpace: 'nowrap' }}>
                      {fmtVnd(comparisonData.thisMonth.casual)}
                    </td>
                    <td style={{ padding: '11px 8px', textAlign: 'right', color: C.gray600, whiteSpace: 'nowrap' }}>
                      {fmtVnd(comparisonData.lastMonthSamePeriod.casual)}
                    </td>
                    <td style={{ padding: '11px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {renderCompGrowth(comparisonData.thisMonth.casual, comparisonData.lastMonthSamePeriod.casual)}
                    </td>
                    {showFull && (
                      <>
                        <td style={{ padding: '11px 8px', textAlign: 'right', color: C.gray600, whiteSpace: 'nowrap' }}>
                          {fmtVnd(comparisonData.lastMonthFull.casual)}
                        </td>
                        <td style={{ padding: '11px 8px', textAlign: 'right', color: C.gray800, whiteSpace: 'nowrap' }}>
                          {renderFullPeriodRatio(comparisonData.thisMonth.casual, comparisonData.lastMonthFull.casual)}
                        </td>
                      </>
                    )}
                  </tr>
                  {/* Gói tháng */}
                  <tr>
                    <td style={{ padding: '11px 8px', paddingLeft: 20, color: C.gray800, whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: C.monthly, marginRight: 7 }} />
                      Gói tháng
                    </td>
                    <td style={{ padding: '11px 8px', textAlign: 'right', fontWeight: 600, color: C.gray800, whiteSpace: 'nowrap' }}>
                      {fmtVnd(comparisonData.thisMonth.monthly)}
                    </td>
                    <td style={{ padding: '11px 8px', textAlign: 'right', color: C.gray600, whiteSpace: 'nowrap' }}>
                      {fmtVnd(comparisonData.lastMonthSamePeriod.monthly)}
                    </td>
                    <td style={{ padding: '11px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {renderCompGrowth(comparisonData.thisMonth.monthly, comparisonData.lastMonthSamePeriod.monthly)}
                    </td>
                    {showFull && (
                      <>
                        <td style={{ padding: '11px 8px', textAlign: 'right', color: C.gray600, whiteSpace: 'nowrap' }}>
                          {fmtVnd(comparisonData.lastMonthFull.monthly)}
                        </td>
                        <td style={{ padding: '11px 8px', textAlign: 'right', color: C.gray800, whiteSpace: 'nowrap' }}>
                          {renderFullPeriodRatio(comparisonData.thisMonth.monthly, comparisonData.lastMonthFull.monthly)}
                        </td>
                      </>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT: Cơ cấu doanh thu (doughnut) ─────────────────── */}
        <div style={{
          background:    C.white,
          borderRadius:  14,
          border:        `1px solid ${C.cardBorder}`,
          boxShadow:     C.shadow,
          padding:       '20px 24px',
          display:       'flex',
          flexDirection: 'column',
        }}>
          {/* Card header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.gray800, margin: 0 }}>Cơ cấu doanh thu</h2>
            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 2, background: C.gray100, padding: 3, borderRadius: 8, flexShrink: 0 }}>
              <button
                onClick={() => setActivePieTab('source')}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                  background:  activePieTab === 'source' ? C.white : 'transparent',
                  color:       activePieTab === 'source' ? C.navy  : C.gray500,
                  boxShadow:   activePieTab === 'source' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                Theo loại khách
              </button>
              <button
                onClick={() => setActivePieTab('method')}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                  background:  activePieTab === 'method' ? C.white : 'transparent',
                  color:       activePieTab === 'method' ? C.navy  : C.gray500,
                  boxShadow:   activePieTab === 'method' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                Theo phương thức
              </button>
            </div>
          </div>

          {/* Doughnut chart body */}
          {loading ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
              <Skeleton height={160} radius={8} />
            </div>
          ) : activePieTab === 'source' ? (
            pieSourceData.length === 0 ? (
              /* Empty state */
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: 10, textAlign: 'center',
              }}>
                <IconBarChart size={44} />
                <p style={{ color: C.gray500, fontSize: 13, fontWeight: 600, margin: 0 }}>
                  Chưa có dữ liệu doanh thu.
                </p>
                <p style={{ color: C.gray400, fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                  Dữ liệu sẽ xuất hiện<br />khi phát sinh giao dịch.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1 }}>
                {/* Donut */}
                <div style={{ flex: '0 0 55%', height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieSourceData}
                        cx="50%" cy="50%"
                        innerRadius={48} outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {pieSourceData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => fmtVnd(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, paddingLeft: 12 }}>
                  {pieSourceData.map((entry, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: entry.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.gray600 }}>{entry.name}</span>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 800, color: entry.color, margin: 0, paddingLeft: 16 }}>
                        {fmtVnd(entry.value)}
                      </p>
                      <p style={{ fontSize: 11, color: C.gray500, margin: '2px 0 0', paddingLeft: 16 }}>
                        {pctOf(t.total, entry.value)} tổng
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            /* Theo PTTT tab */
            pieMethodData.length === 0 ? (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: 10, textAlign: 'center',
              }}>
                <IconBarChart size={44} />
                <p style={{ color: C.gray500, fontSize: 13, fontWeight: 600, margin: 0 }}>
                  Chưa có dữ liệu doanh thu.
                </p>
                <p style={{ color: C.gray400, fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                  Dữ liệu sẽ xuất hiện<br />khi phát sinh giao dịch.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1 }}>
                <div style={{ flex: '0 0 55%', height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieMethodData}
                        cx="50%" cy="50%"
                        innerRadius={48} outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {pieMethodData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => fmtVnd(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, paddingLeft: 12, overflowY: 'auto', maxHeight: 190 }}>
                  {pieMethodData.map((entry, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: entry.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.gray600 }}>{entry.name}</span>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 800, color: entry.color, margin: 0, paddingLeft: 16 }}>
                        {fmtVnd(entry.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── REVENUE TREND CHART (full width) ───────────────────── */}
      <div style={{
        background:    C.white,
        borderRadius:  14,
        border:        `1px solid ${C.cardBorder}`,
        boxShadow:     C.shadow,
        padding:       '20px 24px 16px',
        marginBottom:  20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.gray800, margin: 0 }}>
              Biểu đồ doanh thu
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 12, fontWeight: 600, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.gray400, fontWeight: 500 }}>Theo ngày</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: C.casual,  display: 'inline-block' }} />
              Khách lẻ
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: C.monthly, display: 'inline-block' }} />
              Gói tháng
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconSpinner size={32} />
          </div>
        ) : filteredSeries.length === 0 || filteredSeries.every((r) => r.casual === 0 && r.monthly === 0) ? (
          <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <IconBarChart size={48} />
            <p style={{ color: C.gray400, fontSize: 14, margin: 0 }}>Chưa có doanh thu trong kỳ này</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={filteredSeries} barGap={4} barCategoryGap="32%">
              <CartesianGrid strokeDasharray="3 4" stroke={C.gray200} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtShortDate}
                tick={{ fontSize: 11, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => {
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')}Tr`;
                  if (v >= 1_000)     return `${Math.round(v / 1_000)}K`;
                  return String(v);
                }}
                tick={{ fontSize: 11, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="casual"  name="Khách lẻ"  fill={C.casual}  radius={[4, 4, 0, 0]} />
              <Bar dataKey="monthly" name="Gói tháng" fill={C.monthly} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── TRANSACTION TABLE ─────────────────────────────────── */}
      <div style={{
        background:    C.white,
        borderRadius:  14,
        border:        `1px solid ${C.cardBorder}`,
        boxShadow:     C.shadow,
        padding:       '20px 24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.gray800, margin: 0 }}>
            Chi tiết giao dịch
          </h2>
          {!loading && t.transactions.length > 0 && (
            <span style={{
              background: C.gray100, borderRadius: 20, padding: '3px 10px',
              fontSize: 12, fontWeight: 600, color: C.gray500,
            }}>
              {t.transactions.length} giao dịch
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(4)].map((_, i) => <Skeleton key={i} height={42} />)}
          </div>
        ) : t.transactions.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '48px 0', gap: 12, textAlign: 'center',
          }}>
            <IconEmptyDoc size={48} />
            <p style={{ color: C.gray500, fontSize: 14, fontWeight: 600, margin: 0 }}>
              Chưa có giao dịch trong khoảng thời gian này.
            </p>
            <p style={{ color: C.gray400, fontSize: 13, margin: 0 }}>
              Thay đổi bộ lọc thời gian để xem các giao dịch khác.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.gray200}` }}>
                  {[
                    { label: 'Thời gian',  align: 'left'  },
                    { label: 'Nguồn',      align: 'left'  },
                    { label: 'Biển số',    align: 'left'  },
                    { label: 'Khách hàng', align: 'left'  },
                    { label: 'Số tiền',    align: 'right' },
                  ].map(({ label, align }) => (
                    <th key={label} style={{
                      textAlign:     align as 'left' | 'right',
                      padding:       '0 10px 10px',
                      fontSize:      11,
                      fontWeight:    700,
                      color:         C.gray500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      whiteSpace:    'nowrap',
                    }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.transactions.map((tx, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                    <td style={{ padding: '12px 10px', color: C.gray600, whiteSpace: 'nowrap', fontSize: 13 }}>
                      {tx.date}
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <SourceBadge source={tx.source} />
                    </td>
                    <td style={{ padding: '12px 10px', color: C.gray800, fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>
                      {tx.plateNumber ? tx.plateNumber.toUpperCase() : '—'}
                    </td>
                    <td style={{ padding: '12px 10px', color: C.gray800 }}>
                      {tx.customerName ?? '—'}
                    </td>
                    <td style={{
                      padding:    '12px 10px',
                      textAlign:  'right',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      color: tx.source === 'MONTHLY' ? C.monthly : C.casual,
                    }}>
                      {fmtVnd(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── REVENUE AI CHATBOT ASSISTANT ── */}
      <RevenueChatbotWidget onExportReport={() => exportToExcel(t, currentFrom, currentTo)} />
    </div>
  );
}