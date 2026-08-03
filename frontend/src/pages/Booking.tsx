import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { vehicleService } from '../services/vehicle.service';
import type { Vehicle, Booking } from '../types';
import styles from '../styles/booking.module.css';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

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



function formatExpiryDeadline(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${hh}:${mm} · ${dd}/${MM}/${yyyy}`;
}

// ── Main Page ──────────────────────────────────────────────
export function BookingPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState<Booking | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [hasActiveBooking, setHasActiveBooking] = useState(false);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'STRIPE' | null>(null);
  const [hasNoVisibleBookingCars, setHasNoVisibleBookingCars] = useState(false);
  const [nowTime, setNowTime] = useState(new Date());

  const selectedVehicleIdRef = useRef(selectedVehicleId);
  const isFirstLoadRef = useRef(true);
  const processingRef = useRef(false);

  useEffect(() => {
    selectedVehicleIdRef.current = selectedVehicleId;
  }, [selectedVehicleId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getRemainingTimeText = (expiresAtStr: string | null | undefined): string => {
    if (!expiresAtStr) return '';
    const expiresAt = new Date(expiresAtStr);
    const diffMs = expiresAt.getTime() - nowTime.getTime();
    if (diffMs <= 0) return 'Đã hết hạn';
    const mm = Math.floor(diffMs / 60000);
    const ss = Math.floor((diffMs % 60000) / 1000);
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const successParam = searchParams.get('success');
  const bookingIdParam = searchParams.get('booking_id');
  const [pollingStatus, setPollingStatus] = useState<'IDLE' | 'POLLING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT'>('IDLE');
  const [polledBooking, setPolledBooking] = useState<Booking | null>(null);

  const loadCars = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await vehicleService.getMyVehicles();
      const cars = (data ?? []).filter((v) => v.type === 'CAR');

      const isMonthlyPackage = (vehicle: Vehicle) => {
        if (typeof vehicle.hasActiveMonthlyPackage === 'boolean') {
          return vehicle.hasActiveMonthlyPackage;
        }
        const pkg = vehicle.monthlyPackage;
        return !!(pkg && pkg.status === 'ACTIVE' && new Date(pkg.expiryDate).getTime() > Date.now());
      };

      const isCurrentlyParked = (vehicle: Vehicle) => {
        if (typeof vehicle.isCurrentlyParked === 'boolean') {
          return vehicle.isCurrentlyParked;
        }
        return !!vehicle.checkInRecords?.some(
          (record) => record.checkOutTime == null
        );
      };

      // Hide only vehicles that are currently parked OR have an active monthly package
      const visibleCars = cars.filter((v) => !isCurrentlyParked(v) && !isMonthlyPackage(v));

      setVehicles(visibleCars);
      // Show empty state if all cars are hidden because they are currently parked or monthly
      setHasNoVisibleBookingCars(cars.length > 0 && visibleCars.length === 0);

      const activeRes = await api.get<{ success: boolean; data: Booking[] }>('/bookings/active');
      const activeList = activeRes.data.data || [];

      const myVehicleIds = cars.map((c) => c.id);
      const activeBookingData = activeList.find((b) => myVehicleIds.includes(b.vehicleId));
      if (activeBookingData) {
        setHasActiveBooking(true);
        setActiveBooking(activeBookingData);
        setSelectedVehicleId(null);
      } else {
        setHasActiveBooking(false);
        setActiveBooking(null);

        // Find the first selectable vehicle (has no active/pending bookings)
        const selectable = visibleCars.find(v => {
          const hasActiveOrPending = !!(v.bookings && v.bookings.some(b => ['ACTIVE', 'PENDING_PAYMENT'].includes(b.status)));
          return !hasActiveOrPending;
        });

        const currentSelectedId = selectedVehicleIdRef.current;
        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false;
          if (selectable) {
            setSelectedVehicleId(selectable.id);
          } else if (visibleCars.length > 0) {
            setSelectedVehicleId(visibleCars[0].id);
          } else {
            setSelectedVehicleId(null);
          }
        } else {
          // If we had a selection previously
          if (currentSelectedId !== null) {
            const prevVehicle = cars.find(c => c.id === currentSelectedId);
            if (prevVehicle) {
              const isParked = isCurrentlyParked(prevVehicle);
              const isMonthly = isMonthlyPackage(prevVehicle);
              if (isParked || isMonthly) {
                // Selection cleared and summary cleared
                setSelectedVehicleId(null);
                setSelectedMethod(null);
              } else {
                // Selection kept
                setSelectedVehicleId(currentSelectedId);
              }
            } else {
              setSelectedVehicleId(null);
            }
          }
        }
      }
    } catch {
      setErrorMsg('Không thể tải danh sách xe. Vui lòng tải lại trang.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Success check: if successParam === 'true' and bookingIdParam exists
    if (successParam === 'true' && bookingIdParam) {
      setPollingStatus('POLLING');
      window.history.replaceState({}, document.title, window.location.pathname);
      let attempts = 0;
      const maxAttempts = 15;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const res = await api.get<{ success: boolean; data: Booking }>(`/bookings/${bookingIdParam}`);
          const booking = res.data.data;
          const bookingFeePayment = booking.payments?.find(
            (payment) => payment.type === 'BOOKING_FEE'
          );

          const isPaid =
            bookingFeePayment?.status === 'SUCCESS' &&
            Number(bookingFeePayment.amount) === 15000;

          if (booking.status === 'ACTIVE' && isPaid && booking.expiresAt) {
            clearInterval(interval);
            setPollingStatus('IDLE');
            setPolledBooking(null);
            // Clear pending attempt on successful reconciliation
            sessionStorage.removeItem('pending_booking_id');
            await loadCars();
          } else if (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') {
            clearInterval(interval);
            setPollingStatus('FAILED');
            sessionStorage.removeItem('pending_booking_id');
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            setPollingStatus('TIMEOUT');
          }
        } catch (err) {
          console.error('Error polling booking status:', err);
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            setPollingStatus('TIMEOUT');
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [successParam, bookingIdParam, loadCars]);

  // Reusable function for resolving/abandoning stored pending booking.
  // Reads live URL params from window.location.search on every invocation
  // to avoid stale React Router searchParams after history.replaceState calls.
  const resolvePendingBooking = useCallback(async () => {
    // Read live parameters from the current URL — not stale React state
    const liveParams = new URLSearchParams(window.location.search);
    const liveSuccess = liveParams.get('success');
    const liveCancelledParam = liveParams.get('cancelled');
    const liveCancelledBookingId = liveParams.get('booking_id');

    // Never call abandon-payment during a success return
    if (liveSuccess === 'true') return;

    const storedPendingId = sessionStorage.getItem('pending_booking_id');

    const targetBookingId = (liveCancelledParam === 'true' && liveCancelledBookingId)
      ? liveCancelledBookingId
      : storedPendingId;

    if (!targetBookingId) return;
    if (processingRef.current) return;
    processingRef.current = true;

    // Clear URL via React Router navigate so later pageshow/focus reads
    // a clean URL and cannot reuse a stale cancelled booking_id
    if (liveCancelledParam === 'true') {
      navigate(window.location.pathname, { replace: true });
    }

    try {
      console.log(`[StripeAbandon] Resolving pending booking ID: ${targetBookingId}`);
      await api.post(`/bookings/${targetBookingId}/abandon-payment`);
      // HTTP 200: Definitive success — clear stored ID
      sessionStorage.removeItem('pending_booking_id');
      setErrorMsg('');
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 409 || status === 404) {
        // Definitive backend result — clear stored ID and refetch actual state
        sessionStorage.removeItem('pending_booking_id');
        setErrorMsg('');
      } else {
        // Network error or 5xx: keep pending_booking_id so next return can retry
        setErrorMsg('Không thể kiểm tra hoặc hủy thanh toán lúc này. Hệ thống sẽ tự động thử lại khi bạn quay lại trang.');
      }
    } finally {
      try {
        await loadCars();
      } catch (loadErr) {
        console.error('Failed to reload cars:', loadErr);
      }
      processingRef.current = false;
    }
  }, [navigate, loadCars]);

  // Initial mount: check live URL params and sessionStorage to decide whether to resolve or just load
  useEffect(() => {
    const liveParams = new URLSearchParams(window.location.search);
    const liveSuccess = liveParams.get('success');
    const liveCancelled = liveParams.get('cancelled');
    const liveCancelledBookingId = liveParams.get('booking_id');
    const storedPendingId = sessionStorage.getItem('pending_booking_id');
    const hasPending = storedPendingId || (liveCancelled === 'true' && liveCancelledBookingId);

    if (hasPending && liveSuccess !== 'true') {
      resolvePendingBooking();
    } else {
      loadCars();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount-only — resolvePendingBooking is stable (useCallback with navigate + loadCars)

  // Window pageshow (BFCache return) and focus listeners
  useEffect(() => {
    const handlePageShow = () => {
      resolvePendingBooking();
    };

    const handleFocus = () => {
      const storedPendingId = sessionStorage.getItem('pending_booking_id');
      if (storedPendingId) {
        resolvePendingBooking();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleFocus);
    };
  }, [resolvePendingBooking]);

  // ── Active-booking status polling (5 s) ──────────────
  // Runs only when there is an ACTIVE booking on screen.
  // Stops automatically when the booking reaches a terminal state.
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!activeBooking || activeBooking.status !== 'ACTIVE') {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const bookingId = activeBooking.id;

    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get<{ success: boolean; data: Booking }>(`/bookings/${bookingId}`);
        if (!mountedRef.current) return;
        const updated = res.data.data;
        if (
          updated.status === 'FULFILLED' ||
          updated.status === 'NO_SHOW' ||
          updated.status === 'CANCELLED'
        ) {
          if (pollingRef.current !== null) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          await loadCars();
        }
      } catch {
        // Network hiccup — silently ignore, retry on next interval
      }
    }, 5000);

    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [activeBooking, loadCars]);

  // ── Window-focus / visibility refresh ────────────────
  useRefreshOnFocus({ enabled: true, onRefresh: loadCars });

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;



  const handleOpenPaymentModal = () => {
    if (!selectedVehicle) {
      setErrorMsg('Vui lòng chọn phương tiện để đặt chỗ.');
      return;
    }
    setErrorMsg('');
    setBookingSuccess(null);
    setPolledBooking(null);
    setPollingStatus('IDLE');
    setSelectedMethod(null);
    setShowPaymentModal(true);
  };

  const handleProceedPayment = async () => {
    if (!selectedVehicle || selectedMethod !== 'STRIPE') return;

    setSubmitting(true);
    setErrorMsg('');
    try {
      const arrival = new Date();
      arrival.setMinutes(arrival.getMinutes() + 30);

      const res = await api.post<{ success: boolean; data: { checkoutUrl?: string; bookingId?: string } }>('/bookings/checkout-session', {
        vehicleId: selectedVehicle.id,
        expectedArrival: arrival.toISOString(),
      });

      if (res.data.data?.checkoutUrl) {
        if (res.data.data.bookingId) {
          sessionStorage.setItem('pending_booking_id', res.data.data.bookingId);
        }
        window.location.assign(res.data.data.checkoutUrl);
      } else {
        throw new Error('Không nhận được đường dẫn thanh toán từ Stripe');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      const rawMsg = error.response?.data?.message || error.message || '';
      const isTechnical = /prisma|constraint|D:\\Project_Cursor|db|database|server error|sql/i.test(rawMsg);
      if (isTechnical) {
        setErrorMsg('Không thể khởi tạo phiên thanh toán. Vui lòng thử lại.');
      } else {
        setErrorMsg(rawMsg || 'Không thể khởi tạo phiên thanh toán. Vui lòng thử lại.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setBookingSuccess(null);
    setPolledBooking(null);
    setPollingStatus('IDLE');
    setSelectedVehicleId(vehicles[0]?.id ?? null);
    setErrorMsg('');
  };

  // Active Booking Check is handled inline in the render method below

  // ── All Vehicles Monthly Check ──
  if (hasNoVisibleBookingCars) {
    return (
      <div className={styles.container} style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '3rem', background: '#FFFFFF', borderRadius: 20, boxShadow: '0 10px 25px rgba(0,0,0,0.05)', maxWidth: 500 }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🚗</span>
          <h3 style={{ color: '#1E3A5F', margin: '0 0 0.5rem', fontWeight: 800 }}>Không có xe ô tô phù hợp để đặt chỗ</h3>
          <p style={{ color: '#64748B', margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
            Xe đang gửi trong bãi hoặc đang sử dụng gói tháng sẽ không xuất hiện tại đây.
          </p>
        </div>
      </div>
    );
  }

  // ── Polling screens ──────────────────────────────────────
  if (pollingStatus === 'POLLING') {
    return (
      <div className={styles.container} style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '3rem', background: '#FFFFFF', borderRadius: 20, boxShadow: '0 10px 25px rgba(0,0,0,0.05)', maxWidth: 500 }}>
          <div style={{ border: '4px solid #E2E8F0', borderTop: '4px solid #2563EB', borderRadius: '50%', width: 40, height: 40, animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }} />
          <h3 style={{ color: '#1E3A5F', margin: '0 0 0.5rem', fontWeight: 800 }}>Đang xác nhận thanh toán với Stripe.</h3>
          <p style={{ color: '#64748B', margin: 0, fontSize: '0.9rem' }}>Vui lòng đợi trong giây lát...</p>
        </div>
      </div>
    );
  }

  if (pollingStatus === 'FAILED') {
    return (
      <div className={styles.container} style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '3rem', background: '#FFFFFF', borderRadius: 20, boxShadow: '0 10px 25px rgba(0,0,0,0.05)', maxWidth: 500 }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>❌</span>
          <h3 style={{ color: '#DC2626', margin: '0 0 0.5rem', fontWeight: 700 }}>Thanh toán thất bại hoặc đặt chỗ đã bị hủy</h3>
          <p style={{ color: '#64748B', margin: '0 0 1.5rem', fontSize: '0.9rem' }}>Yêu cầu thanh toán của bạn chưa thành công hoặc đã hết hạn.</p>
          <button onClick={() => window.location.href = '/driver/booking'} className={styles.confirmBtn}>Thử lại</button>
        </div>
      </div>
    );
  }

  if (pollingStatus === 'TIMEOUT') {
    return (
      <div className={styles.container} style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '3rem', background: '#FFFFFF', borderRadius: 20, boxShadow: '0 10px 25px rgba(0,0,0,0.05)', maxWidth: 500 }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>⚠️</span>
          <h3 style={{ color: '#D97706', margin: '0 0 0.5rem', fontWeight: 700 }}>Chưa nhận được phản hồi thanh toán</h3>
          <p style={{ color: '#64748B', margin: '0 0 1.5rem', fontSize: '0.9rem' }}>Hệ thống chưa nhận được phản hồi thanh toán từ Stripe. Vui lòng tải lại trang để kiểm tra trạng thái.</p>
          <button onClick={() => window.location.reload()} className={styles.confirmBtn}>Tải lại trang</button>
        </div>
      </div>
    );
  }

  // ── Success screen ───────────────────────────────────────
  const displayBooking = bookingSuccess ?? polledBooking;
  const displayVehicle = bookingSuccess?.vehicle ?? polledBooking?.vehicle;

  if (displayBooking && displayVehicle) {
    const floorName = displayBooking.floor?.name || '';

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
                  {(() => {
                    const desc = [displayVehicle.brand, displayVehicle.model].filter(Boolean).join(' ');
                    return desc ? `${displayVehicle.plateNumber} (${desc})` : displayVehicle.plateNumber;
                  })()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phí đặt cọc đã thanh toán</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#10B981' }}>
                  {Number(displayBooking.depositAmount) > 0 ? '15.000đ' : 'Miễn phí (Thuê bao tháng)'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Giữ chỗ đến</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#D97706' }}>
                  {displayBooking.expiresAt
                    ? formatExpiryDeadline(displayBooking.expiresAt)
                    : (displayBooking.expectedArrival ? formatExpiryDeadline(displayBooking.expectedArrival) : '30 phút')
                  }
                </span>
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
                  {floorName ? (
                    <>
                      Khu vực đỗ xe: <strong style={{ color: '#1E3A5F', fontWeight: 700 }}>{floorName}</strong>
                    </>
                  ) : (
                    <>
                      Khu vực đỗ xe: <strong style={{ color: '#1E3A5F', fontWeight: 700 }}>Chưa xác định</strong>
                    </>
                  )}
                </span>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', lineHeight: 1.5, fontWeight: 500 }}>
                  Khi đến bãi, bạn vào đúng tầng/khu vực được hướng dẫn và tự chọn một vị trí còn trống.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (successParam) {
                  window.location.href = '/driver/booking';
                } else {
                  handleReset();
                }
              }}
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
          Đặt chỗ trước giúp bạn tiết kiệm thời gian và đảm bảo một suất trong thời gian giữ chỗ.
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
              Bạn chỉ cần chọn xe và xác nhận đặt chỗ. Hệ thống sẽ giữ một suất tại tầng/khu vực phù hợp. Khi đến bãi, bạn tự chọn một vị trí còn trống.
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

          {/* Active Booking Card */}
          {hasActiveBooking && activeBooking && (
            <div style={{
              background: 'linear-gradient(135deg, #1E3A5F 0%, #2C4F78 100%)',
              borderRadius: 20,
              color: '#FFFFFF',
              padding: '2rem',
              border: '1px solid #E2E8F0',
              boxShadow: '0 10px 25px -5px rgba(15,23,42,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🕒</span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.35 }}>Lượt đặt chỗ đang hoạt động</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(255,255,255,0.08)', padding: '1.25rem', borderRadius: 16 }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '2px', lineHeight: 1.35, letterSpacing: '0.04em' }}>Biển số xe</span>
                  <strong style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 600, lineHeight: 1.4 }}>{activeBooking.vehicle?.plateNumber}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '2px', lineHeight: 1.35, letterSpacing: '0.04em' }}>Thông tin xe</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.4 }}>{activeBooking.vehicle?.brand} {activeBooking.vehicle?.model}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '2px', lineHeight: 1.35, letterSpacing: '0.04em' }}>Khu vực</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.4 }}>{activeBooking.floor?.name || 'Chưa xác định'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '2px', lineHeight: 1.35, letterSpacing: '0.04em' }}>Phân loại</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.4 }}>Ô tô khách vãng lai</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '2px', lineHeight: 1.35, letterSpacing: '0.04em' }}>Trạng thái cọc</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#10B981', lineHeight: 1.4 }}>Đã thanh toán (15.000đ)</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '2px', lineHeight: 1.35, letterSpacing: '0.04em' }}>Trạng thái chỗ</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#FBBF24', lineHeight: 1.4 }}>Đang giữ chỗ</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '2px', lineHeight: 1.35, letterSpacing: '0.04em' }}>Bắt đầu từ</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.4 }}>{activeBooking.confirmedAt ? formatExpiryDeadline(activeBooking.confirmedAt) : '—'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '2px', lineHeight: 1.35, letterSpacing: '0.04em' }}>Hạn giữ chỗ</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.4 }}>{activeBooking.expiresAt ? formatExpiryDeadline(activeBooking.expiresAt) : '—'}</span>
                </div>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.12)',
                padding: '1rem',
                borderRadius: 16,
                textAlign: 'center',
                fontSize: '16px',
                fontWeight: 600,
                border: '1px dashed rgba(255,255,255,0.2)',
                lineHeight: '1.3'
              }}>
                Thời gian còn lại: <span style={{ color: '#FBBF24', fontFamily: 'monospace', fontWeight: 700 }}>{getRemainingTimeText(activeBooking.expiresAt)}</span>
              </div>
            </div>
          )}

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
                  const pkg = v.monthlyPackage;
                  const isMonthlyPackage = !!(pkg && pkg.status === 'ACTIVE' && new Date(pkg.expiryDate).getTime() > Date.now());

                  const isParked = !!(v.checkInRecords && v.checkInRecords.length > 0);

                  const hasActive = !!(v.bookings && v.bookings.some(b => b.status === 'ACTIVE'));
                  const activeBookingObj = v.bookings?.find(b => b.status === 'ACTIVE');

                  const isSelected = v.id === selectedVehicleId;
                  const shouldDisable = isMonthlyPackage || isParked || hasActive || hasActiveBooking;

                  return (
                    <div
                      key={v.id}
                      onClick={() => {
                        if (shouldDisable) return;
                        setSelectedVehicleId(v.id);
                        setErrorMsg('');
                      }}
                      style={shouldDisable ? { pointerEvents: 'none', cursor: 'not-allowed', background: '#F1F5F9', border: '1px solid #E2E8F0' } : { cursor: 'pointer' }}
                      className={`${styles.vehicleCard} ${isSelected && !shouldDisable ? styles.vehicleCardSelected : ''} ${shouldDisable ? styles.vehicleCardDisabled : ''}`}
                    >
                      {/* Radio indicator */}
                      <div className={styles.radioIndicator}>
                        {!shouldDisable && isSelected && <div className={styles.radioDot} />}
                      </div>

                      {/* Real Car Image */}
                      <img src="/Car.png" alt="" className={styles.vehicleCarImage} style={shouldDisable ? { opacity: 0.5 } : {}} />

                      {/* Vehicle Details */}
                      <div
                        className={styles.vehicleInfo}
                        style={{
                          minWidth: 0,
                          width: '100%',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          boxSizing: 'border-box'
                        }}
                      >
                        <span className={styles.plateNumber} style={shouldDisable ? { color: '#64748B' } : {}}>
                          {v.plateNumber}
                        </span>
                        <span className={styles.vehicleDesc} style={shouldDisable ? { color: '#94A3B8' } : {}}>
                          {(() => {
                            const desc = [v.brand, v.model].filter(Boolean).join(' ');
                            return desc || 'Ô tô';
                          })()}
                        </span>
                        {isMonthlyPackage ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', alignItems: 'center' }}>
                            <span style={{ background: '#EFF6FF', color: '#1E40AF', fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: 12, width: 'fit-content', lineHeight: 1.35 }}>Gói tháng</span>
                            <span style={{ fontSize: '11px', color: '#1E40AF', fontWeight: 600, display: 'block', textAlign: 'center', width: '100%' }}>Không cần đặt chỗ</span>
                          </div>
                        ) : isParked ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', alignItems: 'center' }}>
                            <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: 12, width: 'fit-content', lineHeight: 1.35 }}>Đang trong bãi</span>
                            <span style={{ fontSize: '11px', color: '#15803D', fontWeight: 600, display: 'block', textAlign: 'center', width: '100%' }}>Vui lòng check-out</span>
                          </div>
                        ) : hasActive ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', alignItems: 'center' }}>
                            <span style={{ background: '#FFFBEB', color: '#D97706', fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: 12, width: 'fit-content', lineHeight: 1.35 }}>Đang giữ chỗ</span>
                            <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 600, display: 'block', textAlign: 'center', width: '100%' }}>Còn {getRemainingTimeText(activeBookingObj?.expiresAt)}</span>
                          </div>
                        ) : hasActiveBooking ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', alignItems: 'center' }}>
                            <span style={{ background: '#F1F5F9', color: '#64748B', fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: 12, width: 'fit-content', lineHeight: 1.35 }}>Chưa thể đặt chỗ</span>
                            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, display: 'block', textAlign: 'center', width: '100%' }}>Chờ lượt kết thúc</span>
                          </div>
                        ) : isSelected ? (
                          <span className={styles.activeBadge}>Đang chọn</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Booking details */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              {hasActiveBooking ? '2. Thông tin lượt giữ chỗ' : '2. Thông tin đặt chỗ'}
            </h3>
            <p className={styles.cardSubtitle}>
              Thông tin chi tiết về lượt giữ chỗ của phương tiện.
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
                  <p className={styles.summaryColLabel}>Hướng dẫn khi đến bãi</p>
                  <p className={`${styles.summaryColValue} ${styles.summaryColValueLong}`}>
                    Vào đúng tầng/khu vực được chỉ định và tự chọn vị trí còn trống.
                  </p>
                </div>
              </div>
            </div>

            {/* arrangement disclaimer note */}
            <div className={styles.disclaimerText}>
              Lượt đặt chỗ chỉ đảm bảo sức chứa tại tầng/khu vực, không giữ một ô đỗ cụ thể.
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
          {!hasActiveBooking && (
            <button
              onClick={handleOpenPaymentModal}
              disabled={submitting || !selectedVehicleId}
              className={styles.confirmBtn}
            >
              {submitting ? (
                'Đang xử lý...'
              ) : (
                <>
                  <IconCheck size={18} color="#FFFFFF" />
                  Đặt chỗ
                </>
              )}
            </button>
          )}
        </div>

        {/* RIGHT COLUMN: Sidebar Summary (30%) */}
        <div className={styles.sidebarWrapper}>

          {/* Card 1: Booking Summary */}
          <div className={styles.sidebarCard}>
            <div className={styles.sidebarTitleRow}>
              <div className={styles.titleIconCircle}>
                <IconTicket size={18} color="#2563EB" />
              </div>
              <h3 className={styles.sidebarTitle}>{hasActiveBooking ? 'Đang giữ chỗ' : 'Tóm tắt đặt chỗ'}</h3>
            </div>

            {hasActiveBooking && activeBooking ? (
              <div className={styles.summaryRows}>
                <div className={styles.summaryRow}>
                  <span className={styles.rowLabel}>Xe đang giữ chỗ</span>
                  <div className={styles.summaryVehicleInfo}>
                    <img src="/Car.png" alt="" className={styles.summaryVehicleImage} />
                    <div>
                      <div className={styles.rowCarPlate}>{activeBooking.vehicle?.plateNumber}</div>
                      <div className={styles.rowCarName}>{activeBooking.vehicle?.brand || 'Ô tô'} {activeBooking.vehicle?.model || ''}</div>
                    </div>
                  </div>
                </div>

                <div className={styles.rowDivider} />

                <div className={styles.summaryRow}>
                  <span className={styles.rowLabel}>Khu vực đỗ xe</span>
                  <span className={styles.rowValue} style={{ fontWeight: 600 }}>{activeBooking.floor?.name || '—'}</span>
                </div>

                <div className={styles.rowDivider} />

                <div className={styles.summaryRow}>
                  <span className={styles.rowLabel}>Tiền cọc đã trả</span>
                  <span className={styles.rowValueGreen} style={{ fontWeight: 600 }}>15.000đ</span>
                </div>

                <div className={styles.rowDivider} />

                <div className={styles.summaryRow}>
                  <span className={styles.rowLabel}>Thời gian còn lại</span>
                  <span className={styles.rowValue} style={{ color: '#D97706', fontWeight: 600 }}>
                    {getRemainingTimeText(activeBooking.expiresAt)}
                  </span>
                </div>

                <div className={styles.rowDivider} />

                <div className={styles.blueNote}>
                  Khi đến bãi, bạn vào đúng tầng/khu vực được hướng dẫn và tự chọn một vị trí còn trống.
                </div>
              </div>
            ) : (
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
                  Khi đến bãi, bạn vào đúng tầng/khu vực được hướng dẫn và tự chọn một vị trí còn trống.
                </div>
              </div>
            )}
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
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 100, backdropFilter: 'blur(4px)' }} onClick={() => { setShowPaymentModal(false); setErrorMsg(''); }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 400, zIndex: 101,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1.5rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1E3A5F' }}>Chọn phương thức thanh toán</h3>
              <button onClick={() => { setShowPaymentModal(false); setErrorMsg(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#64748B', lineHeight: 1 }}>&times;</button>
            </div>

            {errorMsg && (
              <div style={{ padding: '1rem 1.5rem', background: '#FEF2F2', color: '#EF4444', borderBottom: '1px solid #FCA5A5', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 600 }}>Phí giữ chỗ:</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#2563EB' }}>15.000đ</span>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Option 1: Stripe */}
              <div
                onClick={() => setSelectedMethod('STRIPE')}
                style={{
                  padding: '1.25rem',
                  borderRadius: 16,
                  border: selectedMethod === 'STRIPE' ? '2px solid #2563EB' : '1px solid #E2E8F0',
                  background: selectedMethod === 'STRIPE' ? '#EFF6FF' : '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, color: '#1E3A5F', fontSize: '0.95rem' }}>Thẻ ngân hàng qua Stripe</span>
                  <input
                    type="radio"
                    checked={selectedMethod === 'STRIPE'}
                    onChange={() => setSelectedMethod('STRIPE')}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
                <span style={{ fontSize: '0.8rem', color: '#64748B', lineHeight: 1.4 }}>
                  Thanh toán an toàn bằng Visa, Mastercard hoặc phương thức được Stripe hỗ trợ.
                </span>
              </div>

              {/* Option 2: MoMo */}
              <div style={{ padding: '1rem 1.25rem', borderRadius: 16, border: '1px solid #E2E8F0', background: '#F8FAFC', opacity: 0.6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'not-allowed' }}>
                <span style={{ fontWeight: 800, color: '#64748B', fontSize: '0.95rem' }}>Ví điện tử MoMo</span>
                <span style={{ fontSize: '0.7rem', color: '#64748B', background: '#E2E8F0', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>Sắp được hỗ trợ</span>
              </div>

              {/* Option 3: VNPay */}
              <div style={{ padding: '1rem 1.25rem', borderRadius: 16, border: '1px solid #E2E8F0', background: '#F8FAFC', opacity: 0.6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'not-allowed' }}>
                <span style={{ fontWeight: 800, color: '#64748B', fontSize: '0.95rem' }}>Cổng thanh toán VNPay</span>
                <span style={{ fontSize: '0.7rem', color: '#64748B', background: '#E2E8F0', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>Sắp được hỗ trợ</span>
              </div>

              {/* Option 4: Chuyển khoản QR */}
              <div style={{ padding: '1rem 1.25rem', borderRadius: 16, border: '1px solid #E2E8F0', background: '#F8FAFC', opacity: 0.6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'not-allowed' }}>
                <span style={{ fontWeight: 800, color: '#64748B', fontSize: '0.95rem' }}>Chuyển khoản QR</span>
                <span style={{ fontSize: '0.7rem', color: '#64748B', background: '#E2E8F0', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>Sắp được hỗ trợ</span>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => { setShowPaymentModal(false); setErrorMsg(''); }}
                disabled={submitting}
                style={{ flex: 1, padding: '0.85rem', border: '1.5px solid #CBD5E1', borderRadius: 12, background: '#FFFFFF', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
              >
                Quay lại
              </button>
              <button
                onClick={handleProceedPayment}
                disabled={submitting || selectedMethod !== 'STRIPE'}
                style={{
                  flex: 1.5, padding: '0.85rem', border: 'none', borderRadius: 12,
                  background: selectedMethod === 'STRIPE' ? '#2563EB' : '#94A3B8',
                  color: '#FFFFFF', fontWeight: 700, cursor: selectedMethod === 'STRIPE' ? 'pointer' : 'not-allowed',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? 'Đang kết nối...' : 'Tiếp tục thanh toán'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
