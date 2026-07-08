import { useEffect, useState } from 'react';
import api from '../services/api';
import styles from '../styles/history.module.css';

interface HistoryEntry {
  id: string;
  plateNumber?: string;
  licensePlate?: string;
  vehiclePlate?: string;
  vehicle?: {
    licensePlate: string;
  };
  slotCode?: string;
  slot?: {
    code: string;
  };
  parkingSlot?: {
    code: string;
  };
  date?: string;
  entryTime?: string;
  createdAt?: string;
  duration?: string;
  parkingDuration?: string;
  amount?: number;
  totalPrice?: number;
  price?: number;
  status?: string;
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

// Map backend statuses to Vietnamese UI labels
const getStatusLabel = (status?: string) => {
  switch ((status || '').toUpperCase()) {
    case 'COMPLETED':
    case 'PAID':
    case 'DONE':
      return 'Hoàn thành';
    case 'ACTIVE':
    case 'IN_PROGRESS':
    case 'PARKING':
      return 'Đang gửi';
    case 'CANCELLED':
    case 'CANCELED':
      return 'Đã hủy';
    default:
      return 'Hoàn thành';
  }
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

  // Selected entry for details modal
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);

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
    return record.plateNumber || record.licensePlate || record.vehicle?.licensePlate || record.vehiclePlate || '-';
  };

  const getSlotCode = (record: HistoryEntry) => {
    return record.slotCode || record.slot?.code || record.parkingSlot?.code || '-';
  };

  const getDate = (record: HistoryEntry) => {
    return record.entryTime || record.createdAt || record.date || '';
  };

  const getDuration = (record: HistoryEntry) => {
    return record.duration || record.parkingDuration || '-';
  };

  const getAmount = (record: HistoryEntry) => {
    return record.amount ?? record.totalPrice ?? record.price ?? 0;
  };

  const getStatus = (record: HistoryEntry) => {
    return record.status || 'COMPLETED';
  };

  // Compute summary stats from ALL loaded records (before search filters)
  const totalRecords = history?.length ?? 0;
  const totalCost = history?.reduce((acc, curr) => acc + getAmount(curr), 0) ?? 0;
  const completedCount = history?.filter(r => {
    const lbl = getStatusLabel(getStatus(r));
    return lbl === 'Hoàn thành';
  }).length ?? 0;
  const activeCount = history?.filter(r => {
    const lbl = getStatusLabel(getStatus(r));
    return lbl === 'Đang gửi';
  }).length ?? 0;

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
      const mappedLabel = getStatusLabel(getStatus(record));
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
          <div className={`${styles.cardIconContainer} ${styles.iconBlue}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
              <circle cx="7" cy="17" r="2" />
              <path d="M9 17h6" />
              <circle cx="17" cy="17" r="2" />
            </svg>
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
            <span className={styles.cardLabel}>Tổng chi phí</span>
            <p className={styles.cardValue}>{formatCurrency(totalCost)}</p>
          </div>
        </div>

        {/* Card 3: Hoàn thành */}
        <div className={styles.summaryCard}>
          <div className={`${styles.cardIconContainer} ${styles.iconBlue}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
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
            <label htmlFor="searchPlate">Biển số</label>
            <input
              id="searchPlate"
              type="text"
              className={styles.input}
              placeholder="Tìm biển số..."
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="fromDate">Từ ngày</label>
            <input
              id="fromDate"
              type="date"
              className={styles.input}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="toDate">Đến ngày</label>
            <input
              id="toDate"
              type="date"
              className={styles.input}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="statusFilter">Trạng thái</label>
            <select
              id="statusFilter"
              className={styles.select}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="Hoàn thành">Hoàn thành</option>
              <option value="Đang gửi">Đang gửi</option>
              <option value="Đã hủy">Đã hủy</option>
            </select>
          </div>

          <div className={styles.btnGroup}>
            <button type="button" className={styles.btnReset} onClick={handleReset}>Đặt lại</button>
            <button type="button" className={styles.btnFilter} onClick={handleFilter}>Lọc</button>
          </div>
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
                    <th>MÃ CHỖ</th>
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
                    const slot = getSlotCode(entry);
                    const date = getDate(entry);
                    const duration = getDuration(entry);
                    const amount = getAmount(entry);
                    const rawStatus = getStatus(entry);
                    const statusLabel = getStatusLabel(rawStatus);

                    let statusClass = styles.statusCompleted;
                    if (statusLabel === 'Đang gửi') {
                      statusClass = styles.statusActive;
                    } else if (statusLabel === 'Đã hủy') {
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
                        <td style={{ fontWeight: 700, color: '#0F172A' }}>{formatCurrency(amount)}</td>
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
                <span className={styles.modalLabel}>Mã chỗ đỗ</span>
                <span className={styles.modalValue}>{getSlotCode(selectedEntry)}</span>
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
                <span className={styles.modalLabel}>Tổng chi phí</span>
                <span className={styles.modalValue} style={{ color: '#1E3A5F', fontWeight: 700 }}>
                  {formatCurrency(getAmount(selectedEntry))}
                </span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalLabel}>Trạng thái</span>
                <span className={styles.modalValue}>
                  <span className={`${styles.statusBadge} ${
                    getStatusLabel(getStatus(selectedEntry)) === 'Đang gửi'
                      ? styles.statusActive
                      : getStatusLabel(getStatus(selectedEntry)) === 'Đã hủy'
                      ? styles.statusCancelled
                      : styles.statusCompleted
                  }`}>
                    {getStatusLabel(getStatus(selectedEntry))}
                  </span>
                </span>
              </div>

              <div className={`${styles.modalField} ${styles.modalFieldFull}`}>
                <span className={styles.modalLabel}>Mã giao dịch</span>
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
