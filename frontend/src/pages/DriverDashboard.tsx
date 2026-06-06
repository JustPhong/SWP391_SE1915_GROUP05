import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { CarIcon, ChevronRightIcon } from '../components/ui/Icons';
import styles from '../styles/driver.module.css';

interface ParkingSession {
  id: string;
  plateNumber: string;
  slotCode: string;
  floor: string;
  checkInTime: string;
  estimatedAmount?: number | null;
  customerType: 'CASUAL' | 'MONTHLY';
  isMonthly: boolean;
}

interface MonthlyPkg {
  id: string;
  planName: string;
  expiryDate: string;
  status: 'ACTIVE' | 'EXPIRED';
}

interface HistoryEntry {
  id: string;
  plateNumber: string;
  slotCode: string;
  date: string;
  duration: string;
  amount: number;
  status: 'Hoàn thành';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Chào buổi sáng';
  if (hour < 17) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN');
}

export function DriverDashboardPage() {
  const { user } = useAuth();
  const greeting = getGreeting();

  const [session, setSession] = useState<ParkingSession | null | undefined>(undefined);
  const [monthlyPkg, setMonthlyPkg] = useState<MonthlyPkg | null | undefined>(undefined);
  const [history, setHistory] = useState<HistoryEntry[] | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setError('');
      try {
        const [sessionRes, packageRes, historyRes] = await Promise.all([
          api.get('/driver-dashboard/sessions/current'),
          api.get('/driver-dashboard/packages/my'),
          api.get('/driver-dashboard/history'),
        ]);

        if (cancelled) return;

        setSession(sessionRes.data.data ?? null);
        setMonthlyPkg(packageRes.data.data ?? null);
        setHistory(historyRes.data.data ?? []);
      } catch {
        if (cancelled) return;
        setSession(null);
        setMonthlyPkg(null);
        setHistory([]);
        setError('Không thể tải dữ liệu dashboard. Vui lòng thử lại sau.');
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const isSessionLoading = session === undefined;
  const isPackageLoading = monthlyPkg === undefined;
  const isHistoryLoading = history === undefined;

  return (
    <>
      {error && <p className={styles.dashboardError}>{error}</p>}

      {/* Welcome Banner */}
      <div className={styles.welcomeBanner}>
        <div className={styles.welcomeBannerBg} />
        <div>
          <p className={styles.welcomeText}>{greeting}</p>
          <p className={styles.welcomeName}>Xin chào, {user?.fullName ?? 'bạn'}!</p>
          <p className={styles.welcomeSub}>Chúc bạn một ngày đỗ xe thuận lợi</p>
        </div>
        <Link to="/booking" className={styles.bookBtn}>
          Đặt chỗ ngay
          <span style={{ marginLeft: 6, display: 'flex', alignItems: 'center' }}>
            <ChevronRightIcon size={14} />
          </span>
        </Link>
      </div>

      {/* Two Cards */}
      <div className={styles.cardsGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <span className={`${styles.cardIcon} ${styles.cardIconGreen}`}>
                <CarIcon size={16} />
              </span>
              Phiên gửi hiện tại
            </span>
            {session ? (
              <span className={`${styles.badge} ${styles.badgeGreen}`}>
                <span className={styles.badgeDot} />
                Đang đỗ
              </span>
            ) : null}
          </div>

          {isSessionLoading ? (
            <p className={styles.emptyState}>Đang tải...</p>
          ) : session ? (
            <>
              <p className={styles.cardValue}>{session.slotCode}</p>
              <p className={styles.cardSub}>{session.floor} · Vào lúc {formatDateTime(session.checkInTime)}</p>

              <div className={styles.cardFooter}>
                <span className={styles.cardFooterLabel}>Biển số xe</span>
                <span className={styles.plateChip}>{session.plateNumber}</span>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.cardFooterLabel}>Ước tính</span>
                <div>
                  {session.customerType === 'CASUAL' ? (
                    <div>
                      <div className={styles.amount}>{formatCurrency(session.estimatedAmount ?? 0)}</div>
                      <div className={styles.amountSub}>Tính theo giờ gửi</div>
                    </div>
                  ) : (
                    <span className={styles.monthlyNote}>Đã bao gồm trong gói tháng</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.emptyStateBlock}>
              <p className={styles.emptyState}>Bạn chưa có xe nào đang gửi</p>
              <Link to="/booking" className={styles.emptyActionBtn}>
                Đặt chỗ ngay
              </Link>
            </div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <span className={`${styles.cardIcon} ${styles.cardIconBlue}`}>
                <CarIcon size={16} />
              </span>
              Gói tháng
            </span>
            {monthlyPkg ? (
              <span className={`${styles.badge} ${styles.badgeBlue}`}>
                <span className={styles.badgeDot} />
                Hoạt động
              </span>
            ) : null}
          </div>

          {isPackageLoading ? (
            <p className={styles.emptyState}>Đang tải...</p>
          ) : monthlyPkg ? (
            <>
              <p className={styles.cardValue}>{monthlyPkg.planName}</p>
              <p className={styles.cardSub}>Hết hạn: {formatDateTime(monthlyPkg.expiryDate)}</p>

              <div className={styles.cardFooter}>
                <span className={styles.cardFooterLabel}>Trạng thái</span>
                <span className={styles.statusChip} style={{ background: '#DCFCE7', color: '#16A34A', fontSize: '0.78rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 20 }}>
                  {monthlyPkg.status === 'ACTIVE' ? 'Hoạt động' : 'Hết hạn'}
                </span>
              </div>
            </>
          ) : (
            <div className={styles.emptyStateBlock}>
              <p className={styles.emptyState}>Bạn chưa đăng ký gói tháng</p>
            </div>
          )}
        </div>
      </div>

      {/* History Section */}
      <p className={styles.sectionTitle}>Lịch sử đỗ xe gần đây</p>
      <div className={styles.tableWrapper}>
        {isHistoryLoading ? (
          <p className={styles.emptyState}>Đang tải...</p>
        ) : history.length > 0 ? (
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
        ) : (
          <p className={styles.emptyState}>Chưa có lịch sử đỗ xe</p>
        )}
      </div>

      {/* Promo Banner */}
      <div className={styles.promoBanner}>
        <div className={styles.promoBannerBg} />
        <div>
          <p className={styles.promoText}>Cập nhật mới nhất</p>
          <p className={styles.promoTitle}>Hệ thống P-Smart mới</p>
        </div>
        <button className={styles.promoBtn}>Khám phá ngay</button>
      </div>
    </>
  );
}
