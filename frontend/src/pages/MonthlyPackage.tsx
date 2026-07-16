import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { vehicleService as _vehicleService } from '../services/vehicle.service';
import { monthlyPackageService } from '../services/monthlyPackage.service';
import type { MonthlyPackage } from '../types/index';
import { PACKAGES, type PackagePlan } from '../constants/packages';
import { PackagePurchaseModal } from '../components/PackagePurchaseModal';
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
            {pricing.priceLabel}
          </span>
        </div>
        <p className={`${styles.pkgPerDay} ${isFeatured ? styles.pkgPerDayLight : ''}`}>
          ~ {pricing.pricePerDay}
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

function PricingGroup({ vtype, selectedPlanId, onSelect }: { vtype: VType; selectedPlanId: string; onSelect: (planId: string, vtype: VType) => void }) {
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
export function MonthlyPackagePage({ onAddVehicle: _onAddVehicle }: { onAddVehicle?: () => void } = {}) {
  const { user, isLoading: authLoading } = useAuth();

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

  const handlePurchaseSuccess = () => {
    loadMyPackages();
    setIsPurchasing(false);
  };


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
          
          <PricingGroup vtype="MOTORBIKE" selectedPlanId="" onSelect={handleSelectPackage} />
          <PricingGroup vtype="CAR" selectedPlanId="" onSelect={handleSelectPackage} />
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
                              : (isMotorbike ? 'Khu tự do (Xe máy)' : (pkg.allowedTier ? `Tầng G · Khu ${pkg.allowedTier === 'VIP' ? 'VIP' : pkg.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Chưa phân vị trí'))}
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
                <span className={newStyles.ticketLabel}>Vị trí / Khu vực</span>
                <span className={newStyles.ticketValue}>
                  {selectedDetailPkg.slot?.floor?.name && selectedDetailPkg.slot?.code
                    ? `Tầng ${selectedDetailPkg.slot.floor.name} · Ô ${selectedDetailPkg.slot.code}`
                    : (selectedDetailPkg.vehicle?.type === 'MOTORBIKE' ? 'Khu tự do (Xe máy)' : (selectedDetailPkg.allowedTier ? `Tầng G · Khu ${selectedDetailPkg.allowedTier === 'VIP' ? 'VIP' : selectedDetailPkg.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}` : 'Chưa phân vị trí'))}
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

      <PackagePurchaseModal
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        planId={purchasePlanId}
        vehicleType={purchaseVtype}
        onSuccess={handlePurchaseSuccess}
      />
    </div>
  );
}
