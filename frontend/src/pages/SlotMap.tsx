import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import type { ParkingSlot, Floor } from '../types/index';

// ── API response shape ───────────────────────────────────
interface SlotWithFloor extends Omit<ParkingSlot, 'floor'> {
  floor: Floor | null;
}

interface FloorGroup {
  floorCode: string;
  name: string;
  slots: ParkingSlot[];
}

// ── Design tokens ────────────────────────────────────────
const C = {
  navy:       '#1E3A5F',
  white:      '#FFFFFF',
  green:      '#16A34A',
  greenBg:    '#DCFCE7',
  greenBorder:'#86EFAC',
  red:        '#DC2626',
  redBg:      '#FEE2E2',
  redBorder:  '#FECACA',
  amber:      '#D97706',
  amberBg:    '#FEF3C7',
  amberBorder:'#FDE68A',
  gray50:     '#F9FAFB',
  gray100:    '#F3F5F7',
  gray200:    '#E5E7EB',
  gray300:    '#D1D5DB',
  gray400:    '#9CA3AF',
  gray500:    '#6B7280',
  gray800:    '#111827',
};

// ── Slot tile component ─────────────────────────────────
function SlotTile({ slot }: { slot: ParkingSlot }) {
  const isAvailable = slot.status === 'AVAILABLE';
  const isOccupied = slot.status === 'OCCUPIED';
  const isReserved = slot.status === 'RESERVED';

  const bgColor = isAvailable ? C.greenBg : isOccupied ? C.redBg : C.amberBg;
  const borderColor = isAvailable ? C.greenBorder : isOccupied ? C.redBorder : C.amberBorder;
  const textColor = isAvailable ? '#15803D' : isOccupied ? '#B91C1C' : '#92400E';

  return (
    <div
      style={{
        width: 72,
        height: 72,
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        flexShrink: 0,
        cursor: 'default',
      }}
      title={`${slot.code} · ${slot.status}`}
    >
      <span style={{
        fontSize: '0.62rem',
        fontWeight: 700,
        color: textColor,
        letterSpacing: '0.01em',
        lineHeight: 1.1,
        textAlign: 'center',
        padding: '0 2px',
      }}>
        {slot.code}
      </span>
      {isReserved && (
        <span style={{
          fontSize: '0.5rem',
          fontWeight: 600,
          color: '#92400E',
          background: '#FDE68A',
          borderRadius: 4,
          padding: '1px 3px',
          lineHeight: 1,
        }}>
          đặt
        </span>
      )}
      {isOccupied && (
        <span style={{
          fontSize: '0.5rem',
          fontWeight: 600,
          color: '#B91C1C',
          background: '#FECACA',
          borderRadius: 4,
          padding: '1px 3px',
          lineHeight: 1,
        }}>
          đỗ
        </span>
      )}
    </div>
  );
}

// ── Floor section component ───────────────────────────────
function FloorSection({ group }: { group: FloorGroup }) {
  const occupied = group.slots.filter((s) => s.status === 'OCCUPIED').length;
  const total = group.slots.length;

  return (
    <div style={{ marginBottom: '1.75rem' }}>
      {/* Floor header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '0.75rem',
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '1rem',
          fontWeight: 800,
          color: C.navy,
        }}>
          {group.name}
        </h2>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '0.2rem 0.65rem',
          borderRadius: 20,
          fontSize: '0.72rem',
          fontWeight: 700,
          background: occupied > 0 ? C.redBg : C.greenBg,
          color: occupied > 0 ? '#B91C1C' : '#15803D',
          border: `1px solid ${occupied > 0 ? C.redBorder : C.greenBorder}`,
        }}>
          {occupied}/{total} đã đỗ
        </span>
      </div>

      {/* Slot grid */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        background: C.gray50,
        borderRadius: 14,
        border: `1px solid ${C.gray200}`,
      }}>
        {group.slots.map((slot) => (
          <SlotTile key={slot.id} slot={slot} />
        ))}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────
export function SlotMapPage() {
  const [groups, setGroups] = useState<FloorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ success: boolean; data: SlotWithFloor[] }>('/slots/all');
      const raw: SlotWithFloor[] = res.data.data ?? [];

      // Group by floor.floorCode, preserving floor order
      const map = new Map<string, FloorGroup>();

      for (const slot of raw) {
        const code = slot.floor?.floorCode ?? '?';
        if (!map.has(code)) {
          map.set(code, {
            floorCode: code,
            name: slot.floor?.name ?? `Tầng ${code}`,
            slots: [],
          });
        }
        map.get(code)!.slots.push({
          id: slot.id,
          code: slot.code,
          floorId: slot.floorId,
          type: slot.type,
          status: slot.status,
          isFixed: slot.isFixed,
          assignedVehicleId: slot.assignedVehicleId,
          createdAt: slot.createdAt,
        });
      }

      // Sort groups by floorCode: G first, then 1, 2, 3...
      const sorted = Array.from(map.values()).sort((a, b) => {
        if (a.floorCode === 'G') return -1;
        if (b.floorCode === 'G') return 1;
        return a.floorCode.localeCompare(b.floorCode, undefined, { numeric: true });
      });

      // Sort slots within each group
      for (const g of sorted) {
        g.slots.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      }

      setGroups(sorted);
    } catch {
      setError('Không thể tải sơ đồ tầng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  return (
    <>
      {/* ── Page header + refresh ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1.25rem',
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '1.4rem',
            fontWeight: 800,
            color: C.navy,
          }}>
            Sơ đồ tầng
          </h1>
          <p style={{
            margin: '0.2rem 0 0',
            fontSize: '0.85rem',
            color: C.gray500,
          }}>
            Trạng thái các ô đỗ theo tầng
          </p>
        </div>
        <button
          onClick={loadSlots}
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            background: loading ? C.gray100 : C.white,
            color: loading ? C.gray400 : C.navy,
            border: `1.5px solid ${loading ? C.gray200 : C.gray300}`,
            borderRadius: 10,
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {/* ── Legend ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1.25rem',
        marginBottom: '1.25rem',
        padding: '0.6rem 1rem',
        background: C.gray50,
        borderRadius: 10,
        border: `1px solid ${C.gray200}`,
      }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: C.gray500 }}>Chú thích:</span>
        {[
          { color: C.greenBg, border: C.greenBorder, dot: C.green, text: 'Trống', textColor: '#15803D' },
          { color: C.redBg, border: C.redBorder, dot: C.red, text: 'Đã đỗ', textColor: '#B91C1C' },
          { color: C.amberBg, border: C.amberBorder, dot: C.amber, text: 'Đã đặt', textColor: '#92400E' },
        ].map((item) => (
          <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              display: 'inline-block',
              width: 11,
              height: 11,
              borderRadius: '50%',
              background: item.dot,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: item.textColor }}>
              {item.text}
            </span>
          </div>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: C.redBg,
          border: `1.5px solid ${C.redBorder}`,
          borderRadius: 10,
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.875rem',
          color: '#B91C1C',
          fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {/* ── Floor sections ── */}
      {loading ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem',
          color: C.gray400,
          fontSize: '0.9rem',
          fontWeight: 600,
        }}>
          Đang tải sơ đồ...
        </div>
      ) : groups.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: C.gray400,
          fontSize: '0.9rem',
        }}>
          Không có dữ liệu ô đỗ.
        </div>
      ) : (
        groups.map((group) => (
          <FloorSection key={group.floorCode} group={group} />
        ))
      )}
    </>
  );
}
