import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { vehicleService as _vehicleService } from '../services/vehicle.service';
import { monthlyPackageService } from '../services/monthlyPackage.service';
import type { MonthlyPackage } from '../types/index';
import { formatPlateNumber } from '../utils/plate';
import { type PackagePlan, getTierAreaLabel } from '../constants/packages';
import { PackagePurchaseModal } from '../components/PackagePurchaseModal';
import { useMonthlyPaymentReturn } from '../hooks/useMonthlyPaymentReturn';
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


const getPlanDisplayName = (planName?: string | null): string => {
  switch (planName) {
    case '1m':
      return 'Gói 1 tháng';
    case '3m':
      return 'Gói 3 tháng';
    case '1y':
      return 'Gói 1 năm';
    default:
      return 'Gói tháng';
  }
};

const getPlanDurationLabel = (planName?: string | null): string => {
  switch (planName) {
    case '1m':
      return '1 tháng';
    case '3m':
      return '3 tháng';
    case '1y':
      return '1 năm';
    default:
      return 'Tháng';
  }
};

const getVehicleTypeLabel = (vehicleType?: string | null): string => {
  switch (vehicleType) {
    case 'CAR':
      return 'Ô tô';
    case 'MOTORBIKE':
      return 'Xe máy';
    default:
      return 'Phương tiện';
  }
};

const getPackageSummaryLabel = (vehicleType?: string | null, planName?: string | null): string => {
  if (!planName || (planName !== '1m' && planName !== '3m' && planName !== '1y')) {
    if (vehicleType === 'CAR') return 'Gói tháng ô tô';
    if (vehicleType === 'MOTORBIKE') return 'Gói tháng xe máy';
    return 'Gói tháng';
  }

  const typeLabel = getVehicleTypeLabel(vehicleType);
  const durationLabel = getPlanDurationLabel(planName);

  return typeLabel ? `${typeLabel} · ${durationLabel}` : `Gói ${durationLabel}`;
};


const formatFloorName = (name?: string | null): string => {
  if (!name) return '';
  if (name.startsWith('Tầng')) return name;
  return `Tầng ${name}`;
};


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

interface VehiclePackageIconProps {
  vehicleType?: string | null;
  variant?: 'card' | 'ticket';
}

function VehiclePackageIcon({
  vehicleType,
  variant = 'card',
}: VehiclePackageIconProps) {
  if (vehicleType === 'CAR') {
    return (
      <span className={newStyles.vehiclePackageIcon}>
        <img
          src="/oto.png"
          alt="Ô tô"
          className={`${newStyles.vehiclePackageImage} ${newStyles.carVehicleImage}`}
        />
      </span>
    );
  }

  if (vehicleType === 'MOTORBIKE') {
    return (
      <span className={newStyles.vehiclePackageIcon}>
        <img
          src="/xemay.png"
          alt="Xe máy"
          className={`${newStyles.vehiclePackageImage} ${newStyles.motorbikeVehicleImage}`}
        />
      </span>
    );
  }

  return (
    <span className={variant === 'ticket' ? `${newStyles.modalIcon} ${newStyles.modalIconInfo}` : newStyles.avatarIcon}>
      <IconCar size={variant === 'ticket' ? 22 : 20} color={variant === 'ticket' ? '#3B82F6' : undefined} />
    </span>
  );
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

function IconPin({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
}
function IconLayers3({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 12.5-8.58 3.91a2 2 0 0 1-1.66 0L3 12.5" /><path d="m22 17.5-8.58 3.91a2 2 0 0 1-1.66 0L3 17.5" /></svg>;
}
function IconEye({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function IconClose({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
}
// ── Motorbike-benefit icons ───────────────────────────────
function IconInfinity({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12c-2-2.5-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.5 6-4z" /><path d="M12 12c2 2.5 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.5-6 4z" /></svg>;
}
function IconReceipt({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 2 6 22" /><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" /><line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="13" x2="15" y2="13" /></svg>;
}
function IconMap({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>;
}
function IconCamera({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>;
}
function IconHeadset({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" /><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>;
}
function IconZap({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
}






// ═══════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

// ── Package card (single vehicle-type plan) ──────────────
function getCarPerks(planId: string): string[] {
  if (planId === '1m') {
    return [
      'Sử dụng Khu Cơ bản',
      'Ra vào không giới hạn',
      'Không tính phí theo lượt',
      'Xem sơ đồ tầng',
      'Camera giám sát 24/7',
    ];
  }
  if (planId === '3m') {
    return [
      'Sử dụng Khu Phổ biến',
      'Ra vào không giới hạn',
      'Không tính phí theo lượt',
      'Xem sơ đồ tầng',
      'Camera giám sát 24/7',
    ];
  }
  if (planId === '1y') {
    return [
      'Sử dụng Khu VIP',
      'Ra vào không giới hạn',
      'Không tính phí theo lượt',
      'Xem sơ đồ tầng',
      'Camera giám sát 24/7',
      'Ưu tiên check-in',
    ];
  }
  return [];
}

type PerkItem = { label: string; iconKey: string };

function getMotoPerks(planId: string): PerkItem[] {
  if (planId === '1m') {
    return [
      { label: 'Đỗ xe máy tại khu Cơ bản', iconKey: 'bike' },
      { label: 'Ra vào không giới hạn',          iconKey: 'infinity' },
      { label: 'Không tính phí theo lượt',        iconKey: 'receipt' },
      { label: 'Xem sơ đồ tầng',                 iconKey: 'map' },
      { label: 'Camera giám sát 24/7',            iconKey: 'camera' },
    ];
  }
  if (planId === '3m') {
    return [
      { label: 'Đỗ xe máy tại khu Phổ biến',     iconKey: 'bike' },
      { label: 'Ra vào không giới hạn',          iconKey: 'infinity' },
      { label: 'Không tính phí theo lượt',        iconKey: 'receipt' },
      { label: 'Xem sơ đồ tầng',                 iconKey: 'map' },
      { label: 'Camera giám sát 24/7',            iconKey: 'camera' },
    ];
  }
  if (planId === '1y') {
    return [
      { label: 'Đỗ xe máy tại khu VIP',          iconKey: 'bike' },
      { label: 'Ra vào không giới hạn',          iconKey: 'infinity' },
      { label: 'Không tính phí theo lượt',        iconKey: 'receipt' },
      { label: 'Xem sơ đồ tầng',                 iconKey: 'map' },
      { label: 'Camera giám sát 24/7',            iconKey: 'camera' },
      { label: 'Ưu tiên check-in',               iconKey: 'zap' },
    ];
  }
  return [];
}

function MotoPerkIcon({ iconKey, size, color }: { iconKey: string; size: number; color: string }) {
  if (iconKey === 'infinity') return <IconInfinity size={size} color={color} />;
  if (iconKey === 'receipt')  return <IconReceipt  size={size} color={color} />;
  if (iconKey === 'map')      return <IconMap       size={size} color={color} />;
  if (iconKey === 'camera')   return <IconCamera    size={size} color={color} />;
  if (iconKey === 'headset')  return <IconHeadset   size={size} color={color} />;
  if (iconKey === 'zap')      return <IconZap       size={size} color={color} />;
  return <IconBike size={size} color={color} />; // default: bike
}

function PackageCard({ pkg, selected, vehicleType, isFeatured, onSelect }: { pkg: PackagePlan; selected: boolean; vehicleType: VType; isFeatured: boolean; onSelect: () => void }) {
  const pricing = pkg.prices[vehicleType];
  const isCar = vehicleType === 'CAR';
  const carPerks = isCar ? getCarPerks(pkg.id) : null;
  const motoPerks = !isCar ? getMotoPerks(pkg.id) : null;
  const iconColor = isFeatured ? '#ffffff' : '#16a34a';
  const CardIcon = isCar ? <IconCar size={16} /> : <IconBike size={16} />;
  return (
    <div
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
            {pricing ? formatVND(pricing.price) : 'N/A'}
          </span>
        </div>
        <p className={`${styles.pkgPerDay} ${isFeatured ? styles.pkgPerDayLight : ''}`}>
          ~ {pricing ? formatVND(Math.round(pricing.price / pkg.durationDays)) + '/ngày' : 'N/A'}
        </p>
      </div>

      <hr className={`${styles.pkgDivider} ${isFeatured ? styles.pkgDividerLight : ''}`} />

      <ul className={`${styles.pkgPerks} ${isFeatured ? styles.pkgPerksLight : ''}`}>
        {isCar
          ? (carPerks ?? []).map((p) => (
              <li key={p}>
                <IconCheck size={14} color={iconColor} />
                <span>{p}</span>
              </li>
            ))
          : (motoPerks ?? []).map((p) => (
              <li key={p.label}>
                <MotoPerkIcon iconKey={p.iconKey} size={14} color={iconColor} />
                <span>{p.label}</span>
              </li>
            ))
        }
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

      <button
        type="button"
        onClick={onSelect}
        className={[
          styles.pkgCta,
          isFeatured ? styles.pkgCtaGold : styles.pkgCtaOutline,
          selected && !isFeatured ? styles.pkgCtaOutlineSelected : '',
        ].filter(Boolean).join(' ')}
      >
        {selected ? (
          <>
            <IconCheck size={14} color={isFeatured ? '#78350f' : C.white} />
            Đã chọn
          </>
        ) : 'Chọn gói này'}
      </button>
    </div>
  );
}

// ── Pricing group (one vehicle type, 3 cards inside panel) ─

function PricingGroup({ vtype, selectedPlanId, plans, onSelect }: { vtype: VType; selectedPlanId: string; plans: PackagePlan[]; onSelect: (planId: string, vtype: VType) => void }) {
  const isCar = vtype === 'CAR';
  const title = isCar ? 'Gói Ô tô' : 'Gói Xe máy';
  const subtitle = isCar
    ? 'Đăng ký sử dụng khu vực đỗ xe theo phân hạng'
    : 'Đỗ ở ô trống bất kỳ, khu xe máy riêng có mái che';
  const panelClass = isCar ? styles.pkgPanelGreen : styles.pkgPanelBlue;
  const watermarkSrc = isCar ? carWatermark : motorbikeWatermark;
  const watermarkClass = `${styles.vehicleWatermark} ${isCar ? styles.vehicleWatermarkCar : ''}`;
  const IconSvg = isCar ? (
    <div className={styles.carSectionIcon} />
  ) : (
    <div className={styles.motorbikeSectionIcon} />
  );
  return (
    <div className={styles.pkgGroup}>
      <div className={`${styles.pkgGroupHeader} ${isCar ? styles.pkgGroupHeaderCar : ''}`}>
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
          {plans.map((pkg, idx) => (
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

export function MonthlyPackagePage({ onAddVehicle: _onAddVehicle }: { onAddVehicle?: () => void } = {}) {
  const { user, isLoading: authLoading, refreshPackageStatus } = useAuth();

  // Navigation / View state
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Modal states
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchasePlanId, setPurchasePlanId] = useState('');
  const [purchaseVtype, setPurchaseVtype] = useState<'CAR' | 'MOTORBIKE'>('CAR');

  const handleSelectPackage = (planId: string, vtype: 'CAR' | 'MOTORBIKE') => {
    setPurchasePlanId(planId);
    setPurchaseVtype(vtype);
    setPurchaseModalOpen(true);
  };


  const [myPackages, setMyPackages] = useState<MonthlyPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [packageActionLoading, setPackageActionLoading] = useState<string | null>(null);

  const {
    paymentReturnState,
    successDetails,
    packageActionError,
    setPackageActionError,
    packageActionSuccess,
    setPackageActionSuccess,
    handleRetryVerification,
  } = useMonthlyPaymentReturn(setMyPackages);

  // Backend plans catalogue state
  const [plans, setPlans] = useState<PackagePlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState('');

  // Legacy renewal states
  const [legacyRenewModalPkg, setLegacyRenewModalPkg] = useState<MonthlyPackage | null>(null);
  const [legacySelectedPlanId, setLegacySelectedPlanId] = useState<string>('');

  // Detail Modal
  const [selectedDetailPkg, setSelectedDetailPkg] = useState<MonthlyPackage | null>(null);
  const [detailQrUrl, setDetailQrUrl] = useState<string>('');
  const [fetchingQrToken, setFetchingQrToken] = useState(false);
  const [qrTokenError, setQrTokenError] = useState('');

  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  useEffect(() => {
    if (!selectedDetailPkg) {
      setPinError(false);
      setPinLoading(false);
      setCopiedPin(false);
      return;
    }

    const isExpired = selectedDetailPkg.status === 'EXPIRED' || getRemainingDays(selectedDetailPkg.expiryDate) <= 0;
    if (isExpired) {
      return;
    }

    if (!selectedDetailPkg.monthlyAccessPin) {
      let active = true;
      const fetchPin = async () => {
        setPinLoading(true);
        setPinError(false);
        try {
          const res = await monthlyPackageService.ensureAccessPin(selectedDetailPkg.id);
          if (active) {
            setSelectedDetailPkg((prev) => {
              if (prev && prev.id === selectedDetailPkg.id) {
                return {
                  ...prev,
                  monthlyAccessPin: res.monthlyAccessPin,
                  monthlyAccessPinIssuedAt: res.monthlyAccessPinIssuedAt,
                };
              }
              return prev;
            });
            setMyPackages((prevList) =>
              prevList.map((p) =>
                p.id === selectedDetailPkg.id
                  ? {
                      ...p,
                      monthlyAccessPin: res.monthlyAccessPin,
                      monthlyAccessPinIssuedAt: res.monthlyAccessPinIssuedAt,
                    }
                  : p
              )
            );
          }
        } catch (err) {
          if (active) {
            setPinError(true);
          }
        } finally {
          if (active) {
            setPinLoading(false);
          }
        }
      };
      fetchPin();
      return () => {
        active = false;
      };
    }
  }, [selectedDetailPkg]);

  const handleRetryFetchPin = async () => {
    if (!selectedDetailPkg) return;
    setPinLoading(true);
    setPinError(false);
    try {
      const res = await monthlyPackageService.ensureAccessPin(selectedDetailPkg.id);
      setSelectedDetailPkg((prev) => {
        if (prev && prev.id === selectedDetailPkg.id) {
          return {
            ...prev,
            monthlyAccessPin: res.monthlyAccessPin,
            monthlyAccessPinIssuedAt: res.monthlyAccessPinIssuedAt,
          };
        }
        return prev;
      });
      setMyPackages((prevList) =>
        prevList.map((p) =>
          p.id === selectedDetailPkg.id
            ? {
                ...p,
                monthlyAccessPin: res.monthlyAccessPin,
                monthlyAccessPinIssuedAt: res.monthlyAccessPinIssuedAt,
              }
            : p
        )
      );
    } catch (err) {
      setPinError(true);
    } finally {
      setPinLoading(false);
    }
  };

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
    loadMyPackages();
  }, [authLoading, user, loadMyPackages]);

  const abandoningRef = useRef(false);

  const checkAndAbandonPayment = useCallback(async () => {
    const pendingPkgId = sessionStorage.getItem('pending_monthly_package_id');
    const pendingPaymentId = sessionStorage.getItem('pending_monthly_payment_id');
    const pendingSessionId = sessionStorage.getItem('pending_monthly_session_id');
    if (!pendingPkgId || !pendingPaymentId || !pendingSessionId || abandoningRef.current) return;

    // Do not abandon if we are actively polling for success
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') return;

    abandoningRef.current = true;
    try {
      await monthlyPackageService.abandonPayment(pendingPkgId, pendingPaymentId, pendingSessionId);
      sessionStorage.removeItem('pending_monthly_package_id');
      sessionStorage.removeItem('pending_monthly_payment_id');
      sessionStorage.removeItem('pending_monthly_session_id');
      setIsPurchasing(false);
      loadMyPackages();
    } catch (err: any) {
      console.error('[Stripe Abandon] Error checking/abandoning payment:', err);
      const status = err.response?.status;
      if (status === 200 || status === 404 || status === 409) {
        sessionStorage.removeItem('pending_monthly_package_id');
        sessionStorage.removeItem('pending_monthly_payment_id');
        sessionStorage.removeItem('pending_monthly_session_id');
        setIsPurchasing(false);
        loadMyPackages();
      }
    } finally {
      abandoningRef.current = false;
    }
  }, [loadMyPackages]);

  useEffect(() => {
    if (!user) return;

    checkAndAbandonPayment();

    const handleWindowFocus = () => {
      checkAndAbandonPayment();
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pageshow', handleWindowFocus);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pageshow', handleWindowFocus);
    };
  }, [user, checkAndAbandonPayment]);

  // Load plans catalogue from backend on mount
  useEffect(() => {
    const fetchPlans = async () => {
      setLoadingPlans(true);
      setPlansError('');
      try {
        const data = await monthlyPackageService.getPlans();
        setPlans(data ?? []);
      } catch (err) {
        console.error('Failed to load plans from backend:', err);
        setPlansError('Không thể tải cấu hình gói từ máy chủ.');
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);



  // Detail Modal QR Code generation
  useEffect(() => {
    if (!selectedDetailPkg) {
      setDetailQrUrl('');
      setQrTokenError('');
      return;
    }

    const isExpired = selectedDetailPkg.status === 'EXPIRED' || getRemainingDays(selectedDetailPkg.expiryDate) <= 0;
    if (isExpired) {
      setDetailQrUrl('');
      return;
    }

    let active = true;
    const fetchQrToken = async () => {
      setDetailQrUrl('');
      setFetchingQrToken(true);
      setQrTokenError('');
      try {
        const res = await monthlyPackageService.getQrToken(selectedDetailPkg.id, selectedDetailPkg.vehicleId);
        if (active && res && res.qrToken) {
          const qrPayload = JSON.stringify({
            ticketType: 'MONTHLY_PASS',
            qrToken: res.qrToken,
          });
          const url = await QRCode.toDataURL(qrPayload, { width: 180, margin: 1 });
          if (active) {
            setDetailQrUrl(url);
          }
        } else if (active) {
          setQrTokenError('Không thể tạo mã QR bảo mật từ máy chủ.');
        }
      } catch (err) {
        if (active) {
          setQrTokenError('Không thể tạo mã QR bảo mật từ máy chủ.');
          setDetailQrUrl('');
        }
      } finally {
        if (active) {
          setFetchingQrToken(false);
        }
      }
    };

    fetchQrToken();
    return () => {
      active = false;
    };
  }, [selectedDetailPkg]);

  const isLegacyPackage = useCallback((pkg: MonthlyPackage) => {
    if (!pkg.planName) return true;
    if (plans.length > 0) {
      return !plans.some(p => p.id === pkg.planName);
    }
    return false;
  }, [plans]);

  const handleRenewPackage = async (pkg: MonthlyPackage, selectedPlanId?: string) => {
    setPackageActionLoading(pkg.id);
    setPackageActionError(''); // clear error banner when renewal request begins
    setPackageActionSuccess('');
    try {
      const checkoutData = await monthlyPackageService.renewPackage(pkg.id, selectedPlanId);
      if (checkoutData.status === 'ALREADY_PROCESSED') {
        // Previous session was already paid — treat as verified success
        sessionStorage.removeItem('pending_monthly_package_id');
        sessionStorage.removeItem('pending_monthly_payment_id');
        sessionStorage.removeItem('pending_monthly_session_id');
        setLegacyRenewModalPkg(null);
        const pkgs = await monthlyPackageService.getMyPackages();
        setMyPackages(pkgs);
        await refreshPackageStatus();
        setPackageActionSuccess('Giao dịch đã được thanh toán thành công trước đó. Gói tháng đã được kích hoạt.');
        return;
      }
      if (checkoutData.url) {
        setLegacyRenewModalPkg(null); // close legacy modal on success redirect
        sessionStorage.setItem('pending_monthly_package_id', checkoutData.packageId);
        sessionStorage.setItem('pending_monthly_payment_id', checkoutData.paymentId);
        sessionStorage.setItem('pending_monthly_session_id', checkoutData.sessionId);
        sessionStorage.setItem('pending_monthly_plan_id', selectedPlanId || pkg.planName || '');
        sessionStorage.setItem('pending_monthly_vehicle_id', pkg.vehicleId);
        sessionStorage.setItem('pending_monthly_checkout_type', 'renew');
        window.location.href = checkoutData.url;
      } else {
        throw new Error('Không nhận được URL thanh toán.');
      }
    } catch (e: any) {
      setPackageActionError(e?.response?.data?.message ?? e.message ?? 'Không thể gia hạn gói.');
    } finally {
      setPackageActionLoading(null);
    }
  };

  const handleRenewBtnClick = (pkg: MonthlyPackage) => {
    setPackageActionError(''); // clear old error when clicking renewal button
    setPackageActionSuccess('');
    if (loadingPlans || plansError || plans.length === 0) {
      setPackageActionError('Không thể gia hạn lúc này vì cấu hình gói chưa được tải hoặc tải lỗi.');
      return;
    }
    if (isLegacyPackage(pkg)) {
      setLegacyRenewModalPkg(pkg);
      setLegacySelectedPlanId('');
    } else {
      handleRenewPackage(pkg);
    }
  };

  const handleStartPurchase = () => {
    if (loadingPlans || plansError || plans.length === 0) {
      setPackageActionError('Không thể đăng ký lúc này vì cấu hình gói chưa được tải hoặc tải lỗi.');
      return;
    }
    setIsPurchasing(true);
  };





  // ── Auth gates ───────────────────────────────────────
  if (authLoading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: C.navy, fontSize: '0.9rem', fontWeight: 600 }}>Đang tải...</div>;
  }
  if (!user) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: C.navy, fontSize: '0.9rem' }}>Vui lòng đăng nhập để mua gói tháng.</div>;
  }

  const isEffectivelyActive = (pkg: MonthlyPackage) =>
    pkg.isEffectivelyActive ?? (pkg.status === 'ACTIVE' && getRemainingDays(pkg.expiryDate) > 0);

  // Derived counts for Summary Cards
  const activePackagesCount = myPackages.filter(isEffectivelyActive).length;
  const expiringSoonCount = myPackages.filter((pkg) => {
    if (!isEffectivelyActive(pkg)) return false;
    const days = getRemainingDays(pkg.expiryDate);
    return days <= 7 && days > 0;
  }).length;


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
          <button className={newStyles.registerBtnHeader} onClick={handleStartPurchase}>
            <IconPlus size={16} /> Đăng ký gói mới
          </button>
        )}
      </div>

      {/* Action Notification Banners */}
      {paymentReturnState === 'VERIFYING' && (
        <div role="status" aria-live="polite" style={{ background: C.blueBg, border: `1.5px solid ${C.blue}`, borderRadius: 12, padding: '1rem', fontSize: '0.875rem', color: C.blue, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <div style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            Đang xác nhận thanh toán
          </div>
          <div style={{ color: C.gray600, fontSize: '0.8rem', paddingLeft: '1.5rem' }}>
            Giao dịch đã được gửi đến Stripe. Hệ thống đang kích hoạt gói của bạn.
          </div>
        </div>
      )}

      {paymentReturnState === 'SUCCESS' && (
        <div style={{ background: C.greenBg, border: `1.5px solid ${C.greenBorder}`, borderRadius: 12, padding: '1rem', fontSize: '0.875rem', color: C.green, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800 }}>Thanh toán thành công</div>
          <div style={{ color: C.gray600, fontSize: '0.8rem' }}>
            {successDetails ? (() => {
              const duration = getPlanDurationLabel(successDetails.planId);
              const plate = successDetails.plateNumber || '';
              return `Gói ${duration} đã được kích hoạt cho xe ${plate}.`;
            })() : 'Gói tháng của bạn đã được thanh toán và kích hoạt thành công.'}
          </div>
        </div>
      )}

      {paymentReturnState === 'FAILED' && (
        <div role="alert" style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 12, padding: '1rem', fontSize: '0.875rem', color: '#B91C1C', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontWeight: 800 }}>Chưa thể xác nhận thanh toán</div>
          <div style={{ color: C.gray600, fontSize: '0.8rem' }}>
            {packageActionError || 'Giao dịch không thành công hoặc không khớp thông tin.'}
          </div>
          <div>
            <button
              onClick={handleRetryVerification}
              style={{ background: '#B91C1C', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Thử xác nhận lại
            </button>
          </div>
        </div>
      )}

      {paymentReturnState === 'TIMEOUT' && (
        <div role="alert" style={{ background: C.amberBg, border: `1.5px solid ${C.amberBorder}`, borderRadius: 12, padding: '1rem', fontSize: '0.875rem', color: C.amber, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontWeight: 800 }}>Thanh toán đang được xử lý</div>
          <div style={{ color: C.gray600, fontSize: '0.8rem' }}>
            Hệ thống chưa nhận được kết quả cuối cùng từ Stripe. Bạn có thể tải lại trạng thái sau.
          </div>
          <div>
            <button
              onClick={handleRetryVerification}
              style={{ background: C.amber, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Tải lại trạng thái
            </button>
          </div>
        </div>
      )}

      {paymentReturnState === 'IDLE' && packageActionError && (
        <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#B91C1C', fontWeight: 600 }}>
          {packageActionError}
        </div>
      )}

      {paymentReturnState === 'IDLE' && packageActionSuccess && (
        <div style={{ background: C.greenBg, border: `1.5px solid ${C.greenBorder}`, borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.875rem', color: C.green, fontWeight: 600 }}>
          {packageActionSuccess}
        </div>
      )}

      {/* Render purchase flow if active, else normal dashboard */}
      {isPurchasing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <button
              className={newStyles.btnSecondary}
              onClick={() => setIsPurchasing(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem' }}
            >
              <IconChevronLeft size={16} /> Quay lại
            </button>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: C.navy }}>Đăng ký gói mới</h3>
          </div>
          
          {loadingPlans ? (
            <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid #E2E8F0', padding: '3rem', textAlign: 'center', color: C.gray600, fontSize: '0.95rem' }}>
              <div style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid #3B82F6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
              <p style={{ margin: 0 }}>Đang tải danh mục gói từ máy chủ...</p>
            </div>
          ) : plansError ? (
            <div style={{ background: C.redBg, borderRadius: 20, border: `1.5px solid ${C.redBorder}`, padding: '3rem', textAlign: 'center', color: '#B91C1C', fontSize: '0.95rem', fontWeight: 600 }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>❌</div>
              {plansError}
            </div>
          ) : (
            <>
              <PricingGroup vtype="MOTORBIKE" selectedPlanId="" plans={plans} onSelect={handleSelectPackage} />
              <PricingGroup vtype="CAR" selectedPlanId="" plans={plans} onSelect={handleSelectPackage} />
            </>
          )}
        </div>
      ) : (
        <>
          {/* 2. Summary Cards Row */}
          {/* 2. Summary Cards Row */}
          <div className={newStyles.summaryGrid} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
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
              <button className={newStyles.emptyCta} onClick={handleStartPurchase}>
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
                const isExpired = pkg.effectiveStatus === 'EXPIRED' || pkg.isEffectivelyActive === false || pkg.status === 'EXPIRED' || remainingDays <= 0;
                const isExpiring = !isExpired && remainingDays <= 7;
                
                // Ratio calculation
                const ratio = isExpired ? 0 : (totalDays > 0 ? Math.min(1, Math.max(0, remainingDays / totalDays)) : 0);

                return (
                  <div key={pkg.id} className={newStyles.packageCard}>
                    {/* A. Card top row */}
                    <div className={newStyles.cardTopRow}>
                      <div className={newStyles.cardTopLeft}>
                        <VehiclePackageIcon
                          vehicleType={pkg.vehicle?.type}
                          variant="card"
                        />
                        <div className={newStyles.cardTitleBlock}>
                          <h4 className={newStyles.cardMainTitle}>
                            {getPlanDisplayName(pkg.planName)}
                          </h4>
                          <p className={newStyles.cardSubtitle}>
                            Xe: {pkg.vehicle?.plateNumber ? formatPlateNumber(pkg.vehicle.plateNumber, '', pkg.vehicle.type) : pkg.vehicleId || '-'}
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

                        {/* Status Badge 2 — only shown for active packages */}
                        {!isExpired && (
                          pkg.autoRenew ? (
                            <span className={`${newStyles.renewBadge} ${newStyles.renewOn}`}>
                              Tự động gia hạn
                            </span>
                          ) : (
                            <span className={`${newStyles.renewBadge} ${newStyles.renewOff}`}>
                              Không tự động
                            </span>
                          )
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
                          <span className={newStyles.detailLabel}>Khu vực đỗ</span>
                          <span className={newStyles.detailValue}>
                            {pkg.floor?.name
                              ? `${formatFloorName(pkg.floor.name)} · ${getTierAreaLabel(pkg.allowedTier)}`
                              : (pkg.allowedTier ? `Tầng G · ${getTierAreaLabel(pkg.allowedTier)}` : 'Chưa phân khu')}
                          </span>
                        </div>
                      </div>

                      {/* Block 4 — GÓI */}
                      <div className={newStyles.detailBlock}>
                        <div style={{
                          width: 34,
                          height: 34,
                          minWidth: 34,
                          background: '#EEF4FF',
                          borderRadius: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <IconLayers3 size={17} color="#5B7FF5" />
                        </div>
                        <div className={newStyles.detailInfo}>
                          <span className={newStyles.detailLabel}>GÓI</span>
                          <span className={newStyles.detailValue}>
                            {getPackageSummaryLabel(pkg.vehicle?.type, pkg.planName)}
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
                          onClick={() => handleRenewBtnClick(pkg)}
                          disabled={packageActionLoading === pkg.id}
                          className={newStyles.btnPrimary}
                        >
                          <IconCalendar size={16} /> {!isLegacyPackage(pkg) ? 'Gia hạn ngay' : 'Chọn gói để gia hạn'}
                        </button>

                        {/* 2. Auto-renew toggle hidden — not fully implemented */}

                        {/* 3. Neutral button */}
                        <button
                          onClick={() => setSelectedDetailPkg(pkg)}
                          className={newStyles.btnSecondary}
                        >
                          <IconEye size={16} /> Xem chi tiết
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}


      {/* Detail View Ticket Modal */}
      {selectedDetailPkg && (
        <div className={newStyles.modalOverlay} onClick={() => setSelectedDetailPkg(null)}>
          <div className={[newStyles.modalContent, newStyles.detailModalContent].join(' ')} onClick={(e) => e.stopPropagation()}>
            <button className={newStyles.closeModalBtn} onClick={() => setSelectedDetailPkg(null)}>
              <IconClose size={20} />
            </button>

            <div className={newStyles.modalHeader}>
              <VehiclePackageIcon
                vehicleType={selectedDetailPkg.vehicle?.type}
                variant="ticket"
              />
              <h3 className={newStyles.modalTitle}>Vé Đỗ Xe Tháng</h3>
            </div>

            <div className={newStyles.ticketGrid}>
              <div className={newStyles.ticketRow}>
                <span className={newStyles.ticketLabel}>Mã gói tháng</span>
                <span className={newStyles.ticketValue}>{selectedDetailPkg.id}</span>
              </div>
              <div className={newStyles.ticketRow}>
                <span className={newStyles.ticketLabel}>Biển số xe</span>
                <span className={newStyles.ticketValueHighlight}>
                  {selectedDetailPkg.vehicle?.plateNumber
                    ? formatPlateNumber(selectedDetailPkg.vehicle.plateNumber, '', selectedDetailPkg.vehicle.type)
                    : selectedDetailPkg.vehicleId}
                </span>
              </div>
              <div className={newStyles.ticketRow}>
                <span className={newStyles.ticketLabel}>Loại xe</span>
                <span className={newStyles.ticketValue}>{selectedDetailPkg.vehicle?.type === 'MOTORBIKE' ? 'Xe máy' : 'Ô tô'}</span>
              </div>
              <div className={newStyles.ticketRow}>
                <span className={newStyles.ticketLabel}>Vị trí / Khu vực</span>
                <span className={newStyles.ticketValue}>
                  {selectedDetailPkg.floor?.name && selectedDetailPkg.allowedTier
                    ? `${formatFloorName(selectedDetailPkg.floor.name)} · ${getTierAreaLabel(selectedDetailPkg.allowedTier)}`
                    : 'Chưa phân vị trí'}
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
                <span className={newStyles.ticketLabel}>Trạng thái</span>
                {(() => {
                  const isExpired = selectedDetailPkg.effectiveStatus === 'EXPIRED' || selectedDetailPkg.isEffectivelyActive === false || selectedDetailPkg.status === 'EXPIRED' || getRemainingDays(selectedDetailPkg.expiryDate) <= 0;
                  return (
                    <span style={{ fontWeight: 800, color: !isExpired ? '#10B981' : '#EF4444' }}>
                      {!isExpired ? 'ĐANG HOẠT ĐỘNG' : 'HẾT HẠN'}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Check-in QR code */}
            {fetchingQrToken && (
              <div style={{ textAlign: 'center', padding: '1rem', color: C.gray600, fontSize: '0.85rem' }}>
                Đang tạo mã QR bảo mật...
              </div>
            )}
            {qrTokenError && (
              <div style={{ textAlign: 'center', padding: '1rem', color: C.red, fontSize: '0.85rem', fontWeight: 600 }}>
                {qrTokenError}
              </div>
            )}
            {!fetchingQrToken && !qrTokenError && detailQrUrl && (
              <div className={newStyles.qrContainer}>
                <img src={detailQrUrl} alt="Check-in QR" width={180} height={180} className={newStyles.qrImage} />
                <p style={{ margin: 0, fontSize: '0.8rem', color: C.gray600, textAlign: 'center', lineHeight: 1.5 }}>
                  Quét mã này tại cổng kiểm soát để tự động ra vào
                </p>
              </div>
            )}

            {/* PIN Fallback Section */}
            {selectedDetailPkg && (
              <div style={{
                marginTop: '1.25rem',
                padding: '1rem',
                background: '#F8FAFC',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: C.gray600, fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
                  Mã PIN dự phòng
                </span>

                {(() => {
                  const isExpired = selectedDetailPkg.effectiveStatus === 'EXPIRED' || selectedDetailPkg.isEffectivelyActive === false || selectedDetailPkg.status === 'EXPIRED' || getRemainingDays(selectedDetailPkg.expiryDate) <= 0;
                  if (isExpired) {
                    return (
                      <span style={{ fontSize: '0.9rem', color: C.red, fontWeight: 700 }}>
                        Mã PIN đã hết hiệu lực
                      </span>
                    );
                  }
                  if (pinLoading) {
                    return (
                      <span style={{ fontSize: '0.9rem', color: C.blue, fontWeight: 600 }}>
                        Đang tạo mã PIN...
                      </span>
                    );
                  }
                  if (pinError) {
                    return (
                      <div>
                        <span style={{ fontSize: '0.9rem', color: C.red, fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                          Lỗi tải mã PIN
                        </span>
                        <button
                          onClick={handleRetryFetchPin}
                          style={{
                            background: C.blue,
                            color: '#fff',
                            border: 'none',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Thử lại
                        </button>
                      </div>
                    );
                  }
                  if (selectedDetailPkg.monthlyAccessPin) {
                    return (
                      <div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}>
                          <span style={{ fontSize: '1.8rem', fontFamily: 'monospace', fontWeight: 800, color: C.navy, letterSpacing: '0.1em' }}>
                            {selectedDetailPkg.monthlyAccessPin}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedDetailPkg.monthlyAccessPin || '');
                              setCopiedPin(true);
                              setTimeout(() => setCopiedPin(false), 2000);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedPin ? C.green : C.blue,
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              fontSize: '0.8rem',
                              fontWeight: 600
                            }}
                          >
                            {copiedPin ? 'Đã sao chép!' : 'Sao chép'}
                          </button>
                        </div>
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: C.gray600, lineHeight: 1.4 }}>
                          Dùng mã PIN này tại quầy khi không thể quét mã QR.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
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

      {/* Legacy Package Plan Selection Modal */}
      {legacyRenewModalPkg && (
        <div className={newStyles.modalOverlay} onClick={() => {
          setLegacyRenewModalPkg(null);
          setPackageActionError('');
        }}>
          <div className={newStyles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={newStyles.closeModalBtn} onClick={() => {
              setLegacyRenewModalPkg(null);
              setPackageActionError('');
            }}>
              <IconClose size={20} />
            </button>

            <div className={newStyles.modalHeader}>
              <div className={`${newStyles.modalIcon} ${newStyles.modalIconInfo}`} style={{ backgroundColor: '#EFF6FF' }}>
                <IconCalendar size={22} color="#3B82F6" />
              </div>
              <h3 className={newStyles.modalTitle}>Chọn gói gia hạn</h3>
            </div>

            <p style={{ fontSize: '0.875rem', color: C.gray600, marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Gói tháng hiện tại cho xe <strong>{legacyRenewModalPkg.vehicle?.plateNumber}</strong> chưa có cấu hình gói cụ thể.
              Vui lòng chọn một trong các gói chính thức dưới đây để gia hạn:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {loadingPlans ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: C.gray600 }}>
                  <div style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid #3B82F6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Đang tải danh mục gói...</p>
                </div>
              ) : plansError ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#B91C1C', fontSize: '0.875rem', fontWeight: 600 }}>
                  {plansError}
                </div>
              ) : (
                plans
                  .filter(plan => {
                    // 1. Filter by vehicle type (CAR / MOTORBIKE)
                    const vehicleType = legacyRenewModalPkg.vehicle?.type ?? 'CAR';
                    const pricing = plan.prices[vehicleType];
                    if (!pricing) return false;

                    // 2. Active package tier guard
                    const isActive = legacyRenewModalPkg.status === 'ACTIVE' && getRemainingDays(legacyRenewModalPkg.expiryDate) > 0;
                    if (isActive && legacyRenewModalPkg.allowedTier) {
                      return plan.allowedTier === legacyRenewModalPkg.allowedTier;
                    }
                    return true;
                  })
                  .map((plan) => {
                  const vehicleType = legacyRenewModalPkg.vehicle?.type ?? 'CAR';
                  const pricing = plan.prices[vehicleType];
                  const isSelected = legacySelectedPlanId === plan.id;

                  return (
                    <div
                      key={plan.id}
                      onClick={() => {
                        setLegacySelectedPlanId(plan.id);
                        setPackageActionError(''); // clear error when selecting another plan
                      }}
                      style={{
                        padding: '1rem',
                        borderRadius: 16,
                        border: isSelected ? '2px solid #2563EB' : '1px solid #E2E8F0',
                        backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, color: C.navy, fontSize: '0.95rem' }}>
                          {plan.name} ({plan.durationDays} ngày)
                        </p>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: C.gray600 }}>
                          Hạng vé: <strong>{getTierAreaLabel(plan.allowedTier)}</strong>
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontWeight: 800, color: '#16A34A', fontSize: '1.05rem' }}>
                          {pricing ? formatVND(pricing.price) : 'N/A'}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: C.gray400 }}>
                          ~ {pricing ? formatVND(Math.round(pricing.price / plan.durationDays)) + '/ngày' : 'N/A'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={newStyles.modalActions}>
              <button
                type="button"
                className={newStyles.btnSecondary}
                onClick={() => {
                  setLegacyRenewModalPkg(null);
                  setPackageActionError('');
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                className={newStyles.btnPrimary}
                disabled={!legacySelectedPlanId || packageActionLoading === legacyRenewModalPkg.id}
                onClick={() => handleRenewPackage(legacyRenewModalPkg, legacySelectedPlanId)}
              >
                {packageActionLoading === legacyRenewModalPkg.id ? 'Đang xử lý...' : 'Xác nhận gia hạn'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PackagePurchaseModal
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        planId={purchasePlanId}
        vehicleType={purchaseVtype}
        onSuccess={loadMyPackages}
      />
    </div>
  );
}
