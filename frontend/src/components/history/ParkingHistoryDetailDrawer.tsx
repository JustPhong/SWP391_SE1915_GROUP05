import React, { useEffect, useState, useCallback } from 'react';
import { getParkingHistoryDetailApi, ParkingHistoryDetail } from '../../api/historyApi';
import { formatPlateNumber } from '../../utils/plate';
import { EvidenceImageCard } from './EvidenceImageCard';
import { ImageLightbox } from './ImageLightbox';
import styles from '../../styles/parkingHistoryDetailDrawer.module.css';

interface ParkingHistoryDetailDrawerProps {
  recordId: string | null;
  onClose: () => void;
}

function formatCurrency(amount?: number | null): string {
  if (amount == null || isNaN(amount)) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch {
    return '—';
  }
}

function formatDuration(minutes?: number | null): string {
  if (minutes == null || minutes < 0 || isNaN(minutes)) return '—';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0) {
    return `${hrs} giờ ${mins} phút`;
  }
  return `${mins} phút`;
}

export const ParkingHistoryDetailDrawer: React.FC<ParkingHistoryDetailDrawerProps> = ({
  recordId,
  onClose,
}) => {
  const [detail, setDetail] = useState<ParkingHistoryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Lightbox state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState('');

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await getParkingHistoryDetailApi(id);
      setDetail(data);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải hồ sơ lượt gửi xe.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (recordId) {
      loadDetail(recordId);
    } else {
      setDetail(null);
      setError('');
    }
  }, [recordId, loadDetail]);

  // Handle ESC key to close drawer (only when lightbox is closed)
  useEffect(() => {
    if (!recordId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lightboxUrl) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recordId, lightboxUrl, onClose]);

  if (!recordId) return null;

  const isCar = detail?.vehicle.type === 'CAR';
  const isCompleted = detail?.status === 'COMPLETED';

  const customerTypeLabel =
    detail?.customerType === 'monthly'
      ? 'Cư dân (Gói tháng)'
      : detail?.customerType === 'booking'
        ? 'Khách đặt trước'
        : 'Khách thường (Vé lượt)';

  const locationDisplay = (() => {
    if (!detail?.location) return '—';
    const floor = detail.location.floorName || (detail.location.floorCode ? `Tầng ${detail.location.floorCode}` : null);
    const slot = detail.location.slotCode;
    const tier = detail.allowedTier ? `Khu ${detail.allowedTier === 'VIP' ? 'VIP' : detail.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : null;

    if (floor && tier) return `${floor} · ${tier}`;
    if (floor && slot) return `${floor} · ${slot}`;
    if (floor) return floor;
    if (slot) return slot;
    return 'Khu vực tự do';
  })();

  const handleOpenLightbox = (url: string, title: string) => {
    setLightboxUrl(url);
    setLightboxTitle(title);
  };

  return (
    <>
      <div className={styles.drawerOverlay} onClick={onClose}>
        <div className={styles.drawerContent} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className={styles.drawerHeader}>
            <div className={styles.drawerTitleGroup}>
              <span className={styles.drawerSuperTitle}>Hồ sơ lượt gửi xe</span>
              <div className={styles.drawerMainHeader}>
                <span className={styles.drawerPlate}>
                  {detail ? formatPlateNumber(detail.vehicle.plateNumber, '', detail.vehicle.type) : '...'}
                </span>
                {detail && (
                  <>
                    <span className={`${styles.badgeVehicleType} ${isCar ? styles.badgeCar : styles.badgeMotorbike}`}>
                      {isCar ? '🚗 Ô tô' : '🛵 Xe máy'}
                    </span>
                    <span className={`${styles.badgeStatus} ${isCompleted ? styles.statusCompleted : styles.statusParking}`}>
                      {isCompleted ? '✓ Đã rời bãi' : '● Đang đỗ'}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button type="button" className={styles.btnClose} onClick={onClose} aria-label="Đóng">
              ✕
            </button>
          </div>

          {/* Body */}
          <div className={styles.drawerBody}>
            {loading ? (
              <div className={styles.stateBox}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8" />
                </svg>
                <span>Đang tải hồ sơ lượt gửi xe...</span>
              </div>
            ) : error ? (
              <div className={styles.stateBox}>
                <span style={{ color: '#DC2626', fontWeight: 600 }}>{error}</span>
                <button type="button" className={styles.btnRetry} onClick={() => recordId && loadDetail(recordId)}>
                  Thử lại
                </button>
              </div>
            ) : detail ? (
              <>
                {/* 1. THÔNG TIN LƯỢT GỬI */}
                <div className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>
                      <span>📋</span> Thông tin lượt gửi
                    </h3>
                  </div>
                  <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Biển số</span>
                      <span className={styles.metaValue}>{formatPlateNumber(detail.vehicle.plateNumber, '', detail.vehicle.type)}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Loại xe</span>
                      <span className={styles.metaValue}>{isCar ? 'Ô tô' : 'Xe máy'}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Loại khách</span>
                      <span className={styles.metaValue}>{customerTypeLabel}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Tài xế / Khách hàng</span>
                      <span className={styles.metaValue}>{detail.driver?.fullName || 'Khách vãng lai'}</span>
                    </div>
                    {detail.driver?.email && detail.driver.email !== 'walkin@system.local' && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Email</span>
                        <span className={styles.metaValue}>{detail.driver.email}</span>
                      </div>
                    )}
                    {detail.driver?.phoneNumber && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Số điện thoại</span>
                        <span className={styles.metaValue}>{detail.driver.phoneNumber}</span>
                      </div>
                    )}
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Tầng / Khu vực</span>
                      <span className={styles.metaValue} style={{ color: '#0F766E' }}>{locationDisplay}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Thời gian vào</span>
                      <span className={styles.metaValue}>{formatDateTime(detail.checkInTime)}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Thời gian ra</span>
                      <span className={styles.metaValue}>{detail.checkOutTime ? formatDateTime(detail.checkOutTime) : '—'}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Thời lượng</span>
                      <span className={styles.metaValue}>{formatDuration(detail.durationMinutes)}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Check-in bởi</span>
                      <span className={styles.metaValue}>{detail.checkedInBy?.fullName || '—'}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Check-out bởi</span>
                      <span className={styles.metaValue}>{detail.checkedOutBy?.fullName || '—'}</span>
                    </div>
                    {detail.booking && (
                      <div className={`${styles.metaItem} ${styles.metaItemFull}`}>
                        <span className={styles.metaLabel}>Mã đặt chỗ trước</span>
                        <span className={styles.metaValue} style={{ fontFamily: 'monospace', color: '#6366F1' }}>
                          {detail.booking.id} (Cọc: {formatCurrency(detail.booking.depositAmount)})
                        </span>
                      </div>
                    )}
                    {detail.isLostTicket && (
                      <div className={`${styles.metaItem} ${styles.metaItemFull}`} style={{ background: '#FEE2E2', padding: '0.5rem', borderRadius: 6 }}>
                        <span className={styles.metaLabel} style={{ color: '#991B1B', fontWeight: 800 }}>Xử lý mất vé</span>
                        <span className={styles.metaValue} style={{ color: '#DC2626' }}>
                          Lý do: {detail.lostTicketReason || '—'} | Người nhận: {detail.lostTicketFullName || '—'} ({detail.lostTicketPhone || '—'})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. HÌNH ẢNH CHECK-IN */}
                <div className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>
                      <span>📷</span> Hình ảnh Check-in
                    </h3>
                  </div>
                  <div className={styles.evidenceGrid}>
                    <EvidenceImageCard
                      title="Ảnh xe phía trước"
                      imageUrl={detail.checkInEvidence.frontImageUrl}
                      onPreview={handleOpenLightbox}
                    />
                    <EvidenceImageCard
                      title="Ảnh xe phía sau"
                      imageUrl={detail.checkInEvidence.rearImageUrl}
                      onPreview={handleOpenLightbox}
                    />
                    <div className={styles.evidenceGridFull}>
                      <EvidenceImageCard
                        title="Ảnh người gửi xe"
                        subtitle={detail.checkInEvidence.driverFaceCapturedAt ? `Nhận diện lúc ${formatDateTime(detail.checkInEvidence.driverFaceCapturedAt)}` : null}
                        imageUrl={detail.checkInEvidence.driverImageUrl}
                        onPreview={handleOpenLightbox}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. HÌNH ẢNH CHECK-OUT */}
                <div className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>
                      <span>📸</span> Hình ảnh Check-out
                    </h3>
                  </div>
                  <div className={styles.evidenceGrid}>
                    <EvidenceImageCard
                      title="Ảnh xe phía trước lúc ra"
                      imageUrl={detail.checkOutEvidence.frontImageUrl}
                      onPreview={handleOpenLightbox}
                    />
                    <EvidenceImageCard
                      title="Ảnh xe phía sau lúc ra"
                      imageUrl={detail.checkOutEvidence.rearImageUrl}
                      onPreview={handleOpenLightbox}
                    />
                    <div className={styles.evidenceGridFull}>
                      <EvidenceImageCard
                        title="Ảnh người lấy xe"
                        imageUrl={detail.checkOutEvidence.driverImageUrl}
                        onPreview={handleOpenLightbox}
                      />
                    </div>
                  </div>
                </div>

                {/* 4. THANH TOÁN */}
                <div className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>
                      <span>💳</span> Thanh toán
                    </h3>
                  </div>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {detail.isMonthly ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803D', fontWeight: 700, fontSize: '0.9rem' }}>
                        <span>✅ Gói tháng · Không thu phí lượt</span>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700 }}>
                          <span style={{ color: '#64748B' }}>Tổng thanh toán</span>
                          <span style={{ color: '#1E3A5F', fontSize: '1.05rem' }}>{formatCurrency(detail.payment.totalAmount)}</span>
                        </div>
                        {detail.payment.payments.length > 0 && (
                          <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {detail.payment.payments.map((p) => (
                              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#334155' }}>
                                <span>
                                  {p.method === 'CARD' ? 'Thẻ / Stripe' : p.method === 'EWALLET' ? 'Ví điện tử' : 'Tiền mặt'} ({p.type === 'BOOKING_DEPOSIT' ? 'Cọc đặt chỗ' : 'Phí gửi xe'})
                                </span>
                                <span style={{ fontWeight: 600 }}>{formatCurrency(p.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 5. LỊCH SỬ XỬ LÝ */}
                <div className={styles.sectionBlock}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>
                      <span>⏱️</span> Lịch sử xử lý
                    </h3>
                  </div>
                  <div className={styles.timelineContainer}>
                    {/* Check-in event */}
                    <div className={styles.timelineItem}>
                      <div className={styles.timelineLine} />
                      <div className={styles.timelineDot} style={{ background: '#2563EB' }} />
                      <div className={styles.timelineContent}>
                        <span className={styles.timelineTime}>Check-in: {formatDateTime(detail.checkInTime)}</span>
                        <span className={styles.timelineActor}>
                          Nhân viên: {detail.checkedInBy?.fullName || 'Hệ thống tự động'}
                        </span>
                      </div>
                    </div>

                    {/* Check-out event */}
                    {detail.checkOutTime && (
                      <div className={styles.timelineItem}>
                        <div className={styles.timelineDot} style={{ background: '#16A34A' }} />
                        <div className={styles.timelineContent}>
                          <span className={styles.timelineTime}>Check-out: {formatDateTime(detail.checkOutTime)}</span>
                          <span className={styles.timelineActor}>
                            Nhân viên: {detail.checkedOutBy?.fullName || 'Hệ thống tự động'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Lightbox for zoom */}
      <ImageLightbox
        isOpen={Boolean(lightboxUrl)}
        imageUrl={lightboxUrl}
        title={lightboxTitle}
        onClose={() => setLightboxUrl(null)}
      />
    </>
  );
};
