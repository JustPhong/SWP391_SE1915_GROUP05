import { useState } from 'react';
import api from '../services/api';
import type { ParkingSlot } from '../types';

const C = {
  navy:      '#1E3A5F',
  navyLight:  '#2C4F78',
  bg:        '#F0F4F8',
  white:     '#FFFFFF',
  blue:      '#3B82F6',
  blueBg:    '#EFF6FF',
  green:     '#22C55E',
  greenBg:   '#DCFCE7',
  red:       '#DC2626',
  redBg:     '#FEE2E2',
  amber:     '#D97706',
  amberBg:   '#FEF3C7',
  amberBorder:'#F59E0B',
  gray50:    '#F9FAFB',
  gray100:   '#F3F5F7',
  gray200:   '#E2E8F0',
  gray400:   '#9BA8B4',
  gray600:   '#5C6B7A',
  gray800:   '#2D3A45',
} as const;

const BOOKING_DEPOSIT = 15000;

// ── Icons ──────────────────────────────────────────────────
function IconClose({ size = 20, color = C.gray400 }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function IconCheck({ size = 14, color = C.white }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function IconShare({ size = 16, color = C.white }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
}

// ── Booking Modal ──────────────────────────────────────────
interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (slot: ParkingSlot, bookingId: string) => void;
}

export function BookingModal({ open, onClose, onSuccess }: BookingModalProps) {
  const [plateNumber, setPlateNumber] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    const plate = plateNumber.trim();
    if (!plate) { setErrorMsg('Vui lòng nhập biển số xe.'); return; }
    if (plate.length < 4) { setErrorMsg('Biển số xe không hợp lệ.'); return; }
    if (!arrivalTime) { setErrorMsg('Vui lòng chọn thời gian dự kiến tới.'); return; }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const expectedArrival = new Date(arrivalTime).toISOString();
      const res = await api.post<{ success: boolean; data: { id: string; slot: ParkingSlot } }>('/bookings', {
        plateNumber: plate,
        expectedArrival,
      });
      const slot = res.data.data.slot;
      const bid = `PKS-${String(res.data.data.id).slice(0, 8).toUpperCase()}`;
      onSuccess(slot, bid);
      setPlateNumber('');
      setArrivalTime('');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Đặt chỗ thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setPlateNumber('');
    setArrivalTime('');
    setErrorMsg('');
    onClose();
  };

  if (!open) return null;

  const canSubmit =
    !submitting &&
    plateNumber.trim().length >= 4 &&
    arrivalTime.trim().length > 0;

  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  now.setSeconds(0);
  now.setMilliseconds(0);
  const minDatetime = now.toISOString().slice(0, 16);

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10, 25, 60, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 200,
          animation: 'bookingFadeIn 0.2s ease',
        }}
      />

      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: 440,
        zIndex: 201,
        animation: 'bookingSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <div style={{
          background: C.white,
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(10, 25, 60, 0.20)',
          overflow: 'hidden',
          margin: '0 1rem',
        }}>
          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyLight} 100%)`,
            padding: '1.5rem 1.5rem 1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: C.white }}>
                Đặt chỗ đỗ xe
              </h2>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.70)', lineHeight: 1.5 }}>
                Hệ thống sẽ tự chọn vị trí tối ưu cho bạn
              </p>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none', borderRadius: 8,
                width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <IconClose size={16} color={C.white} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '1.5rem' }}>
            {errorMsg && (
              <div style={{
                background: C.redBg, border: '1.5px solid #FECACA',
                borderRadius: 10, padding: '0.6rem 0.85rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                marginBottom: '1rem',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p style={{ margin: 0, fontSize: '0.82rem', color: C.red }}>{errorMsg}</p>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: C.gray600, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Biển số xe
              </label>
              <input
                type="text"
                value={plateNumber}
                onChange={(e) => { setPlateNumber(e.target.value.toUpperCase()); setErrorMsg(''); }}
                placeholder="VD: 30A-123.45"
                maxLength={15}
                style={{
                  width: '100%', padding: '0.75rem 0.9rem',
                  border: `1.5px solid ${C.gray200}`,
                  borderRadius: 10, fontSize: '0.95rem',
                  color: C.gray800, boxSizing: 'border-box',
                  outline: 'none', fontFamily: 'inherit',
                  background: C.white,
                }}
                onFocus={(e) => { e.target.style.borderColor = C.navy; e.target.style.boxShadow = `0 0 0 3px rgba(30,58,95,0.10)`; }}
                onBlur={(e) => { e.target.style.borderColor = C.gray200; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: C.gray600, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Thời gian dự kiến tới
              </label>
              <input
                type="datetime-local"
                value={arrivalTime}
                min={minDatetime}
                onChange={(e) => { setArrivalTime(e.target.value); setErrorMsg(''); }}
                style={{
                  width: '100%', padding: '0.75rem 0.9rem',
                  border: `1.5px solid ${C.gray200}`,
                  borderRadius: 10, fontSize: '0.95rem',
                  color: C.gray800, boxSizing: 'border-box',
                  outline: 'none', fontFamily: 'inherit',
                  background: C.white,
                }}
                onFocus={(e) => { e.target.style.borderColor = C.navy; e.target.style.boxShadow = `0 0 0 3px rgba(30,58,95,0.10)`; }}
                onBlur={(e) => { e.target.style.borderColor = C.gray200; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div style={{
              background: C.blueBg, border: '1px solid #BFDBFE',
              borderRadius: 10, padding: '0.75rem 1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: '0.82rem', color: '#1D4ED8' }}>Phí đặt cọc</span>
              </div>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: C.blue }}>
                {BOOKING_DEPOSIT.toLocaleString('vi-VN')}đ
              </span>
            </div>

            <div style={{
              background: C.redBg, border: '1px solid #FECACA',
              borderRadius: 10, padding: '0.65rem 0.85rem',
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
              marginBottom: '1.25rem',
            }}>
              <span style={{ fontSize: '0.9rem', flexShrink: 0, lineHeight: 1.4 }}>⚠</span>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#991B1B', lineHeight: 1.5 }}>
                Đặt chỗ sẽ bị hủy và mất cọc nếu xe không vào bãi trong <strong>30 phút</strong>.
              </p>
            </div>

            <button
              disabled={!canSubmit}
              onClick={handleSubmit}
              style={{
                width: '100%', padding: '0.85rem',
                background: canSubmit ? C.navy : C.gray200,
                color: canSubmit ? C.white : C.gray400,
                border: 'none', borderRadius: 12,
                fontSize: '0.95rem', fontWeight: 700,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit ? '0 4px 14px rgba(30, 58, 95, 0.25)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {submitting ? 'Đang xử lý...' : 'Xác nhận đặt chỗ'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bookingFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes bookingSlideUp { from { opacity: 0; transform: translate(-50%, -44%) } to { opacity: 1; transform: translate(-50%, -50%) } }
      `}</style>
    </>
  );
}

// ── Booking Success ────────────────────────────────────────
interface BookingSuccessProps {
  bookingId: string;
  slotCode: string;
  onClose: () => void;
}

export function BookingSuccess({ bookingId, slotCode, onClose }: BookingSuccessProps) {
  return (
    <div style={{
      background: C.white,
      borderRadius: 20,
      boxShadow: '0 8px 32px rgba(30,58,95,0.10)',
      overflow: 'hidden',
      animation: 'bookingFadeIn 0.3s ease',
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${C.green} 0%, #16A34A 100%)`,
        padding: '2rem 1.5rem',
        textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(255,255,255,0.20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1rem',
        }}>
          <IconCheck size={28} color={C.white} />
        </div>
        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: C.white }}>
          Đặt chỗ thành công!
        </h2>
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'rgba(255,255,255,0.80)', lineHeight: 1.5 }}>
          Mã đặt chỗ của bạn
        </p>
        <p style={{ margin: '0.5rem 0 0', fontSize: '1.4rem', fontWeight: 900, color: C.white, letterSpacing: '0.08em' }}>
          {bookingId}
        </p>
      </div>

      {/* Details */}
      <div style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{
          background: C.greenBg, border: '1px solid #BBF7D0',
          borderRadius: 12, padding: '1rem 1.25rem',
          marginBottom: '1rem',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#15803D', marginBottom: '0.2rem' }}>
            Vị trí đã xếp
          </p>
          <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 900, color: C.green, letterSpacing: '0.04em', lineHeight: 1 }}>
            {slotCode}
          </p>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: '#166534' }}>
            Hết hạn sau 30 phút kể từ khi đặt
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '0.75rem',
              background: C.white,
              border: `1.5px solid ${C.gray200}`,
              borderRadius: 10, fontSize: '0.875rem', fontWeight: 600,
              color: C.gray600, cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
          >
            Đặt chỗ khác
          </button>
          <button
            style={{
              flex: 2, padding: '0.75rem',
              background: C.green, border: 'none',
              borderRadius: 10, fontSize: '0.875rem', fontWeight: 700,
              color: C.white, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(34,197,94,0.30)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            }}
          >
            <IconShare size={14} />
            In / Chia sẻ
          </button>
        </div>
      </div>
    </div>
  );
}
