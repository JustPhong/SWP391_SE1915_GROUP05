import { useEffect, useState } from 'react';
import api from '../services/api';
import styles from '../styles/driver.module.css';

interface HistoryEntry {
  id: string;
  plateNumber: string;
  slotCode: string;
  date: string;
  duration: string;
  amount: number;
  status: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
}

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[] | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await api.get('/driver-dashboard/history');
        if (cancelled) return;
        setHistory(res.data.data ?? []);
      } catch {
        if (cancelled) return;
        setHistory([]);
        setError('Không thể tải lịch sử. Vui lòng thử lại.');
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.card}>
      <p className={styles.sectionTitle}>Lịch sử gửi xe</p>

      {history === undefined ? (
        <p className={styles.emptyState}>Đang tải...</p>
      ) : error ? (
        <p className={styles.emptyState}>{error}</p>
      ) : history.length > 0 ? (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Biển số</th>
                <th>Mã chỗ</th>
                <th>Ngày</th>
                <th>Thời gian</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id}>
                  <td><span className={styles.plateChip}>{entry.plateNumber}</span></td>
                  <td>{entry.slotCode}</td>
                  <td>{entry.date}</td>
                  <td>{entry.duration}</td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(entry.amount)}</td>
                  <td>
                    <span className={`${styles.statusChip} ${styles.statusCompleted}`}>
                      <span className={styles.badgeDot} />
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.emptyState}>Chưa có lịch sử đỗ xe</p>
      )}
    </div>
  );
}

