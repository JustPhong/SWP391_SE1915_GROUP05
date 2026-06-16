import { useState, useEffect, useCallback } from 'react';
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
} as const;

// ═══════════════════════════════════════════════════════════
//  API TYPES
// ═══════════════════════════════════════════════════════════
interface SlotInfo {
  code: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
}

interface FloorDetail {
  floorCode: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
  customerType: 'MONTHLY' | 'CASUAL';
  capacity: number;
  occupied: number;
  available: number;
  reserved: number;
  rate: number;
  slots: SlotInfo[];
}

interface OccupancyDetail {
  totalCapacity: number;
  totalOccupied: number;
  overallRate: number;
  floors: FloorDetail[];
}

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════
function rateColor(rate: number): string {
  if (rate >= 85) return C.red;
  if (rate >= 60) return C.amber;
  return C.green;
}

function rateBg(rate: number): string {
  if (rate >= 85) return C.redBg;
  if (rate >= 60) return C.amberBg;
  return C.greenBg;
}

function slotStatusColor(status: SlotInfo['status']): { bg: string; border: string; text: string } {
  switch (status) {
    case 'AVAILABLE': return { bg: C.greenBg,  border: '#86EFAC', text: '#15803D' };
    case 'OCCUPIED': return { bg: C.navy,     border: C.navyDark, text: C.white };
    case 'RESERVED': return { bg: C.amberBg,  border: '#FCD34D', text: '#92400E' };
  }
}

function floorLabel(floorCode: string): string {
  const map: Record<string, string> = {
    G: 'Tầng G', '0': 'Tầng G',
    '1': 'Tầng 1', '2': 'Tầng 2', '3': 'Tầng 3',
  };
  return map[floorCode] ?? `Tầng ${floorCode}`;
}

function vehicleLabel(type: 'CAR' | 'MOTORBIKE'): string {
  return type === 'CAR' ? 'Ô tô' : 'Xe máy';
}

function customerLabel(type: 'MONTHLY' | 'CASUAL'): string {
  return type === 'MONTHLY' ? 'Gói tháng' : 'Khách lẻ';
}

// 'G' → 0 (ground floor first), '1'/'2'/'3' → parseInt + 1, others last
function floorSortOrder(floorCode: string): number {
  if (floorCode === 'G' || floorCode === '0') return 0;
  const n = parseInt(floorCode, 10);
  return isNaN(n) ? 99 : n + 1;
}

// ═══════════════════════════════════════════════════════════
//  SLOT CELL
// ═══════════════════════════════════════════════════════════
function SlotCellInner({ slot }: { slot: SlotInfo }) {
  const colors = slotStatusColor(slot.status);
  return (
    <div
      title={`${slot.code} — ${slot.status === 'AVAILABLE' ? 'Trống' : slot.status === 'OCCUPIED' ? 'Đang dùng' : 'Đã đặt'}`}
      style={{
        width: 44,
        height: 36,
        borderRadius: 8,
        background: colors.bg,
        border: `1.5px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
        color: colors.text,
        cursor: 'default',
        fontFamily: 'monospace',
        flexShrink: 0,
        transition: 'transform 0.15s',
      }}
    >
      {slot.code}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  FLOOR CARD
// ═══════════════════════════════════════════════════════════
function FloorCard({ floor }: { floor: FloorDetail }) {
  const accent = rateColor(floor.rate);
  const accentBg = rateBg(floor.rate);

  return (
    <div style={{
      background: C.white,
      borderRadius: 18,
      padding: '24px 28px',
      boxShadow: C.shadow,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.navy }}>
            {floorLabel(floor.floorCode)}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.gray600 }}>
            {vehicleLabel(floor.vehicleType)} ({customerLabel(floor.customerType)})
          </p>
        </div>
        {/* Rate badge */}
        <div style={{
          background: accentBg,
          color: accent,
          borderRadius: 999,
          padding: '4px 12px',
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {floor.rate}%
        </div>
      </div>

      {/* Occupancy bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: C.gray600, fontWeight: 500 }}>
            {floor.occupied}/{floor.capacity} chỗ
          </span>
          <span style={{ fontSize: 13, color: accent, fontWeight: 700 }}>
            {floor.reserved > 0 && `(${floor.reserved} đã đặt) `}
            {floor.available} trống
          </span>
        </div>
        <div style={{ height: 10, background: C.gray200, borderRadius: 999 }}>
          <div style={{
            height: '100%',
            width: `${Math.min(floor.rate, 100)}%`,
            background: accent,
            borderRadius: 999,
            transition: 'width 0.5s ease',
            minWidth: floor.rate > 0 ? 4 : 0,
          }} />
        </div>
      </div>

      {/* Slot grid */}
      {floor.slots.length === 0 ? (
        <p style={{ color: C.gray400, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
          Chưa có dữ liệu slot cho tầng này
        </p>
      ) : (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          maxHeight: 160,
          overflowY: 'auto',
        }}>
          {floor.slots.map((slot) => (
            <SlotCellInner key={slot.code} slot={slot} />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════
export function OccupancyDetailPage() {
  const [data, setData] = useState<OccupancyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await api.get<{ success: boolean; data: OccupancyDetail }>(
        '/reports/occupancy-detail'
      );
      setData(resp.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const t = data ?? {
    totalCapacity: 120,
    totalOccupied: 0,
    overallRate: 0,
    floors: [],
  };

  const overallColor = rateColor(t.overallRate);
  const overallBg = rateBg(t.overallRate);
  const totalAvailable = t.totalCapacity - t.totalOccupied;

  return (
    <div style={{
      padding: '32px 36px',
      minHeight: '100%',
      background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
    }}>
      {/* ── Page Header ─────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.navy, margin: 0 }}>
          Tỉ lệ lấp đầy
        </h1>
        <p style={{ fontSize: 14, color: C.gray600, margin: '4px 0 0' }}>
          Tình trạng sử dụng bãi theo thời gian thực
        </p>
      </div>

      {/* ── Top Summary Cards ─────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 20,
        marginBottom: 28,
      }}>
        {/* Tổng sức chứa */}
        <div style={{
          background: C.white,
          borderRadius: 18,
          padding: '24px 28px',
          boxShadow: C.shadow,
          borderTop: `4px solid ${C.navy}`,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.gray600, margin: 0 }}>Tổng sức chứa</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: C.navy, margin: '6px 0 0', lineHeight: 1 }}>
            {loading ? '…' : t.totalCapacity}
          </p>
          <p style={{ fontSize: 12, color: C.gray400, margin: '4px 0 0' }}>vị trí</p>
        </div>

        {/* Đang sử dụng */}
        <div style={{
          background: C.white,
          borderRadius: 18,
          padding: '24px 28px',
          boxShadow: C.shadow,
          borderTop: `4px solid ${C.blue}`,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.gray600, margin: 0 }}>Đang sử dụng</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: C.blue, margin: '6px 0 0', lineHeight: 1 }}>
            {loading ? '…' : t.totalOccupied}
          </p>
          <p style={{ fontSize: 12, color: C.gray400, margin: '4px 0 0' }}>chỗ đang chiếm</p>
        </div>

        {/* Còn trống */}
        <div style={{
          background: C.white,
          borderRadius: 18,
          padding: '24px 28px',
          boxShadow: C.shadow,
          borderTop: `4px solid ${C.green}`,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.gray600, margin: 0 }}>Còn trống</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: C.green, margin: '6px 0 0', lineHeight: 1 }}>
            {loading ? '…' : totalAvailable}
          </p>
          <p style={{ fontSize: 12, color: C.gray400, margin: '4px 0 0' }}>vị trí trống</p>
        </div>
      </div>

      {/* ── Overall Rate Card ─────────────────────────────── */}
      <div style={{
        background: C.white,
        borderRadius: 18,
        padding: '28px',
        boxShadow: C.shadow,
        marginBottom: 28,
        display: 'flex',
        alignItems: 'center',
        gap: 32,
      }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.navy, margin: '0 0 4px' }}>
            Tỉ lệ lấp đầy toàn bãi
          </h2>
          <p style={{ fontSize: 13, color: C.gray600, margin: 0 }}>
            {loading ? 'Đang tính…' : `${t.totalOccupied} / ${t.totalCapacity} vị trí`}
          </p>
        </div>

        {/* Big rate */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}>
          {loading ? (
            <p style={{ fontSize: 40, fontWeight: 800, color: C.gray400 }}>…</p>
          ) : (
            <>
              <p style={{
                fontSize: 52,
                fontWeight: 800,
                color: overallColor,
                margin: 0,
                lineHeight: 1,
              }}>
                {t.overallRate.toFixed(1)}%
              </p>
              <span style={{
                background: overallBg,
                color: overallColor,
                borderRadius: 999,
                padding: '2px 12px',
                fontSize: 11,
                fontWeight: 700,
              }}>
                {t.overallRate >= 85 ? 'Bận' : t.overallRate >= 60 ? 'Trung bình' : 'Thông thoáng'}
              </span>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ flex: 2 }}>
          <div style={{ height: 16, background: C.gray200, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(t.overallRate, 100)}%`,
              background: loading
                ? C.gray400
                : overallColor,
              borderRadius: 999,
              transition: 'width 0.6s ease',
            }} />
          </div>
          {/* Segmented legend */}
          <div style={{
            display: 'flex',
            marginTop: 8,
            gap: 16,
            fontSize: 11,
            color: C.gray400,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: C.green, display: 'inline-block' }} />
              Thông thoáng (&lt;60%)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: C.amber, display: 'inline-block' }} />
              Trung bình (60–84%)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: C.red, display: 'inline-block' }} />
              Bận (≥85%)
            </span>
          </div>
        </div>
      </div>

      {/* ── Floor Cards ───────────────────────────────────── */}
      {loading ? (
        <div style={{
          background: C.white,
          borderRadius: 18,
          padding: '48px',
          boxShadow: C.shadow,
          textAlign: 'center',
          color: C.gray400,
          fontSize: 14,
        }}>
          Đang tải dữ liệu…
        </div>
      ) : t.floors.length === 0 ? (
        <div style={{
          background: C.white,
          borderRadius: 18,
          padding: '48px',
          boxShadow: C.shadow,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}>
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={C.gray200} strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 9h18M9 21V9"/>
          </svg>
          <p style={{ color: C.gray400, fontSize: 14, margin: 0 }}>Chưa có dữ liệu tầng nào</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))',
          gap: 20,
        }}>
          {t.floors.slice().sort((a, b) => floorSortOrder(a.floorCode) - floorSortOrder(b.floorCode)).map((floor) => (
            <FloorCard key={floor.floorCode} floor={floor} />
          ))}
        </div>
      )}

      {/* ── Slot Legend ───────────────────────────────────── */}
      {!loading && t.floors.length > 0 && (
        <div style={{
          marginTop: 20,
          display: 'flex',
          justifyContent: 'center',
          gap: 24,
          fontSize: 12,
          color: C.gray600,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 28, height: 22, borderRadius: 6,
              background: C.greenBg, border: `1.5px solid #86EFAC`,
              display: 'inline-block',
            }} />
            Trống
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 28, height: 22, borderRadius: 6,
              background: C.navy, border: `1.5px solid ${C.navyDark}`,
              display: 'inline-block',
            }} />
            Đang dùng
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 28, height: 22, borderRadius: 6,
              background: C.amberBg, border: `1.5px solid #FCD34D`,
              display: 'inline-block',
            }} />
            Đã đặt
          </span>
        </div>
      )}
    </div>
  );
}
