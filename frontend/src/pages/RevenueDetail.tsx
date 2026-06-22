import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import * as XLSX from 'xlsx';
import api from '../services/api';

// ═══════════════════════════════════════════════════════════
//  PALETTE — matches ManagerDashboard / design system
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
  red:       '#EF4444',
  redBg:     '#FEE2E2',
  shadow:    '0 8px 32px rgba(30, 58, 95, 0.08)',
  casual:    '#3B82F6',   // blue — matches nav
  monthly:   '#22C55E',   // green — matches package theme
} as const;

// ═══════════════════════════════════════════════════════════
//  API TYPES
// ═══════════════════════════════════════════════════════════
interface RevenueDetail {
  total: number;
  casualTotal: number;
  monthlyTotal: number;
  series: SeriesRow[];
  transactions: Transaction[];
}

interface SeriesRow {
  date: string;
  casual: number;
  monthly: number;
}

interface Transaction {
  date: string;
  source: 'CASUAL' | 'MONTHLY';
  plateNumber: string | null;
  customerName: string | null;
  amount: number;
}

type DateRange = 'today' | 'week' | 'month' | 'custom';

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════
function fmtVnd(amount: number): string {
  if (!amount && amount !== 0) return '0đ';
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

function exportToExcel(
  data: RevenueDetail,
  from: string,
  to: string,
): void {
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

  ws['!cols'] = [
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Doanh thu');
  const filename = `DoanhThu_${from}_${to}.xlsx`;
  XLSX.writeFile(wb, filename);
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function pctOf(total: number, part: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function dateRangeToIso(range: DateRange, custom?: { from: string; to: string }): { from: string; to: string } {
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (range === 'custom' && custom) {
    return { from: custom.from, to: custom.to };
  }

  switch (range) {
    case 'today': {
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from: t.toISOString().split('T')[0], to: todayEnd.toISOString().split('T')[0] };
    }
    case 'week': {
      const start = new Date(now);
      const day = start.getDay(); // 0=Sun, 1=Mon, ...
      const diff = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);
      start.setHours(0, 0, 0, 0);
      return { from: start.toISOString().split('T')[0], to: todayEnd.toISOString().split('T')[0] };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString().split('T')[0], to: todayEnd.toISOString().split('T')[0] };
    }
    default:
      return { from: todayEnd.toISOString().split('T')[0], to: todayEnd.toISOString().split('T')[0] };
  }
}

// ═══════════════════════════════════════════════════════════
//  CHART TOOLTIP
// ═══════════════════════════════════════════════════════════
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.gray200}`,
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      fontSize: 13,
    }}>
      <p style={{ fontWeight: 600, color: C.gray800, marginBottom: 6 }}>{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color, margin: '2px 0' }}>
          {entry.name}: <strong>{fmtVnd(entry.value)}</strong>
        </p>
      ))}
      <p style={{ color: C.navy, marginTop: 6, borderTop: `1px solid ${C.gray200}`, paddingTop: 6 }}>
        Tổng: <strong>{fmtVnd((payload[0]?.value ?? 0) + (payload[1]?.value ?? 0))}</strong>
      </p>
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
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background: isCasual ? C.blueBg : C.greenBg,
      color: isCasual ? C.blue : C.green,
      whiteSpace: 'nowrap',
    }}>
      {isCasual ? 'Khách lẻ' : 'Gói tháng'}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════
//  SUMMARY CARD
// ═══════════════════════════════════════════════════════════
interface SummaryCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  icon: React.ReactNode;
}

function SummaryCard({ label, value, sub, accent, icon }: SummaryCardProps) {
  return (
    <div style={{
      background: C.white,
      borderRadius: 18,
      padding: '24px 28px',
      boxShadow: C.shadow,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* thin coloured top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
        background: accent ?? C.navy,
        borderRadius: '18px 18px 0 0',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.gray600, margin: 0, marginTop: 4 }}>
            {label}
          </p>
          <p style={{
            fontSize: 28,
            fontWeight: 800,
            color: accent ?? C.navy,
            margin: '4px 0 0',
            lineHeight: 1.1,
          }}>
            {value}
          </p>
          {sub && (
            <p style={{ fontSize: 12, color: C.gray400, margin: '4px 0 0' }}>{sub}</p>
          )}
        </div>
        <div style={{
          width: 44, height: 44,
          borderRadius: 12,
          background: (accent ?? C.navy) + '1A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════
export function RevenueDetailPage() {
  const [range, setRange] = useState<DateRange>('month');
  // Custom range inputs (only visible when range === 'custom')
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  // Tracks the currently active from/to so export button and chart can reference them
  const [currentFrom, setCurrentFrom] = useState('');
  const [currentTo, setCurrentTo] = useState('');

  const [data, setData] = useState<RevenueDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setCurrentFrom(from);
    setCurrentTo(to);
    console.log('[Revenue] fetchData → GET /reports/revenue-detail', { from, to });
    try {
      const resp = await api.get<{ success: boolean; data: RevenueDetail }>(
        '/reports/revenue-detail',
        { params: { from, to } }
      );
      console.log('[Revenue] fetchData ←', {
        total: resp.data.data.total,
        casual: resp.data.data.casualTotal,
        monthly: resp.data.data.monthlyTotal,
        txCount: resp.data.data.transactions.length,
      });
      setData(resp.data.data);
    } catch (err) {
      console.error('[Revenue] fetchData ERROR', err);
      setData({ total: 0, casualTotal: 0, monthlyTotal: 0, series: [], transactions: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { from, to } = dateRangeToIso(
      range,
      range === 'custom' && customFrom && customTo
        ? { from: customFrom, to: customTo }
        : undefined,
    );
    console.log('[Revenue] useEffect triggered → range:', range, '| from:', from, '| to:', to);
    fetchData(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customFrom, customTo]);

  // Trigger fetch when custom range is submitted
  const handleCustomApply = () => {
    if (!customFrom || !customTo || customFrom > customTo) {
      alert('Vui lòng chọn khoảng ngày hợp lệ');
      return;
    }
    fetchData(customFrom, customTo);
  };

  const t = data ?? { total: 0, casualTotal: 0, monthlyTotal: 0, series: [], transactions: [] };
  const shareCasual = pctOf(t.total, t.casualTotal);
  const shareMonthly = pctOf(t.total, t.monthlyTotal);

  const rangeOptions: { value: DateRange; label: string }[] = [
    { value: 'today', label: 'Hôm nay' },
    { value: 'week',  label: 'Tuần này' },
    { value: 'month', label: 'Tháng này' },
    { value: 'custom', label: 'Tùy chọn' },
  ];

  return (
    <div style={{
      padding: '32px 36px',
      minHeight: '100%',
      background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
    }}>
      {/* ── Page Header ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.navy, margin: 0 }}>
            Doanh thu
          </h1>
          <p style={{ fontSize: 14, color: C.gray600, margin: '4px 0 0' }}>
            Báo cáo chi tiết theo nguồn thu
          </p>
        </div>

        {/* Filter pills + custom range panel + export */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          {/* Range buttons */}
          <div style={{
            display: 'flex', gap: 6, background: C.white,
            padding: '5px 8px', borderRadius: 12, boxShadow: C.shadow,
            flexWrap: 'wrap', justifyContent: 'flex-end',
          }}>
            {rangeOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => {
                  setRange(value);
                  if (value !== 'custom') {
                    setCustomFrom('');
                    setCustomTo('');
                  }
                }}
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: range === value ? 'none' : `1.5px solid ${C.gray200}`,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  background: range === value ? C.navy : 'transparent',
                  color: range === value ? C.white : C.gray600,
                  transition: 'all 0.18s',
                }}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => exportToExcel(t, currentFrom, currentTo)}
              disabled={t.transactions.length === 0}
              title={t.transactions.length === 0 ? 'Không có dữ liệu để xuất' : 'Xuất Excel'}
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                border: `1.5px solid ${C.gray200}`,
                cursor: t.transactions.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 600,
                background: t.transactions.length === 0 ? C.gray100 : C.white,
                color: t.transactions.length === 0 ? C.gray400 : C.navy,
                marginLeft: 4,
                transition: 'all 0.18s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Xuất báo cáo
            </button>
          </div>

          {/* Custom range inputs — only shown when "Tùy chọn" is active */}
          {range === 'custom' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: C.white,
              padding: '8px 14px',
              borderRadius: 12,
              boxShadow: C.shadow,
            }}>
              <label style={{ fontSize: 13, color: C.gray600, fontWeight: 500, whiteSpace: 'nowrap' }}>
                Từ ngày:
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{
                  border: `1.5px solid ${C.gray200}`,
                  borderRadius: 8,
                  padding: '5px 10px',
                  fontSize: 13,
                  color: C.gray800,
                  outline: 'none',
                }}
              />
              <label style={{ fontSize: 13, color: C.gray600, fontWeight: 500, whiteSpace: 'nowrap' }}>
                Đến ngày:
              </label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{
                  border: `1.5px solid ${C.gray200}`,
                  borderRadius: 8,
                  padding: '5px 10px',
                  fontSize: 13,
                  color: C.gray800,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleCustomApply}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: C.navy,
                  color: C.white,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Áp dụng
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Summary Cards ────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 20,
        marginBottom: 28,
      }}>
        {/* Tổng doanh thu */}
        <SummaryCard
          label="Tổng doanh thu"
          value={fmtVnd(t.total)}
          accent={C.navy}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          }
        />

        {/* Khách lẻ */}
        <SummaryCard
          label="Khách lẻ"
          value={fmtVnd(t.casualTotal)}
          sub={`Thu khi xe ra · ${shareCasual} tổng`}
          accent={C.casual}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.casual} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          }
        />

        {/* Gói tháng */}
        <SummaryCard
          label="Gói tháng"
          value={fmtVnd(t.monthlyTotal)}
          sub={`Thu khi mua gói · ${shareMonthly} tổng`}
          accent={C.monthly}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.monthly} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          }
        />
      </div>

      {/* ── Chart ───────────────────────────────────────────── */}
      <div style={{
        background: C.white,
        borderRadius: 18,
        padding: '28px 28px 20px',
        boxShadow: C.shadow,
        marginBottom: 28,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy, margin: 0 }}>
            Doanh thu theo thời gian
          </h2>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: C.casual, display: 'inline-block' }} />
              Khách lẻ
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: C.monthly, display: 'inline-block' }} />
              Gói tháng
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: C.gray400, fontSize: 14 }}>Đang tải biểu đồ…</p>
          </div>
        ) : t.series.length === 0 || t.series.every((r) => r.casual === 0 && r.monthly === 0) ? (
          <div style={{
            height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 12,
          }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={C.gray200} strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
              <line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
            <p style={{ color: C.gray400, fontSize: 14, margin: 0 }}>Chưa có doanh thu trong kỳ này</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={t.series} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.gray200} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtShortDate}
                tick={{ fontSize: 12, fill: C.gray600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => {
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')}Tr`;
                  if (v >= 1_000) return `${Math.round(v / 1_000)}N`;
                  return String(v);
                }}
                tick={{ fontSize: 12, fill: C.gray600 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="casual"  name="Khách lẻ" fill={C.casual}  radius={[4, 4, 0, 0]} />
              <Bar dataKey="monthly" name="Gói tháng" fill={C.monthly} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Transaction Table ────────────────────────────────── */}
      <div style={{
        background: C.white,
        borderRadius: 18,
        padding: '28px',
        boxShadow: C.shadow,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy, margin: '0 0 20px' }}>
          Chi tiết giao dịch
        </h2>

        {loading ? (
          <p style={{ color: C.gray400, fontSize: 14, textAlign: 'center', padding: '20px 0' }}>Đang tải…</p>
        ) : t.transactions.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '40px 0', gap: 12,
          }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={C.gray200} strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
            <p style={{ color: C.gray400, fontSize: 14, margin: 0 }}>Chưa có giao dịch nào</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.gray100}` }}>
                  {['Thời gian', 'Nguồn', 'Biển số', 'Khách hàng', 'Số tiền'].map((col) => (
                    <th key={col} style={{
                      textAlign: col === 'Số tiền' ? 'right' : 'left',
                      padding: '0 12px 12px',
                      fontSize: 12, fontWeight: 700, color: C.gray600,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.transactions.map((tx, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: `1px solid ${C.gray100}` }}
                  >
                    <td style={{ padding: '14px 12px', color: C.gray800, whiteSpace: 'nowrap' }}>
                      {tx.date}
                    </td>
                    <td style={{ padding: '14px 12px' }}>
                      <SourceBadge source={tx.source} />
                    </td>
                    <td style={{ padding: '14px 12px', color: C.gray800, fontFamily: 'monospace', fontSize: 13 }}>
                      {tx.plateNumber ?? '—'}
                    </td>
                    <td style={{ padding: '14px 12px', color: C.gray800 }}>
                      {tx.customerName ?? '—'}
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: tx.source === 'MONTHLY' ? C.green : C.blue,
                      whiteSpace: 'nowrap',
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
    </div>
  );
}
