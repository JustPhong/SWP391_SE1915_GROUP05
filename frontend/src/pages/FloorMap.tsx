import { useState, useEffect, useCallback } from 'react';
import { floorMapService, type FloorWithSlots } from '../services/floorMap.service';
import type { ParkingSlot, Floor } from '../types';
import styles from '../styles/staff.module.css';

// ═══════════════════════════════════════════════════════
//  PALETTE
// ═══════════════════════════════════════════════════════
const C = {
  navy: '#1E3A5F',
  navyLight: '#2C4F78',
  bg: '#F0F4F8',
  white: '#FFFFFF',
  blue: '#3B82F6',
  blueBg: '#EFF6FF',
  green: '#22C55E',
  greenBg: '#DCFCE7',
  red: '#DC2626',
  redBg: '#FEE2E2',
  amber: '#D97706',
  amberBg: '#FFFBEB',
  amberLight: '#FEF3C7',
  amberBorder: '#F59E0B',
  gray50: '#F9FAFB',
  gray100: '#F3F5F7',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#9BA8B4',
  gray600: '#5C6B7A',
  gray800: '#2D3A45',
  shadow: '0 8px 32px rgba(30, 58, 95, 0.08)',
};

// ═══════════════════════════════════════════════════════
//  ICONS
// ═══════════════════════════════════════════════════════
function IconCar({ size = 16 }: { size?: number; color?: string }) {
  return (
    <span style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>🚗</span>
  );
}
function IconBike({ size = 16 }: { size?: number; color?: string }) {
  return (
    <span style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>🛵</span>
  );
}
function IconLock({ size = 14, color = C.blue }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>;
}
function IconCheck({ size = 14, color = C.green }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}
function IconStar({ size = 12, color = C.amber }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
}
function IconInfo({ size = 15, color = C.navy }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
}
function IconClock({ size = 15, color = C.gray600 }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>;
}
function IconX({ size = 14, color = C.red }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
}

// ═══════════════════════════════════════════════════════
//  SLOT CARD
// ═══════════════════════════════════════════════════════
interface SlotCardProps {
  slot: ParkingSlot;
  isSelected: boolean;
  isSuggested: boolean;
  canBook: boolean;
  onSelect: (slot: ParkingSlot) => void;
}

function SlotCard({ slot, isSelected, isSuggested, canBook, onSelect }: SlotCardProps) {
  const isAvailable = slot.status === 'AVAILABLE';
  const isOccupied = slot.status === 'OCCUPIED';
  const isReserved = slot.status === 'RESERVED';

  let bgColor: string;
  let borderColor: string;
  let textColor: string;
  let icon: JSX.Element;
  let ring = false;

  if (isOccupied) {
    bgColor = C.gray600;
    borderColor = C.gray600;
    textColor = C.white;
    icon = <IconCar size={15} color={C.white} />;
  } else if (isReserved) {
    bgColor = C.amberLight;
    borderColor = C.amberBorder;
    textColor = '#92400E';
    icon = <IconLock size={13} color={C.amberBorder} />;
  } else {
    // AVAILABLE
    if (isSelected) {
      bgColor = C.navy;
      borderColor = C.navy;
      textColor = C.white;
      icon = <IconCheck size={13} color={C.white} />;
      ring = true;
    } else {
      bgColor = C.greenBg;
      borderColor = isSuggested ? C.amber : C.green;
      textColor = C.green;
      icon = isSuggested ? <IconStar size={13} color={C.amber} /> : <IconCheck size={13} color={C.green} />;
      if (isSuggested) ring = true;
    }
  }

  const isClickable = canBook && isAvailable;

  return (
    <button
      onClick={() => isClickable && onSelect(slot)}
      disabled={!isClickable}
      title={isAvailable ? (canBook ? `Chọn vị trí ${slot.code}` : 'Vị trí trống') : `Slot ${slot.code}: ${slot.status}`}
      style={{
        width: 64,
        height: 56,
        background: bgColor,
        border: ring ? `2px solid ${C.navy}` : `1.5px solid ${borderColor}`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        cursor: isClickable ? 'pointer' : 'not-allowed',
        opacity: isClickable ? 1 : 0.65,
        boxShadow: isSelected ? `0 0 0 3px ${C.navy}30` : 'none',
        padding: 0,
        position: 'relative',
        boxSizing: 'border-box',
        transition: 'all 0.15s ease',
      }}
    >
      <span style={{ color: textColor, fontSize: '0.75rem', fontWeight: 700 }}>{slot.code}</span>
      {icon}
      {isSuggested && !isSelected && (
        <span style={{
          position: 'absolute',
          top: -7,
          right: -4,
          background: C.amber,
          color: C.white,
          fontSize: '0.58rem',
          fontWeight: 700,
          padding: '1px 4px',
          borderRadius: 6,
          letterSpacing: '0.02em',
          lineHeight: 1.4,
        }}>
          Gợi ý
        </span>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════
//  BOOKING FORM MODAL
// ═══════════════════════════════════════════════════════
interface BookingFormProps {
  slot: ParkingSlot;
  floor: Floor;
  onConfirm: (plateNumber: string, expectedArrival: Date) => Promise<void>;
  onCancel: () => void;
}

function BookingForm({ slot, floor, onConfirm, onCancel }: BookingFormProps) {
  const [plateNumber, setPlateNumber] = useState('');
  const [expectedArrival, setExpectedArrival] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!plateNumber.trim()) { setError('Vui lòng nhập biển số xe'); return; }
    if (!expectedArrival) { setError('Vui lòng chọn thời gian đến'); return; }
    const arrDate = new Date(expectedArrival);
    if (arrDate <= new Date()) { setError('Thời gian đến phải trong tương lai'); return; }
    setSubmitting(true);
    try {
      await onConfirm(plateNumber.trim(), arrDate);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Đặt chỗ thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const defaultArrival = new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <div style={{
      background: C.white,
      borderRadius: 16,
      boxShadow: C.shadow,
      padding: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: C.gray800 }}>
            Đặt chỗ trước
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: C.gray600 }}>
            {floor.name} · Vị trí <strong style={{ color: C.navy }}>{slot.code}</strong>
          </p>
        </div>
        <button onClick={onCancel} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0.25rem', display: 'flex', alignItems: 'center',
        }}>
          <IconX size={18} color={C.gray400} />
        </button>
      </div>

      {/* Info banner */}
      <div style={{
        background: C.blueBg,
        border: '1px solid #BFDBFE',
        borderRadius: 10,
        padding: '0.6rem 0.85rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        marginBottom: '1.25rem',
      }}>
        <IconInfo size={14} color={C.blue} />
        <p style={{ margin: 0, fontSize: '0.78rem', color: C.navy, lineHeight: 1.4 }}>
          Chỉ dành cho <strong>Ô tô</strong> tại Tầng 3. Đặt chỗ sẽ được giữ trong 30 phút.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.gray800, marginBottom: '0.35rem' }}>
            Biển số xe
          </label>
          <input
            type="text"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
            placeholder="VD: 30A-123.45"
            style={{
              width: '100%',
              padding: '0.6rem 0.85rem',
              border: `1.5px solid ${C.gray200}`,
              borderRadius: 8,
              fontSize: '0.9rem',
              color: C.gray800,
              boxSizing: 'border-box',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: C.gray800, marginBottom: '0.35rem' }}>
            Thời gian đến dự kiến
          </label>
          <input
            type="datetime-local"
            value={expectedArrival || defaultArrival}
            onChange={(e) => setExpectedArrival(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            style={{
              width: '100%',
              padding: '0.6rem 0.85rem',
              border: `1.5px solid ${C.gray200}`,
              borderRadius: 8,
              fontSize: '0.9rem',
              color: C.gray800,
              boxSizing: 'border-box',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {error && (
          <div style={{
            background: C.redBg,
            border: '1px solid #FECACA',
            borderRadius: 8,
            padding: '0.5rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <IconX size={13} color={C.red} />
            <span style={{ fontSize: '0.8rem', color: C.red }}>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{
              flex: 1,
              padding: '0.7rem',
              background: C.white,
              border: `1.5px solid ${C.gray200}`,
              borderRadius: 10,
              fontSize: '0.875rem',
              fontWeight: 600,
              color: C.gray600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              flex: 2,
              padding: '0.7rem',
              background: submitting ? C.gray300 : C.navy,
              color: submitting ? C.gray400 : C.white,
              border: 'none',
              borderRadius: 10,
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: submitting ? 'none' : '0 4px 14px rgba(30,58,95,0.25)',
            }}
          >
            {submitting ? 'Đang xử lý...' : 'Xác nhận đặt chỗ'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export function FloorMapPage() {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [activeFloorCode, setActiveFloorCode] = useState<string>('G');
  const [activeFloor, setActiveFloor] = useState<FloorWithSlots | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null);
  const [bookingSlot, setBookingSlot] = useState<ParkingSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const canBook = false;

  // Load floor list on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await floorMapService.getAllFloors();
        setFloors(data);
        if (data.length > 0) {
          setActiveFloorCode(data[0].floorCode);
        }
      } catch (err) {
        console.error('Failed to load floors:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load active floor's slots whenever floor changes
  useEffect(() => {
    if (!activeFloorCode) return;
    (async () => {
      try {
        const data = await floorMapService.getSlotsByFloor(activeFloorCode);
        setActiveFloor(data);
      } catch (err) {
        console.error('Failed to load slots:', err);
      }
    })();
  }, [activeFloorCode]);

  // Refresh slots after booking/cancel
  const refreshSlots = useCallback(async () => {
    try {
      const data = await floorMapService.getSlotsByFloor(activeFloorCode);
      setActiveFloor(data);
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  }, [activeFloorCode]);

  const handleSelectSlot = (slot: ParkingSlot) => {
    if (selectedSlot?.id === slot.id) {
      setSelectedSlot(null);
    } else {
      setSelectedSlot(slot);
    }
  };

  const handleBookClick = () => {
    if (selectedSlot?.status === 'AVAILABLE') {
      setBookingSlot(selectedSlot);
      setSuccessMsg('');
    }
  };

  const handleConfirmBooking = async (plateNumber: string, expectedArrival: Date) => {
    if (!bookingSlot) return;
    setSubmitting(true);
    try {
      await floorMapService.createBooking({
        plateNumber,
        slotId: bookingSlot.id,
        expectedArrival: expectedArrival.toISOString(),
      });
      setSuccessMsg(`Đặt chỗ thành công! Vị trí ${bookingSlot.code} đã được giữ đến ${expectedArrival.toLocaleString('vi-VN')}.`);
      setBookingSlot(null);
      setSelectedSlot(null);
      await refreshSlots();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async (bookingId: number) => {
    setSubmitting(true);
    try {
      await floorMapService.cancelBooking(bookingId);
      setSuccessMsg('Đặt chỗ đã được hủy thành công.');
      await refreshSlots();
    } finally {
      setSubmitting(false);
    }
  };

  // Build 2 logical rows for the grid (odd = row A, even = row B)
  const slots = activeFloor?.slots ?? [];
  const half = Math.ceil(slots.length / 2);
  const rowA = slots.slice(0, half);
  const rowB = slots.slice(half);

  // Suggested slots: first AVAILABLE slot per row (only for Tầng 3)
  const suggestedCodes = new Set<string>();
  if (activeFloorCode === '3') {
    if (rowA.find((s) => s.status === 'AVAILABLE')) suggestedCodes.add(rowA.find((s) => s.status === 'AVAILABLE')!.id);
    if (rowB.find((s) => s.status === 'AVAILABLE')) suggestedCodes.add(rowB.find((s) => s.status === 'AVAILABLE')!.id);
  }

  const floorLabel = (code: string) => {
    const f = floors.find((fl) => fl.floorCode === code);
    return f?.name ?? `Tầng ${code}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
        <p style={{ color: C.gray400, fontSize: '0.9rem' }}>Đang tải sơ đồ bãi đổ...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── 1. Controls card ──────────────────────────────── */}
      <div className={styles.card}>
        {/* Floor tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: floors.length > 0 ? '1rem' : 0, flexWrap: 'wrap' }}>
          {floors.map((floor) => {
            const active = floor.floorCode === activeFloorCode;
            const isT3 = floor.floorCode === '3';
            return (
              <button
                key={floor.floorCode}
                onClick={() => { setActiveFloorCode(floor.floorCode); setSelectedSlot(null); setBookingSlot(null); setSuccessMsg(''); }}
                style={{
                  padding: '0.4rem 1rem',
                  borderRadius: 8,
                  border: `1.5px solid ${active ? C.navy : C.gray200}`,
                  background: active ? C.navy : C.white,
                  color: active ? C.white : C.navy,
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.15s ease',
                }}
              >
                {floor.vehicleType === 'CAR'
                  ? <IconCar size={13} color={active ? C.white : '#3B82F6'} />
                  : <IconBike size={13} color={active ? C.white : '#F97316'} />}
                {floor.name}
                {isT3 && (
                  <span style={{
                    fontSize: '0.6rem',
                    background: active ? C.amber : C.amberBg,
                    color: active ? C.white : C.amber,
                    borderRadius: 10,
                    padding: '1px 6px',
                    fontWeight: 700,
                  }}>
                    VÃNG LAI
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', paddingTop: floors.length > 0 ? '0.75rem' : 0, borderTop: floors.length > 0 ? `1px solid ${C.gray100}` : 'none' }}>
          {([
            { bg: C.greenBg, border: C.green, label: 'Trống', dot: C.green },
            { bg: C.amberLight, border: C.amberBorder, label: 'Đã đặt trước', dot: C.amberBorder },
            { bg: C.gray600, border: C.gray600, label: 'Đang sử dụng', dot: C.gray600 },
            ...(activeFloorCode === '3' ? [{ bg: C.amberBg, border: C.amber, label: 'Gợi ý', dot: C.amber }] : []),
          ] as const).map(({ bg, border, label, dot }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: dot }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1.5px solid ${border}`, display: 'inline-block', flexShrink: 0 }} />
              {label}
            </span>
          ))}

          {canBook && (
            <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: C.blue, fontWeight: 600 }}>
              Nhấn vào ô trống để đặt chỗ
            </span>
          )}
        </div>
      </div>

      {/* ── 2. Two-column layout ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: canBook ? '3fr 2fr' : '1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* LEFT: Slot map card */}
        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: C.gray800 }}>
                Sơ đồ {floorLabel(activeFloorCode)}
              </h2>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: C.gray400 }}>
                {activeFloor?.vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy'} ·{' '}
                {activeFloor?.customerType === 'CASUAL' ? 'Khách vãng lai' : 'Khách tháng'}
                {activeFloor && ` · ${activeFloor.slots.filter(s => s.status === 'AVAILABLE').length}/${activeFloor.slots.length} chỗ trống`}
              </p>
            </div>
          </div>

          {/* Success message */}
          {successMsg && (
            <div style={{
              background: C.greenBg,
              border: `1.5px solid ${C.green}`,
              borderRadius: 10,
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              marginBottom: '1rem',
            }}>
              <IconCheck size={18} color={C.green} />
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#15803D', lineHeight: 1.5 }}>{successMsg}</p>
            </div>
          )}

          {/* Slot grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {/* Row A */}
            {rowA.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 26, height: 26, background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: C.navy }}>A</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {rowA.map((slot) => (
                    <SlotCard
                      key={slot.id}
                      slot={slot}
                      isSelected={selectedSlot?.id === slot.id}
                      isSuggested={suggestedCodes.has(slot.id)}
                      canBook={canBook}
                      onSelect={handleSelectSlot}
                    />
                  ))}
                </div>
              </div>
            )}
            {/* Row B */}
            {rowB.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 26, height: 26, background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: C.navy }}>B</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {rowB.map((slot) => (
                    <SlotCard
                      key={slot.id}
                      slot={slot}
                      isSelected={selectedSlot?.id === slot.id}
                      isSuggested={suggestedCodes.has(slot.id)}
                      canBook={canBook}
                      onSelect={handleSelectSlot}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Booking panel (driver on Tầng 3 only) */}
        {canBook && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '1.5rem' }}>

            {bookingSlot && activeFloor ? (
              <BookingForm
                slot={bookingSlot}
                floor={activeFloor}
                onConfirm={handleConfirmBooking}
                onCancel={() => { setBookingSlot(null); }}
              />
            ) : selectedSlot ? (
              <div className={styles.card}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 800, color: C.gray800 }}>
                  Vị trí đã chọn
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: C.gray600 }}>Vị trí</span>
                    <strong style={{ fontSize: '1rem', color: C.navy }}>{selectedSlot.code}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: C.gray600 }}>Tầng</span>
                    <span style={{ fontSize: '0.875rem', color: C.gray800 }}>{floorLabel(activeFloorCode)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: C.gray600 }}>Loại xe</span>
                    <span style={{ fontSize: '0.875rem', color: C.gray800 }}>
                      {activeFloor?.vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: C.gray600 }}>Trạng thái</span>
                    <span style={{ fontSize: '0.875rem', color: selectedSlot.status === 'AVAILABLE' ? C.green : C.amber }}>
                      {selectedSlot.status === 'AVAILABLE' ? 'Trống' : selectedSlot.status === 'RESERVED' ? 'Đã đặt' : 'Đang sử dụng'}
                    </span>
                  </div>
                </div>

                {selectedSlot.status === 'AVAILABLE' ? (
                  <button
                    onClick={handleBookClick}
                    style={{
                      width: '100%',
                      marginTop: '1rem',
                      padding: '0.75rem',
                      background: C.navy,
                      color: C.white,
                      border: 'none',
                      borderRadius: 10,
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(30,58,95,0.25)',
                    }}
                  >
                    Đặt chỗ ngay
                  </button>
                ) : (
                  <div style={{ marginTop: '1rem', padding: '0.6rem 0.85rem', background: C.amberBg, borderRadius: 8, textAlign: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: C.amber, fontWeight: 600 }}>
                      Vị trí không khả dụng để đặt
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.card} style={{ background: C.gray50, border: `1.5px dashed ${C.gray200}`, textAlign: 'center', padding: '2rem 1rem' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <IconClock size={28} color={C.gray400} />
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: C.gray600 }}>
                  Chọn một vị trí trống
                </p>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: C.gray400 }}>
                  Nhấn vào ô màu xanh để đặt chỗ
                </p>
              </div>
            )}

            {/* Active bookings list */}
            <ActiveBookingsPanel onCancel={handleCancelBooking} submitting={submitting} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  ACTIVE BOOKINGS PANEL  (driver side panel)
// ═══════════════════════════════════════════════════════
function ActiveBookingsPanel({ onCancel, submitting }: { onCancel: (id: number) => void; submitting: boolean }) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    floorMapService.getActiveBookings()
      .then(setBookings)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (bookings.length === 0) return null;

  return (
    <div className={styles.card}>
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 800, color: C.gray800 }}>
        Đặt chỗ đang hoạt động
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {bookings.map((b) => (
          <div key={b.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.6rem 0.75rem',
            background: C.amberBg,
            border: `1px solid ${C.amber}`,
            borderRadius: 8,
            gap: '0.5rem',
          }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: C.amber }}>
                {b.slot?.code ?? '—'} · {b.vehicle?.plateNumber ?? '—'}
              </p>
              <p style={{ margin: '0.1rem 0 0', fontSize: '0.7rem', color: C.gray600 }}>
                Đến: {new Date(b.expectedArrival).toLocaleString('vi-VN')}
              </p>
            </div>
            <button
              onClick={() => onCancel(b.id)}
              disabled={submitting}
              style={{
                padding: '0.3rem 0.6rem',
                background: C.redBg,
                border: '1px solid #FECACA',
                borderRadius: 6,
                fontSize: '0.72rem',
                fontWeight: 600,
                color: C.red,
                cursor: submitting ? 'not-allowed' : 'pointer',
                flexShrink: 0,
              }}
            >
              Hủy
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
