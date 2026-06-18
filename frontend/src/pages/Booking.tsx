import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type { ParkingSlot } from '../types';

// ═══════════════════════════════════════════════════════
//  PALETTE  (matches Login / Dashboard)
// ═══════════════════════════════════════════════════════
const C = {
  navy:     '#1E3A5F',
  navyLight: '#2C4F78',
  bg:       '#F0F4F8',
  white:    '#FFFFFF',
  blue:     '#3B82F6',
  blueBg:   '#EFF6FF',
  green:    '#22C55E',
  greenBg:  '#DCFCE7',
  red:      '#DC2626',
  redBg:    '#FEE2E2',
  amber:      '#D97706',
  amberBg:    '#FEF3C7',
  amberBorder:'#F59E0B',
  gray50:   '#F9FAFB',
  gray100:  '#F3F5F7',
  gray200:  '#E2E8F0',
  gray400:  '#9BA8B4',
  gray600:  '#5C6B7A',
  gray800:  '#2D3A45',
  shadow:   '0 8px 32px rgba(30, 58, 95, 0.08)',
} as const;

type ApiSlotStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
const BOOKING_DEPOSIT = 15000;

// ═══════════════════════════════════════════════════════
//  ICONS  (inline SVG)
// ═══════════════════════════════════════════════════════
function IconPlus({ size = 14, color = C.green }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function IconCar({ size = 16, color = C.white }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h11l5 5v4"/><path d="M5 17a2 2 0 104 0 2 2 0 00-4 0zM15 17a2 2 0 104 0 2 2 0 00-4 0z"/></svg>;
}
function IconLock({ size = 14, color = C.blue }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;
}
function IconCheck({ size = 14, color = C.white }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function IconStar({ size = 12, color = C.blue }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}
function IconInfo({ size = 16, color = C.navy }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}
function IconClock({ size = 16, color = C.gray600 }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>;
}

// ═══════════════════════════════════════════════════════
//  SLOT CARD
// ═══════════════════════════════════════════════════════
interface SlotCardProps {
  slot: ParkingSlot;
  isSelected: boolean;
  isSuggested: boolean;
  onSelect: (slot: ParkingSlot) => void;
}

function SlotCard({ slot, isSelected, isSuggested, onSelect }: SlotCardProps) {
  const status = slot.status as ApiSlotStatus;
  const isAvailable = status === 'AVAILABLE';
  const isClickable = isAvailable;

  let icon: JSX.Element;
  let bgColor: string;
  let borderColor: string;
  let textColor: string;
  let ring = false;

  switch (status) {
    case 'OCCUPIED':
      icon = <IconCar size={15} color={C.white} />;
      bgColor = C.gray600;
      borderColor = C.gray600;
      textColor = C.white;
      break;
    case 'RESERVED':
      icon = <IconLock size={13} color={C.amberBorder} />;
      bgColor = C.amberBg;
      borderColor = C.amberBorder;
      textColor = '#92400E';
      break;
    default:
      if (isSelected) {
        icon = <IconCheck size={13} color={C.white} />;
        bgColor = C.navy;
        borderColor = C.navy;
        textColor = C.white;
        ring = true;
      } else {
        icon = isSuggested ? <IconStar size={13} color={C.blue} /> : <IconPlus size={14} color={C.green} />;
        bgColor = C.greenBg;
        borderColor = isSuggested ? C.blue : C.green;
        textColor = isSuggested ? C.blue : C.green;
        if (isSuggested) ring = true;
      }
  }

  return (
    <button
      onClick={() => isClickable && onSelect(slot)}
      disabled={!isClickable}
              title={isAvailable ? `Chọn vị trí ${slot.code}` : `Vị trí ${slot.code}: ${status}`}
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
        opacity: isClickable ? 1 : 0.6,
        boxShadow: isSelected ? `0 0 0 3px ${C.navy}40` : 'none',
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
          background: C.blue,
          color: C.white,
          fontSize: '0.58rem',
          fontWeight: 700,
          padding: '1px 5px',
          borderRadius: 6,
          lineHeight: 1.4,
        }}>
          Gợi ý
        </span>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
interface FloorInfo {
  floorCode: string;
  name: string;
}

export function BookingPage() {
  const [floor, setFloor] = useState<FloorInfo | null>(null);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [bookingId, setBookingId] = useState('');

  // Fetch floor list → find CASUAL+CAR floor → load its slots
  const loadSlots = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get<{ success: boolean; data: any[] }>('/floors');
      const casualCar = res.data.data.find(
        (f: any) => f.vehicleType === 'CAR' && f.customerType === 'CASUAL'
      );
      if (!casualCar) {
        setErrorMsg('Không tìm thấy tầng đỗ xe ô tô cho khách vãng lai.');
        setLoading(false);
        return;
      }

      setFloor({ floorCode: casualCar.floorCode, name: casualCar.name });

      const slotRes = await api.get<{ success: boolean; data: any }>(
        `/floors/${casualCar.floorCode}/slots`
      );
      setSlots(slotRes.data.data.slots ?? []);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Không thể tải sơ đồ bãi đỗ.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const handleSelectSlot = (slot: ParkingSlot) => {
    setSelectedSlot((prev) => (prev?.id === slot.id ? null : slot));
    setErrorMsg('');
  };

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    const plate = plateNumber.trim();
    if (!plate) {
      setErrorMsg('Vui lòng nhập biển số xe.');
      return;
    }
    if (plate.length < 4) {
      setErrorMsg('Biển số xe không hợp lệ.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const expectedArrival = new Date().toISOString();
      const res = await api.post<{ success: boolean; data: { id: number } }>('/bookings', {
        plateNumber: plate,
        slotId: selectedSlot.id,
        expectedArrival,
      });
      setBookingId(`PKS${String(res.data.data.id).padStart(8, '0')}`);
      setConfirmed(true);
      await loadSlots();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Đặt chỗ thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedSlot(null);
    setPlateNumber('');
    setConfirmed(false);
    setErrorMsg('');
    setBookingId('');
  };

  // Split slots into 2 rows (first half = row A, second half = row B)
  const half = Math.ceil(slots.length / 2);
  const rowASlots = slots.slice(0, half);
  const rowBSlots = slots.slice(half);

  // Suggested: first available slot per row
  const suggestedIds = new Set<string>();
  const rowAAvail = rowASlots.find((s) => s.status === 'AVAILABLE');
  const rowBAvail = rowBSlots.find((s) => s.status === 'AVAILABLE');
  if (rowAAvail) suggestedIds.add(rowAAvail.id);
  if (rowBAvail) suggestedIds.add(rowBAvail.id);

  const floorLabel = floor ? `${floor.name} – Ô tô (Khách vãng lai)` : 'Đang tải…';

  return (
    <div style={{
      minHeight: '100%',
      background: C.bg,
      fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
      padding: '1.5rem',
      boxSizing: 'border-box',
    }}>

      {/* ── TWO-COLUMN LAYOUT ───────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '3fr 2fr',
        gap: '1.25rem',
        alignItems: 'start',
      }}>

        {/* ════════════════════════════════
            LEFT COLUMN
        ════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* ── 1. Controls card ──────────────────────── */}
          <div style={{
            background: C.white,
            borderRadius: 16,
            boxShadow: C.shadow,
            padding: '1.25rem',
          }}>
            {/* Info banner */}
            <div style={{
              background: '#DBEAFE',
              border: '1px solid #BFDBFE',
              borderRadius: 10,
              padding: '0.6rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              marginBottom: '1rem',
            }}>
              <IconInfo size={15} color={C.navy} />
              <p style={{ margin: 0, fontSize: '0.8rem', color: C.navy, lineHeight: 1.4 }}>
                Đặt chỗ trước chỉ dành cho <strong>Ô TÔ</strong>. Xe máy đỗ ở ô trống bất kỳ, không cần đặt chỗ.
              </p>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              {([
                { bg: C.greenBg, border: C.green, label: 'Trống', dotColor: C.green },
                { bg: C.amberBg, border: C.amberBorder, label: 'Được đặt trước', dotColor: C.amberBorder },
                { bg: C.gray600, border: C.gray600, label: 'Đang sử dụng', dotColor: C.gray600 },
                { bg: '#DBEAFE', border: C.blue, label: 'Gợi ý', dotColor: C.blue },
              ] as const).map(({ bg, border, label, dotColor }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: dotColor }}>
                  <span style={{
                    width: 12, height: 12, borderRadius: 3,
                    background: bg, border: `1.5px solid ${border}`,
                    display: 'inline-block', flexShrink: 0,
                  }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* ── 2. Slot map card ───────────────────────── */}
          <div style={{
            background: C.white,
            borderRadius: 16,
            boxShadow: C.shadow,
            padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: C.gray800 }}>
                  Sơ đồ {floorLabel}
                </h2>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: C.gray400 }}>
                  {loading ? 'Đang tải...' : `${slots.filter(s => s.status === 'AVAILABLE').length}/${slots.length} chỗ trống`}
                </p>
              </div>
              <span style={{
                padding: '0.3rem 0.75rem',
                background: C.blueBg,
                border: '1px solid #BFDBFE',
                borderRadius: 20,
                fontSize: '0.75rem',
                fontWeight: 500,
                color: C.blue,
                flexShrink: 0,
              }}>
                Chọn ô trống để đặt chỗ
              </span>
            </div>

            {/* Error banner */}
            {errorMsg && !confirmed && (
              <div style={{
                background: C.redBg,
                border: '1.5px solid #FECACA',
                borderRadius: 10,
                padding: '0.7rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p style={{ margin: 0, fontSize: '0.82rem', color: C.red }}>{errorMsg}</p>
              </div>
            )}

            {/* Success state */}
            {confirmed && selectedSlot ? (
              <div style={{
                background: C.greenBg,
                border: `1.5px solid ${C.green}`,
                borderRadius: 12,
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
              }}>
                <IconCheck size={22} color={C.green} />
                <div>
                  <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#15803D' }}>
                    Đặt chỗ thành công!
                  </p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#166534' }}>
                    Mã đặt chỗ: <strong>{bookingId}</strong>
                  </p>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#166534' }}>
                    Vị trí: <strong>{selectedSlot.code}</strong> · Hết hạn sau 15 phút
                  </p>
                  <button
                    onClick={handleReset}
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.4rem 1rem',
                      background: C.green,
                      color: C.white,
                      border: 'none',
                      borderRadius: 8,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Đặt chỗ khác
                  </button>
                </div>
              </div>
            ) : (
              /* ── Slot grid ────── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                {/* Row A */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{
                    width: 28, height: 28,
                    background: C.gray50, border: `1px solid ${C.gray200}`,
                    borderRadius: 6, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: C.navy }}>A</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {rowASlots.map((slot) => (
                      <SlotCard
                        key={slot.id}
                        slot={slot}
                        isSelected={selectedSlot?.id === slot.id}
                        isSuggested={suggestedIds.has(slot.id)}
                        onSelect={handleSelectSlot}
                      />
                    ))}
                  </div>
                </div>

                {/* Row B */}
                {rowBSlots.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: 28, height: 28,
                      background: C.gray50, border: `1px solid ${C.gray200}`,
                      borderRadius: 6, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: C.navy }}>B</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {rowBSlots.map((slot) => (
                        <SlotCard
                          key={slot.id}
                          slot={slot}
                          isSelected={selectedSlot?.id === slot.id}
                          isSuggested={suggestedIds.has(slot.id)}
                          onSelect={handleSelectSlot}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════
            RIGHT COLUMN
        ════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '1.5rem' }}>

          {/* ── 3. Summary card ─────────────────────────── */}
          <div style={{
            background: C.white,
            borderRadius: 16,
            boxShadow: C.shadow,
            padding: '1.25rem',
          }}>
            <h2 style={{ margin: '0 0 0.3rem', fontSize: '1rem', fontWeight: 800, color: C.gray800 }}>
              Tóm tắt đặt chỗ
            </h2>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.8rem', color: C.gray600 }}>
              Thông tin chi tiết về vị trí đỗ xe của bạn
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>

              {/* Biển số xe */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.gray400, marginBottom: '0.35rem' }}>
                  Biển số xe
                </label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => { setPlateNumber(e.target.value.toUpperCase()); setErrorMsg(''); }}
                  placeholder="VD: 30A-123.45"
                  disabled={confirmed || submitting}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    border: `1.5px solid ${C.gray200}`,
                    borderRadius: 8,
                    fontSize: '0.875rem',
                    color: C.gray800,
                    boxSizing: 'border-box',
                    outline: 'none',
                    fontFamily: 'inherit',
                    background: confirmed ? C.gray50 : C.white,
                  }}
                />
              </div>

              {/* Vị trí */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 32, height: 32, background: C.gray50, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.gray400 }}>
                    Vị trí
                  </p>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.9rem', fontWeight: 700, color: selectedSlot ? C.navy : C.gray400 }}>
                    {selectedSlot ? `${selectedSlot.code}` : '—'}
                  </p>
                </div>
              </div>

              {/* Giá */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 32, height: 32, background: C.gray50, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: C.navy }}>đ</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.gray400 }}>
                    Phí đặt cọc
                  </p>
                  {/* Deposit is a fixed amount (BR-BK-01), independent of slot choice,
                      so it is always rendered from BOOKING_DEPOSIT — never gated on selectedSlot. */}
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.9rem', fontWeight: 700, color: C.green }}>
                    {BOOKING_DEPOSIT.toLocaleString('vi-VN')}đ
                  </p>
                  {selectedSlot && (
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.7rem', color: C.gray400 }}>
                      Cọc sẽ được trừ vào phí gửi xe khi bạn vào bãi.
                    </p>
                  )}
                </div>
              </div>

              {/* Thời gian giữ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 32, height: 32, background: C.gray50, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconClock size={15} color={C.navy} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.gray400 }}>
                    Thời gian giữ
                  </p>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.9rem', fontWeight: 700, color: C.gray800 }}>
                    15 phút
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── 4. Warning box ─────────────────────────── */}
          <div style={{
            background: C.redBg,
            border: '1.5px solid #FECACA',
            borderRadius: 12,
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
          }}>
            <span style={{ fontSize: '1rem', lineHeight: 1.4, flexShrink: 0 }}>⚠</span>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#991B1B', lineHeight: 1.5 }}>
              Đặt chỗ sẽ tự động bị hủy và mất cọc nếu xe không vào bãi trong 15 phút.
            </p>
          </div>

          {/* ── 5. Confirm button ─────────────────────── */}
          <button
            disabled={!selectedSlot || confirmed || submitting}
            onClick={handleConfirm}
            style={{
              width: '100%',
              padding: '0.85rem',
              background: selectedSlot && !confirmed && !submitting ? C.navy : C.gray200,
              color: selectedSlot && !confirmed && !submitting ? C.white : C.gray400,
              border: 'none',
              borderRadius: 12,
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: selectedSlot && !confirmed && !submitting ? 'pointer' : 'not-allowed',
              boxShadow: selectedSlot && !confirmed && !submitting ? '0 4px 14px rgba(30, 58, 95, 0.25)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {submitting ? 'Đang xử lý...' : 'Xác nhận đặt chỗ'}
          </button>

          {selectedSlot && !confirmed && !submitting && (
            <p style={{ margin: 0, textAlign: 'center', fontSize: '0.75rem', color: C.gray400 }}>
              Chọn vị trí {selectedSlot.code} — đặt cọc {BOOKING_DEPOSIT.toLocaleString('vi-VN')}đ, giữ chỗ 15 phút
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
