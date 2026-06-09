import { useState, useEffect, useCallback } from 'react';
import { getParkingOverview, type ParkingOverviewResponse } from '../api/parkingApi';

// ── Design tokens ──────────────────────────────────────────────────
const C = {
  navy:  '#1E3A5F',
  white: '#FFFFFF',
  gray50:  '#F9FAFB',
  gray100:  '#F3F4F6',
  gray200:  '#E5E7EB',
  gray400:  '#9CA3AF',
  gray600:  '#5C6B7A',
  gray800:  '#2D3A45',
  shadow: '0 8px 32px rgba(30,58,95,0.10)',
} as const;

// ── Toast ─────────────────────────────────────────────────────────
type Toast = { message: string; type: 'success' | 'error' } | null;

function ToastBanner({ toast, onClear }: { toast: Toast; onClear: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClear, 3500);
    return () => clearTimeout(t);
  }, [toast, onClear]);
  if (!toast) return null;
  const bg = toast.type === 'success' ? '#DCFCE7' : '#FEE2E2';
  const text = toast.type === 'success' ? '#15803D' : '#DC2626';
  const border = toast.type === 'success' ? '#BBF7D0' : '#FECACA';
  return (
    <div style={{
      position: 'fixed', top: 20, right: 24, zIndex: 9999,
      background: bg, border: `1.5px solid ${border}`, borderRadius: 12,
      padding: '12px 20px', color: text, fontWeight: 600, fontSize: '0.9rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxWidth: 400,
    }}>
      {toast.message}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  icon,
  accent = false,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: boolean;
  sub?: string;
}) {
  return (
    <div style={{
      background: C.white,
      borderRadius: 16,
      padding: '20px 24px',
      boxShadow: C.shadow,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      minWidth: 0,
      flex: '1 1 160px',
    }}>
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: accent ? '#EDE9FE' : '#EFF6FF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: accent ? '#7C3AED' : C.navy, lineHeight: 1.2 }}>
          {value}
        </div>
        <div style={{ fontSize: '0.78rem', color: C.gray600, fontWeight: 600, marginTop: 2 }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: '0.72rem', color: C.gray400, marginTop: 1 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// ── Occupancy bar ─────────────────────────────────────────────────
function OccupancyBar({ percent }: { percent: number }) {
  const hue = percent >= 80 ? 0 : percent >= 50 ? 30 : 120;
  const barColor = `hsl(${hue}, 70%, 45%)`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
      <div style={{
        flex: 1,
        height: 8,
        borderRadius: 4,
        background: C.gray100,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${percent}%`,
          height: '100%',
          background: barColor,
          borderRadius: 4,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: C.gray800, minWidth: 36 }}>
        {percent}%
      </span>
    </div>
  );
}

// ── Badge helpers ─────────────────────────────────────────────────
const CUSTOMER_TYPE_LABELS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  MONTHLY: { label: 'Theo tháng', bg: '#EDE9FE', text: '#7C3AED', border: '#C4B5FD' },
  CASUAL:  { label: 'Vãng lai',   bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
};

const VEHICLE_TYPE_LABELS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  CAR:       { label: 'Ô tô',      bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  MOTORBIKE: { label: 'Xe máy',   bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
};

function Badge({ value, map }: { value: string; map: Record<string, { label: string; bg: string; text: string; border: string }> }) {
  const s = map[value] ?? { label: value, bg: C.gray100, text: C.gray600, border: C.gray200 };
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      background: s.bg,
      color: s.text,
      border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

// ── Main page ────────────────────────────────────────────────────
export function ParkingConfigPage() {
  const [data, setData]         = useState<ParkingOverviewResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [toast, setToast]       = useState<Toast>(null);

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type });

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await getParkingOverview();
      setData(result);
    } catch (err: any) {
      const msg = err.response?.data?.message ?? err.message ?? 'Không tải được dữ liệu';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { building, floors } = data ?? {
    building: { totalFloors: 0, totalSlots: 0, occupied: 0, available: 0, overallOccupancy: 0 },
    floors: [],
  };

  return (
    <div>
      <ToastBanner toast={toast} onClear={() => setToast(null)} />

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: C.navy }}>
            Cấu hình bãi & slot
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: C.gray600 }}>
            Tổng quan cấu trúc bãi đỗ — Tòa nhà A
          </p>
        </div>
        <button
          onClick={fetchData}
          style={{
            padding: '10px 20px', borderRadius: 12,
            border: `1.5px solid ${C.gray200}`,
            background: C.white, color: C.navy,
            fontWeight: 700, fontSize: '0.88rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s',
          }}
          onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = C.gray50; }}
          onMouseOut={(e)  => { (e.currentTarget as HTMLButtonElement).style.background = C.white; }}
        >
          ⟳ Làm mới
        </button>
      </div>

      {/* ── KPI cards ── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <KpiCard
          label="Tổng số tầng"
          value={loading ? '—' : building.totalFloors}
          accent={false}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1E3A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M3 15h18M9 21V9"/>
            </svg>
          }
        />
        <KpiCard
          label="Tổng số slot"
          value={loading ? '—' : building.totalSlots}
          accent={false}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1E3A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          }
        />
        <KpiCard
          label="Đang sử dụng"
          value={loading ? '—' : building.occupied}
          accent={true}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 11l1.5-5h11L19 11"/>
              <path d="M3 11h18v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7z"/>
              <circle cx="7" cy="16" r="2"/>
              <circle cx="17" cy="16" r="2"/>
            </svg>
          }
        />
        <KpiCard
          label="Còn trống"
          value={loading ? '—' : building.available}
          accent={false}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          }
        />
        <KpiCard
          label="Tỉ lệ lấp đầy"
          value={loading ? '—' : `${building.overallOccupancy}%`}
          accent={true}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          }
        />
      </div>

      {/* ── Floor table card ── */}
      <div style={{
        background: C.white,
        borderRadius: 16,
        boxShadow: C.shadow,
        overflow: 'hidden',
        marginBottom: '1rem',
      }}>
        {loading ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: C.gray400, fontSize: '0.95rem' }}>
            Đang tải dữ liệu bãi đỗ…
          </div>
        ) : error && !data ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#DC2626', fontSize: '0.95rem' }}>
            {error}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.gray50 }}>
                  {['Tầng', 'Loại khách', 'Loại xe', 'Tổng slot', 'Đang dùng', 'Còn trống', 'Tỉ lệ lấp đầy'].map((h) => (
                    <th key={h} style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: C.gray600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: `2px solid ${C.gray200}`,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {floors.map((floor, idx) => (
                  <tr
                    key={floor.floorCode}
                    style={{
                      borderBottom: `1px solid ${C.gray100}`,
                      transition: 'background 0.1s',
                    }}
                    onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = C.gray50; }}
                    onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: C.navy }}>
                        {floor.floorName}
                      </span>
                      <span style={{ marginLeft: 6, fontSize: '0.72rem', color: C.gray400, fontFamily: 'monospace' }}>
                        ({floor.floorCode})
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <Badge value={floor.customerType} map={CUSTOMER_TYPE_LABELS} />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <Badge value={floor.vehicleType} map={VEHICLE_TYPE_LABELS} />
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '0.95rem', color: C.gray800 }}>
                      {floor.totalSlots}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontWeight: 700, fontSize: '0.875rem',
                        color: floor.occupied > 0 ? '#7C3AED' : C.gray400,
                      }}>
                        {floor.occupied > 0 && (
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7C3AED', display: 'inline-block', flexShrink: 0 }} />
                        )}
                        {floor.occupied}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '0.875rem', color: '#15803D' }}>
                      {floor.available}
                    </td>
                    <td style={{ padding: '14px 16px', minWidth: 160 }}>
                      <OccupancyBar percent={floor.occupancyPercent} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Read-only notice ── */}
      <div style={{
        background: '#F0F9FF',
        border: '1.5px solid #BAE6FD',
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        fontSize: '0.82rem',
        color: '#0369A1',
        lineHeight: 1.6,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0369A1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Trang này chỉ hiển thị. Việc thay đổi cấu trúc bãi cần thao tác trực tiếp trong cơ sở dữ liệu để đảm bảo toàn vẹn dữ liệu.
      </div>
    </div>
  );
}
