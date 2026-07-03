import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { vehicleService } from '../services/vehicle.service';
import { monthlyPackageService } from '../services/monthlyPackage.service';
import api from '../services/api';
import type { Vehicle, ParkingSlot, MonthlyPackage } from '../types';
import { PACKAGES, type PackagePlan } from '../constants/packages';
import styles from '../styles/driver.module.css';

// ═══════════════════════════════════════════════════════
//  PALETTE  (matches driver.module.css / DriverLayout)
// ═══════════════════════════════════════════════════════
const C = {
  navy: '#1E3A5F',
  bg: '#F3F4F6',
  white: '#FFFFFF',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  greenBorder: '#86EFAC',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray600: '#6B7280',
  gray900: '#111827',
  blue: '#3B82F6',
  blueBg: '#EFF6FF',
  red: '#EF4444',
  redBg: '#FEF2F2',
  redBorder: '#FECACA',
  amber: '#D97706',
  amberBg: '#FEF3C7',
  amberBorder: '#FDE68A',
};

// ═══════════════════════════════════════════════════════
//  CONSTANTS — package plans (prices are BUSINESS RULES)
//  Confirmed prices (Quyết định 35/2018 TP.HCM, phương án A):
//    1 tháng:  CAR 1.500.000đ | MOTORBIKE 300.000đ
//    3 tháng:  CAR 4.000.000đ | MOTORBIKE 800.000đ
//    1 năm:    CAR 15.000.000đ | MOTORBIKE 3.000.000đ
// ═══════════════════════════════════════════════════════
type VType = 'CAR' | 'MOTORBIKE';

const TYPE_LABEL: Record<VType, string> = { CAR: 'Ô tô', MOTORBIKE: 'Xe máy' };
const PAYMENT_LABEL: Record<'CASH' | 'CARD' | 'EWALLET', string> = {
  CASH: 'Tiền mặt', CARD: 'Thẻ ngân hàng', EWALLET: 'Ví điện tử',
};

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════
function formatVND(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
}
function formatDDMMYYYY(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function computeExpiry(start: Date, days: number): string {
  const d = new Date(start);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
function formatCountdown(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════
//  VIETQR (EMVCo) PAYLOAD — demo bank account
// ═══════════════════════════════════════════════════════
const VIETQR_BANK_BIN = '970422'; // MB Bank (demo)
const VIETQR_ACCOUNT = '0000000000'; // demo account

function emvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildVietQR(amount: number, note: string): string {
  const acqId = emvField('00', VIETQR_BANK_BIN) + emvField('01', VIETQR_ACCOUNT);
  const merchantAccount =
    emvField('00', 'A000000727') +
    emvField('01', acqId) +
    emvField('02', 'QRIBFTTA');
  let payload =
    emvField('00', '01') +
    emvField('01', '12') +               // 12 = dynamic (one-time, has amount)
    emvField('38', merchantAccount) +
    emvField('53', '704') +              // VND
    emvField('54', String(Math.round(amount))) +
    emvField('58', 'VN') +
    emvField('62', emvField('08', note.slice(0, 25)));
  payload += '6304';
  return payload + crc16(payload);
}

// ═══════════════════════════════════════════════════════
//  ICONS
// ═══════════════════════════════════════════════════════
function IconCheck({ size = 14, color = C.green }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}
function IconCar({ size = 16, color = C.navy }: { size?: number; color?: string }) {
  const id = Math.random().toString(36).slice(2, 8);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`carG-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`carGl-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d="M3 13V17.5C3 18.33 3.67 19 4.5 19H5.5C6.33 19 7 18.33 7 17.5V17H17V17.5C17 18.33 17.67 19 18.5 19H19.5C20.33 19 21 18.33 21 17.5V13" fill={`url(#carGl-${id})`} />
      <path d="M18.5 7.5H5.5L3 13V17.5C3 18.33 3.67 19 4.5 19H5.5C6.33 19 7 18.33 7 17.5V16H17V17.5C17 18.33 17.67 19 18.5 19H19.5C20.33 19 21 18.33 21 17.5V13L18.5 7.5Z" stroke={`url(#carG-${id})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.5 13H20.5" stroke={`url(#carG-${id})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 7.5L6.5 13" stroke={`url(#carG-${id})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16.5 7.5L17.5 13" stroke={`url(#carG-${id})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="7" cy="15" r="1.5" fill={`url(#carG-${id})`}/>
      <circle cx="17" cy="15" r="1.5" fill={`url(#carG-${id})`}/>
    </svg>
  );
}
function IconBike({ size = 16, color = C.navy }: { size?: number; color?: string }) {
  const id = Math.random().toString(36).slice(2, 8);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`bkG-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`bkGl-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <circle cx="6.5" cy="16" r="3.5" fill={`url(#bkGl-${id})`}/>
      <circle cx="17.5" cy="16" r="3.5" fill={`url(#bkGl-${id})`}/>
      <circle cx="6.5" cy="16" r="3.5" stroke={`url(#bkG-${id})`} strokeWidth="1.8"/>
      <circle cx="17.5" cy="16" r="3.5" stroke={`url(#bkG-${id})`} strokeWidth="1.8"/>
      <path d="M15 8H11L8 16" stroke={`url(#bkG-${id})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.5 13.5H15L17.5 16" stroke={`url(#bkG-${id})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15 8L16.5 5H18" stroke={`url(#bkG-${id})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 10H5.5" stroke={`url(#bkG-${id})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="15" cy="8" r="1.5" fill={`url(#bkG-${id})`}/>
      <path d="M10 13.5L12 9" stroke={`url(#bkG-${id})`} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function IconCalendar({ size = 15, color = C.gray600 }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
}
function IconInfo({ size = 15, color = C.gray600 }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
}

// ═══════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

// ── Vehicle picker card ────────────────────────────────
function VehiclePickerCard({ vehicle, selected, onSelect }: { vehicle: Vehicle; selected: boolean; onSelect: () => void }) {
  const isCar = vehicle.type === 'CAR';
  const hasPackage = vehicle.isMonthly;
  return (
    <button
      disabled={hasPackage}
      onClick={hasPackage ? undefined : onSelect}
      style={{
        background: selected ? C.blueBg : C.white,
        border: selected ? `2px solid ${C.navy}` : `1.5px solid ${C.gray200}`,
        borderRadius: 14, padding: '0.85rem 1rem',
        cursor: hasPackage ? 'not-allowed' : 'pointer',
        opacity: hasPackage ? 0.6 : 1,
        textAlign: 'left', width: '100%', boxSizing: 'border-box',
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'all 0.15s ease',
      }}
    >
      {selected && (
        <div style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, background: C.navy, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconCheck size={12} color={C.white} />
        </div>
      )}
      <div style={{ width: 40, height: 40, background: isCar ? C.blueBg : C.gray100, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isCar ? <IconCar size={20} color={C.navy} /> : <IconBike size={20} color={C.navy} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'Consolas', monospace", fontSize: '1rem', fontWeight: 800, color: C.gray900, letterSpacing: '0.03em' }}>
            {vehicle.plateNumber}
          </span>
          <span style={{ background: C.blueBg, color: C.blue, fontSize: '0.65rem', fontWeight: 700, padding: '0.12rem 0.5rem', borderRadius: 20 }}>
            {TYPE_LABEL[vehicle.type]}
          </span>
          {hasPackage && (
            <span style={{ background: C.greenBg, color: C.green, fontSize: '0.65rem', fontWeight: 700, padding: '0.12rem 0.5rem', borderRadius: 20 }}>
              Đã có gói tháng
            </span>
          )}
        </div>
        {hasPackage && (
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: C.gray600 }}>
            Xe đã có gói tháng đang hoạt động — không thể mua thêm
          </p>
        )}
      </div>
    </button>
  );
}

// ── Empty state: no vehicles ──────────────────────────
function NoVehiclesState({ onAddVehicle }: { onAddVehicle?: () => void }) {
  return (
    <div className={styles.card} style={{ background: C.gray50, border: `1.5px dashed ${C.gray300}`, padding: '1.75rem 1.25rem', textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, background: C.white, border: `1.5px solid ${C.gray200}`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
        <IconCar size={24} color={C.gray400} />
      </div>
      <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: C.gray900 }}>Bạn chưa có xe</p>
      <p style={{ margin: '0.25rem 0 1rem', fontSize: '0.82rem', color: C.gray600 }}>Thêm xe trước khi mua gói tháng</p>
      <button onClick={onAddVehicle} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.55rem 1.1rem', background: C.navy, color: C.white, borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none', border: 'none', cursor: 'pointer' }}>
        Thêm xe ngay
      </button>
    </div>
  );
}

// ── Slot tile (mirrors SlotMap.tsx look) ──────────────
function SlotTile({ slot, selected, onSelect }: { slot: ParkingSlot; selected: boolean; onSelect: () => void }) {
  const isAvailable = slot.status === 'AVAILABLE';
  const isOccupied = slot.status === 'OCCUPIED';
  const bg = isAvailable ? C.greenBg : isOccupied ? C.redBg : C.amberBg;
  const border = isAvailable ? C.greenBorder : isOccupied ? C.redBorder : C.amberBorder;
  const text = isAvailable ? '#15803D' : isOccupied ? '#B91C1C' : '#92400E';
  const canPick = isAvailable;
  return (
    <button
      onClick={onSelect}
      disabled={!canPick}
      title={canPick ? `${slot.code} — chọn` : `${slot.code} · ${slot.status}`}
      style={{
        width: 72, height: 72,
        background: selected ? C.navy : bg,
        border: selected ? `2px solid ${C.navy}` : `1.5px solid ${border}`,
        borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        flexShrink: 0, cursor: canPick ? 'pointer' : 'not-allowed', opacity: canPick ? 1 : 0.7, padding: 0, transition: 'all 0.1s',
      }}
    >
      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: selected ? C.white : text, lineHeight: 1.1, textAlign: 'center', padding: '0 2px' }}>
        {slot.code}
      </span>
      {!isAvailable && !selected && (
        <span style={{ fontSize: '0.5rem', fontWeight: 600, color: text, background: border, borderRadius: 4, padding: '1px 3px', lineHeight: 1 }}>
          {isOccupied ? 'đỗ' : 'đặt'}
        </span>
      )}
      {selected && (
        <span style={{ fontSize: '0.5rem', fontWeight: 700, color: C.white, background: 'rgba(255,255,255,0.25)', borderRadius: 4, padding: '1px 3px', lineHeight: 1 }}>
          chọn
        </span>
      )}
    </button>
  );
}

function SlotPicker({ slots, selectedSlotId, onSelect, loading, error, onRetry }: {
  slots: ParkingSlot[]; selectedSlotId: string | null; onSelect: (id: string) => void;
  loading: boolean; error: string; onRetry: () => void;
}) {
  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: C.gray400, fontSize: '0.875rem', fontWeight: 600, background: C.gray50, borderRadius: 14, border: `1px solid ${C.gray200}` }}>Đang tải sơ đồ chỗ đỗ...</div>;
  }
  if (error) {
    return (
      <div>
        <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 10, padding: '0.65rem 0.85rem', fontSize: '0.82rem', color: '#B91C1C', fontWeight: 500, marginBottom: '0.6rem' }}>{error}</div>
        <button onClick={onRetry} style={{ padding: '0.45rem 0.9rem', background: C.white, border: `1.5px solid ${C.gray300}`, borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, color: C.navy, cursor: 'pointer' }}>Thử lại</button>
      </div>
    );
  }
  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {[
          { dot: C.green, text: 'Trống', tc: '#15803D' },
          { dot: C.red, text: 'Đã đỗ', tc: '#B91C1C' },
          { dot: C.amber, text: 'Đã đặt', tc: '#92400E' },
          { dot: C.navy, text: 'Đã chọn', tc: C.navy },
        ].map((it) => (
          <div key={it.text} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: it.dot, flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: it.tc }}>{it.text}</span>
          </div>
        ))}
      </div>
      {/* Grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.75rem 1rem', background: C.gray50, borderRadius: 14, border: `1px solid ${C.gray200}` }}>
        {slots.map((slot) => (
          <SlotTile key={slot.id} slot={slot} selected={slot.id === selectedSlotId} onSelect={() => onSelect(slot.id)} />
        ))}
        {slots.length === 0 && (
          <p style={{ margin: 0, padding: '1rem', fontSize: '0.82rem', color: C.gray400 }}>Không có chỗ đỗ cố định nào cho ô tô trên tầng G.</p>
        )}
      </div>
      {selectedSlotId && (
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: C.navy, fontWeight: 600 }}>
          Đã chọn: <span style={{ fontFamily: "'Consolas', monospace" }}>{slots.find((s) => s.id === selectedSlotId)?.code}</span>
        </p>
      )}
    </div>
  );
}

// ── Package card ───────────────────────────────────────
function PackageCard({ pkg, selected, vehicleType, onSelect }: { pkg: PackagePlan; selected: boolean; vehicleType: VType; onSelect: () => void }) {
  const pricing = pkg.prices[vehicleType];
  return (
    <button onClick={onSelect} style={{ background: selected ? C.blueBg : C.white, border: selected ? `2px solid ${C.navy}` : `1.5px solid ${C.gray200}`, borderRadius: 14, padding: '1rem', cursor: 'pointer', textAlign: 'left', width: '100%', boxSizing: 'border-box', position: 'relative', transition: 'all 0.15s ease', boxShadow: selected ? '0 4px 16px rgba(30,58,95,0.12)' : 'none' }}>
      {selected && (
        <div style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, background: C.navy, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconCheck size={12} color={C.white} />
        </div>
      )}
      <div style={{ marginBottom: '0.6rem' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: C.gray900 }}>{pkg.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <IconCalendar size={11} color={C.gray400} />
          <span style={{ fontSize: '0.72rem', color: C.gray400 }}>{pkg.durationDays} ngày</span>
        </div>
      </div>
      <div style={{ marginBottom: '0.7rem' }}>
        <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: C.navy, lineHeight: 1 }}>{pricing.priceLabel}</p>
        <p style={{ margin: '0.1rem 0 0', fontSize: '0.7rem', color: C.gray400 }}>{pricing.pricePerDay}</p>
      </div>
      <div style={{ padding: '0.35rem 0.55rem', borderRadius: 7, background: vehicleType === 'CAR' ? '#F0FDF4' : C.blueBg, border: `1px solid ${vehicleType === 'CAR' ? C.greenBorder : C.blue}`, display: 'flex', alignItems: 'center', gap: 5 }}>
        <IconInfo size={11} color={vehicleType === 'CAR' ? C.green : C.blue} />
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: vehicleType === 'CAR' ? C.green : C.blue }}>
          {vehicleType === 'CAR' ? 'Chỗ đỗ cố định khi đăng ký' : 'Đỗ ở ô trống bất kỳ'}
        </span>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export function MonthlyPackagePage({ onAddVehicle }: { onAddVehicle?: () => void } = {}) {
  const { user, isLoading: authLoading } = useAuth();

  // Vehicles
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [vehicleError, setVehicleError] = useState('');

  // Slots (CAR only)
  const [allSlots, setAllSlots] = useState<ParkingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState('');

  // Selections
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('3m');
  const [paymentMethod, setPaymentMethod] = useState<'EWALLET' | 'CARD'>('EWALLET');

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdPkg, setCreatedPkg] = useState<MonthlyPackage | null>(null);

  // Existing package actions
  const [myPackages, setMyPackages] = useState<MonthlyPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [packageActionLoading, setPackageActionLoading] = useState<string | null>(null);
  const [packageActionError, setPackageActionError] = useState('');
  const [packageActionSuccess, setPackageActionSuccess] = useState('');

  // QR payment
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [countdown, setCountdown] = useState(300);

  // Card payment (demo / mock)
  const [showCard, setShowCard] = useState(false);
  const [cardForm, setCardForm] = useState({ number: '', name: '', expiry: '', cvv: '' });

  // Derived
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;
  const vehicleType: VType | null = selectedVehicle?.type ?? null;
  const selectedPlan = PACKAGES.find((p) => p.id === selectedPlanId)!;
  const today = new Date();
  const expiryDate = computeExpiry(today, selectedPlan.durationDays);
  const expiryLabel = formatDDMMYYYY(expiryDate);
  const selectedPrice = vehicleType ? selectedPlan.prices[vehicleType] : null;
  const totalAmount = selectedPrice?.price ?? 0;

  const availableCarSlots = allSlots.filter((s) => s.type === 'CAR' && s.floor?.customerType === 'MONTHLY');

  const canSubmit =
    !submitting &&
    selectedVehicleId !== null &&
    vehicleType !== null &&
    (vehicleType === 'MOTORBIKE' || selectedSlotId !== null);

  // Fetch vehicles
  const loadVehicles = useCallback(async () => {
    setLoadingVehicles(true);
    setVehicleError('');
    try {
      const data = await vehicleService.getMyVehicles();
      setVehicles(data ?? []);
    } catch (e: any) {
      setVehicleError(e?.response?.data?.message ?? 'Không thể tải danh sách xe.');
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  const loadMyPackages = useCallback(async () => {
    setLoadingPackages(true);
    setPackageActionError('');
    try {
      const data = await monthlyPackageService.getMyPackages();
      setMyPackages(data ?? []);
    } catch (e: any) {
      setPackageActionError(e?.response?.data?.message ?? 'Không thể tải gói tháng hiện tại.');
    } finally {
      setLoadingPackages(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    loadVehicles();
    loadMyPackages();
  }, [authLoading, user, loadVehicles, loadMyPackages]);

  // Fetch slots (CAR only)
  const loadSlots = useCallback(async () => {
    setLoadingSlots(true);
    setSlotError('');
    setSelectedSlotId(null);
    try {
      const res = await api.get<{ success: boolean; data: ParkingSlot[] }>('/slots/all');
      setAllSlots(res.data.data ?? []);
    } catch {
      setSlotError('Không thể tải sơ đồ chỗ đỗ. Vui lòng thử lại.');
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (vehicleType === 'CAR') {
      loadSlots();
    } else {
      setAllSlots([]);
      setSelectedSlotId(null);
    }
  }, [vehicleType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Submit
  const handleSubmit = async () => {
    if (!user || !selectedVehicle || !vehicleType) return;
    if (vehicleType === 'CAR' && !selectedSlotId) {
      setSubmitError('Vui lòng chọn chỗ đỗ cố định');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const created = await monthlyPackageService.create({
        userId: user.id,
        vehicleId: selectedVehicle.id,
        slotId: vehicleType === 'CAR' ? selectedSlotId! : undefined,
        startDate: today.toISOString(),
        expiryDate,
        price: totalAmount,
        paymentMethod,
      });
      setCreatedPkg(created);
      await loadVehicles(); // reflect isMonthly=true
      await loadMyPackages();
    } catch (e: any) {
      const msg: string = e?.response?.data?.message ?? 'Có lỗi xảy ra';
      // 409 slot race → refetch the map so they can pick another
      if (msg.includes('Chỗ đỗ đã được người khác chọn')) {
        await loadSlots();
      }
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProceedToQR = async () => {
    const note = `ParkSmart ${selectedPlan.name}`.replace(/[^a-zA-Z0-9 ]/g, '');
    const payload = buildVietQR(totalAmount, note);
    try {
      const url = await QRCode.toDataURL(payload, { width: 220, margin: 2 });
      setQrDataUrl(url);
      setShowQR(true);
      setCountdown(300);
      setSubmitError('');
    } catch {
      setSubmitError('Không thể tạo mã QR. Vui lòng thử lại.');
    }
  };

  useEffect(() => {
    if (!showQR || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showQR, countdown]);

  const handleReset = () => {
    setCreatedPkg(null);
    setSelectedVehicleId(null);
    setSelectedSlotId(null);
    setSelectedPlanId('3m');
    setShowQR(false);
    setShowCard(false);
    setPaymentMethod('EWALLET');
    setCardForm({ number: '', name: '', expiry: '', cvv: '' });
    setSubmitError('');
    setPackageActionError('');
    setPackageActionSuccess('');
  };

  const handleRenewPackage = async (pkg: MonthlyPackage) => {
    setPackageActionLoading(pkg.id);
    setPackageActionError('');
    setPackageActionSuccess('');
    try {
      const updated = await monthlyPackageService.renewPackage(pkg.id);
      setMyPackages((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setPackageActionSuccess('Gia hạn gói thành công. Email xác nhận đã được gửi nếu có cấu hình.');
    } catch (e: any) {
      setPackageActionError(e?.response?.data?.message ?? 'Không thể gia hạn gói.');
    } finally {
      setPackageActionLoading(null);
    }
  };

  const handleToggleAutoRenew = async (pkg: MonthlyPackage) => {
    setPackageActionLoading(pkg.id);
    setPackageActionError('');
    setPackageActionSuccess('');
    try {
      const updated = await monthlyPackageService.setAutoRenew(pkg.id, !pkg.autoRenew);
      setMyPackages((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setPackageActionSuccess(updated.autoRenew ? 'Tự động gia hạn đã được bật.' : 'Tự động gia hạn đã được tắt.');
    } catch (e: any) {
      setPackageActionError(e?.response?.data?.message ?? 'Không thể cập nhật chức năng gia hạn.');
    } finally {
      setPackageActionLoading(null);
    }
  };

  // ── Auth gates ───────────────────────────────────────
  if (authLoading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: C.gray400, fontSize: '0.9rem', fontWeight: 600 }}>Đang tải...</div>;
  }
  if (!user) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: C.gray600, fontSize: '0.9rem' }}>Vui lòng đăng nhập để mua gói tháng.</div>;
  }

  const activePackages = myPackages.filter((pkg) => pkg.status === 'ACTIVE');

  // ── Existing package management ─────────────────────
  if (activePackages.length > 0 && !createdPkg) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: C.gray900 }}>Gói tháng hiện tại</p>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.9rem', color: C.gray600 }}>Quản lý gia hạn gói tháng và cài đặt gia hạn tự động.</p>
        </div>

        {packageActionError && (
          <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#B91C1C', fontWeight: 500 }}>
            {packageActionError}
          </div>
        )}
        {packageActionSuccess && (
          <div style={{ background: C.greenBg, border: `1.5px solid ${C.greenBorder}`, borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.875rem', color: C.green, fontWeight: 500 }}>
            {packageActionSuccess}
          </div>
        )}

        {loadingPackages ? (
          <div className={styles.card} style={{ padding: '2rem', textAlign: 'center', color: C.gray400, fontSize: '0.9rem', fontWeight: 600 }}>Đang tải gói tháng...</div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {activePackages.map((pkg) => (
              <div key={pkg.id} className={styles.card} style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: C.gray900 }}>{pkg.planName ?? 'Gói tháng'}</p>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: C.gray600 }}>Xe: {pkg.vehicle?.plateNumber ?? pkg.vehicleId}</p>
                  </div>
                  <span style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: 999, background: pkg.autoRenew ? C.greenBg : C.gray50, color: pkg.autoRenew ? C.green : C.gray600 }}>
                    {pkg.autoRenew ? 'Gia hạn tự động' : 'Không tự động'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.78rem', color: C.gray600 }}>Bắt đầu</span>
                    <span style={{ fontWeight: 700, color: C.gray900 }}>{formatDDMMYYYY(pkg.startDate)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.78rem', color: C.gray600 }}>Hết hạn</span>
                    <span style={{ fontWeight: 700, color: C.navy }}>{formatDDMMYYYY(pkg.expiryDate)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <button
                    onClick={() => handleRenewPackage(pkg)}
                    disabled={packageActionLoading === pkg.id}
                    style={{ flex: 1, padding: '0.9rem', background: C.navy, color: C.white, border: 'none', borderRadius: 12, fontSize: '0.95rem', fontWeight: 700, cursor: packageActionLoading === pkg.id ? 'not-allowed' : 'pointer' }}
                  >
                    {packageActionLoading === pkg.id ? 'Đang xử lý...' : 'Gia hạn ngay'}
                  </button>
                  <button
                    onClick={() => handleToggleAutoRenew(pkg)}
                    disabled={packageActionLoading === pkg.id}
                    style={{ flex: 1, padding: '0.9rem', background: pkg.autoRenew ? C.redBg : C.white, color: pkg.autoRenew ? C.red : C.gray900, border: `1.5px solid ${pkg.autoRenew ? C.redBorder : C.gray200}`, borderRadius: 12, fontSize: '0.95rem', fontWeight: 700, cursor: packageActionLoading === pkg.id ? 'not-allowed' : 'pointer' }}
                  >
                    {pkg.autoRenew ? 'Hủy gia hạn tự động' : 'Bật gia hạn tự động'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Success state ────────────────────────────────────
  if (createdPkg) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', paddingTop: '2rem' }}>
        <div style={{ width: 72, height: 72, background: C.greenBg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `3px solid ${C.green}` }}>
          <IconCheck size={36} color={C.green} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: C.gray900 }}>Thanh toán thành công!</p>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.875rem', color: C.gray600 }}>Bạn đã đăng ký gói tháng thành công.</p>
        </div>
        <div className={styles.card} style={{ width: '100%', maxWidth: 480 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: C.gray600 }}>Gói</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: C.gray900 }}>{selectedPlan.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: C.gray600 }}>Thanh toán</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: C.gray900 }}>{PAYMENT_LABEL[paymentMethod]}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: C.gray600 }}>Số tiền</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 800, color: C.navy }}>{formatVND(createdPkg.price)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.6rem', borderTop: `1px solid ${C.gray100}` }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: C.gray900 }}>Ngày hết hạn</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 800, color: C.navy }}>{formatDDMMYYYY(createdPkg.expiryDate)}</span>
            </div>
          </div>
        </div>
        <button onClick={handleReset} style={{ padding: '0.6rem 1.5rem', background: C.navy, color: C.white, border: 'none', borderRadius: 10, fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
          Mua thêm gói khác
        </button>
      </div>
    );
  }

  // ── Card Payment Screen (demo / mock) ──────────────────
  if (showCard) {
    const inputStyle: React.CSSProperties = {
      width: '100%',
      padding: '0.65rem 0.75rem',
      fontSize: '0.9rem',
      border: `1.5px solid ${C.gray200}`,
      borderRadius: 10,
      background: C.white,
      color: C.gray900,
      boxSizing: 'border-box',
      outline: 'none',
    };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: C.gray900, textAlign: 'center' }}>Thanh toán bằng thẻ</p>

        {/* Bill summary */}
        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>Tổng thanh toán</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: C.navy }}>{formatVND(totalAmount)}</span>
          </div>
        </div>

        {/* Card form */}
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: C.gray600, marginBottom: 4 }}>Số thẻ</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              value={cardForm.number}
              onChange={(e) => setCardForm((f) => ({ ...f, number: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: C.gray600, marginBottom: 4 }}>Tên chủ thẻ</label>
            <input
              type="text"
              autoComplete="cc-name"
              placeholder="NGUYEN VAN A"
              value={cardForm.name}
              onChange={(e) => setCardForm((f) => ({ ...f, name: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: C.gray600, marginBottom: 4 }}>Ngày hết hạn</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                value={cardForm.expiry}
                onChange={(e) => setCardForm((f) => ({ ...f, expiry: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: C.gray600, marginBottom: 4 }}>CVV</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="•••"
                value={cardForm.cvv}
                onChange={(e) => setCardForm((f) => ({ ...f, cvv: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: C.gray400, textAlign: 'center', lineHeight: 1.5 }}>
            Đây là cổng thanh toán mô phỏng cho mục đích demo.
          </p>
        </div>

        {/* Error */}
        {submitError && (
          <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#B91C1C', fontWeight: 500 }}>{submitError}</div>
        )}

        {/* CTA */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{ width: '100%', padding: '0.9rem', background: submitting ? C.gray300 : C.navy, color: submitting ? C.gray400 : C.white, border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: submitting ? 'none' : '0 4px 14px rgba(30,58,95,0.25)', transition: 'all 0.2s ease' }}
        >
          {submitting ? 'Đang xử lý...' : `Thanh toán ${formatVND(totalAmount)}`}
        </button>

        {/* Back */}
        <button
          onClick={() => setShowCard(false)}
          style={{ width: '100%', padding: '0.7rem', background: C.white, border: `1.5px solid ${C.gray300}`, borderRadius: 12, fontSize: '0.875rem', fontWeight: 700, color: C.gray600, cursor: 'pointer', transition: 'all 0.2s ease' }}
        >
          Quay lại
        </button>

      </div>
    );
  }

  // ── QR Payment Screen ─────────────────────────────────
  if (showQR) {
    const selectedSlot = allSlots.find((s) => s.id === selectedSlotId);
    const billRows: { label: string; value: string }[] = [
      { label: 'Gói', value: selectedPlan.name },
      { label: 'Xe', value: selectedVehicle!.plateNumber },
      { label: 'Loại', value: TYPE_LABEL[vehicleType!] },
      ...(vehicleType === 'CAR' && selectedSlot ? [{ label: 'Chỗ đỗ', value: selectedSlot.code }] : []),
      { label: 'Ngày bắt đầu', value: formatDDMMYYYY(today.toISOString()) },
      { label: 'Ngày hết hạn', value: expiryLabel },
      { label: 'Thời hạn', value: `${selectedPlan.durationDays} ngày` },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: C.gray900, textAlign: 'center' }}>Thanh toán gói tháng</p>

        {/* Bill */}
        <div className={styles.card}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {billRows.map((r) => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.875rem', color: C.gray600 }}>{r.label}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.gray900 }}>{r.value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderTop: `2px solid ${C.gray200}`, marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>Tổng thanh toán</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: C.navy }}>{formatVND(totalAmount)}</span>
          </div>
        </div>

        {/* QR Code */}
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
          <img src={qrDataUrl} alt="QR thanh toán" width={220} height={220} style={{ borderRadius: 8, border: `1px solid ${C.gray200}` }} />
          <p style={{ margin: 0, fontSize: '0.82rem', color: C.gray600, textAlign: 'center', lineHeight: 1.5 }}>
            Mở ứng dụng ngân hàng hoặc ví điện tử và quét mã để thanh toán
          </p>
        </div>

        {/* Countdown */}
        <div style={{ textAlign: 'center' }}>
          {countdown > 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: countdown <= 60 ? C.red : C.amber, fontWeight: 600 }}>
              Mã QR hết hạn sau {formatCountdown(countdown)}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: C.red, fontWeight: 700 }}>Mã QR đã hết hạn</p>
              <button onClick={handleProceedToQR} style={{ padding: '0.5rem 1.25rem', background: C.white, border: `1.5px solid ${C.gray300}`, borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, color: C.navy, cursor: 'pointer' }}>
                Tạo lại mã
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {submitError && (
          <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#B91C1C', fontWeight: 500 }}>{submitError}</div>
        )}

        {/* CTA */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || countdown === 0}
          style={{ width: '100%', padding: '0.9rem', background: canSubmit && countdown > 0 ? C.navy : C.gray300, color: canSubmit && countdown > 0 ? C.white : C.gray400, border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: canSubmit && countdown > 0 ? 'pointer' : 'not-allowed', boxShadow: canSubmit && countdown > 0 ? '0 4px 14px rgba(30,58,95,0.25)' : 'none', transition: 'all 0.2s ease' }}
        >
          {submitting ? 'Đang xử lý...' : 'Tôi đã thanh toán'}
        </button>

        {/* Cancel */}
        <button
          onClick={() => setShowQR(false)}
          style={{ width: '100%', padding: '0.7rem', background: C.white, border: `1.5px solid ${C.gray300}`, borderRadius: 12, fontSize: '0.875rem', fontWeight: 700, color: C.gray600, cursor: 'pointer', transition: 'all 0.2s ease' }}
        >
          Hủy
        </button>

      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* SECTION 1: Vehicle picker */}
      <div className={styles.card}>
        <p style={{ margin: '0 0 0.85rem', fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>Chọn xe</p>
        {vehicleError && (
          <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 10, padding: '0.65rem 0.85rem', fontSize: '0.82rem', color: '#B91C1C', fontWeight: 500, marginBottom: '0.75rem' }}>{vehicleError}</div>
        )}
        {loadingVehicles ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: C.gray400, fontSize: '0.875rem', fontWeight: 600 }}>Đang tải danh sách xe...</div>
        ) : vehicles.length === 0 ? (
          <NoVehiclesState onAddVehicle={onAddVehicle} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {vehicles.map((v) => (
              <VehiclePickerCard key={v.id} vehicle={v} selected={v.id === selectedVehicleId} onSelect={() => { setSelectedVehicleId(v.id); setSubmitError(''); }} />
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: vehicle-type hint */}
      {selectedVehicle && (
        <div style={{ padding: '0.5rem 0.85rem', background: C.blueBg, border: '1px solid #BFDBFE', borderRadius: 8, fontSize: '0.8rem', color: '#1D4ED8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconInfo size={13} color={C.blue} />
          {vehicleType === 'MOTORBIKE'
            ? 'Xe máy — đỗ ở ô trống bất kỳ, không cần chọn chỗ cố định'
            : 'Ô tô — vui lòng chọn chỗ đỗ cố định trên tầng G'}
        </div>
      )}

      {/* SECTION 3: slot picker (CAR only) */}
      {vehicleType === 'CAR' && selectedVehicle && (
        <div className={styles.card}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>Chọn chỗ đỗ cố định</p>
          <SlotPicker slots={availableCarSlots} selectedSlotId={selectedSlotId} onSelect={(id) => { setSelectedSlotId(id); setSubmitError(''); }} loading={loadingSlots} error={slotError} onRetry={loadSlots} />
        </div>
      )}

      {/* SECTION 4: package selection (only after a vehicle is picked) */}
      {vehicleType && (
        <div className={styles.card}>
          <p style={{ margin: '0 0 0.85rem', fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>Chọn gói</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
            {PACKAGES.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} selected={selectedPlanId === pkg.id} vehicleType={vehicleType} onSelect={() => { setSelectedPlanId(pkg.id); setSubmitError(''); }} />
            ))}
          </div>
        </div>
      )}

      {/* SECTION 5: payment summary */}
      {selectedVehicle && vehicleType && (
        <div className={styles.card}>
          <p style={{ margin: '0 0 0.85rem', fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>Tóm tắt thanh toán</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: C.gray600 }}>Ngày bắt đầu</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.gray900 }}>{formatDDMMYYYY(today.toISOString())}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: C.gray600 }}>Ngày kết thúc</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.navy }}>{expiryLabel}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: C.gray600 }}>Thời hạn</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.gray900 }}>{selectedPlan.durationDays} ngày</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderTop: `2px solid ${C.gray200}`, marginTop: '0.25rem' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>Tổng thanh toán</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: C.navy }}>{selectedPrice ? formatVND(totalAmount) : '—'}</span>
          </div>
        </div>
      )}

      {/* Error banner */}
      {submitError && (
        <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#B91C1C', fontWeight: 500 }}>{submitError}</div>
      )}

      {/* Payment method picker */}
      <div className={styles.card} style={{ padding: '0.85rem' }}>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', fontWeight: 700, color: C.gray900 }}>Phương thức thanh toán</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {([
            { id: 'EWALLET', label: 'Quét mã QR' },
            { id: 'CARD', label: 'Thẻ ngân hàng' },
          ] as const).map((opt) => {
            const active = paymentMethod === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setPaymentMethod(opt.id)}
                style={{
                  padding: '0.65rem 0.5rem',
                  background: active ? C.blueBg : C.white,
                  border: active ? `2px solid ${C.navy}` : `1.5px solid ${C.gray200}`,
                  borderRadius: 10,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: active ? C.navy : C.gray600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => { if (paymentMethod === 'CARD') setShowCard(true); else handleProceedToQR(); }}
        disabled={!canSubmit}
        style={{ width: '100%', padding: '0.9rem', background: canSubmit ? C.navy : C.gray300, color: canSubmit ? C.white : C.gray400, border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed', boxShadow: canSubmit ? '0 4px 14px rgba(30,58,95,0.25)' : 'none', transition: 'all 0.2s ease' }}
      >
        Tiến hành thanh toán
      </button>

    </div>
  );
}