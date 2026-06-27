import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type { ParkingSlot } from '../types';
import { BookingModal, BookingSuccess } from '../components/BookingModal';

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
  shadow:    '0 8px 32px rgba(30, 58, 95, 0.10)',
} as const;

type ApiSlotStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';

// ── Icons ──────────────────────────────────────────────────
function IconPlus({ size = 14, color = C.green }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function IconCar({ size = 16, color = C.white }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h11l5 5v4"/><path d="M5 17a2 2 0 104 0 2 2 0 00-4 0zM15 17a2 2 0 104 0 2 2 0 00-4 0z"/></svg>;
}
function IconLock({ size = 14, color = C.blue }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;
}
function IconStar({ size = 12, color = C.blue }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}
function IconInfo({ size = 16, color = C.navy }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}

// ── Slot Card ─────────────────────────────────────────────
interface SlotCardProps {
  slot: ParkingSlot;
  isAssigned: boolean;
}

function SlotCard({ slot, isAssigned }: SlotCardProps) {
  const status = slot.status as ApiSlotStatus;
  const isAvailable = status === 'AVAILABLE';

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
      icon = isAssigned ? <IconStar size={13} color={C.blue} /> : <IconPlus size={14} color={C.green} />;
      bgColor = C.greenBg;
      borderColor = isAssigned ? C.blue : C.green;
      textColor = isAssigned ? C.blue : C.green;
      if (isAssigned) ring = true;
  }

  return (
    <div
      title={isAvailable ? `Vị trí ${slot.code} – trống` : `Vị trí ${slot.code}: ${status}`}
      style={{
        width: 64, height: 56,
        background: bgColor,
        border: ring ? `2px solid ${C.navy}` : `1.5px solid ${borderColor}`,
        borderRadius: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 2,
        cursor: 'default',
        boxShadow: isAssigned ? `0 0 0 3px ${C.navy}40` : 'none',
        padding: 0,
        position: 'relative',
        boxSizing: 'border-box',
        transition: 'all 0.15s ease',
      }}
    >
      <span style={{ color: textColor, fontSize: '0.75rem', fontWeight: 700 }}>{slot.code}</span>
      {icon}
      {isAssigned && (
        <span style={{
          position: 'absolute', top: -7, right: -4,
          background: C.blue, color: C.white,
          fontSize: '0.58rem', fontWeight: 700,
          padding: '1px 5px', borderRadius: 6, lineHeight: 1.4,
        }}>
          Đã xếp
        </span>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
interface FloorInfo {
  floorCode: string;
  name: string;
}

export function BookingPage() {
  const [floor, setFloor] = useState<FloorInfo | null>(null);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [assignedSlot, setAssignedSlot] = useState<ParkingSlot | null>(null);
  const [bookingId, setBookingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

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

  const handleModalSuccess = (slot: ParkingSlot, bid: string) => {
    setAssignedSlot(slot);
    setBookingId(bid);
    setModalOpen(false);
    loadSlots();
  };

  const handleReset = () => {
    setAssignedSlot(null);
    setBookingId('');
  };

  const half = Math.ceil(slots.length / 2);
  const rowASlots = slots.slice(0, half);
  const rowBSlots = slots.slice(half);
  const assignedSlotId = assignedSlot?.id ?? null;
  const floorLabel = floor ? `${floor.name} – Ô tô (Khách vãng lai)` : 'Đang tải…';

  return (
    <div style={{
      minHeight: '100%',
      background: C.bg,
      fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
      padding: '1.5rem',
      boxSizing: 'border-box',
    }}>
      <BookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleModalSuccess}
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: assignedSlot ? '1fr 400px' : '3fr 2fr',
        gap: '1.25rem',
        alignItems: 'start',
        transition: 'grid-template-columns 0.3s ease',
      }}>

        {/* LEFT ─ Slot Map */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Info banner */}
          <div style={{
            background: C.white, borderRadius: 16, boxShadow: C.shadow, padding: '1.1rem 1.25rem',
            display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
          }}>
            <div style={{
              background: '#DBEAFE', border: '1px solid #BFDBFE',
              borderRadius: 10, padding: '0.55rem 0.85rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1,
            }}>
              <IconInfo size={14} color={C.navy} />
              <p style={{ margin: 0, fontSize: '0.8rem', color: C.navy, lineHeight: 1.4 }}>
                Đặt chỗ trước chỉ dành cho <strong>Ô TÔ</strong>. Xe máy đỗ ở ô trống bất kỳ, không cần đặt chỗ.
              </p>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {([
                { bg: C.greenBg, border: C.green, label: 'Trống', dotColor: C.green },
                { bg: C.amberBg, border: C.amberBorder, label: 'Đặt trước', dotColor: C.amberBorder },
                { bg: C.gray600, border: C.gray600, label: 'Sử dụng', dotColor: C.gray600 },
                { bg: '#DBEAFE', border: C.blue, label: 'Đã xếp', dotColor: C.blue },
              ] as const).map(({ bg, border, label, dotColor }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.76rem', color: dotColor }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: bg, border: `1.5px solid ${border}`, display: 'inline-block', flexShrink: 0 }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Slot map */}
          <div style={{ background: C.white, borderRadius: 16, boxShadow: C.shadow, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: C.gray800 }}>
                  Sơ đồ {floorLabel}
                </h2>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: C.gray400 }}>
                  {loading ? 'Đang tải...' : `${slots.filter(s => s.status === 'AVAILABLE').length}/${slots.length} chỗ trống`}
                </p>
              </div>
            </div>

            {errorMsg && !assignedSlot && (
              <div style={{ background: C.redBg, border: '1.5px solid #FECACA', borderRadius: 10, padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p style={{ margin: 0, fontSize: '0.82rem', color: C.red }}>{errorMsg}</p>
              </div>
            )}

            {/* Slot grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 28, height: 28, background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: C.navy }}>A</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {rowASlots.map((slot) => <SlotCard key={slot.id} slot={slot} isAssigned={assignedSlotId === slot.id} />)}
                </div>
              </div>
              {rowBSlots.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: 28, height: 28, background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: C.navy }}>B</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {rowBSlots.map((slot) => <SlotCard key={slot.id} slot={slot} isAssigned={assignedSlotId === slot.id} />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        {assignedSlot ? (
          <div style={{ position: 'sticky', top: '1.5rem' }}>
            <BookingSuccess
              bookingId={bookingId}
              slotCode={assignedSlot.code}
              onClose={handleReset}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '1.5rem' }}>

            {/* CTA card */}
            <div style={{ background: C.white, borderRadius: 16, boxShadow: C.shadow, padding: '1.5rem', textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyLight} 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem', boxShadow: '0 6px 20px rgba(30,58,95,0.25)',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <path d="M3 9h18M9 21V9"/>
                </svg>
              </div>
              <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem', fontWeight: 800, color: C.gray800 }}>
                Đặt chỗ ngay
              </h2>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: C.gray600, lineHeight: 1.5 }}>
                Đặt trước vị trí đỗ xe ô tô.<br />
                Hệ thống tự chọn vị trí tối ưu cho bạn.
              </p>
              <button
                onClick={() => setModalOpen(true)}
                style={{
                  width: '100%', padding: '0.85rem',
                  background: C.navy, color: C.white,
                  border: 'none', borderRadius: 12,
                  fontSize: '0.95rem', fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(30,58,95,0.25)',
                  transition: 'all 0.2s ease',
                }}
              >
                Bắt đầu đặt chỗ
              </button>
            </div>

            {/* Deposit summary */}
            <div style={{ background: C.white, borderRadius: 16, boxShadow: C.shadow, padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 700, color: C.gray800 }}>
                Thông tin đặt cọc
              </h3>
              {([
                { label: 'Phí đặt cọc', value: '15.000đ', color: C.green, icon: 'đ' },
                { label: 'Thời gian giữ chỗ', value: '30 phút', color: C.gray800, icon: '⏱' },
              ] as const).map(({ label, value, color, icon }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: 32, height: 32, background: C.gray50, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: C.navy }}>{icon}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.gray400 }}>{label}</p>
                    <p style={{ margin: '0.1rem 0 0', fontSize: '0.9rem', fontWeight: 700, color }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Warning */}
            <div style={{ background: C.redBg, border: '1px solid #FECACA', borderRadius: 12, padding: '0.75rem 1rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', flexShrink: 0, lineHeight: 1.5 }}>⚠</span>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#991B1B', lineHeight: 1.5 }}>
                Đặt chỗ sẽ bị hủy và mất cọc nếu xe không vào bãi trong 30 phút.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
