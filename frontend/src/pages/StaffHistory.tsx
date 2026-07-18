import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { HistoryIcon, SearchIcon, CalendarIcon } from '../components/ui/Icons';
import styles from '../styles/staffHistory.module.css';

interface CheckInRecord {
  id: string;
  recordType: 'CHECKIN' | 'BOOKING';
  plateNumber: string;
  vehicleType: string;
  slotCode: string;
  timeIn: string | null;
  timeOut: string | null;
  status: string; // COMPLETED, PARKING, ACTIVE, CANCELLED, NO_SHOW
  isMonthly: boolean;
  amount: number;
  isLostTicket: boolean;
  expectedArrival: string | null;
  bookingTime: string | null;
  driverName: string | null;
  driverEmail: string | null;
}

// ── Green Parking Icon ──
const ParkingIcon = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ color: '#16A34A' }}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
  </svg>
);

// ── Custom Info Icon ──
const InfoIcon = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

// ── License Plate Formatter ──
function formatPlateNumber(plate: string | null | undefined): string {
  if (!plate) return '—';
  return plate.trim().toUpperCase();
}

// ── Currency Formatter ──
function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
}

// ── Duration Formatter ──
function formatDuration(inTime: string, outTime: string | null): string {
  const start = new Date(inTime).getTime();
  const end = outTime ? new Date(outTime).getTime() : Date.now();
  const diffMs = end - start;
  if (diffMs < 0) return '0 phút';

  const diffMins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (hrs > 0) {
    return `${hrs} giờ ${mins} phút`;
  }
  return `${mins} phút`;
}

// ── Date and Time Format Helpers ──
function formatDatePart(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatTimePart(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

// ── Percentage Formatter ──
function formatPercent(val: number): string {
  return val % 1 === 0 ? val.toString() : val.toFixed(1);
}

export function StaffHistoryPage() {
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [searchPlate, setSearchPlate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<'ALL' | 'CAR' | 'MOTORBIKE'>('ALL');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'ALL' | 'MONTHLY' | 'CASUAL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PARKING' | 'COMPLETED' | 'BOOKED' | 'NO_SHOW'>('ALL');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchHistory = useCallback(async (plateVal?: string) => {
    setLoading(true);
    setError('');
    try {
      const url = plateVal ? `/checkin-out/history?plate=${encodeURIComponent(plateVal.toUpperCase())}` : '/checkin-out/history';
      const res = await api.get(url);
      setRecords(res.data.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không tải được lịch sử gửi xe');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(searchQuery);
  }, [searchQuery, fetchHistory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchPlate.trim());
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchPlate('');
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setVehicleTypeFilter('ALL');
    setCustomerTypeFilter('ALL');
    setStatusFilter('ALL');
    setCurrentPage(1);
    fetchHistory('');
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  // ── Frontend Filters Application ──
  const filteredRecords = records.filter((r) => {
    // 1. Exclude CANCELLED bookings from list and logic
    if (r.recordType === 'BOOKING' && r.status === 'CANCELLED') {
      return false;
    }

    // 2. Keyword Filter (plate, name, email client-side match check)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchPlate = r.plateNumber?.toLowerCase().includes(q);
      const matchName = r.driverName?.toLowerCase().includes(q);
      const matchEmail = r.driverEmail?.toLowerCase().includes(q);
      if (!matchPlate && !matchName && !matchEmail) {
        return false;
      }
    }

    // 3. Date range filter
    const dateStr = r.recordType === 'CHECKIN' ? r.timeIn : r.expectedArrival;
    if (dateStr) {
      const recordDate = new Date(dateStr);
      if (!Number.isNaN(recordDate.getTime())) {
        if (fromDate) {
          const start = new Date(fromDate);
          start.setHours(0, 0, 0, 0);
          if (recordDate < start) return false;
        }
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          if (recordDate > end) return false;
        }
      }
    }

    // 4. Vehicle Type filter
    if (vehicleTypeFilter !== 'ALL') {
      if (r.vehicleType !== vehicleTypeFilter) return false;
    }

    // 5. Customer Type filter
    if (customerTypeFilter !== 'ALL') {
      if (customerTypeFilter === 'MONTHLY' && !r.isMonthly) return false;
      if (customerTypeFilter === 'CASUAL' && r.isMonthly) return false;
    }

    // 6. Status filter (excluding CANCELLED)
    if (statusFilter !== 'ALL') {
      if (r.recordType === 'CHECKIN') {
        if (statusFilter === 'PARKING' && r.status !== 'PARKING') return false;
        if (statusFilter === 'COMPLETED' && r.status !== 'COMPLETED') return false;
        if (statusFilter === 'BOOKED' || statusFilter === 'NO_SHOW') return false;
      } else if (r.recordType === 'BOOKING') {
        if (statusFilter === 'BOOKED' && r.status !== 'ACTIVE') return false;
        if (statusFilter === 'NO_SHOW' && r.status !== 'NO_SHOW') return false;
        if (statusFilter === 'PARKING' || statusFilter === 'COMPLETED') return false;
      }
    }

    return true;
  });

  // ── KPI Calculations based on filtered list ──
  const activeSessionsCount = filteredRecords.filter(
    (r) => r.recordType === 'CHECKIN' && r.status === 'PARKING'
  ).length;

  const completedSessionsCount = filteredRecords.filter(
    (r) => r.recordType === 'CHECKIN' && r.status === 'COMPLETED'
  ).length;

  const totalParkingSessions = activeSessionsCount + completedSessionsCount;

  const activeSessionsPercentage =
    totalParkingSessions > 0 ? (activeSessionsCount / totalParkingSessions) * 100 : 0;

  const completedSessionsPercentage =
    totalParkingSessions > 0 ? (completedSessionsCount / totalParkingSessions) * 100 : 0;

  const bookingsInPeriodCount = filteredRecords.filter(
    (r) => r.recordType === 'BOOKING'
  ).length;

  // ── Pagination calculations ──
  const totalResults = filteredRecords.length;
  const totalPages = Math.ceil(totalResults / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalResults);
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  return (
    <div className={styles.container}>
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Lịch sử gửi xe và đặt chỗ</h1>
          <p className={styles.subtitle}>
            Xem toàn bộ lượt xe vào, rời bãi và thông tin đặt chỗ trước.
          </p>
        </div>
        <button
          onClick={() => fetchHistory(searchQuery)}
          disabled={loading}
          className={styles.btnRefresh}
        >
          <HistoryIcon size={16} />
          Làm mới
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className={styles.kpiGrid}>
        {/* KPI 1: Tổng lượt gửi xe */}
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Tổng lượt gửi xe</span>
          <div className={styles.kpiValueRow}>
            {loading ? (
              <div className={styles.skeletonLine} style={{ width: '80px', height: '28px' }} />
            ) : (
              <p className={styles.kpiValue}>{totalParkingSessions}</p>
            )}
          </div>
          <span className={styles.kpiSub}>= Đang đỗ + Đã rời bãi</span>
        </div>

        {/* KPI 2: Đang đỗ */}
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Đang đỗ</span>
          <div className={styles.kpiValueRow}>
            {loading ? (
              <div className={styles.skeletonLine} style={{ width: '80px', height: '28px' }} />
            ) : (
              <>
                <p className={styles.kpiValue}>{activeSessionsCount}</p>
                <span className={styles.kpiPercent}>
                  {formatPercent(activeSessionsPercentage)}%
                </span>
              </>
            )}
          </div>
          <span className={styles.kpiSub}>Số xe hiện có trong bãi</span>
        </div>

        {/* KPI 3: Đã rời bãi */}
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Đã rời bãi</span>
          <div className={styles.kpiValueRow}>
            {loading ? (
              <div className={styles.skeletonLine} style={{ width: '80px', height: '28px' }} />
            ) : (
              <>
                <p className={styles.kpiValue}>{completedSessionsCount}</p>
                <span className={styles.kpiPercent}>
                  {formatPercent(completedSessionsPercentage)}%
                </span>
              </>
            )}
          </div>
          <span className={styles.kpiSub}>Số xe đã rời bãi</span>
        </div>

        {/* KPI 4: Đặt chỗ trong kỳ */}
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Đặt chỗ trong kỳ</span>
          <div className={styles.kpiValueRow}>
            {loading ? (
              <div className={styles.skeletonLine} style={{ width: '80px', height: '28px' }} />
            ) : (
              <p className={styles.kpiValue}>{bookingsInPeriodCount}</p>
            )}
          </div>
          <span className={styles.kpiSub}>Chưa bao gồm lượt gửi xe</span>
        </div>
      </div>

      {/* ── Info Note ── */}
      <div className={styles.infoNote}>
        <InfoIcon size={18} />
        <span>Lưu ý: Tổng lượt gửi xe chỉ bao gồm các phiên gửi xe đang đỗ hoặc đã rời bãi.</span>
      </div>

      {/* ── Filter Area ── */}
      <div className={styles.filterCard}>
        <form onSubmit={handleSearchSubmit} className={styles.filterGrid}>
          {/* Keyword Search */}
          <div className={`${styles.filterGroup} ${styles.filterGroupKeyword}`}>
            <label htmlFor="searchKeyword" className={styles.filterLabel}>
              Tìm theo biển số, tài xế, email...
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <SearchIcon size={16} />
              </span>
              <input
                id="searchKeyword"
                type="text"
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value)}
                placeholder="Nhập từ khóa cần tìm..."
                className={styles.filterInput}
                style={{ paddingLeft: '32px' }}
                disabled={loading}
              />
            </div>
          </div>

          {/* Date range - Start Date */}
          <div className={styles.filterGroup}>
            <label htmlFor="startDate" className={styles.filterLabel}>
              Từ ngày
            </label>
            <input
              id="startDate"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
              className={styles.filterInput}
              disabled={loading}
            />
          </div>

          {/* Date range - End Date */}
          <div className={styles.filterGroup}>
            <label htmlFor="endDate" className={styles.filterLabel}>
              Đến ngày
            </label>
            <input
              id="endDate"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setCurrentPage(1);
              }}
              className={styles.filterInput}
              disabled={loading}
            />
          </div>

          {/* Vehicle Type */}
          <div className={styles.filterGroup}>
            <label htmlFor="vehicleType" className={styles.filterLabel}>
              Loại xe
            </label>
            <select
              id="vehicleType"
              value={vehicleTypeFilter}
              onChange={(e) => {
                setVehicleTypeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className={styles.filterSelect}
              disabled={loading}
            >
              <option value="ALL">Tất cả loại xe</option>
              <option value="CAR">Ô tô</option>
              <option value="MOTORBIKE">Xe máy</option>
            </select>
          </div>

          {/* Customer Type */}
          <div className={styles.filterGroup}>
            <label htmlFor="customerType" className={styles.filterLabel}>
              Loại khách
            </label>
            <select
              id="customerType"
              value={customerTypeFilter}
              onChange={(e) => {
                setCustomerTypeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className={styles.filterSelect}
              disabled={loading}
            >
              <option value="ALL">Tất cả loại khách</option>
              <option value="MONTHLY">Cư dân</option>
              <option value="CASUAL">Khách thường</option>
            </select>
          </div>

          {/* Status */}
          <div className={styles.filterGroup}>
            <label htmlFor="status" className={styles.filterLabel}>
              Trạng thái
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className={styles.filterSelect}
              disabled={loading}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PARKING">Đang đỗ</option>
              <option value="COMPLETED">Đã rời bãi</option>
              <option value="BOOKED">Đã đặt chỗ</option>
              <option value="NO_SHOW">Không đến</option>
            </select>
          </div>

          {/* Filter Actions */}
          <div className={styles.filterActions}>
            <button
              type="submit"
              disabled={loading}
              className={styles.btnSubmit}
            >
              Tìm kiếm
            </button>
            {(searchPlate || searchQuery || fromDate || toDate || vehicleTypeFilter !== 'ALL' || customerTypeFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={handleClearSearch}
                className={styles.btnReset}
                disabled={loading}
              >
                Xóa lọc
              </button>
            )}
          </div>
        </form>
        <span className={styles.filterSupportText}>
          Áp dụng cho KPI và danh sách bên dưới
        </span>
      </div>

      {/* ── Table Card ── */}
      <div className={styles.tableCard}>
        {loading ? (
          /* Shimmering Loading Skeleton */
          <>
            <div className={styles.tableHeader}>
              <div className={styles.skeletonLine} style={{ width: '150px', height: '18px' }} />
              <div className={styles.skeletonLine} style={{ width: '200px', height: '16px' }} />
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {['Loại bản ghi', 'Biển số', 'Loại khách', 'Tài xế', 'Loại xe', 'Vị trí', 'Thời gian vào / Hẹn', 'Thời gian ra', 'Thời lượng', 'Số tiền', 'Trạng thái'].map((h, i) => (
                      <th key={i} className={styles.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, rIdx) => (
                    <tr key={rIdx} className={styles.tr}>
                      {Array.from({ length: 11 }).map((_, cIdx) => (
                        <td key={cIdx} className={styles.td}>
                          <div className={styles.skeletonLine} style={{ width: cIdx === 3 ? '120px' : '60px', height: '14px' }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : error ? (
          /* Error State */
          <div className={styles.stateContainer}>
            <p className={`${styles.stateTitle} ${styles.errorText}`}>Lỗi tải dữ liệu</p>
            <p className={styles.stateDesc}>{error}</p>
          </div>
        ) : records.length === 0 ? (
          /* No History at all State */
          <div className={styles.stateContainer}>
            <svg
              className={styles.stateIcon}
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <h3 className={styles.stateTitle}>Chưa có lịch sử gửi xe hoặc đặt chỗ.</h3>
          </div>
        ) : filteredRecords.length === 0 ? (
          /* No Filtered Results State */
          <div className={styles.stateContainer}>
            <svg
              className={styles.stateIcon}
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <h3 className={styles.stateTitle}>Không tìm thấy dữ liệu phù hợp.</h3>
            <p className={styles.stateDesc}>Hãy thử thay đổi từ khóa hoặc bộ lọc.</p>
          </div>
        ) : (
          /* Actual History Data Table */
          <>
            <div className={styles.tableHeader}>
              <h2 className={styles.tableTitle}>Danh sách lịch sử gửi xe và Đặt chỗ</h2>
              <span className={styles.tableCount}>
                Hiển thị {startIndex + 1}–{endIndex} trong {totalResults} kết quả
              </span>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={`${styles.th} ${styles.colRecordType}`}>LOẠI BẢN GHI</th>
                    <th className={styles.th}>BIỂN SỐ</th>
                    <th className={styles.th}>LOẠI KHÁCH</th>
                    <th className={styles.th}>TÀI XẾ</th>
                    <th className={styles.th}>LOẠI XE</th>
                    <th className={styles.th}>TẦNG / VỊ TRÍ</th>
                    <th className={styles.th}>THỜI GIAN VÀO / HẸN</th>
                    <th className={styles.th}>THỜI GIAN RA</th>
                    <th className={styles.th}>THỜI LƯỢNG</th>
                    <th className={styles.th}>SỐ TIỀN</th>
                    <th className={styles.th}>TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((r) => {
                    const isBooking = r.recordType === 'BOOKING';
                    const isCar = r.vehicleType === 'CAR';
                    const dateStr = isBooking ? r.expectedArrival : r.timeIn;

                    // ── Trạng thái Badges mapping ──
                    let statusElement = null;
                    if (isBooking) {
                      if (r.status === 'ACTIVE') {
                        statusElement = (
                          <span className={`${styles.statusBadge} ${styles.statusBooked}`}>
                            <span className={`${styles.dot} ${styles.dotBooked}`} />
                            Đã đặt chỗ
                          </span>
                        );
                      } else {
                        statusElement = (
                          <div className={styles.statusNoShowText}>
                            <span className={`${styles.statusBadge} ${styles.statusNoShow}`}>
                              <span className={`${styles.dot} ${styles.dotNoShow}`} />
                              Không đến
                            </span>
                            <span className={styles.noShowSupport}>Quá thời gian</span>
                          </div>
                        );
                      }
                    } else {
                      if (r.status === 'PARKING') {
                        statusElement = (
                          <span className={`${styles.statusBadge} ${styles.statusParking}`}>
                            <span className={`${styles.dot} ${styles.dotParking}`} />
                            Đang đỗ
                          </span>
                        );
                      } else {
                        statusElement = (
                          <span className={`${styles.statusBadge} ${styles.statusCompleted}`}>
                            <span className={`${styles.dot} ${styles.dotCompleted}`} />
                            Đã rời bãi
                          </span>
                        );
                      }
                    }

                    // ── SỐ TIỀN mapping ──
                    let amountElement = null;
                    if (isBooking) {
                      if (r.amount > 0) {
                        amountElement = (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{formatCurrency(r.amount)}</span>
                            <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 500 }}>
                              Tiền cọc
                            </span>
                          </div>
                        );
                      } else {
                        amountElement = <span>—</span>;
                      }
                    } else {
                      if (r.isMonthly) {
                        amountElement = (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>—</span>
                            <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 500 }}>
                              (Gói tháng)
                            </span>
                          </div>
                        );
                      } else {
                        amountElement = <span>{formatCurrency(r.amount)}</span>;
                      }
                    }

                    return (
                      <tr key={`${r.recordType}-${r.id}`} className={styles.tr}>
                        {/* 1. LOẠI BẢN GHI */}
                        <td className={`${styles.td} ${styles.colRecordType}`}>
                          {isBooking ? (
                            <span className={`${styles.badgeRecordType} ${styles.badgeRecordBooking}`}>
                              <CalendarIcon size={14} />
                              Đặt chỗ
                            </span>
                          ) : (
                            <span className={`${styles.badgeRecordType} ${styles.badgeRecordParking}`}>
                              <ParkingIcon size={14} />
                              Lượt gửi xe
                            </span>
                          )}
                        </td>

                        {/* 2. BIỂN SỐ */}
                        <td className={`${styles.td} ${styles.colPlate}`}>
                          <span className={styles.plateBadge}>
                            {formatPlateNumber(r.plateNumber)}
                          </span>
                        </td>

                        {/* 3. LOẠI KHÁCH */}
                        <td className={styles.td}>
                          {r.isMonthly ? (
                            <span className={`${styles.badgeCustomerType} ${styles.badgeMonthly}`}>
                              Cư dân (Gói tháng)
                            </span>
                          ) : (
                            <span className={`${styles.badgeCustomerType} ${styles.badgeCasual}`}>
                              Khách thường (Vé lượt)
                            </span>
                          )}
                        </td>

                        {/* 4. TÀI XẾ */}
                        <td className={styles.td}>
                          {r.driverEmail === 'walkin@system.local' || !r.driverName ? (
                            <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>
                              Khách vãng lai
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 700, color: '#1E3A5F' }}>
                                {r.driverName}
                              </span>
                              <span className={styles.driverEmail}>
                                {r.driverEmail}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 5. LOẠI XE */}
                        <td className={`${styles.td} ${styles.colType}`}>
                          {isCar ? (
                            <span className={`${styles.badgeVehicleType} ${styles.badgeCar}`}>
                              🚗 Ô tô
                            </span>
                          ) : (
                            <span className={`${styles.badgeVehicleType} ${styles.badgeMotorbike}`}>
                              🛵 Xe máy
                            </span>
                          )}
                        </td>

                        {/* 6. TẦNG / VỊ TRÍ */}
                        <td className={`${styles.td} ${styles.colLocation}`}>{r.slotCode}</td>

                        {/* 7. THỜI GIAN VÀO / HẸN */}
                        <td className={styles.td}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600 }}>{formatDatePart(dateStr)}</span>
                            <span style={{ fontSize: '11px', color: '#64748B' }}>
                              {formatTimePart(dateStr)}
                            </span>
                            {isBooking && (
                              <span style={{ fontSize: '10px', color: '#7E22CE', fontWeight: 600 }}>
                                (Hẹn đến)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 8. THỜI GIAN RA */}
                        <td className={styles.td}>
                          {isBooking || !r.timeOut ? (
                            <span>—</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 500 }}>{formatDatePart(r.timeOut)}</span>
                              <span style={{ fontSize: '11px', color: '#64748B' }}>
                                {formatTimePart(r.timeOut)}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 9. THỜI LƯỢNG */}
                        <td className={styles.td}>
                          {isBooking || !r.timeIn ? (
                            <span>—</span>
                          ) : (
                            formatDuration(r.timeIn, r.timeOut)
                          )}
                        </td>

                        {/* 10. SỐ TIỀN */}
                        <td className={`${styles.td} ${styles.colAmount}`}>{amountElement}</td>

                        {/* 11. TRẠNG THÁI */}
                        <td className={`${styles.td} ${styles.colStatus}`}>{statusElement}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Table Legend ── */}
            <div className={styles.legend}>
              <div className={styles.legendItem}>
                <span className={`${styles.statusBadge} ${styles.statusParking}`}>
                  <span className={`${styles.dot} ${styles.dotParking}`} />
                  Đang đỗ
                </span>
                <span className={styles.legendDesc}>Xe đang trong bãi</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.statusBadge} ${styles.statusCompleted}`}>
                  <span className={`${styles.dot} ${styles.dotCompleted}`} />
                  Đã rời bãi
                </span>
                <span className={styles.legendDesc}>Xe đã ra khỏi bãi</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.statusBadge} ${styles.statusBooked}`}>
                  <span className={`${styles.dot} ${styles.dotBooked}`} />
                  Đã đặt chỗ
                </span>
                <span className={styles.legendDesc}>Chỗ đã được đặt trước</span>
              </div>
              <div className={styles.legendItem}>
                <span className={`${styles.statusBadge} ${styles.statusNoShow}`}>
                  <span className={`${styles.dot} ${styles.dotNoShow}`} />
                  Không đến
                </span>
                <span className={styles.legendDesc}>Quá thời gian giữ chỗ</span>
              </div>
            </div>

            {/* ── Pagination controls ── */}
            <div className={styles.pagination}>
              {/* Page size selector */}
              <div className={styles.pageSizeContainer}>
                <span>Hiển thị</span>
                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className={styles.selectPageSize}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>dòng mỗi trang</span>
              </div>

              {/* Page navigation buttons */}
              <div className={styles.paginationControls}>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className={styles.paginationBtn}
                  title="Trang trước"
                >
                  &larr;
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`${styles.pageNumber} ${currentPage === page ? styles.pageNumberActive : ''}`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={styles.paginationBtn}
                  title="Trang sau"
                >
                  &rarr;
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default StaffHistoryPage;
