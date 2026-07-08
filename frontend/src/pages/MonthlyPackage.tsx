import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { vehicleService } from '../services/vehicle.service';
import { monthlyPackageService } from '../services/monthlyPackage.service';
import api from '../services/api';
import type { Vehicle, ParkingSlot, MonthlyPackage } from '../types';
import { PACKAGES, type PackagePlan } from '../constants/packages';
import styles from '../styles/driver.module.css';
import newStyles from '../styles/monthlyPackage.module.css';
import motorbikeWatermark from '../assets/motorbike-watermark.png';
import carWatermark from '../assets/car-watermark.png';

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

const formatDate = (value?: string | Date) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
};

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

const getRemainingDays = (expiryDateStr: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays < 0 ? 0 : diffDays;
};

const getTotalDays = (startDateStr: string, expiryDateStr: string) => {
  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 0 ? 30 : diffDays;
};

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
//  INLINE SVG ICONS (uniform visual language)
// ═══════════════════════════════════════════════════════
function IconCheck({ size = 14, color = '#16A34A' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}
function IconCar({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="22" height="13" rx="2" /><path d="M5 16v4a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-4m6 0v4a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-4M4 8h16M2 12h20" /></svg>;
}
function IconBike({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="18" r="3" /><circle cx="19" cy="18" r="3" /><path d="M12 18V10H9m3 0 4-4H9" /></svg>;
}
function IconInfo({ size = 15, color = '#6B7280' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
}
function IconPlus({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
function IconChevronLeft({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>;
}
function IconCalendar({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
}
function IconClock({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
}
function IconRefresh({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" /></svg>;
}
function IconPin({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
}
function IconList({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
}
function IconEye({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function IconTrash({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>;
}
function IconClose({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
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

// ── Package card (single vehicle-type plan) ──────────────
function PackageCard({ pkg, selected, vehicleType, isFeatured, onSelect }: { pkg: PackagePlan; selected: boolean; vehicleType: VType; isFeatured: boolean; onSelect: () => void }) {
  const pricing = pkg.prices[vehicleType];
  const isCar = vehicleType === 'CAR';
  const perks = isCar ? CAR_PERKS : MOTO_PERKS;
  const CardIcon = isCar ? <IconCar size={16} /> : <IconBike size={16} />;
  return (
    <button
      onClick={onSelect}
      className={[
        styles.pkgCard,
        isFeatured ? styles.pkgCardFeatured : '',
        isFeatured && isCar ? styles.pkgCardFeaturedGreen : '',
        isFeatured && !isCar ? styles.pkgCardFeaturedBlue : '',
        selected && !isFeatured ? styles.pkgCardSelected : '',
        selected && isFeatured ? styles.pkgCardFeaturedSelected : '',
      ].filter(Boolean).join(' ')}
    >
      {isFeatured && (
        <span className={styles.pkgBadge}>Tiết kiệm nhất</span>
      )}

      <div className={styles.pkgCardTopRow}>
        <div>
          <p className={`${styles.pkgDuration} ${isFeatured ? styles.pkgDurationLight : styles.pkgDurationMuted}`}>
            {pkg.durationDays} ngày
          </p>
          <p className={`${styles.pkgName} ${isFeatured ? styles.pkgNameLight : ''}`}>
            {pkg.name}
          </p>
        </div>
        <div className={`${styles.pkgCardIcon} ${isCar ? styles.pkgCardIconGreen : ''} ${isFeatured ? styles.pkgCardIconFeatured : ''}`}>
          {CardIcon}
        </div>
      </div>

      <div>
        <div className={styles.pkgPrice}>
          <span className={`${styles.pkgPriceValue} ${isFeatured ? styles.pkgPriceValueLight : ''}`}>
            {pricing.priceLabel}
          </span>
        </div>
        <p className={`${styles.pkgPerDay} ${isFeatured ? styles.pkgPerDayLight : ''}`}>
          ~ {pricing.pricePerDay}
        </p>
      </div>

      <hr className={`${styles.pkgDivider} ${isFeatured ? styles.pkgDividerLight : ''}`} />

      <ul className={`${styles.pkgPerks} ${isFeatured ? styles.pkgPerksLight : ''}`}>
        {perks.map((p) => (
          <li key={p}>
            <IconCheck size={14} color={isFeatured ? '#ffffff' : '#16a34a'} />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      {isFeatured && (
        <span className={`${styles.pkgSaving} ${styles.pkgSavingFeatured}`}>
          Tiết kiệm ~11%
        </span>
      )}
      {!isFeatured && pkg.id === '1y' && (
        <span className={styles.pkgSaving}>
          Tiết kiệm ~17%
        </span>
      )}

      <span className={[
        styles.pkgCta,
        isFeatured ? styles.pkgCtaGold : styles.pkgCtaOutline,
        selected && !isFeatured ? styles.pkgCtaOutlineSelected : '',
      ].filter(Boolean).join(' ')}>
        {selected ? (
          <>
            <IconCheck size={14} color={isFeatured ? '#78350f' : C.white} />
            Đã chọn
          </>
        ) : isFeatured ? 'Đăng ký ngay' : 'Chọn gói này'}
      </span>
    </button>
  );
}

// ── Pricing group (one vehicle type, 3 cards inside panel) ─
const MOTO_PERKS = ['Đỗ ở ô trống bất kỳ', 'Không tính phí theo lượt', 'Ra vào không giới hạn', 'Khu xe máy riêng, có mái che'];
const CAR_PERKS  = ['Chỗ đỗ cố định riêng', 'Không tính phí theo lượt', 'Ra vào không giới hạn', 'Ưu tiên khu gói tháng'];

function PricingGroup({ vtype, selectedPlanId, onSelect }: { vtype: VType; selectedPlanId: string; onSelect: (planId: string, vtype: VType) => void }) {
  const isCar = vtype === 'CAR';
  const title = isCar ? 'Gói Ô tô' : 'Gói Xe máy';
  const subtitle = isCar
    ? 'Chỗ đỗ cố định, ưu tiên khu gói tháng'
    : 'Đỗ ở ô trống bất kỳ, khu xe máy riêng có mái che';
  const panelClass = isCar ? styles.pkgPanelGreen : styles.pkgPanelBlue;
  const watermarkSrc = isCar ? carWatermark : motorbikeWatermark;
  const watermarkClass = `${styles.vehicleWatermark} ${isCar ? styles.vehicleWatermarkCar : ''}`;
  const IconSvg = isCar ? <IconCar size={18} /> : <IconBike size={18} />;
  return (
    <div className={styles.pkgGroup}>
      <div className={styles.pkgGroupHeader}>
        <div className={`${styles.pkgGroupIcon} ${isCar ? styles.pkgGroupIconGreen : styles.pkgGroupIconBlue}`}>
          {IconSvg}
        </div>
        <div>
          <h4 className={styles.pkgGroupTitle}>{title}</h4>
          <p className={styles.pkgGroupSubtitle}>{subtitle}</p>
        </div>
      </div>
      <div className={`${styles.pkgPanel} ${panelClass}`}>
        <img
          src={watermarkSrc}
          alt=""
          aria-hidden="true"
          className={watermarkClass}
          draggable={false}
        />
        <div className={styles.pkgCardsRow}>
          {PACKAGES.map((pkg, idx) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              selected={selectedPlanId === pkg.id}
              vehicleType={vtype}
              isFeatured={idx === 1}
              onSelect={() => onSelect(pkg.id, vtype)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export function MonthlyPackagePage({ onAddVehicle }: { onAddVehicle?: () => void } = {}) {
  const { user, isLoading: authLoading } = useAuth();

  // Navigation / View state
  const [isPurchasing, setIsPurchasing] = useState(false);

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
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [pkgToCancel, setPkgToCancel] = useState<MonthlyPackage | null>(null);

  // Detail Modal
  const [selectedDetailPkg, setSelectedDetailPkg] = useState<MonthlyPackage | null>(null);
  const [detailQrUrl, setDetailQrUrl] = useState<string>('');

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
  const expiryLabel = formatDate(expiryDate);
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

  // Detail Modal QR Code generation
  useEffect(() => {
    if (selectedDetailPkg) {
      const qrPayload = JSON.stringify({
        ticketType: 'MONTHLY_PASS',
        packageId: selectedDetailPkg.id,
        vehicleId: selectedDetailPkg.vehicleId,
        plateNumber: selectedDetailPkg.vehicle?.plateNumber || selectedDetailPkg.vehicleId,
        expiryDate: selectedDetailPkg.expiryDate,
      });
      QRCode.toDataURL(qrPayload, { width: 180, margin: 1 })
        .then(url => setDetailQrUrl(url))
        .catch(() => setDetailQrUrl(''));
    } else {
      setDetailQrUrl('');
    }
  }, [selectedDetailPkg]);

  // Pick a plan; if the user picks a plan from a different vehicle-type group
  // than the currently selected vehicle, try to switch to a matching vehicle
  // automatically (or surface an inline error so the user picks a vehicle first).
  const handleSelectPlan = (planId: string, groupVtype: VType) => {
    setSubmitError('');
    if (vehicleType && vehicleType !== groupVtype) {
      const matching = vehicles.find((v) => v.type === groupVtype && !v.isMonthly);
      if (matching) {
        setSelectedVehicleId(matching.id);
        setSelectedSlotId(null);
      } else {
        setSubmitError(
          `Bạn cần thêm xe ${TYPE_LABEL[groupVtype]} trước khi chọn gói này.`
        );
        return;
      }
    }
    setSelectedPlanId(planId);
  };

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
    setIsPurchasing(false);
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

  const handleCancelPackage = (pkg: MonthlyPackage) => {
    setPkgToCancel(pkg);
    setShowCancelConfirm(true);
  };

  const confirmCancelPackage = async () => {
    if (!pkgToCancel) return;
    const pkg = pkgToCancel;
    setShowCancelConfirm(false);
    setPackageActionLoading(pkg.id);
    setPackageActionError('');
    setPackageActionSuccess('');
    try {
      const updated = await monthlyPackageService.cancelPackage(pkg.id);
      setMyPackages((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setPackageActionSuccess('Hủy gói tháng thành công.');
    } catch (e: any) {
      setPackageActionError(e?.response?.data?.message ?? 'Không thể hủy gói tháng.');
    } finally {
      setPackageActionLoading(null);
      setPkgToCancel(null);
    }
  };

  // ── Auth gates ───────────────────────────────────────
  if (authLoading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: C.navy, fontSize: '0.9rem', fontWeight: 600 }}>Đang tải...</div>;
  }
  if (!user) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: C.navy, fontSize: '0.9rem' }}>Vui lòng đăng nhập để mua gói tháng.</div>;
  }

  // Derived counts for Summary Cards
  const activePackagesCount = myPackages.filter((pkg) => pkg.status === 'ACTIVE').length;
  const expiringSoonCount = myPackages.filter((pkg) => {
    if (pkg.status !== 'ACTIVE') return false;
    const days = getRemainingDays(pkg.expiryDate);
    return days <= 7 && days > 0;
  }).length;
  const autoRenewCount = myPackages.filter((pkg) => pkg.status === 'ACTIVE' && pkg.autoRenew).length;

  // ── PURCHASE FLOW RENDERING ──────────────────────────
  const renderPurchaseFlow = () => {
    // ── Success state ────────────────────────────────────
    if (createdPkg) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', paddingTop: '1.5rem' }}>
          <div style={{ width: 72, height: 72, background: C.greenBg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `3px solid ${C.green}` }}>
            <IconCheck size={36} color={C.green} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: C.gray900 }}>Thanh toán thành công!</p>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.875rem', color: C.gray600 }}>Bạn đã đăng ký gói tháng thành công.</p>
          </div>
          <div className={styles.card} style={{ width: '100%', maxWidth: 480, background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                <span style={{ fontSize: '0.875rem', fontWeight: 800, color: C.navy }}>{formatDate(createdPkg.expiryDate)}</span>
              </div>
            </div>
          </div>
          <button onClick={handleReset} className={newStyles.btnPrimary} style={{ padding: '0.75rem 2rem' }}>
            Quay lại trang chủ
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 480, margin: '0 auto', width: '100%' }}>
          {/* Bill summary */}
          <div className={styles.card} style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: C.gray900 }}>Tổng thanh toán</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: C.navy }}>{formatVND(totalAmount)}</span>
            </div>
          </div>

          {/* Card form */}
          <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#ffffff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
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
            className={newStyles.btnPrimary}
            style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', background: C.navy }}
          >
            {submitting ? 'Đang xử lý...' : `Thanh toán ${formatVND(totalAmount)}`}
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
        { label: 'Ngày bắt đầu', value: formatDate(today.toISOString()) },
        { label: 'Ngày hết hạn', value: expiryLabel },
        { label: 'Thời hạn', value: `${selectedPlan.durationDays} ngày` },
      ];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 480, margin: '0 auto', width: '100%' }}>
          {/* Bill */}
          <div className={styles.card} style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
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
          <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem', background: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
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
                <button onClick={handleProceedToQR} className={newStyles.btnSecondary} style={{ padding: '0.45rem 1.25rem' }}>
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
            className={newStyles.btnPrimary}
            style={{ width: '100%', padding: '0.85rem' }}
          >
            {submitting ? 'Đang xử lý...' : 'Tôi đã thanh toán'}
          </button>
        </div>
      );
    }

    // ── Main purchase form ─────────────────────────────────────────
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* SECTION 1: Vehicle picker */}
        <div className={styles.card} style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
          <p style={{ margin: '0 0 0.85rem', fontSize: '1rem', fontWeight: 800, color: C.gray900 }}>Chọn xe đăng ký</p>
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
          <div style={{ padding: '0.75rem 1rem', background: C.blueBg, border: '1px solid #BFDBFE', borderRadius: 12, fontSize: '0.85rem', color: '#1D4ED8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconInfo size={16} color={C.blue} />
            {vehicleType === 'MOTORBIKE'
              ? 'Xe máy — Đỗ ở ô trống bất kỳ, không cần chọn vị trí cố định.'
              : 'Ô tô — Vui lòng chọn một chỗ đỗ cố định dưới đây.'}
          </div>
        )}

        {/* SECTION 3: slot picker (CAR only) */}
        {vehicleType === 'CAR' && selectedVehicle && (
          <div className={styles.card} style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 800, color: C.gray900 }}>Chọn chỗ đỗ cố định</p>
            <SlotPicker slots={availableCarSlots} selectedSlotId={selectedSlotId} onSelect={(id) => { setSelectedSlotId(id); setSubmitError(''); }} loading={loadingSlots} error={slotError} onRetry={loadSlots} />
          </div>
        )}

        {/* SECTION 4: package selection — BOTH vehicle groups shown side-by-side-stacked */}
        {vehicleType && (
          <div className={styles.card} style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 800, color: C.gray900 }}>Chọn gói đăng ký</p>
            <p style={{ margin: '0 0 0.85rem', fontSize: '0.82rem', color: C.gray600 }}>
              Gói sẽ được áp dụng cho xe <b style={{ color: C.navy }}>{selectedVehicle?.plateNumber}</b> ({TYPE_LABEL[vehicleType!]}).
            </p>
            <PricingGroup
              vtype="MOTORBIKE"
              selectedPlanId={selectedPlanId}
              onSelect={handleSelectPlan}
            />
            <PricingGroup
              vtype="CAR"
              selectedPlanId={selectedPlanId}
              onSelect={handleSelectPlan}
            />
          </div>
        )}

        {/* SECTION 5: payment summary */}
        {selectedVehicle && vehicleType && (
          <div className={styles.card} style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <p style={{ margin: '0 0 0.85rem', fontSize: '1rem', fontWeight: 800, color: C.gray900 }}>Tóm tắt thanh toán</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.875rem', color: C.gray600 }}>Ngày bắt đầu</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.gray900 }}>{formatDate(today.toISOString())}</span>
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
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: C.navy }}>{selectedPrice ? formatVND(totalAmount) : '—'}</span>
            </div>
          </div>
        )}

        {/* Error banner */}
        {submitError && (
          <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#B91C1C', fontWeight: 500 }}>{submitError}</div>
        )}

        {/* Payment method picker */}
        <div className={styles.card} style={{ padding: '1rem', background: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
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
          className={newStyles.btnPrimary}
          style={{ width: '100%', padding: '0.9rem', fontSize: '1rem' }}
        >
          Tiến hành thanh toán
        </button>

      </div>
    );
  };

  // ── DASHBOARD RENDERING ──────────────────────────────
  return (
    <div className={newStyles.pageContainer}>
      
      {/* 1. Page Header */}
      <div className={newStyles.header}>
        <div className={newStyles.headerInfo}>
          <h2 className={newStyles.title}>Gói tháng hiện tại</h2>
          <p className={newStyles.subtitle}>Quản lý gia hạn gói tháng và cài đặt gia hạn tự động.</p>
        </div>
        {/* Only show register button if they are not purchasing and have packages already */}
        {!isPurchasing && myPackages.length > 0 && (
          <button className={newStyles.registerBtnHeader} onClick={() => setIsPurchasing(true)}>
            <IconPlus size={16} /> Đăng ký gói mới
          </button>
        )}
      </div>

      {/* Action Notification Banners */}
      {packageActionError && (
        <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#B91C1C', fontWeight: 600 }}>
          {packageActionError}
        </div>
      )}
      {packageActionSuccess && (
        <div style={{ background: C.greenBg, border: `1.5px solid ${C.greenBorder}`, borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.875rem', color: C.green, fontWeight: 600 }}>
          {packageActionSuccess}
        </div>
      )}

      {/* Render purchase flow if active, else normal dashboard */}
      {isPurchasing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Purchase Back header */}
          {!createdPkg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <button
                className={newStyles.btnSecondary}
                onClick={() => {
                  if (showCard) setShowCard(false);
                  else if (showQR) setShowQR(false);
                  else setIsPurchasing(false);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem' }}
              >
                <IconChevronLeft size={16} /> Quay lại
              </button>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: C.navy }}>
                {showCard ? 'Thanh toán bằng thẻ' : showQR ? 'Thanh toán bằng QR' : 'Đăng ký gói mới'}
              </h3>
            </div>
          )}
          {renderPurchaseFlow()}
        </div>
      ) : (
        <>
          {/* 2. Summary Cards Row */}
          <div className={newStyles.summaryGrid}>
            {/* Card 1: Active Packages */}
            <div className={newStyles.summaryCard}>
              <div className={`${newStyles.iconCircle} ${newStyles.iconBlue}`}>
                <IconCalendar size={20} />
              </div>
              <div className={newStyles.summaryInfo}>
                <span className={newStyles.summaryLabel}>Gói đang hoạt động</span>
                <h3 className={newStyles.summaryValue}>{activePackagesCount}</h3>
              </div>
            </div>

            {/* Card 2: Expiring Soon */}
            <div className={newStyles.summaryCard}>
              <div className={`${newStyles.iconCircle} ${newStyles.iconOrange}`}>
                <IconClock size={20} />
              </div>
              <div className={newStyles.summaryInfo}>
                <span className={newStyles.summaryLabel}>Sắp hết hạn</span>
                <h3 className={newStyles.summaryValue}>{expiringSoonCount}</h3>
              </div>
            </div>

            {/* Card 3: Auto Renewing */}
            <div className={newStyles.summaryCard}>
              <div className={`${newStyles.iconCircle} ${newStyles.iconGreen}`}>
                <IconRefresh size={20} />
              </div>
              <div className={newStyles.summaryInfo}>
                <span className={newStyles.summaryLabel}>Tự động gia hạn</span>
                <h3 className={newStyles.summaryValue}>{autoRenewCount}</h3>
              </div>
            </div>
          </div>

          {/* 3. Package List Section or Empty State */}
          {loadingPackages ? (
            <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #E2E8F0', padding: '3rem', textAlign: 'center', color: C.gray400, fontSize: '0.95rem', fontWeight: 600 }}>
              Đang tải danh sách gói tháng...
            </div>
          ) : myPackages.length === 0 ? (
            /* 6. Empty State */
            <div className={newStyles.emptyStateCard}>
              <div className={newStyles.emptyStateIcon}>
                <IconCalendar size={32} />
              </div>
              <h4 className={newStyles.emptyTitle}>Chưa có gói tháng</h4>
              <p className={newStyles.emptyDescription}>
                Bạn chưa đăng ký gói tháng nào. Hãy chọn gói phù hợp để bắt đầu sử dụng dịch vụ.
              </p>
              <button className={newStyles.emptyCta} onClick={() => setIsPurchasing(true)}>
                Đăng ký gói tháng ngay
              </button>
            </div>
          ) : (
            /* Vertical list of package cards */
            <div className={newStyles.packagesStack}>
              {myPackages.map((pkg) => {
                const remainingDays = getRemainingDays(pkg.expiryDate);
                const totalDays = getTotalDays(pkg.startDate, pkg.expiryDate);
                
                // Status mapping
                const isExpired = pkg.status === 'EXPIRED' || remainingDays <= 0;
                const isExpiring = !isExpired && remainingDays <= 7;
                
                // Ratio calculation
                const ratio = isExpired ? 0 : (totalDays > 0 ? Math.min(1, Math.max(0, remainingDays / totalDays)) : 0);

                // Icons dynamic to vehicle
                const isMotorbike = pkg.vehicle?.type === 'MOTORBIKE';
                
                return (
                  <div key={pkg.id} className={newStyles.packageCard}>
                    {/* A. Card top row */}
                    <div className={newStyles.cardTopRow}>
                      <div className={newStyles.cardTopLeft}>
                        <div className={newStyles.avatarIcon}>
                          {isMotorbike ? <IconBike size={20} /> : <IconCar size={20} />}
                        </div>
                        <div className={newStyles.cardTitleBlock}>
                          <h4 className={newStyles.cardMainTitle}>
                            {pkg.planName || (isMotorbike ? 'Gói Xe máy tháng' : 'Gói Ô tô tháng')}
                          </h4>
                          <p className={newStyles.cardSubtitle}>
                            Xe: {pkg.vehicle?.plateNumber || pkg.vehicleId || '-'}
                          </p>
                        </div>
                      </div>

                      <div className={newStyles.badgeGroup}>
                        {/* Status Badge 1 */}
                        {isExpired ? (
                          <span className={`${newStyles.statusBadge} ${newStyles.statusExpired}`}>
                            <span className={newStyles.dot} /> Hết hạn
                          </span>
                        ) : isExpiring ? (
                          <span className={`${newStyles.statusBadge} ${newStyles.statusExpiring}`}>
                            <span className={newStyles.dot} /> Sắp hết hạn
                          </span>
                        ) : (
                          <span className={`${newStyles.statusBadge} ${newStyles.statusActive}`}>
                            <span className={newStyles.dot} /> Đang hoạt động
                          </span>
                        )}

                        {/* Status Badge 2 */}
                        {pkg.autoRenew ? (
                          <span className={`${newStyles.renewBadge} ${newStyles.renewOn}`}>
                            Tự động gia hạn
                          </span>
                        ) : (
                          <span className={`${newStyles.renewBadge} ${newStyles.renewOff}`}>
                            Không tự động
                          </span>
                        )}
                      </div>
                    </div>

                    {/* B. Details row */}
                    <div className={newStyles.detailsGrid}>
                      {/* Block 1 */}
                      <div className={newStyles.detailBlock}>
                        <div className={newStyles.detailIcon}>
                          <IconCalendar size={18} />
                        </div>
                        <div className={newStyles.detailInfo}>
                          <span className={newStyles.detailLabel}>Bắt đầu</span>
                          <span className={newStyles.detailValue}>{formatDate(pkg.startDate)}</span>
                        </div>
                      </div>

                      {/* Block 2 */}
                      <div className={newStyles.detailBlock}>
                        <div className={newStyles.detailIcon}>
                          <IconCalendar size={18} />
                        </div>
                        <div className={newStyles.detailInfo}>
                          <span className={newStyles.detailLabel}>Hết hạn</span>
                          <span className={newStyles.detailValue}>{formatDate(pkg.expiryDate)}</span>
                        </div>
                      </div>

                      {/* Block 3 */}
                      <div className={newStyles.detailBlock}>
                        <div className={newStyles.detailIcon}>
                          <IconPin size={18} />
                        </div>
                        <div className={newStyles.detailInfo}>
                          <span className={newStyles.detailLabel}>Vị trí</span>
                          <span className={newStyles.detailValue}>
                            {pkg.slot?.floor?.name && pkg.slot?.code
                              ? `Tầng ${pkg.slot.floor.name} · Ô ${pkg.slot.code}`
                              : (isMotorbike ? 'Khu tự do (Xe máy)' : 'Chưa phân vị trí')}
                          </span>
                        </div>
                      </div>

                      {/* Block 4 */}
                      <div className={newStyles.detailBlock}>
                        <div className={newStyles.detailIcon}>
                          <IconList size={18} />
                        </div>
                        <div className={newStyles.detailInfo}>
                          <span className={newStyles.detailLabel}>Gói</span>
                          <span className={newStyles.detailValue}>
                            {isMotorbike ? 'Xe máy tháng' : 'Ô tô tháng'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 4. Remaining days + progress bar */}
                    <div className={newStyles.progressContainer}>
                      <div className={newStyles.progressLabelRow}>
                        <span className={newStyles.progressText}>
                          {isExpired ? 'Đã hết hạn sử dụng' : `Còn lại ${remainingDays} ngày`}
                        </span>
                        <span className={newStyles.progressText}>
                          {Math.round(ratio * 100)}%
                        </span>
                      </div>
                      <div className={newStyles.progressBarTrack}>
                        <div
                          className={[
                            newStyles.progressBarFill,
                            isExpired ? newStyles.progressBarFillExpired : '',
                            isExpiring ? newStyles.progressBarFillExpiring : '',
                          ].filter(Boolean).join(' ')}
                          style={{ width: `${ratio * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* 5. Action buttons row */}
                    <div className={newStyles.actionsRow}>
                      <div className={newStyles.leftActionGroup}>
                        {/* 1. Primary button */}
                        <button
                          onClick={() => handleRenewPackage(pkg)}
                          disabled={packageActionLoading === pkg.id}
                          className={newStyles.btnPrimary}
                        >
                          <IconCalendar size={16} /> Gia hạn ngay
                        </button>

                        {/* 2. Secondary button */}
                        {!isExpired && (
                          <button
                            onClick={() => handleToggleAutoRenew(pkg)}
                            disabled={packageActionLoading === pkg.id}
                            className={newStyles.btnSecondary}
                          >
                            <IconRefresh size={16} />
                            {pkg.autoRenew ? 'Tắt gia hạn tự động' : 'Bật gia hạn tự động'}
                          </button>
                        )}

                        {/* 3. Neutral button */}
                        <button
                          onClick={() => setSelectedDetailPkg(pkg)}
                          className={newStyles.btnSecondary}
                        >
                          <IconEye size={16} /> Xem chi tiết
                        </button>
                      </div>

                      {/* Right Danger Action */}
                      {!isExpired && (
                        <>
                          <div className={newStyles.divider} />
                          <button
                            onClick={() => handleCancelPackage(pkg)}
                            disabled={packageActionLoading === pkg.id}
                            className={newStyles.btnDanger}
                          >
                            <IconTrash size={16} /> Hủy gia hạn gói
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      {showCancelConfirm && pkgToCancel && (
        <div className={newStyles.modalOverlay}>
          <div className={newStyles.modalContent}>
            <div className={newStyles.modalHeader}>
              <div className={`${newStyles.modalIcon} ${newStyles.modalIconDanger}`}>
                <IconTrash size={22} color="#DC2626" />
              </div>
              <h3 className={newStyles.modalTitle}>Xác nhận hủy gia hạn</h3>
            </div>

            <div className={newStyles.warningBox}>
              <strong>Hành động này không thể hoàn tác!</strong> Bạn có chắc chắn muốn hủy gia hạn gói này không? Xe của bạn sẽ không còn được nhận diện là xe vé tháng và chỗ đỗ cố định (nếu có) sẽ bị giải phóng.
            </div>

            <div className={newStyles.modalActions}>
              <button
                type="button"
                className={newStyles.btnSecondary}
                onClick={() => {
                  setShowCancelConfirm(false);
                  setPkgToCancel(null);
                }}
              >
                Quay lại
              </button>
              <button
                type="button"
                className={newStyles.btnPrimary}
                style={{ background: '#DC2626' }}
                onClick={confirmCancelPackage}
              >
                Xác nhận hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail View Ticket Modal */}
      {selectedDetailPkg && (
        <div className={newStyles.modalOverlay} onClick={() => setSelectedDetailPkg(null)}>
          <div className={[newStyles.modalContent, newStyles.detailModalContent].join(' ')} onClick={(e) => e.stopPropagation()}>
            <button className={newStyles.closeModalBtn} onClick={() => setSelectedDetailPkg(null)}>
              <IconClose size={20} />
            </button>

            <div className={newStyles.modalHeader}>
              <div className={`${newStyles.modalIcon} ${newStyles.modalIconInfo}`}>
                {selectedDetailPkg.vehicle?.type === 'MOTORBIKE' ? <IconBike size={22} color="#3B82F6" /> : <IconCar size={22} color="#3B82F6" />}
              </div>
              <h3 className={newStyles.modalTitle}>Vé Đỗ Xe Vé Tháng</h3>
            </div>

            <div className={newStyles.ticketGrid}>
              <div className={newStyles.ticketRow}>
                <span className={newStyles.ticketLabel}>Mã gói tháng</span>
                <span className={newStyles.ticketValue}>{selectedDetailPkg.id}</span>
              </div>
              <div className={newStyles.ticketRow}>
                <span className={newStyles.ticketLabel}>Biển số xe</span>
                <span className={newStyles.ticketValueHighlight}>{selectedDetailPkg.vehicle?.plateNumber || selectedDetailPkg.vehicleId}</span>
              </div>
              <div className={newStyles.ticketRow}>
                <span className={newStyles.ticketLabel}>Loại xe</span>
                <span className={newStyles.ticketValue}>{selectedDetailPkg.vehicle?.type === 'MOTORBIKE' ? 'Xe máy' : 'Ô tô'}</span>
              </div>
              <div className={newStyles.ticketRow}>
                <span className={newStyles.ticketLabel}>Vị trí cố định</span>
                <span className={newStyles.ticketValue}>
                  {selectedDetailPkg.slot?.floor?.name && selectedDetailPkg.slot?.code
                    ? `Tầng ${selectedDetailPkg.slot.floor.name} · Ô ${selectedDetailPkg.slot.code}`
                    : (selectedDetailPkg.vehicle?.type === 'MOTORBIKE' ? 'Khu tự do (Xe máy)' : 'Chưa phân vị trí')}
                </span>
              </div>
              <div className={newStyles.ticketRow}>
                <span className={newStyles.ticketLabel}>Giá trị gói</span>
                <span className={newStyles.ticketValuePrice}>{formatVND(selectedDetailPkg.price)}</span>
              </div>
              <div className={newStyles.ticketRow}>
                <span className={newStyles.ticketLabel}>Ngày bắt đầu</span>
                <span className={newStyles.ticketValue}>{formatDate(selectedDetailPkg.startDate)}</span>
              </div>
              <div className={newStyles.ticketRow}>
                <span className={newStyles.ticketLabel}>Ngày hết hạn</span>
                <span className={newStyles.ticketValueHighlight}>{formatDate(selectedDetailPkg.expiryDate)}</span>
              </div>
              <div className={newStyles.ticketRow}>
                <span className={newStyles.ticketLabel}>Gia hạn tự động</span>
                <span className={newStyles.ticketValue}>{selectedDetailPkg.autoRenew ? 'Đang bật' : 'Đang tắt'}</span>
              </div>
              <div className={newStyles.ticketRow}>
                <span className={newStyles.ticketLabel}>Trạng thái</span>
                <span style={{ fontWeight: 800, color: selectedDetailPkg.status === 'ACTIVE' ? '#10B981' : '#EF4444' }}>
                  {selectedDetailPkg.status === 'ACTIVE' ? 'ĐANG HOẠT ĐỘNG' : 'HẾT HẠN'}
                </span>
              </div>
            </div>

            {/* Check-in QR code */}
            {detailQrUrl && (
              <div className={newStyles.qrContainer}>
                <img src={detailQrUrl} alt="Check-in QR" width={180} height={180} className={newStyles.qrImage} />
                <p style={{ margin: 0, fontSize: '0.8rem', color: C.gray600, textAlign: 'center', lineHeight: 1.5 }}>
                  Quét mã này tại cổng kiểm soát để tự động ra vào
                </p>
              </div>
            )}

            <div className={newStyles.modalActions} style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className={newStyles.btnPrimary}
                onClick={() => setSelectedDetailPkg(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}