import { useEffect, useState } from 'react';
import api from '../services/api';
import styles from '../styles/history.module.css';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { formatPlateNumber } from '../utils/plate';

interface HistoryEntry {
  id: string;
  recordType?: 'CHECKIN' | 'BOOKING' | 'PARKING_SESSION';
  plateNumber?: string;
  licensePlate?: string;
  vehiclePlate?: string;
  vehicle?: {
    licensePlate: string;
  };
  slotCode?: string | null;
  floor?: string | null;
  slot?: {
    code: string;
  };
  parkingSlot?: {
    code: string;
  };
  floorId?: number;
  floorName?: string | null;
  parkingArea?: string | null;
  date?: string;
  entryTime?: string;
  createdAt?: string;
  /** Exact duration in minutes from the backend (preferred over pre-formatted string). */
  durationMinutes?: number;
  duration?: string;
  parkingDuration?: string;
  amount?: number;
  totalPrice?: number;
  price?: number;
  status?: string;
  /** amountType distinguishes provisional (active) from final (completed) amounts */
  amountType?: 'PROVISIONAL' | 'FINAL';
  vehicleType?: 'CAR' | 'MOTORBIKE';
}

// Vietnamese date formatting
const formatDateTime = (value?: string | Date) => {
  if (!value) return '-';
  try {
    const dateObj = new Date(value);
    if (isNaN(dateObj.getTime())) return '-';

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj);
  } catch {
    return '-';
  }
};

// Vietnamese currency formatting
const formatCurrency = (value?: number) => {
  return new Intl.NumberFormat('vi-VN').format(value || 0) + ' đ';
};

/**
 * Format an exact duration in minutes as a human-readable Vietnamese string.
 * Examples: 35 → "35 phút"; 60 → "1 giờ"; 266 → "4 giờ 26 phút"; 0 → "0 phút"
 */
const formatDurationMinutes = (minutes?: number): string => {
  if (minutes == null || minutes < 0) return '0 phút';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
};

export const isCompletedParkingStatus = (status?: string): boolean => {
  const s = (status || '').toUpperCase();
  return ['COMPLETED', 'PAID', 'DONE'].includes(s);
};

export const isActiveParkingStatus = (status?: string): boolean => {
  const s = (status || '').toUpperCase();
  return ['PARKING', 'IN_PROGRESS', 'ACTIVE'].includes(s);
};

export const getHistoryStatusLabel = (
  status?: string,
  recordType?: 'CHECKIN' | 'BOOKING' | 'PARKING_SESSION'
): string => {
  const s = (status || '').toUpperCase();

  if (recordType === 'BOOKING') {
    switch (s) {
      case 'PENDING_PAYMENT':
        return 'Chờ thanh toán';
      case 'ACTIVE':
        return 'Đang chờ xe vào';
      case 'FULFILLED':
        return 'Đã check-in';
      case 'CANCELLED':
      case 'CANCELED':
        return 'Đã hủy';
      case 'NO_SHOW':
        return 'Không đến';
      default:
        return 'Không xác định';
    }
  }

  if (isCompletedParkingStatus(status)) {
    return 'Hoàn thành';
  }
  if (isActiveParkingStatus(status)) {
    return 'Đang gửi xe';
  }
  if (s === 'AWAITING_PAYMENT') {
    return 'Chờ thanh toán';
  }
  return 'Không xác định';
};

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[] | undefined>(undefined);
  const [error, setError] = useState('');

  // Local filter states
  const [searchPlate, setSearchPlate] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Active filter values that trigger search
  const [activeFilters, setActiveFilters] = useState({
    searchPlate: '',
    fromDate: '',
    toDate: '',
    statusFilter: '',
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);

  const load = async () => {
    try {
      const res = await api.get('/driver-dashboard/history');
      setHistory(res.data.data ?? []);
    } catch {
      setHistory([]);
      setError('Không thể tải lịch sử. Vui lòng thử lại.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  useRefreshOnFocus({ enabled: true, onRefresh: load });

  // Filter application
  const handleFilter = () => {
    setActiveFilters({
      searchPlate,
      fromDate,
      toDate,
      statusFilter,
    });
    setCurrentPage(1);
  };

  // Filter reset
  const handleReset = () => {
    setSearchPlate('');
    setFromDate('');
    setToDate('');
    setStatusFilter('');
    setActiveFilters({
      searchPlate: '',
      fromDate: '',
      toDate: '',
      statusFilter: '',
    });
    setCurrentPage(1);
  };

  // Safe data extraction helpers for a record
  const getPlate = (record: HistoryEntry) => {
    const raw = record.plateNumber || record.licensePlate || record.vehicle?.licensePlate || record.vehiclePlate || '';
    if (!raw) return '-';
    // Use the shared formatter: vehicleType is optional here — the formatter infers CAR pattern
    return formatPlateNumber(raw, undefined, record.vehicleType) || raw;
  };

  const getLocationLabel = (record: HistoryEntry): string => {
    // Prefer the backend-provided floor name + slotCode combination.
    const floorLabel = record.floor ?? record.floorName ?? record.parkingArea ?? null;
    const slotLabel = record.slotCode || record.slot?.code || record.parkingSlot?.code || 'Không cố định';
    if (floorLabel) return `${floorLabel} · ${slotLabel}`;
    return slotLabel || 'Chưa xác định';
  };

  const getDate = (record: HistoryEntry) => {
    return record.entryTime || record.createdAt || record.date || '';
  };

  const getDuration = (record: HistoryEntry) => {
    // Prefer exact backend-provided durationMinutes over pre-formatted string
    if (record.durationMinutes != null) return formatDurationMinutes(record.durationMinutes);
    return record.duration || record.parkingDuration || '-';
  };

  const getAmount = (record: HistoryEntry) => {
    return record.amount ?? record.totalPrice ?? record.price ?? 0;
  };

  const getStatus = (record: HistoryEntry) => {
    return record.status || 'COMPLETED';
  };

  const selectedStatusLabel = selectedEntry
    ? getHistoryStatusLabel(
        getStatus(selectedEntry),
        selectedEntry.recordType
      )
    : 'Không xác định';

  let selectedStatusClass = styles.statusUnknown;
  if (selectedStatusLabel === 'Đang gửi xe') {
    selectedStatusClass = styles.statusActive;
  } else if (selectedStatusLabel === 'Đang chờ xe vào' || selectedStatusLabel === 'Chờ thanh toán') {
    selectedStatusClass = styles.statusPending;
  } else if (selectedStatusLabel === 'Đã hủy' || selectedStatusLabel === 'Không đến') {
    selectedStatusClass = styles.statusCancelled;
  } else if (selectedStatusLabel === 'Hoàn thành') {
    selectedStatusClass = styles.statusCompleted;
  }

  // Compute summary stats from ALL loaded records (before search filters)
  const parkingSessions = (history ?? []).filter(r => r.recordType === 'PARKING_SESSION');
  const completedParkingSessions = parkingSessions.filter(r => isCompletedParkingStatus(r.status));

  const totalRecords = parkingSessions.length;
  const totalCost = completedParkingSessions.reduce((acc, curr) => acc + getAmount(curr), 0);
  const completedCount = completedParkingSessions.length;
  const activeCount = parkingSessions.filter(r => isActiveParkingStatus(r.status)).length;

  // Filtered dataset
  const filteredHistory = (history ?? []).filter((record) => {
    // 1. License plate filter
    if (activeFilters.searchPlate) {
      const plate = getPlate(record).toLowerCase();
      if (!plate.includes(activeFilters.searchPlate.toLowerCase())) {
        return false;
      }
    }

    // 2. Status filter
    if (activeFilters.statusFilter) {
      const mappedLabel = getHistoryStatusLabel(getStatus(record), record.recordType);
      if (mappedLabel !== activeFilters.statusFilter) {
        return false;
      }
    }

    // 3. Date range filter
    const recordDateStr = getDate(record);
    if (recordDateStr) {
      const recordDate = new Date(recordDateStr);
      if (!isNaN(recordDate.getTime())) {
        if (activeFilters.fromDate) {
          const from = new Date(activeFilters.fromDate);
          from.setHours(0, 0, 0, 0);
          if (recordDate < from) return false;
        }
        if (activeFilters.toDate) {
          const to = new Date(activeFilters.toDate);
          to.setHours(23, 59, 59, 999);
          if (recordDate > to) return false;
        }
      }
    }

    return true;
  });

  // Pagination calculation
  const totalFilteredCount = filteredHistory.length;
  const totalPages = Math.ceil(totalFilteredCount / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedHistory = filteredHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className={styles.container}>
      {/* 1. Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Lịch sử gửi xe</h1>
        <p className={styles.subtitle}>Theo dõi toàn bộ lịch sử gửi xe, thời gian đỗ và chi phí của bạn.</p>
      </div>

      {/* 2. Summary Cards Row */}
      <div className={styles.cardsGrid}>
        {/* Card 1: Tổng lượt gửi */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryVehicleIconCircle}>
            <img
              src="/oto.png"
              alt=""
              aria-hidden="true"
              className={styles.summaryVehicleIconImage}
            />
          </div>
          <div className={styles.cardMeta}>
            <span className={styles.cardLabel}>Tổng lượt gửi</span>
            <p className={styles.cardValue}>{totalRecords}</p>
          </div>
        </div>

        {/* Card 2: Tổng chi phí */}
        <div className={styles.summaryCard}>
          <div className={`${styles.cardIconContainer} ${styles.iconBlue}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" x2="22" y1="10" y2="10" />
            </svg>
          </div>
          <div className={styles.cardMeta}>
            <span className={styles.cardLabel}>Đã thanh toán</span>
            <p className={styles.cardValue}>{formatCurrency(totalCost)}</p>
          </div>
        </div>

        {/* Card 3: Hoàn thành */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryIconCompleted}>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div className={styles.cardMeta}>
            <span className={styles.cardLabel}>Hoàn thành</span>
            <p className={styles.cardValue}>{completedCount}</p>
          </div>
        </div>

        {/* Card 4: Đang gửi */}
        <div className={styles.summaryCard}>
          <div className={`${styles.cardIconContainer} ${styles.iconGreen}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className={styles.cardMeta}>
            <span className={styles.cardLabel}>Đang gửi</span>
            <p className={styles.cardValue}>{activeCount}</p>
          </div>
        </div>
      </div>

      {/* 3. Filter Toolbar */}
      <div className={styles.filterCard}>
        <div className={styles.filterGrid}>
          <div className={styles.filterGroup}>
            <label htmlFor="searchPlate" className={styles.filterLabel}>Biển số</label>
            <input
              id="searchPlate"
              type="text"
              className={styles.filterInput}
              placeholder="Tìm biển số..."
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="fromDate" className={styles.filterLabel}>Từ ngày</label>
            <input
              id="fromDate"
              type="date"
              className={styles.filterInput}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="toDate" className={styles.filterLabel}>Đến ngày</label>
            <input
              id="toDate"
              type="date"
              className={styles.filterInput}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="statusFilter" className={styles.filterLabel}>Trạng thái</label>
            <select
              id="statusFilter"
              className={styles.filterSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="Hoàn thành">Hoàn thành</option>
              <option value="Đang gửi">Đang gửi</option>
              <option value="Đã hủy">Đã hủy</option>
            </select>
          </div>

          <button type="button" className={styles.resetButton} onClick={handleReset}>Đặt lại</button>
          <button type="button" className={styles.filterButton} onClick={handleFilter}>Lọc</button>
        </div>
      </div>

      {/* 4. History Table Card */}
      <div className={styles.tableCard}>
        {history === undefined ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8" />
              </svg>
            </div>
            <p className={styles.emptyStateTitle}>Đang tải dữ liệu...</p>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateTitle} style={{ color: '#EF4444' }}>Đã xảy ra lỗi</p>
            <p className={styles.emptyStateDesc}>{error}</p>
          </div>
        ) : totalFilteredCount > 0 ? (
          <>
            <div className={styles.tableHeader}>
              <h2 className={styles.tableTitle}>Danh sách lịch sử</h2>
              <span className={styles.tableCount}>
                Hiển thị {startIndex + 1} - {Math.min(startIndex + ITEMS_PER_PAGE, totalFilteredCount)} / {totalFilteredCount} bản ghi
              </span>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>BIỂN SỐ</th>
                    <th>TẦNG / KHU VỰC</th>
                    <th>NGÀY VÀO</th>
                    <th>THỜI GIAN</th>
                    <th>SỐ TIỀN</th>
                    <th>TRẠNG THÁI</th>
                    <th style={{ textAlign: 'center' }}>CHI TIẾT</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((entry) => {
                    const plate = getPlate(entry);
                    const slot = getLocationLabel(entry);
                    const date = getDate(entry);
                    const duration = getDuration(entry);
                    const amount = getAmount(entry);
                    const rawStatus = getStatus(entry);
                    const statusLabel = getHistoryStatusLabel(rawStatus, entry.recordType);

                    let statusClass = styles.statusCompleted;
                    if (statusLabel === 'Đang gửi' || statusLabel === 'Đang gửi xe' || statusLabel === 'Đang chờ xe vào') {
                      statusClass = styles.statusActive;
                    } else if (statusLabel === 'Đã hủy' || statusLabel === 'Không đến' || statusLabel === 'Không xác định') {
                      statusClass = styles.statusCancelled;
                    }

                    return (
                      <tr key={entry.id} className={styles.tableRow}>
                        <td>
                          <span className={styles.plateBadge}>{plate}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{slot}</td>
                        <td>{formatDateTime(date)}</td>
                        <td>{duration}</td>
                        <td style={{ fontWeight: 700, color: '#0F172A' }}>
                          {entry.amountType === 'PROVISIONAL'
                            ? `Tạm tính ${formatCurrency(amount)}`
                            : formatCurrency(amount)}
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className={styles.btnDetail}
                            onClick={() => setSelectedEntry(entry)}
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 6. Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  type="button"
                  className={styles.paginationBtn}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Trước
                </button>
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`${styles.pageNumber} ${currentPage === page ? styles.pageNumberActive : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  className={styles.paginationBtn}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Sau
                </button>
              </div>
            )}
          </>
        ) : (
          /* 7. Empty State */
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="8" height="4" x="8" y="2" rx="1" />
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <path d="m9 14 2 2 4-4" />
              </svg>
            </div>
            <h3 className={styles.emptyStateTitle}>Chưa có lịch sử gửi xe</h3>
            <p className={styles.emptyStateDesc}>Khi bạn đặt chỗ hoặc gửi xe, thông tin sẽ được hiển thị tại đây.</p>
          </div>
        )}
      </div>

      {/* 5. Detail Modal Popup */}
      {selectedEntry && (
        <div className={styles.modalOverlay} onClick={() => setSelectedEntry(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Chi tiết lượt gửi xe</h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setSelectedEntry(null)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className={styles.modalGrid}>
              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Biển số xe</span>
                <span className={styles.modalValue}>
                  <span className={styles.plateBadge}>{getPlate(selectedEntry)}</span>
                </span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Vị trí</span>
                <span className={styles.modalValue}>{getLocationLabel(selectedEntry)}</span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Thời gian vào</span>
                <span className={styles.modalValue}>{formatDateTime(getDate(selectedEntry))}</span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Thời gian đỗ</span>
                <span className={styles.modalValue}>{getDuration(selectedEntry)}</span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>
                  {selectedEntry.amountType === 'PROVISIONAL' ? 'Phí tạm tính' : 'Tổng chi phí'}
                </span>
                <span className={styles.modalValue} style={{ color: '#1E3A5F', fontWeight: 700 }}>
                  {formatCurrency(getAmount(selectedEntry))}
                </span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Trạng thái</span>
                <span className={styles.modalValue}>
                  <span className={`${styles.statusBadge} ${selectedStatusClass}`}>
                    {selectedStatusLabel}
                  </span>
                </span>
              </div>

              <div className={`${styles.modalField} ${styles.modalFieldFull}`}>
                <span className={styles.modalLabel}>Mã lượt gửi</span>
                <span className={styles.modalValue} style={{ fontFamily: 'monospace', color: '#64748B', fontSize: '0.85rem' }}>
                  {selectedEntry.id}
                </span>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnModalClose}
                onClick={() => setSelectedEntry(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
