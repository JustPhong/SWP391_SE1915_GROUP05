
import styles from '../../styles/staff.module.css';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'green' | 'blue' | 'orange' | 'gray';
  icon?: React.ReactNode;
}

const accentColors: Record<string, { border: string; bg: string; text: string }> = {
  green: { border: '#86EFAC', bg: '#F0FDF4', text: '#15803D' },
  blue: { border: '#93C5FD', bg: '#EFF6FF', text: '#1D4ED8' },
  orange: { border: '#FCD34D', bg: '#FFFBEB', text: '#B45309' },
  gray: { border: '#D1D5DB', bg: '#F9FAFB', text: '#374151' },
};

export function KpiCard({ label, value, sub, accent = 'blue', icon }: KpiCardProps) {
  const c = accentColors[accent];
  return (
    <div
      className={styles.kpiCard}
      style={{
        borderLeft: `4px solid ${c.border}`,
        background: c.bg,
      }}
    >
      <div className={styles.kpiLabel} style={{ color: c.text }}>{label}</div>
      <div className={styles.kpiValue} style={{ color: c.text }}>{value}</div>
      {sub && <div className={styles.kpiSub} style={{ color: c.text, opacity: 0.75 }}>{sub}</div>}
      {icon && <div className={styles.kpiIcon} style={{ color: c.text }}>{icon}</div>}
    </div>
  );
}

interface SlotBreakdown {
  label: string;
  value: string;
  accent?: 'blue';
}

export function KpiSlotBreakdown({ breakdowns }: { breakdowns: SlotBreakdown[] }) {
  return (
    <div className={styles.kpiCard} style={{ borderLeft: '4px solid #93C5FD', background: '#EFF6FF' }}>
      <div className={styles.kpiLabel} style={{ color: '#1D4ED8' }}>Chỗ trống</div>
      <div className={styles.kpiSlotRows}>
        {breakdowns.map((b) => (
          <div key={b.label} className={styles.kpiSlotRow}>
            <span style={{ color: '#374151', fontSize: '0.8rem' }}>{b.label}</span>
            <span style={{ color: '#1D4ED8', fontWeight: 700, fontSize: '0.95rem' }}>{b.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
