import { useState } from 'react';
import { lookupPlate, type LookupResult } from '../api/checkinApi';
import { validatePlate, formatPlateNumber } from '../utils/plate';
import { SearchIcon } from '../components/ui/Icons';
import styles from '../styles/staff.module.css';

function normalizePlate(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function formatPlate(raw: string): { valid: boolean; formatted: string } {
  const v = validatePlate(raw);
  if (!v.valid) return { valid: false, formatted: '' };
  return { valid: true, formatted: formatPlateNumber(raw) };
}

function isPlateValid(raw: string): boolean {
  if (!raw.trim()) return false;
  return validatePlate(raw).valid;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN');
}

export function SearchVehiclePage() {
  const [plateInput, setPlateInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [lookupData, setLookupData] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string>('');

  const handleSearch = async () => {
    const raw = plateInput.trim();
    if (!raw) return;
    const { valid, formatted } = formatPlate(raw);
    if (!valid) {
      setError('Biển số không hợp lệ. Vui lòng kiểm tra lại.');
      setLookupData(null);
      return;
    }

    setPlateInput(formatted);
    setError('');
    setSearching(true);
    setLookupData(null);

    try {
      const result = await lookupPlate(normalizePlate(formatted));
      setLookupData(result);
    } catch (err: unknown) {
      setError((err as Error).message || 'Không thể tra cứu biển số. Vui lòng thử lại.');
    } finally {
      setSearching(false);
    }
  };

  const handleRetry = () => {
    setError('');
    setLookupData(null);
  };

  const showLoading = searching;
  const showResult = lookupData && lookupData.found;
  const showNotFound = lookupData && !lookupData.found;
  const showError = !!error && !lookupData;
  const showEmpty = !lookupData && !error;

  function renderSummaryRow(d: LookupResult) {
    return (
      <div className={styles.svSummary}>
        <span className={styles.svPlateNumber}>{plateInput}</span>
        {d.vehicleType && (
          <span className={`${styles.svBadge} ${d.vehicleType === 'CAR' ? styles.svBadgeCar : styles.svBadgeMotorbike}`}>
            {d.vehicleType === 'CAR' ? '🚗 Ô tô' : '🛵 Xe máy'}
          </span>
        )}
        <span className={`${styles.svBadge} ${d.customerType === 'monthly' ? styles.svBadgeMonthly : styles.svBadgeCasual}`}>
          {d.customerType === 'monthly' ? '📋 Khách tháng' : '🎟️ Khách lẻ'}
        </span>
        {d.alreadyParked !== undefined && (
          <span className={`${styles.svBadge} ${d.alreadyParked ? styles.svBadgeParked : styles.svBadgeNotParked}`}>
            {d.alreadyParked ? '🟢 Đang trong bãi' : '⚪ Không trong bãi'}
          </span>
        )}
        {d.isExpired && (
          <span className={`${styles.svBadge} ${styles.svBadgeExpired}`}>
            ⏰ Gói hết hạn
          </span>
        )}
      </div>
    );
  }

  function renderInfoItem(label: string, value: string | null | undefined) {
    const displayValue = (value !== null && value !== undefined && value !== '')
      ? value
      : null;
    return (
      <div className={styles.svInfoItem}>
        <span className={styles.svInfoLabel}>{label}</span>
        {displayValue !== null ? (
          <span className={styles.svInfoValue}>{displayValue}</span>
        ) : (
          <span className={styles.svInfoValueMissing}>Chưa cập nhật</span>
        )}
      </div>
    );
  }

  function renderVehicleInfo(d: LookupResult) {
    return (
      <div className={styles.svInfoSection}>
        <h4 className={styles.svInfoSectionTitle}>🚘 THÔNG TIN PHƯƠNG TIỆN</h4>
        <div className={styles.svInfoGrid}>
          {renderInfoItem('Hãng xe', d.brand)}
          {renderInfoItem('Dòng xe', d.model)}
          {renderInfoItem('Màu sắc', d.color)}
          {renderInfoItem('Năm sản xuất', d.year != null ? String(d.year) : null)}
          {renderInfoItem('Loại xe', d.vehicleType === 'CAR' ? 'Ô tô' : d.vehicleType === 'MOTORBIKE' ? 'Xe máy' : null)}
          {renderInfoItem('Số chỗ', d.seats != null ? `${d.seats} chỗ` : null)}
          {d.fixedSlot && renderInfoItem('Slot cố định', d.fixedSlot)}
          {d.packageExpiry && renderInfoItem('Hạn gói tháng', formatDate(d.packageExpiry))}
          {d.customerType === 'monthly' && d.isExpired !== undefined && (
            renderInfoItem('Trạng thái gói', d.isExpired ? 'Đã hết hạn' : 'Còn hiệu lực')
          )}
        </div>
      </div>
    );
  }

  function renderOwnerInfo(d: LookupResult) {
    const hasOwner = d.ownerName || d.ownerPhone || d.ownerEmail;
    if (!hasOwner) {
      return (
        <div className={styles.svInfoSection}>
          <h4 className={styles.svInfoSectionTitle}>👤 THÔNG TIN CHỦ XE</h4>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: 0, fontStyle: 'italic' }}>
            Chưa có thông tin chủ xe
          </p>
        </div>
      );
    }
    return (
      <div className={styles.svInfoSection}>
        <h4 className={styles.svInfoSectionTitle}>👤 THÔNG TIN CHỦ XE</h4>
        <div className={styles.svInfoGrid}>
          {renderInfoItem('Họ và tên', d.ownerName)}
          {renderInfoItem('Số điện thoại', d.ownerPhone)}
          {renderInfoItem('Email', d.ownerEmail)}
        </div>
      </div>
    );
  }

  function renderParkingStatus(d: LookupResult) {
    const hasParkingRecord = d.alreadyParked && d.slotCode;
    if (!hasParkingRecord) {
      return (
        <div className={styles.svStatusEmpty}>
          <h4 className={styles.svInfoSectionTitle}>🅿️ TRẠNG THÁI GỬI XE HIỆN TẠI</h4>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: 0, fontStyle: 'italic' }}>
            Xe hiện không có phiên gửi xe đang hoạt động.
          </p>
        </div>
      );
    }
    return (
      <div className={styles.svStatusPanel}>
        <h4 className={styles.svInfoSectionTitle}>🅿️ TRẠNG THÁI GỬI XE HIỆN TẠI</h4>
        {d.slotCode && (
          <div className={styles.svStatusRow}>
            <div className={styles.svStatusIcon}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <span className={styles.svStatusLabel}>Vị trí đỗ</span>
            <span className={styles.svStatusValue}>{d.slotCode}</span>
          </div>
        )}
        <div className={styles.svStatusRow}>
          <div className={styles.svStatusIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          </div>
          <span className={styles.svStatusLabel}>Trạng thái</span>
          <span className={styles.svStatusActive}>Đang đỗ trong bãi</span>
        </div>
      </div>
    );
  }

  function renderInfoBanner(d: LookupResult) {
    if (d.alreadyParked) {
      return (
        <div className={styles.svBanner}>
          <div className={styles.svBannerIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4l3 3" />
            </svg>
          </div>
          <p className={styles.svBannerText}>
            Xe hiện đang ở trong bãi. Nhân viên có thể tiếp tục thao tác check-out hoặc xem lịch sử gần nhất.
          </p>
        </div>
      );
    }
    return (
      <div className={styles.svBanner} style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}>
        <div className={styles.svBannerIcon} style={{ color: '#64748B' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4l3 3" />
          </svg>
        </div>
        <p className={styles.svBannerText} style={{ color: '#64748B' }}>
          Xe hiện không có phiên gửi xe đang hoạt động.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.svPage}>
      {/* Page Header */}
      <div className={styles.svHeader}>
        <h1 className={styles.svTitle}>Tra cứu xe</h1>
        <p className={styles.svSubtitle}>
          Tìm kiếm thông tin xe theo biển số một cách nhanh chóng và chính xác
        </p>
      </div>

      {/* Search Card */}
      <div className={styles.svSearchCard}>
        <h2 className={styles.svSearchSectionTitle}>
          <SearchIcon size={20} />
          Tìm kiếm phương tiện
        </h2>
        <p className={styles.svSearchHelper}>
          Nhập biển số để xem nhanh thông tin xe, chủ xe và trạng thái hiện tại.
        </p>
        <div className={styles.svInputGroup}>
          <div className={styles.svInputField}>
            <label className={styles.svInputLabel} htmlFor="sv-plate-input">Biển số xe</label>
            <div className={styles.svInputWrapper}>
              <div className={styles.svInputIcon}>
                <SearchIcon size={16} />
              </div>
              <input
                id="sv-plate-input"
                type="text"
                value={plateInput}
                onChange={(e) => { setPlateInput(e.target.value.toUpperCase()); setError(''); }}
                placeholder="VD: 51A-11111"
                disabled={searching}
                className={styles.svInput}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                aria-label="Nhập biển số xe"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={!isPlateValid(plateInput) || searching}
            className={styles.svSearchBtn}
            aria-label="Tìm xe"
          >
            {searching ? (
              <>
                <span className={styles.svSpinner} />
                Đang tìm...
              </>
            ) : (
              <>
                <SearchIcon size={16} />
                Tìm xe
              </>
            )}
          </button>
        </div>
        {error && (
          <p className={styles.svError}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            {error}
          </p>
        )}
      </div>

      {/* Result Card */}
      <div className={styles.svResultCard}>
        <div className={styles.svResultHeader}>
          <h2 className={styles.svResultTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <circle cx="7.5" cy="12" r="1" fill="currentColor" />
              <circle cx="16.5" cy="12" r="1" fill="currentColor" />
              <path d="M10 9h4M10 15h4" />
            </svg>
            Kết quả tra cứu
          </h2>
          {showLoading && (
            <span style={{ fontSize: 13, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className={styles.svSpinner} style={{ borderColor: '#CBD5E1', borderTopColor: '#082B63' }} />
              Đang tải dữ liệu...
            </span>
          )}
        </div>

        {/* Empty State */}
        {showEmpty && (
          <div className={styles.svEmptyState}>
            <div className={styles.svEmptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <circle cx="7.5" cy="12" r="1" fill="currentColor" />
                <circle cx="16.5" cy="12" r="1" fill="currentColor" />
                <path d="M10 9h4M10 15h4" />
              </svg>
            </div>
            <p className={styles.svEmptyText}>
              Nhập biển số và nhấn &ldquo;Tìm xe&rdquo; để xem thông tin phương tiện.
            </p>
          </div>
        )}

        {/* Not Found State */}
        {showNotFound && (
          <div className={styles.svNotFound}>
            <div className={styles.svNotFoundIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
                <path d="M8 11h6" />
              </svg>
            </div>
            <h3 className={styles.svNotFoundTitle}>Không tìm thấy phương tiện</h3>
            <p className={styles.svNotFoundText}>
              Không có phương tiện phù hợp với biển số đã nhập.
            </p>
          </div>
        )}

        {/* Error State */}
        {showError && (
          <div className={styles.svErrorState}>
            <div className={styles.svErrorStateIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <h3 className={styles.svErrorStateTitle}>Đã xảy ra lỗi</h3>
            <p className={styles.svErrorStateText}>{error}</p>
            <button type="button" onClick={handleRetry} className={styles.svRetryBtn}>
              Thử lại
            </button>
          </div>
        )}

        {/* Successful Result */}
        {showResult && lookupData && (
          <>
            {renderSummaryRow(lookupData)}

            <div className={styles.svContentGrid}>
              {/* Left Panel — Vehicle & Owner Info */}
              <div className={styles.svInfoPanel}>
                {renderVehicleInfo(lookupData)}
                <div className={styles.svDivider} />
                {renderOwnerInfo(lookupData)}
              </div>

              {/* Right Panel — Parking Status */}
              {renderParkingStatus(lookupData)}
            </div>

            {/* Info Banner */}
            {renderInfoBanner(lookupData)}
          </>
        )}
      </div>
    </div>
  );
}

export default SearchVehiclePage;