import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { vehicleService } from '../services/vehicle.service';
import type { Vehicle } from '../types';
import styles from '../styles/booking.module.css';

// ── Icons ──────────────────────────────────────────────────
function IconInfo({ size = 18, color = '#2563EB' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
}

function IconTicket({ size = 20, color = '#1E3A5F' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/></svg>;
}
function IconDollar({ size = 20, color = '#10B981' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
}
function IconClock({ size = 20, color = '#D97706' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function IconLayers({ size = 20, color = '#8B5CF6' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
}
function IconShield({ size = 16, color = '#64748B' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}

function IconCheck({ size = 14, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}

// ── Main Page ──────────────────────────────────────────────
export function BookingPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Fetch cars on mount
  const loadCars = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await vehicleService.getMyVehicles();
      // Only CAR vehicles can use booking
      const cars = (data ?? []).filter((v) => v.type === 'CAR');
      setVehicles(cars);
      if (cars.length > 0) {
        setSelectedVehicleId(cars[0].id);
      }
    } catch {
      setErrorMsg('Không thể tải danh sách xe. Vui lòng tải lại trang.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCars();
  }, [loadCars]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  const handleBooking = async () => {
    if (!selectedVehicle) return;
    
    // Only require payment if not monthly
    const isMonthly = selectedVehicle.isMonthly || !!selectedVehicle.monthlyPackage;
    if (!isMonthly && !showPaymentModal) {
      setShowPaymentModal(true);
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const arrival = new Date();
      arrival.setMinutes(arrival.getMinutes() + 30);
      
      const res = await api.post<{ success: boolean; data: any }>('/bookings', {
        plateNumber: selectedVehicle.plateNumber,
        expectedArrival: arrival.toISOString(),
      });
      
      setShowPaymentModal(false);
      setBookingSuccess({
        booking: res.data.data,
        vehicle: selectedVehicle,
      });
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Đặt chỗ thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setBookingSuccess(null);
    setSelectedVehicleId(vehicles[0]?.id ?? null);
    setErrorMsg('');
  };

  // ── Success screen ───────────────────────────────────────
  if (bookingSuccess) {
    const { booking, vehicle } = bookingSuccess;
    const floorName = booking.slot?.floor?.name || '';
    const slotCode = booking.slot?.code || '';

    return (
      <div className={styles.container} style={{ minHeight: 'auto', paddingBottom: '5rem' }}>
        <div style={{
          maxWidth: 600,
          margin: '2rem auto',
          background: '#FFFFFF',
          borderRadius: 20,
          boxShadow: '0 10px 25px -5px rgba(15,23,42,0.08), 0 8px 16px -6px rgba(15,23,42,0.04)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          animation: 'fadeIn 0.3s ease',
        }}>
          {/* Success Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1E3A5F 0%, #2C4F78 100%)',
            padding: '3rem 2rem',
            textAlign: 'center',
            color: '#FFFFFF',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem',
              border: '2.5px solid rgba(255, 255, 255, 0.4)',
            }}>
              <IconCheck size={32} color="#FFFFFF" />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
              Đặt chỗ thành công
            </h2>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.95rem', color: 'rgba(255,255,255,0.8)' }}>
              Hệ thống đã giữ một suất đỗ cho phương tiện của bạn
            </p>
          </div>

          {/* Success Content */}
          <div style={{ padding: '2.5rem' }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              background: '#F8FAFC',
              borderRadius: 16,
              border: '1px solid #E2E8F0',
              padding: '1.5rem 1.75rem',
              marginBottom: '2rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PHƯƠNG TIỆN</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                  {vehicle.plateNumber} ({vehicle.brand} {vehicle.model})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PHÍ ĐẶT CỌC</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#10B981' }}>15.000đ (Đã thanh toán)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>THỜI GIAN GIỮ CHỖ</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#D97706' }}>30 phút</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TRẠNG THÁI</span>
                <span style={{
                  background: '#ECFDF5', color: '#10B981', fontSize: '0.75rem', fontWeight: 800,
                  padding: '4px 10px', borderRadius: 20, letterSpacing: '0.05em'
                }}>ĐANG HIỆU LỰC</span>
              </div>
              
              <div style={{ height: 1, background: '#E2E8F0', margin: '0.5rem 0' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center', padding: '0.5rem 0' }}>
                <span style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 600 }}>
                  {floorName && slotCode ? (
                    <>
                      Vị trí được bố trí: <strong style={{ color: '#1E3A5F', fontWeight: 800 }}>Tầng {floorName} · Ô {slotCode}</strong>
                    </>
                  ) : (
                    'Vị trí cụ thể sẽ được bố trí khi bạn đến bãi.'
                  )}
                </span>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', lineHeight: 1.5, fontWeight: 500 }}>
                  Vui lòng đưa xe đến cổng soát vé trong vòng 30 phút để nhận diện biển số và đỗ xe.
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className={styles.confirmBtn}
              style={{ height: '52px' }}
            >
              Quay lại trang đặt chỗ
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Booking Screen ──────────────────────────────────
  return (
    <div className={styles.container}>
      {/* 1. Page Title Section */}
      <div className={styles.headerSection}>
        <h2 className={styles.pageTitle}>Đặt chỗ trước</h2>
        <p className={styles.pageSubtitle}>
          Đặt chỗ trước giúp bạn tiết kiệm thời gian và đảm bảo luôn có chỗ khi đến bãi.
        </p>
      </div>

      {/* 2. Info Banner */}
      <div className={styles.infoBanner}>
        <div className={styles.bannerLeft}>
          <div className={styles.infoIconCircle}>
            <IconInfo size={26} color="#2563EB" />
          </div>
          <div className={styles.bannerText}>
            <h4 className={styles.bannerTitle}>Đảm bảo có chỗ khi bạn đến bãi</h4>
            <p className={styles.bannerDesc}>
              Bạn chỉ cần chọn xe và xác nhận đặt chỗ. Hệ thống sẽ giữ một suất đỗ và bố trí vị trí trống phù hợp khi bạn đến bãi.
            </p>
          </div>
        </div>
        <div className={styles.bannerDecor}>
          <img src="/carr-clean.png" alt="" className={styles.bannerCarImage} />
        </div>
      </div>

      {/* 3. Two Column Layout */}
      <div className={styles.layoutGrid}>
        
        {/* LEFT COLUMN: Booking Form Options (70%) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
          
          {/* Section 1: Choose Car */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              1. Chọn xe ô tô
            </h3>
            <p className={styles.cardSubtitle}>
              Chỉ áp dụng cho xe ô tô
            </p>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B', fontSize: '0.9rem', fontWeight: 600 }}>
                Đang tải danh sách xe...
              </div>
            ) : vehicles.length === 0 ? (
              <div style={{
                background: '#F8FAFC',
                border: '2px dashed #CBD5E1',
                borderRadius: 16,
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>🚗</span>
                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1E3A5F' }}>
                  Bạn cần thêm xe ô tô để sử dụng tính năng đặt chỗ trước.
                </p>
              </div>
            ) : (
              <div className={styles.vehicleGrid}>
                {vehicles.map((v) => {
                  const isSelected = v.id === selectedVehicleId;
                  return (
                    <button
                      key={v.id}
                      onClick={() => { setSelectedVehicleId(v.id); setErrorMsg(''); }}
                      className={`${styles.vehicleCard} ${isSelected ? styles.vehicleCardSelected : ''}`}
                    >
                      {/* Radio indicator */}
                      <div className={styles.radioIndicator}>
                        {isSelected && <div className={styles.radioDot} />}
                      </div>

                      {/* Real Car Image */}
                      <img src="/Car.png" alt="" className={styles.vehicleCarImage} />

                      {/* Vehicle Details */}
                      <div className={styles.vehicleInfo}>
                        <span className={styles.plateNumber}>
                          {v.plateNumber}
                        </span>
                        <span className={styles.vehicleDesc}>
                          {v.brand || 'Ô tô'} {v.model || ''}
                        </span>
                        {isSelected && (
                          <span className={styles.activeBadge}>Đang chọn</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Booking details */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              2. Thông tin đặt chỗ
            </h3>
            <p className={styles.cardSubtitle}>
              Thông tin chi tiết về lượt đặt đỗ xe của phương tiện.
            </p>

            {/* 4 Item horizontal summary row */}
            <div className={styles.infoSummaryGrid}>
              
              {/* Item 1 */}
              <div className={styles.summaryCol}>
                <div className={styles.summaryColCircle} style={{ background: '#EFF6FF', color: '#2563EB' }}>
                  <IconTicket size={22} color="#2563EB" />
                </div>
                <div className={styles.summaryColText}>
                  <p className={styles.summaryColLabel}>Loại đặt chỗ</p>
                  <p className={styles.summaryColValue}>Ô tô khách vãng lai</p>
                </div>
              </div>

              {/* Item 2 */}
              <div className={styles.summaryCol}>
                <div className={styles.summaryColCircle} style={{ background: '#ECFDF5', color: '#10B981' }}>
                  <IconDollar size={22} color="#10B981" />
                </div>
                <div className={styles.summaryColText}>
                  <p className={styles.summaryColLabel}>Phí đặt cọc</p>
                  <p className={`${styles.summaryColValue} ${styles.summaryColValueGreen}`}>15.000đ</p>
                </div>
              </div>

              {/* Item 3 */}
              <div className={styles.summaryCol}>
                <div className={styles.summaryColCircle} style={{ background: '#FFFBEB', color: '#D97706' }}>
                  <IconClock size={22} color="#D97706" />
                </div>
                <div className={styles.summaryColText}>
                  <p className={styles.summaryColLabel}>Thời gian giữ chỗ</p>
                  <p className={styles.summaryColValue} style={{ color: '#D97706', fontWeight: 800 }}>30 phút</p>
                </div>
              </div>

              {/* Item 4 */}
              <div className={styles.summaryCol}>
                <div className={styles.summaryColCircle} style={{ background: '#F5F3FF', color: '#8B5CF6' }}>
                  <IconLayers size={22} color="#8B5CF6" />
                </div>
                <div className={styles.summaryColText}>
                  <p className={styles.summaryColLabel}>Bố trí khi khách đến bãi</p>
                  <p className={`${styles.summaryColValue} ${styles.summaryColValueLong}`}>
                    Vị trí cụ thể sẽ được sắp xếp theo tình trạng chỗ trống thực tế.
                  </p>
                </div>
              </div>
            </div>

            {/* arrangement disclaimer note */}
            <div className={styles.disclaimerText}>
              Vị trí cụ thể sẽ được sắp xếp theo tình trạng chỗ trống thực tế tại thời điểm xe của bạn đến bãi.
            </div>
          </div>

          {/* Warning box */}
          <div className={styles.warningBlock}>
            <h4 className={styles.warningHeader}>
              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>⚠️</span> Lưu ý quan trọng
            </h4>
            <ul className={styles.warningList}>
              <li>Vui lòng có mặt tại bãi trong thời gian giữ chỗ.</li>
              <li>Quá thời gian giữ chỗ, suất đỗ sẽ được hủy tự động.</li>
              <li>Phí đặt cọc có thể không được hoàn lại nếu không đến đúng thời gian.</li>
            </ul>
          </div>

          {/* API Errors */}
          {errorMsg && (
            <div className={styles.errorBlock}>{errorMsg}</div>
          )}

          {/* Confirm Button */}
          <button
            onClick={handleBooking}
            disabled={submitting || !selectedVehicleId}
            className={styles.confirmBtn}
          >
            {submitting ? (
              'Đang xử lý...'
            ) : (
              <>
                <IconCheck size={18} color="#FFFFFF" />
                Xác nhận đặt chỗ
              </>
            )}
          </button>
        </div>

        {/* RIGHT COLUMN: Sidebar Summary (30%) */}
        <div className={styles.sidebarWrapper}>
          
          {/* Card 1: Booking Summary */}
          <div className={styles.sidebarCard}>
            <div className={styles.sidebarTitleRow}>
              <div className={styles.titleIconCircle}>
                <IconTicket size={18} color="#2563EB" />
              </div>
              <h3 className={styles.sidebarTitle}>Tóm tắt đặt chỗ</h3>
            </div>
            
            <div className={styles.summaryRows}>
              <div className={styles.summaryRow}>
                <span className={styles.rowLabel}>Xe đã chọn</span>
                {selectedVehicle ? (
                  <div className={styles.summaryVehicleInfo}>
                    <img src="/Car.png" alt="" className={styles.summaryVehicleImage} />
                    <div>
                      <div className={styles.rowCarPlate}>{selectedVehicle.plateNumber}</div>
                      <div className={styles.rowCarName}>{selectedVehicle.brand || 'Ô tô'} {selectedVehicle.model || ''}</div>
                    </div>
                  </div>
                ) : (
                  <span className={styles.rowValue}>—</span>
                )}
              </div>
              
              <div className={styles.rowDivider} />

              <div className={styles.summaryRow}>
                <span className={styles.rowLabel}>Loại đặt chỗ</span>
                <span className={styles.rowValue}>Ô tô khách vãng lai</span>
              </div>
              
              <div className={styles.rowDivider} />

              <div className={styles.summaryRow}>
                <span className={styles.rowLabel}>Phí đặt cọc</span>
                <span className={styles.rowValueGreen}>15.000đ</span>
              </div>
              
              <div className={styles.rowDivider} />

              <div className={styles.summaryRow}>
                <span className={styles.rowLabel}>Thời gian giữ chỗ</span>
                <span className={styles.rowValue} style={{ color: '#D97706' }}>30 phút</span>
              </div>
              
              <div className={styles.rowDivider} />
              
              <div className={styles.blueNote}>
                Vị trí đỗ cụ thể sẽ được bố trí khi bạn đến bãi.
              </div>
            </div>
          </div>

          {/* Card 2: Regulations */}
          <div className={styles.sidebarCard}>
            <div className={styles.sidebarTitleRow}>
              <div className={styles.titleIconCircle} style={{ background: '#ECFDF5' }}>
                <IconShield size={18} color="#10B981" />
              </div>
              <h3 className={styles.sidebarTitle}>Quy định sử dụng</h3>
            </div>

            <ul className={styles.rulesList}>
              {[
                'Chỉ áp dụng cho xe ô tô.',
                'Một lượt đặt chỗ chỉ áp dụng cho 1 xe.',
                'Không được chuyển nhượng lượt đặt chỗ.',
                'Hệ thống có quyền hủy chỗ nếu phát hiện hành vi gian lận.'
              ].map((rule, index) => (
                <li key={index} className={styles.ruleItem}>
                  <span className={styles.ruleCheck}>
                    <IconCheck size={10} color="#10B981" />
                  </span>
                  <span className={styles.ruleIcon}>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>

      {/* 4. Payment Modal */}
      {showPaymentModal && selectedVehicle && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 100, backdropFilter: 'blur(4px)' }} onClick={() => setShowPaymentModal(false)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 400, zIndex: 101,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1.5rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1E3A5F' }}>Thanh toán phí đặt cọc</h3>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#64748B', lineHeight: 1 }}>&times;</button>
            </div>
            
            <div style={{ padding: '2rem 1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748B' }}>Quét mã QR để thanh toán phí giữ chỗ</p>
              
              <div style={{ padding: '1rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, display: 'inline-block' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=PARKSMART_DEPOSIT_${selectedVehicle.plateNumber}`}
                  alt="QR Code"
                  style={{ width: 160, height: 160 }}
                />
              </div>
              
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#2563EB' }}>15.000đ</div>
              
              <div style={{ width: '100%', background: '#F1F5F9', borderRadius: 12, padding: '1rem', fontSize: '0.85rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Biển số:</span>
                  <span style={{ fontWeight: 700, color: '#1E3A5F' }}>{selectedVehicle.plateNumber}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Nội dung:</span>
                  <span style={{ fontWeight: 700, color: '#1E3A5F' }}>Coc giu cho {selectedVehicle.plateNumber}</span>
                </div>
              </div>
            </div>
            
            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setShowPaymentModal(false)} disabled={submitting} style={{ flex: 1, padding: '0.85rem', border: '1.5px solid #CBD5E1', borderRadius: 12, background: '#FFFFFF', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>
                Hủy
              </button>
              <button onClick={handleBooking} disabled={submitting} style={{ flex: 1.5, padding: '0.85rem', border: 'none', borderRadius: 12, background: '#2563EB', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}>
                {submitting ? 'Đang xử lý...' : 'Xác nhận đã chuyển khoản'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}