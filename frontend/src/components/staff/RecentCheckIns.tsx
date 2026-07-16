import { Link } from 'react-router-dom';
import type { CheckInRecord } from '../../types/index';
import styles from '../../styles/staff.module.css';

interface ProcessedRecord extends CheckInRecord {
  checkedInBy?: string;
}

interface RecentCheckInsProps {
  records: ProcessedRecord[];
  isLoading?: boolean;
  onViewAll?: () => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function VehicleBadge({ type }: { type: string }) {
  const isCar = type === 'CAR';
  return (
    <span className={styles.tableBadge} style={{
      background: isCar ? '#DBEAFE' : '#FEF9C3',
      color: isCar ? '#1E3A5F' : '#854D0E',
    }}>
      {isCar ? 'Ô tô' : 'Xe máy'}
    </span>
  );
}

export function RecentCheckIns({ records, isLoading, onViewAll }: RecentCheckInsProps) {
  return (
    <div className={styles.card}>
      <div className={styles.tableHeader}>
        <p className={styles.cardTitle} style={{ margin: 0 }}>Xe mới vào bãi</p>
        <button type="button" className={styles.linkBtn} onClick={onViewAll}>
          Xem tất cả lịch sử
        </button>
      </div>

      <div className={styles.tableWrapper}>
        {isLoading ? (
          <p className={styles.emptyState}>Đang tải...</p>
        ) : records.length === 0 ? (
          <p className={styles.emptyState}>Chưa có xe nào check-in trong ca này.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Biển số</th>
                <th>Giờ vào</th>
                <th>Loại xe</th>
                <th>Vị trí</th>
                <th>NV xử lý</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className={styles.plateChip}>{r.vehicle?.plateNumber ?? '—'}</span>
                  </td>
                  <td>{formatTime(r.checkInTime)}</td>
                  <td><VehicleBadge type={r.vehicle?.type ?? 'CAR'} /></td>
                  <td>{r.slot?.code ?? '—'}</td>
                  <td>{r.checkedInBy ?? '—'}</td>
                  <td>
                    <Link to="/staff/checkout" className={styles.linkBtn} style={{ fontSize: '0.8rem' }}>
                      Check-out
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
