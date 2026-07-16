import type { ParkingSlot } from '../../types/index';
import styles from '../../styles/staff.module.css';

interface FloorData {
  floor: number;
  label: string;
  slots: ParkingSlot[];
}

interface DensityMapProps {
  floors: FloorData[];
}

function computeOccupancy(slots: ParkingSlot[]): number {
  if (slots.length === 0) return 0;
  const occupied = slots.filter((s) => s.status === 'OCCUPIED' || s.status === 'RESERVED').length;
  return Math.round((occupied / slots.length) * 100);
}

export function DensityMap({ floors }: DensityMapProps) {
  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>Mật độ đỗ xe</p>

      <div className={styles.densityLegend}>
        <span className={styles.legendDot} style={{ background: '#22C55E' }} />
        <span>Trống</span>
        <span className={styles.legendDot} style={{ background: '#EF4444', marginLeft: '0.75rem' }} />
        <span>Đã đỗ</span>
      </div>

      <div className={styles.densityFloors}>
        {floors.map((floor) => {
          const pct = computeOccupancy(floor.slots);
          const occupied = floor.slots.filter((s) => s.status !== 'AVAILABLE').length;

          return (
            <div key={floor.floor} className={styles.densityFloorSection}>
              <div className={styles.densityFloorHeader}>
                <div className={styles.densityFloorName}>{floor.label}</div>
                <div className={styles.densityFloorStats}>
                  <span>{occupied}/{floor.slots.length} chỗ</span>
                  <span className={styles.densityPct} style={{ color: pct >= 85 ? '#EF4444' : pct >= 60 ? '#F59E0B' : '#22C55E' }}>
                    {pct}% đầy
                  </span>
                </div>
              </div>

              <div className={styles.densityGrid}>
                {floor.slots.map((slot) => (
                  <div
                    key={slot.id}
                    className={`${styles.densitySlot} ${slot.status === 'AVAILABLE' ? styles.slotEmpty : styles.slotOccupied}`}
                    title={`${slot.code} — ${slot.type}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
