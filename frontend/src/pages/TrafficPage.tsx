import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine,
} from 'recharts';
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
  purple:    '#8B5CF6',
} as const;

// ═══════════════════════════════════════════════════════════
//  API TYPES
// ═══════════════════════════════════════════════════════════
interface TrafficData {
  totalIn: number;
  totalOut: number;
  currentlyParked: number;
  byVehicleType: { car: number; motorbike: number };
  daily: { date: string; in: number; out: number }[];
  hourly: { hour: number; in: number; out: number }[];
  peakHour: { hour: number; count: number } | null;
}

type DateRange = 'today' | 'week' | 'month' | 'custom';

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════
function dateRangeToIso(range: DateRange): { from: string; to: string } {
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (range) {
    case 'today': {
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from: t.toISOString().split('T')[0], to: todayEnd.toISOString().split('T')[0] };
    }
    case 'week': {
      const start = new Date(now);
      const day = start.getDay();
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
      return { from: '2025-01-01', to: todayEnd.toISOString().split('T')[0] };
  }
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function peakHourLabel(hour: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'sáng' : 'chiều';
  const next = (hour + 1) % 12 || 12;
  return `${h}:00 – ${next}:00 ${ampm}`;
}

// ═══════════════════════════════════════════════════════════
//  CHART TOOLTIPS
// ═══════════════════════════════════════════════════════════
function DailyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: 13,
    }}>
      <p style={{ margin: '0 0 6px', fontWeight: 600, color: C.gray800 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color, margin: '2px 0' }}>
          {p.name}: <strong>{p.value} lượt</strong>
        </p>
      ))}
    </div>
  );
}

function HourlyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: 13,
    }}>
      <p style={{ margin: '0 0 6px', fontWeight: 600, color: C.gray800 }}>
        {label}
      </p>
      <p style={{ color: C.navy, margin: '2px 0' }}>
        Vào: <strong>{payload[0]?.value ?? 0} lượt</strong>
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SUMMARY CARD
// ═══════════════════════════════════════════════════════════
interface SummaryCardProps {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  accentBar: string;
  loading?: boolean;
}

function SummaryCard({ label, value, sub, accent, accentBar, loading }: SummaryCardProps) {
  return (
    <div style={{
      background: C.white,
      borderRadius: 18,
      padding: '24px 28px',
      boxShadow: C.shadow,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
        background: accentBar, borderRadius: '18px 18px 0 0',
      }} />
      <p style={{ fontSize: 13, fontWeight: 600, color: C.gray600, margin: '8px 0 0' }}>
        {label}
      </p>
      <p style={{
        fontSize: 32, fontWeight: 800, color: accent,
        margin: '6px 0 0', lineHeight: 1,
      }}>
        {loading ? '…' : value}
      </p>
      {sub && (
        <p style={{ fontSize: 12, color: C.gray400, margin: '4px 0 0' }}>{sub}</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  VEHICLE TYPE BREAKDOWN BAR
// ═══════════════════════════════════════════════════════════
function VehicleBreakdown({ data, loading }: { data: TrafficData['byVehicleType']; loading: boolean }) {
  const carTotal = data.car + data.motorbike;
  const carPct = carTotal > 0 ? (data.car / carTotal) * 100 : 0;
  const motoPct = carTotal > 0 ? (data.motorbike / carTotal) * 100 : 0;

  const items = [
    { label: 'Ô tô', count: data.car, pct: carPct, color: C.navy },
    { label: 'Xe máy', count: data.motorbike, pct: motoPct, color: C.amber },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {items.map((item) => (
        <div key={item.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.gray800 }}>{item.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>
              {loading ? '…' : `${item.count} lượt`}
            </span>
          </div>
          <div style={{ height: 8, background: C.gray200, borderRadius: 999 }}>
            <div style={{
              height: '100%',
              width: `${item.pct}%`,
              background: item.color,
              borderRadius: 999,
              transition: 'width 0.6s ease',
              minWidth: item.pct > 0 ? 4 : 0,
            }} />
          </div>
        </div>
      ))}
      {carTotal === 0 && !loading && (
        <p style={{ fontSize: 12, color: C.gray400, margin: 0 }}>Chưa có lượt xe vào</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════
export function TrafficPage() {
  const [range, setRange] = useState<DateRange>('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true);
    try {
      const resp = await api.get<{ success: boolean; data: TrafficData }>(
        '/reports/traffic',
        { params: { from, to } }
      );
      setData(resp.data.data);
    } catch {
      setData({
        totalIn: 0, totalOut: 0, currentlyParked: 0,
        byVehicleType: { car: 0, motorbike: 0 },
        daily: [], hourly: [], peakHour: null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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

  const t = data ?? {
    totalIn: 0, totalOut: 0, currentlyParked: 0,
    byVehicleType: { car: 0, motorbike: 0 },
    daily: [], hourly: [], peakHour: null,
  };

  const rangeOptions: { value: DateRange; label: string }[] = [
    { value: 'today', label: 'Hôm nay' },
    { value: 'week',  label: 'Tuần này' },
    { value: 'month', label: 'Tháng này' },
    { value: 'custom', label: 'Tùy chọn' },
  ];

  const allDailyZero = t.daily.every((d) => d.in === 0 && d.out === 0);
  const allHourlyZero = t.hourly.every((h) => h.in === 0);

  const peakHourDisplay = t.peakHour != null ? peakHourLabel(t.peakHour.hour) : null;

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
            Lưu lượng xe
          </h1>
          <p style={{ fontSize: 14, color: C.gray600, margin: '4px 0 0' }}>
            Thống kê lượt xe ra vào
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
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
                  if (value !== 'custom') { setCustomFrom(''); setCustomTo(''); }
                }}
                style={{
                  padding: '7px 16px', borderRadius: 8,
                  border: range === value ? 'none' : `1.5px solid ${C.gray200}`,
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: range === value ? C.navy : 'transparent',
                  color: range === value ? C.white : C.gray600,
                  transition: 'all 0.18s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: C.white, padding: '8px 14px',
              borderRadius: 12, boxShadow: C.shadow,
            }}>
              <label style={{ fontSize: 13, color: C.gray600, fontWeight: 500, whiteSpace: 'nowrap' }}>Từ ngày:</label>
              <input
                type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                style={{
                  border: `1.5px solid ${C.gray200}`, borderRadius: 8,
                  padding: '5px 10px', fontSize: 13, color: C.gray800, outline: 'none',
                }}
              />
              <label style={{ fontSize: 13, color: C.gray600, fontWeight: 500, whiteSpace: 'nowrap' }}>Đến ngày:</label>
              <input
                type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                style={{
                  border: `1.5px solid ${C.gray200}`, borderRadius: 8,
                  padding: '5px 10px', fontSize: 13, color: C.gray800, outline: 'none',
                }}
              />
              <button
                onClick={handleCustomApply}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: 'none',
                  background: C.navy, color: C.white, fontSize: 13, fontWeight: 600, cursor: 'pointer',
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
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 20,
        marginBottom: 28,
      }}>
        <SummaryCard
          label="Lượt vào"
          value={String(t.totalIn)}
          accent={C.navy}
          accentBar={C.navy}
          loading={loading}
        />
        <SummaryCard
          label="Lượt ra"
          value={String(t.totalOut)}
          accent={C.blue}
          accentBar={C.blue}
          loading={loading}
        />
        <SummaryCard
          label="Đang trong bãi"
          value={String(t.currentlyParked)}
          accent={C.amber}
          accentBar={C.amber}
          loading={loading}
        />
        <SummaryCard
          label="Khung giờ cao điểm"
          value={peakHourDisplay ?? '—'}
          sub={t.peakHour != null ? `${t.peakHour.count} lượt vào` : undefined}
          accent={t.peakHour != null ? C.green : C.gray400}
          accentBar={t.peakHour != null ? C.green : C.gray200}
          loading={loading}
        />
      </div>

      {/* ── Daily Chart ─────────────────────────────────────── */}
      <div style={{
        background: C.white, borderRadius: 18, padding: '28px 28px 20px',
        boxShadow: C.shadow, marginBottom: 28,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy, margin: 0 }}>
            Lượt xe ra/vào theo ngày
          </h2>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: C.navy, display: 'inline-block' }} />
              Vào
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: C.blue, display: 'inline-block' }} />
              Ra
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: C.gray400, fontSize: 14 }}>Đang tải biểu đồ…</p>
          </div>
        ) : allDailyZero ? (
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={C.gray200} strokeWidth="1.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <p style={{ color: C.gray400, fontSize: 14, margin: 0 }}>Chưa có lưu lượng trong kỳ này</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={t.daily} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.gray200} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtShortDate}
                tick={{ fontSize: 12, fill: C.gray600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: C.gray600 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<DailyTooltip />} />
              <Line type="monotone" dataKey="in"  name="Vào" stroke={C.navy} strokeWidth={2.5} dot={{ r: 3, fill: C.navy, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="out" name="Ra"  stroke={C.blue}  strokeWidth={2.5} dot={{ r: 3, fill: C.blue,  strokeWidth: 0 }} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Hourly Chart + Vehicle Breakdown ────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: 20,
        marginBottom: 28,
      }}>
        {/* Hourly bar chart */}
        <div style={{
          background: C.white, borderRadius: 18, padding: '28px 28px 20px',
          boxShadow: C.shadow,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy, margin: 0 }}>
              Khung giờ cao điểm
            </h2>
            {t.peakHour != null && !loading && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: C.green,
                background: C.greenBg, borderRadius: 999, padding: '2px 10px',
              }}>
                Đỉnh: {peakHourDisplay}
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: C.gray400, fontSize: 14 }}>Đang tải…</p>
            </div>
          ) : allHourlyZero ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.gray200} strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
              <p style={{ color: C.gray400, fontSize: 14, margin: 0 }}>Chưa có dữ liệu giờ cao điểm</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={t.hourly} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke={C.gray200} vertical={false} />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h) => `${String(h).padStart(2, '0')}h`}
                  tick={{ fontSize: 11, fill: C.gray600 }}
                  axisLine={false}
                  tickLine={false}
                  interval={1}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: C.gray600 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<HourlyTooltip />} cursor={{ fill: C.gray100 }} />
                {t.peakHour != null && (
                  <ReferenceLine
                    x={t.peakHour.hour}
                    stroke={C.amber}
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />
                )}
                <Bar dataKey="in" name="Vào" fill={C.navy} radius={[4, 4, 0, 0]}>
                  {t.hourly.map((entry) => (
                    <Cell
                      key={entry.hour}
                      fill={t.peakHour?.hour === entry.hour ? C.amber : C.navy}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Vehicle breakdown */}
        <div style={{
          background: C.white, borderRadius: 18, padding: '28px',
          boxShadow: C.shadow,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy, margin: '0 0 4px' }}>
            Cơ cấu loại xe vào
          </h2>
          <p style={{ fontSize: 12, color: C.gray400, margin: '0 0 20px' }}>
            Theo loại phương tiện trong kỳ
          </p>
          <VehicleBreakdown data={t.byVehicleType} loading={loading} />
        </div>
      </div>
    </div>
  );
}
