import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportService } from '../services/report.service';
import { floorMapService } from '../services/floorMap.service';
import styles from '../styles/report.module.css';

// ── Inline Premium SVG Icons ──
interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const RefreshIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
  </svg>
);

const DownloadIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

const UserRoundIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <circle cx="12" cy="8" r="5" />
    <path d="M20 21a8 8 0 0 0-16 0" />
  </svg>
);

const SunIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const CalendarClockIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
    <path d="M16 2v4" />
    <path d="M8 2v4" />
    <path d="M3 10h18" />
    <path d="M16 14v2l2 2" />
    <circle cx="16" cy="16" r="6" />
  </svg>
);

const CalendarIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ClockIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const BoxIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const CheckSquareIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const ArrowRightIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const ArrowLeftIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const AlertTriangleIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CreditCardIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const ShieldCheckIcon = ({ size = 16, className, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

// ── Currency Formatter ──
function formatCurrency(amount: number | string | undefined): string {
  if (amount === undefined) return '0đ';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('vi-VN').format(num) + 'đ';
}

// ── Vietnamese day of week helper ──
function getVietnameseDayOfWeek(date: Date): string {
  const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  return days[date.getDay()];
}

export function ReportPage() {
  const { user } = useAuth();
  const [occupancy, setOccupancy] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [floors, setFloors] = useState<any[]>([]);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);

  // Shift selection filters
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedShift, setSelectedShift] = useState(() => {
    const h = new Date().getHours();
    if (h >= 6 && h < 14) return 'MORNING';
    if (h >= 14 && h < 22) return 'AFTERNOON';
    return 'NIGHT';
  });

  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Handover note state
  const [note, setNote] = useState(() => {
    return localStorage.getItem('shift_handover_note') || 
      'Mọi hoạt động trong ca diễn ra bình thường. Thiết bị hoạt động ổn định. Bàn giao ca trực tiếp cho nhân viên ca sau đầy đủ.';
  });
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [tempNote, setTempNote] = useState(note);

  // Derive shift details
  const getShiftDetails = (shiftVal: string) => {
    switch (shiftVal) {
      case 'MORNING':
        return { label: 'Ca sáng', time: '06:00 – 14:00', icon: <SunIcon size={16} /> };
      case 'AFTERNOON':
        return { label: 'Ca chiều', time: '14:00 – 22:00', icon: <CalendarClockIcon size={16} /> };
      case 'NIGHT':
      default:
        return { label: 'Ca đêm', time: '22:00 – 06:00', icon: <MoonIcon size={16} /> };
    }
  };

  const shiftInfo = getShiftDetails(selectedShift);

  // Calculate shift start/end times
  const getShiftRange = useCallback((dateStr: string, shiftVal: string) => {
    const baseDate = new Date(dateStr);
    const start = new Date(baseDate);
    const end = new Date(baseDate);

    if (shiftVal === 'MORNING') {
      start.setHours(6, 0, 0, 0);
      end.setHours(14, 0, 0, 0);
    } else if (shiftVal === 'AFTERNOON') {
      start.setHours(14, 0, 0, 0);
      end.setHours(22, 0, 0, 0);
    } else {
      start.setHours(22, 0, 0, 0);
      end.setDate(end.getDate() + 1);
      end.setHours(6, 0, 0, 0);
    }
    return { start, end };
  }, []);

  const isShiftActive = useCallback(() => {
    const { end } = getShiftRange(selectedDate, selectedShift);
    return new Date() < end;
  }, [selectedDate, selectedShift, getShiftRange]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setOccupancy(null);
    setRevenue(null);
    try {
      const { start, end } = getShiftRange(selectedDate, selectedShift);

      // Fetch live data
      const [occ, rev, floorsData, historyData] = await Promise.all([
        reportService.getOccupancy(),
        reportService.getRevenue({ startDate: start.toISOString(), endDate: end.toISOString() }),
        floorMapService.getAllFloors().catch(() => []),
        reportService.getShiftActivity({ startDate: start.toISOString(), endDate: end.toISOString() }).catch(() => []),
      ]);

      setOccupancy(occ);
      setRevenue(rev);
      setFloors(floorsData);
      setHistoryRecords(historyData);

      // Save update timestamp
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu báo cáo:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedShift, getShiftRange]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Autorun for STAFF to lock them into the server-defined current shift
  useEffect(() => {
    if (user?.role?.toUpperCase() === 'STAFF') {
      reportService.getCurrentShift()
        .then((assignment) => {
          if (assignment) {
            setSelectedDate(assignment.dateStr);
            setSelectedShift(assignment.shift);
          }
        })
        .catch((err) => {
          console.error('Lỗi khi tải thông tin ca trực của nhân viên:', err);
        });
    }
  }, [user]);

  // Operational metrics calculated locally from history records within the shift range
  const getShiftActivityMetrics = () => {
    const { start, end } = getShiftRange(selectedDate, selectedShift);

    const inRange = (dStr: string | null) => {
      if (!dStr) return false;
      const d = new Date(dStr);
      return d >= start && d <= end;
    };

    const vehiclesIn = historyRecords.filter(
      (r) => r.recordType === 'CHECKIN' && inRange(r.timeIn)
    ).length;

    const vehiclesOut = historyRecords.filter(
      (r) => r.recordType === 'CHECKIN' && inRange(r.timeOut)
    ).length;

    const bookingsCreated = historyRecords.filter(
      (r) => r.recordType === 'BOOKING' && inRange(r.bookingTime || r.createdAt)
    ).length;

    const noShows = historyRecords.filter(
      (r) => r.recordType === 'BOOKING' && r.status === 'NO_SHOW' && inRange(r.expectedArrival)
    ).length;

    // Default fallbacks to live occupancy or filtered calculations
    const liveInYard = occupancy?.occupiedSlots ?? historyRecords.filter(
      (r) => r.recordType === 'CHECKIN' && r.status === 'PARKING'
    ).length;

    return {
      vehiclesIn,
      vehiclesOut,
      bookingsCreated,
      noShows,
      liveInYard,
    };
  };

  const activityMetrics = getShiftActivityMetrics();

  // Export CSV function
  const handleExportCSV = () => {
    if (!occupancy || !revenue) return;
    const { start, end } = getShiftRange(selectedDate, selectedShift);

    const headers = ['Mục báo cáo', 'Chi tiết', 'Giá trị'];
    const rows = [
      ['--- THÔNG TIN CA TRỰC ---', '', ''],
      ['Nhân viên trực ca', user?.fullName ?? 'Nhân viên', ''],
      ['Ca trực', `${shiftInfo.label} (${shiftInfo.time})`, ''],
      ['Ngày trực', `${selectedDate} (${getVietnameseDayOfWeek(new Date(selectedDate))})`, ''],
      ['Trạng thái', 'Đang diễn ra', ''],
      ['Thời gian bắt đầu', start.toLocaleString('vi-VN'), ''],
      ['Thời gian kết thúc', end.toLocaleString('vi-VN'), ''],
      ['', '', ''],
      ['--- CÔNG SUẤT BÃI ---', '', ''],
      ['Tổng sức chứa', occupancy.totalSlots.toString(), 'vị trí'],
      ['Đang sử dụng', occupancy.occupiedSlots.toString(), 'xe'],
      ['Đã đặt trước', occupancy.reservedSlots.toString(), 'chỗ'],
      ['Còn trống', occupancy.availableSlots.toString(), 'chỗ'],
      ['Tỉ lệ đang sử dụng', `${occupancy.occupancyRate.toFixed(1)}%`, ''],
      ['Tỉ lệ không khả dụng', `${(((occupancy.occupiedSlots + occupancy.reservedSlots) / occupancy.totalSlots) * 100).toFixed(1)}%`, ''],
      ['', '', ''],
      ['--- HOẠT ĐỘNG TRONG CA ---', '', ''],
      ['Lượt xe vào', activityMetrics.vehiclesIn.toString(), 'lượt'],
      ['Lượt xe ra', activityMetrics.vehiclesOut.toString(), 'lượt'],
      ['Đặt chỗ phát sinh', activityMetrics.bookingsCreated.toString(), 'lượt'],
      ['Không đến', activityMetrics.noShows.toString(), 'lượt'],
      ['Xe còn trong bãi', activityMetrics.liveInYard.toString(), 'xe'],
      ['', '', ''],
      ['--- DOANH THU TRONG CA ---', '', ''],
      ['Tổng doanh thu', formatCurrency(revenue.totalRevenue), ''],
      ['Doanh thu vé lượt', formatCurrency(revenue.sessionRevenue), ''],
      ['Doanh thu gói tháng', formatCurrency(revenue.monthlyRevenue), ''],
      ['Doanh thu đặt chỗ', formatCurrency(revenue.bookingRevenue || 0), ''],
      ['Số giao dịch', revenue.transactionCount.toString(), ''],
      ['Tiền mặt', formatCurrency(revenue.byMethod['CASH'] || 0), ''],
      ['Thẻ', formatCurrency(revenue.byMethod['CARD'] || 0), ''],
      ['Ví điện tử', formatCurrency(revenue.byMethod['EWALLET'] || 0), ''],
      ['Tiền mặt cần bàn giao', formatCurrency(revenue.byMethod['CASH'] || 0), ''],
      ['', '', ''],
      ['--- BÀN GIAO CA ---', '', ''],
      ['Ghi chú bàn giao', note, '']
    ];

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bao_cao_ca_${selectedDate}_${selectedShift}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Note actions
  const handleSaveNote = () => {
    setNote(tempNote);
    localStorage.setItem('shift_handover_note', tempNote);
    setIsEditingNote(false);
  };

  const handleCancelNote = () => {
    setTempNote(note);
    setIsEditingNote(false);
  };

  // Safe percentage helper
  const getPercentage = (amount: number, total: number) => {
    if (total <= 0) return 0;
    return (amount / total) * 100;
  };

  return (
    <div className={styles.container}>
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Báo cáo ca trực</h1>
          <p className={styles.subtitle}>Tổng hợp hoạt động và doanh thu trong ca làm việc.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={loadReports}
            disabled={loading}
            className={styles.btnAction}
            title="Tải lại dữ liệu"
          >
            <RefreshIcon size={14} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={loading || !occupancy}
            className={`${styles.btnAction} ${styles.btnAccent}`}
            title="Tải file báo cáo dạng CSV"
          >
            <DownloadIcon size={14} />
            Xuất báo cáo
          </button>
        </div>
      </div>

      {/* ── Shift Summary Card Row ── */}
      <div className={styles.summaryRow}>
        {/* Block 1: Nhân viên */}
        <div className={styles.summaryBlock}>
          <div className={styles.iconWrapper}>
            <UserRoundIcon size={24} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Nhân viên trực ca</span>
            <span className={styles.summaryValue}>{user?.fullName ?? 'Nhân viên trực'}</span>
          </div>
        </div>

        {/* Block 2: Ca trực */}
        <div className={styles.summaryBlock}>
          <div className={styles.iconWrapper}>
            <CalendarClockIcon size={24} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Ca trực</span>
            <span className={styles.summaryValue}>{shiftInfo.label}</span>
            <span className={styles.summarySub}>{shiftInfo.time}</span>
          </div>
        </div>

        {/* Block 3: Ngày */}
        <div className={styles.summaryBlock}>
          <div className={styles.iconWrapper}>
            <CalendarIcon size={24} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Ngày trực</span>
            <span className={styles.summaryValue}>
              {new Date(selectedDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
            <span className={styles.summarySub}>{getVietnameseDayOfWeek(new Date(selectedDate))}</span>
          </div>
        </div>

        {/* Block 4: Trạng thái ca */}
        <div className={styles.summaryBlock}>
          <div className={styles.iconWrapper}>
            <ClockIcon size={24} />
          </div>
          <div className={styles.summaryContent}>
            <span className={styles.summaryLabel}>Trạng thái ca</span>
            <span className={styles.summaryValue}>
              {user?.role?.toUpperCase() === 'STAFF' || isShiftActive() ? 'Báo cáo ca hiện tại' : 'Báo cáo ca đã hoàn thành'}
            </span>
            {(user?.role?.toUpperCase() === 'STAFF' || isShiftActive()) && lastUpdated && (
              <span className={styles.summarySub}>Dữ liệu cập nhật đến {lastUpdated}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Report Filter / Control Card ── */}
      {user?.role?.toUpperCase() !== 'STAFF' && (
        <div className={styles.controlCard}>
          <h3 className={styles.controlTitle}>Bạn muốn xem báo cáo ca nào?</h3>
          <div className={styles.controlGrid}>
            {/* Ngày */}
            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>Ngày</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={styles.inputField}
              />
            </div>

            {/* Ca trực */}
            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>Ca trực</span>
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className={styles.selectField}
              >
                <option value="MORNING">Ca sáng (06:00 – 14:00)</option>
                <option value="AFTERNOON">Ca chiều (14:00 – 22:00)</option>
                <option value="NIGHT">Ca đêm (22:00 – 06:00)</option>
              </select>
            </div>

            {/* Button */}
            <button
              type="button"
              onClick={loadReports}
              disabled={loading}
              className={styles.btnSubmit}
            >
              Xem báo cáo
            </button>
          </div>
          <span className={styles.controlNote}>
            Lưu ý: Báo cáo ca được tính từ thời gian bắt đầu đến thời gian kết thúc ca.
          </span>
        </div>
      )}

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <span style={{ fontSize: '14px', color: '#94A3B8', fontWeight: 500 }}>
            Đang tổng hợp dữ liệu ca trực...
          </span>
        </div>
      ) : (
        <>
          {/* ── Capacity KPI Section ── */}
          <div>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Công suất bãi xe</h2>
            </div>
            <div className={styles.kpiGrid} style={{ marginTop: '12px' }}>
              {/* Card 1: Tổng */}
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <BoxIcon size={14} />
                  <span className={styles.kpiLabel}>Tổng sức chứa</span>
                </div>
                <p className={styles.kpiValue}>{occupancy?.totalSlots ?? 0}</p>
                <span className={styles.kpiSubText}>vị trí xe</span>
              </div>

              {/* Card 2: Đang sử dụng */}
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <ClockIcon size={14} />
                  <span className={styles.kpiLabel}>Đang sử dụng</span>
                </div>
                <p className={styles.kpiValue} style={{ color: '#F59E0B' }}>{occupancy?.occupiedSlots ?? 0}</p>
                <span className={styles.kpiSubText}>vị trí có xe</span>
              </div>

              {/* Card 3: Đã đặt trước */}
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <CalendarIcon size={14} />
                  <span className={styles.kpiLabel}>Đã đặt trước</span>
                </div>
                <p className={styles.kpiValue} style={{ color: '#8B5CF6' }}>{occupancy?.reservedSlots ?? 0}</p>
                <span className={styles.kpiSubText}>chỗ đặt trước</span>
              </div>

              {/* Card 4: Còn trống */}
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <ShieldCheckIcon size={14} />
                  <span className={styles.kpiLabel}>Còn trống</span>
                </div>
                <p className={styles.kpiValue} style={{ color: '#10B981' }}>{occupancy?.availableSlots ?? 0}</p>
                <span className={styles.kpiSubText}>vị trí khả dụng</span>
              </div>

              {/* Card 5: Tỉ lệ sử dụng */}
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <span className={styles.kpiLabel}>Tỉ lệ sử dụng</span>
                </div>
                <p className={styles.kpiValue}>
                  {occupancy?.occupancyRate !== undefined ? occupancy.occupancyRate.toFixed(1) : '0.0'}%
                </p>
                <span className={styles.kpiSubText}>= Đang sử dụng / Tổng</span>
              </div>

              {/* Card 6: Tỉ lệ không khả dụng */}
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <span className={styles.kpiLabel}>Tỉ lệ không khả dụng</span>
                </div>
                <p className={styles.kpiValue}>
                  {occupancy ? (((occupancy.occupiedSlots + occupancy.reservedSlots) / occupancy.totalSlots) * 100).toFixed(1) : '0.0'}%
                </p>
                <span className={styles.kpiSubText}>= (Đang dùng + Đã đặt) / Tổng</span>
              </div>
            </div>
            <p className={styles.sectionExplanatory}>
              * Công thức tính: Tỉ lệ không khả dụng = (Đang sử dụng + Đã đặt trước) / Tổng sức chứa
            </p>
          </div>

          {/* ── Shift Activity KPI Section ── */}
          <div>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Hoạt động trong ca</h2>
            </div>
            <div className={styles.activityGrid} style={{ marginTop: '12px' }}>
              {/* Lượt xe vào */}
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <ArrowRightIcon size={14} style={{ color: '#10B981' }} />
                  <span className={styles.kpiLabel}>Lượt xe vào</span>
                </div>
                <p className={styles.kpiValue} style={{ color: '#10B981' }}>{activityMetrics.vehiclesIn}</p>
                <span className={styles.kpiSubText}>lượt check-in trong ca</span>
              </div>

              {/* Lượt xe ra */}
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <ArrowLeftIcon size={14} style={{ color: '#EF4444' }} />
                  <span className={styles.kpiLabel}>Lượt xe ra</span>
                </div>
                <p className={styles.kpiValue} style={{ color: '#EF4444' }}>{activityMetrics.vehiclesOut}</p>
                <span className={styles.kpiSubText}>lượt check-out trong ca</span>
              </div>

              {/* Đặt chỗ phát sinh */}
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <CalendarIcon size={14} style={{ color: '#8B5CF6' }} />
                  <span className={styles.kpiLabel}>Đặt chỗ phát sinh</span>
                </div>
                <p className={styles.kpiValue} style={{ color: '#8B5CF6' }}>{activityMetrics.bookingsCreated}</p>
                <span className={styles.kpiSubText}>lượt đặt mới trong ca</span>
              </div>

              {/* Không đến */}
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <AlertTriangleIcon size={14} style={{ color: '#F59E0B' }} />
                  <span className={styles.kpiLabel}>Không đến</span>
                </div>
                <p className={styles.kpiValue} style={{ color: '#F59E0B' }}>{activityMetrics.noShows}</p>
                <span className={styles.kpiSubText}>quá thời gian đặt chỗ</span>
              </div>

              {/* Xe còn trong bãi */}
              <div className={styles.kpiCard}>
                <div className={styles.kpiHeader}>
                  <CheckSquareIcon size={14} style={{ color: '#3B82F6' }} />
                  <span className={styles.kpiLabel}>Xe còn trong bãi</span>
                </div>
                <p className={styles.kpiValue} style={{ color: '#3B82F6' }}>{activityMetrics.liveInYard}</p>
                <span className={styles.kpiSubText}>phiên gửi chưa check-out</span>
              </div>
            </div>
          </div>

          {/* ── Floor Status Table ── */}
          {occupancy?.byFloor && occupancy.byFloor.length > 0 && (
            <div>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Tình trạng theo tầng</h2>
              </div>
              <div className={styles.tableCard} style={{ marginTop: '12px' }}>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Tầng</th>
                        <th className={styles.th}>Tổng</th>
                        <th className={styles.th}>Đang sử dụng</th>
                        <th className={styles.th}>Đã đặt trước</th>
                        <th className={styles.th}>Còn trống</th>
                        <th className={styles.th}>Tỉ lệ đang sử dụng</th>
                        <th className={styles.th}>Tỉ lệ không khả dụng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {occupancy.byFloor.map((row: any) => {
                        const f = floors.find((x) => x.id === row.floor);
                        const floorCode = f?.floorCode ?? row.floor.toString();
                        const floorLabel = `Tầng ${floorCode}`;

                        const occupancyRate = row.occupancyRate;
                        const unavailRate = getPercentage(row.occupied + row.reserved, row.total);

                        return (
                          <tr key={row.floor} className={styles.tr}>
                            <td className={styles.td} style={{ fontWeight: 700 }}>{floorLabel}</td>
                            <td className={styles.td}>{row.total}</td>
                            <td className={styles.td}>{row.occupied}</td>
                            <td className={styles.td}>{row.reserved}</td>
                            <td className={styles.td}>{row.available}</td>
                            
                            {/* Tỉ lệ sử dụng */}
                            <td className={styles.td}>
                              <div className={styles.progressContainer}>
                                <div className={styles.progressBarBg}>
                                  <div
                                    className={`${styles.progressBarFill} ${
                                      occupancyRate > 90 ? styles.progressBarFillDanger : 
                                      occupancyRate > 75 ? styles.progressBarFillWarning : ''
                                    }`}
                                    style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                                  />
                                </div>
                                <span className={styles.progressValue}>{occupancyRate.toFixed(1)}%</span>
                              </div>
                            </td>

                            {/* Tỉ lệ không khả dụng */}
                            <td className={styles.td}>
                              <div className={styles.progressContainer}>
                                <div className={styles.progressBarBg}>
                                  <div
                                    className={`${styles.progressBarFill} ${
                                      unavailRate > 90 ? styles.progressBarFillDanger : 
                                      unavailRate > 75 ? styles.progressBarFillWarning : ''
                                    }`}
                                    style={{ width: `${Math.min(unavailRate, 100)}%` }}
                                  />
                                </div>
                                <span className={styles.progressValue}>{unavailRate.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Summary Row */}
                      <tr className={styles.trSummary}>
                        <td className={styles.td}>Tổng cộng</td>
                        <td className={styles.td}>{occupancy.totalSlots}</td>
                        <td className={styles.td}>{occupancy.occupiedSlots}</td>
                        <td className={styles.td}>{occupancy.reservedSlots}</td>
                        <td className={styles.td}>{occupancy.availableSlots}</td>
                        
                        <td className={styles.td}>
                          <div className={styles.progressContainer}>
                            <div className={styles.progressBarBg}>
                              <div
                                className={styles.progressBarFill}
                                style={{ width: `${Math.min(occupancy.occupancyRate, 100)}%` }}
                              />
                            </div>
                            <span className={styles.progressValue}>{occupancy.occupancyRate.toFixed(1)}%</span>
                          </div>
                        </td>

                        <td className={styles.td}>
                          <div className={styles.progressContainer}>
                            <div className={styles.progressBarBg}>
                              <div
                                className={styles.progressBarFill}
                                style={{
                                  width: `${Math.min(
                                    getPercentage(occupancy.occupiedSlots + occupancy.reservedSlots, occupancy.totalSlots),
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className={styles.progressValue}>
                              {getPercentage(occupancy.occupiedSlots + occupancy.reservedSlots, occupancy.totalSlots).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Revenue Section ── */}
          {revenue && (
            <div>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Doanh thu trong ca</h2>
              </div>
              
              <div className={styles.kpiGrid5} style={{ marginTop: '12px' }}>
                {/* Tổng doanh thu */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiHeader}>
                    <CreditCardIcon size={14} style={{ color: '#10B981' }} />
                    <span className={styles.kpiLabel}>Tổng doanh thu</span>
                  </div>
                  <p className={styles.kpiValue} style={{ color: '#10B981' }}>{formatCurrency(revenue.totalRevenue)}</p>
                  <span className={styles.kpiSubText}>Tổng các khoản thu nhận trong ca</span>
                </div>

                {/* Doanh thu vé lượt */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>Doanh thu vé lượt</span>
                  </div>
                  <p className={styles.kpiValue}>{formatCurrency(revenue.sessionRevenue)}</p>
                  <span className={styles.kpiSubText}>
                    {getPercentage(revenue.sessionRevenue, revenue.totalRevenue).toFixed(1)}% tổng doanh thu
                  </span>
                </div>

                {/* Doanh thu gói tháng */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>Doanh thu gói tháng</span>
                  </div>
                  <p className={styles.kpiValue}>{formatCurrency(revenue.monthlyRevenue)}</p>
                  <span className={styles.kpiSubText}>
                    {getPercentage(revenue.monthlyRevenue, revenue.totalRevenue).toFixed(1)}% tổng doanh thu
                  </span>
                </div>

                {/* Doanh thu đặt chỗ */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>Doanh thu đặt chỗ</span>
                  </div>
                  <p className={styles.kpiValue}>{formatCurrency(revenue.bookingRevenue || 0)}</p>
                  <span className={styles.kpiSubText}>
                    {getPercentage(revenue.bookingRevenue || 0, revenue.totalRevenue).toFixed(1)}% tổng doanh thu
                  </span>
                </div>

                {/* Số giao dịch */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>Số giao dịch</span>
                  </div>
                  <p className={styles.kpiValue}>{revenue.transactionCount}</p>
                  <span className={styles.kpiSubText}>giao dịch phát sinh</span>
                </div>
              </div>

              {/* Sub-row: Theo phương thức thanh toán */}
              <div className={styles.sectionHeader} style={{ margin: '20px 0 4px 0', borderLeftColor: '#F59E0B' }}>
                <h2 className={styles.sectionTitle}>Theo phương thức thanh toán</h2>
              </div>
              <div className={styles.kpiGrid4} style={{ marginTop: '12px' }}>
                {/* Tiền mặt */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>Tiền mặt</span>
                  </div>
                  <p className={styles.kpiValue}>{formatCurrency(revenue.byMethod['CASH'] || 0)}</p>
                  <span className={styles.kpiSubText}>
                    {getPercentage(revenue.byMethod['CASH'] || 0, revenue.totalRevenue).toFixed(1)}% tổng doanh thu
                  </span>
                </div>

                {/* Thẻ */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>Thẻ</span>
                  </div>
                  <p className={styles.kpiValue}>{formatCurrency(revenue.byMethod['CARD'] || 0)}</p>
                  <span className={styles.kpiSubText}>
                    {getPercentage(revenue.byMethod['CARD'] || 0, revenue.totalRevenue).toFixed(1)}% tổng doanh thu
                  </span>
                </div>

                {/* Ví điện tử */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiHeader}>
                    <span className={styles.kpiLabel}>Ví điện tử</span>
                  </div>
                  <p className={styles.kpiValue}>{formatCurrency(revenue.byMethod['EWALLET'] || 0)}</p>
                  <span className={styles.kpiSubText}>
                    {getPercentage(revenue.byMethod['EWALLET'] || 0, revenue.totalRevenue).toFixed(1)}% tổng doanh thu
                  </span>
                </div>

                {/* Tiền mặt cần bàn giao (Highlight Card) */}
                <div className={`${styles.kpiCard} ${styles.kpiHighlight}`}>
                  <div className={styles.kpiHeader} style={{ color: '#FBBF24' }}>
                    <AlertTriangleIcon size={14} />
                    <span className={styles.kpiLabel}>Tiền mặt cần bàn giao</span>
                  </div>
                  <p className={styles.kpiValue} style={{ color: '#F59E0B' }}>
                    {formatCurrency(revenue.byMethod['CASH'] || 0)}
                  </p>
                  <span className={styles.kpiSubText} style={{ color: '#A16207' }}>
                    Số tiền mặt thu trong ca cần nộp lại
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Shift Note / Handover Section ── */}
          <div className={styles.noteCard} style={{ marginTop: '12px' }}>
            <div className={styles.noteHeader}>
              <h3 className={styles.noteTitle}>Ghi chú và bàn giao ca</h3>
              {!isEditingNote && (
                <button
                  type="button"
                  onClick={() => setIsEditingNote(true)}
                  className={styles.btnEditNote}
                >
                  Sửa ghi chú
                </button>
              )}
            </div>

            {isEditingNote ? (
              <div>
                <textarea
                  value={tempNote}
                  onChange={(e) => setTempNote(e.target.value)}
                  className={styles.textarea}
                  placeholder="Nhập ghi chú bàn giao ca trực..."
                />
                <div className={styles.noteActions}>
                  <button
                    type="button"
                    onClick={handleCancelNote}
                    className={styles.btnCancel}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    className={styles.btnSave}
                  >
                    Lưu
                  </button>
                </div>
              </div>
            ) : (
              <pre className={styles.noteText}>{note}</pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}
