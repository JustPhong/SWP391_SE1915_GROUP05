import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from '../styles/driver.module.css';

// ═══════════════════════════════════════════════════════
//  PALETTE  (matches driver.module.css / DriverLayout)
// ═══════════════════════════════════════════════════════
const C = {
  navy:     '#1E3A5F',
  navyDark:  '#152D4A',
  bg:       '#F3F4F6',
  white:    '#FFFFFF',
  blue:     '#3B82F6',
  blueBg:   '#EFF6FF',
  green:    '#16A34A',
  greenBg:  '#DCFCE7',
  gray50:   '#F9FAFB',
  gray100:  '#F3F4F6',
  gray200:  '#E5E7EB',
  gray300:  '#D1D5DB',
  gray400:  '#9CA3AF',
  gray600:  '#6B7280',
  gray800:  '#374151',
  gray900:  '#111827',
  red:      '#EF4444',
  redBg:    '#FEF2F2',
  amber:    '#D97706',
  amberBg:  '#FFFBEB',
};

// ═══════════════════════════════════════════════════════
//  MOCK PACKAGES  (SRS-aligned: duration, fixed slot for cars, price)
// ═══════════════════════════════════════════════════════
interface PackagePlan {
  id: string;
  name: string;
  durationDays: number;
  durationLabel: string;
  prices: {
    CAR:       { price: number; priceLabel: string; pricePerDay: string };
    MOTORBIKE: { price: number; priceLabel: string; pricePerDay: string };
  };
}

const PACKAGES: PackagePlan[] = [
  {
    id: '1m',
    name: 'Gói 1 tháng',
    durationDays: 30,
    durationLabel: '30 ngày',
    prices: {
      CAR:       { price: 1500000,    priceLabel: '1.500.000đ', pricePerDay: '50.000đ/ngày' },
      MOTORBIKE: { price: 200000,     priceLabel: '200.000đ',   pricePerDay: '6.667đ/ngày'  },
    },
  },
  {
    id: '3m',
    name: 'Gói 3 tháng',
    durationDays: 90,
    durationLabel: '90 ngày',
    prices: {
      CAR:       { price: 4000000,    priceLabel: '4.000.000đ', pricePerDay: '44.444đ/ngày' },
      MOTORBIKE: { price: 540000,    priceLabel: '540.000đ',   pricePerDay: '6.000đ/ngày'  },
    },
  },
  {
    id: '1y',
    name: 'Gói 1 năm',
    durationDays: 365,
    durationLabel: '365 ngày',
    prices: {
      CAR:       { price: 15000000,   priceLabel: '15.000.000đ', pricePerDay: '41.096đ/ngày' },
      MOTORBIKE: { price: 2000000,    priceLabel: '2.000.000đ',  pricePerDay: '5.479đ/ngày'  },
    },
  },
];

const PAYMENT_OPTIONS: { value: 'CASH' | 'CARD' | 'EWALLET'; label: string; discount: number }[] = [
  { value: 'CASH',    label: 'Tiền mặt',   discount: 0 },
  { value: 'CARD',    label: 'Thẻ ngân hàng', discount: 0 },
  { value: 'EWALLET', label: 'SmartPay (–15.000đ)', discount: 15000 },
];

const VEHICLE_OPTIONS: { value: 'CAR' | 'MOTORBIKE'; label: string }[] = [
  { value: 'CAR',       label: 'Ô tô' },
  { value: 'MOTORBIKE', label: 'Xe máy' },
];

// ═══════════════════════════════════════════════════════
//  MOCK USER PACKAGE  (toggle this to simulate hasActivePackage)
// ═══════════════════════════════════════════════════════
type CustomerType = 'monthly' | 'casual';

interface UserPackage {
  id: string;
  planName: string;
  durationDays: number;
  expiryDate: string;   // ISO string — computed dynamically
  status: 'ACTIVE' | 'EXPIRED';
}

function buildMockPackage(planId: string): UserPackage {
  const plan = PACKAGES.find((p) => p.id === planId)!;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + plan.durationDays);
  return {
    id: plan.id,
    planName: plan.name,
    durationDays: plan.durationDays,
    expiryDate: expiry.toISOString(),
    status: 'ACTIVE',
  };
}

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════
function formatVND(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
}

function formatDDMMYYYY(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function computeExpiry(startDate: Date, durationDays: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + durationDays);
  return d.toISOString();
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function deriveStatus(expiryDate: string): 'expired' | 'expiring' | 'active' {
  const days = daysUntil(expiryDate);
  if (days < 0)  return 'expired';
  if (days <= 7) return 'expiring';
  return 'active';
}

const STATUS_META = {
  expired:  { bg: C.redBg,    border: '#FECACA', text: C.red,    label: 'Đã hết hạn'   },
  expiring: { bg: C.amberBg,  border: '#FCD34D', text: C.amber,  label: 'Sắp hết hạn'  },
  active:   { bg: C.greenBg,  border: '#86EFAC', text: C.green,  label: 'Còn hiệu lực' },
} as const;

// ═══════════════════════════════════════════════════════
//  ICONS
// ═══════════════════════════════════════════════════════
function IconCheck({ size = 14, color = C.green }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
}
function IconX({ size = 14, color = C.red }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function IconCar({ size = 16, color = C.navy }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h11l5 5v4"/><path d="M5 17a2 2 0 104 0 2 2 0 00-4 0zM15 17a2 2 0 104 0 2 2 0 00-4 0z"/></svg>;
}
function IconBike({ size = 16, color = C.navy }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M12 17V9l4-4M12 5h3l2 4"/></svg>;
}
function IconCalendar({ size = 15, color = C.gray600 }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
function IconInfo({ size = 15, color = C.gray600 }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}

// ═══════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

// ── Status badge ──────────────────────────────────────
function StatusBadge({ status }: { status: 'expired' | 'expiring' | 'active' }) {
  const m = STATUS_META[status];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '0.25rem 0.6rem',
      borderRadius: 20,
      fontSize: '0.72rem',
      fontWeight: 700,
      background: m.bg,
      color: m.text,
      border: `1px solid ${m.border}`,
    }}>
      {status === 'active' ? <IconCheck size={11} color={m.text} /> :
       status === 'expired' ? <IconX size={11} color={m.text} /> : null}
      {m.label}
    </span>
  );
}

// ── Package card ───────────────────────────────────────
function PackageCard({
  pkg,
  selected,
  vehicleType,
  onSelect,
}: {
  pkg: PackagePlan;
  selected: boolean;
  vehicleType: 'CAR' | 'MOTORBIKE';
  onSelect: () => void;
}) {
  const pricing = pkg.prices[vehicleType];

  return (
    <button
      onClick={onSelect}
      style={{
        background: selected ? '#EFF6FF' : C.white,
        border: selected ? `2px solid ${C.navy}` : `1.5px solid ${C.gray200}`,
        borderRadius: 14,
        padding: '1rem',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.15s ease',
        boxShadow: selected ? `0 4px 16px rgba(30,58,95,0.12)` : 'none',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute', top: -8, right: -8,
          width: 22, height: 22,
          background: C.navy, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconCheck size={12} color={C.white} />
        </div>
      )}

      {/* Header: name + duration */}
      <div style={{ marginBottom: '0.6rem' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: C.gray900 }}>
          {pkg.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <IconCalendar size={11} color={C.gray400} />
          <span style={{ fontSize: '0.72rem', color: C.gray400 }}>
            {pkg.durationLabel}
          </span>
        </div>
      </div>

      {/* Price + per-day */}
      <div style={{ marginBottom: '0.7rem' }}>
        <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: C.navy, lineHeight: 1 }}>
          {pricing.priceLabel}
        </p>
        <p style={{ margin: '0.1rem 0 0', fontSize: '0.7rem', color: C.gray400 }}>
          {pricing.pricePerDay}
        </p>
      </div>

      {/* Slot type rule */}
      <div style={{
        padding: '0.35rem 0.55rem',
        borderRadius: 7,
        background: vehicleType === 'CAR' ? '#F0FDF4' : C.blueBg,
        border: `1px solid ${vehicleType === 'CAR' ? '#86EFAC' : C.blue}`,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
      }}>
        <IconInfo
          size={11}
          color={vehicleType === 'CAR' ? C.green : C.blue}
        />
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          color: vehicleType === 'CAR' ? C.green : C.blue,
        }}>
          {vehicleType === 'CAR'
            ? 'Chỗ đỗ cố định khi đăng ký'
            : 'Đỗ ở ô trống bất kỳ'}
        </span>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export function MonthlyPackagePage() {
  useAuth(); // AuthContext available for future per-user package data

  // ── Demo toggle: switch between 'casual' and 'monthly' ──
  const [customerType, setCustomerType] = useState<CustomerType>('monthly');
  const hasActivePackage = customerType === 'monthly';

  // Current user's package (computed dynamically)
  const mockUserPkg: UserPackage | null = hasActivePackage
    ? buildMockPackage('3m')
    : null;

  // Computed dynamic status
  const pkgStatus = mockUserPkg ? deriveStatus(mockUserPkg.expiryDate) : null;
  const pkgExpiryLabel = mockUserPkg ? formatDDMMYYYY(mockUserPkg.expiryDate) : null;

  // ── Selection state ─────────────────────────────────
  const [selectedPlanId, setSelectedPlanId] = useState<string>('3m');
  const [vehicleType, setVehicleType] = useState<'CAR' | 'MOTORBIKE'>('CAR');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'EWALLET'>('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const selectedPlan = PACKAGES.find((p) => p.id === selectedPlanId)!;
  const selectedPayment = PAYMENT_OPTIONS.find((p) => p.value === paymentMethod)!;

  // Dynamic expiry for summary: today + durationDays
  const today = new Date();
  const dynamicExpiry = computeExpiry(today, selectedPlan.durationDays);
  const dynamicExpiryLabel = formatDDMMYYYY(dynamicExpiry);

  // Dynamic total
  const discount = selectedPayment.discount;
  const selectedPrice = selectedPlan.prices[vehicleType];
  const totalAmount = selectedPrice.price - discount;

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSubmitting(false);
    setSuccess(true);
  };

  const handleReset = () => {
    setSuccess(false);
    setSelectedPlanId('3m');
  };

  // ── Renew: compute new expiry from existing expiry ───
  const renewExpiry = mockUserPkg
    ? computeExpiry(new Date(mockUserPkg.expiryDate), selectedPlan.durationDays)
    : null;
  const renewExpiryLabel = renewExpiry ? formatDDMMYYYY(renewExpiry) : null;

  // ── Render success state ────────────────────────────
  if (success) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', paddingTop: '2rem' }}>
        <div style={{
          width: 72, height: 72,
          background: C.greenBg,
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `3px solid ${C.green}`,
        }}>
          <IconCheck size={36} color={C.green} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: C.gray900 }}>
            Thanh toán thành công!
          </p>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.875rem', color: C.gray600 }}>
            {hasActivePackage ? 'Gói của bạn đã được gia hạn.' : 'Bạn đã đăng ký thành công.'}
          </p>
        </div>
        <div className={styles.card} style={{ width: '100%', maxWidth: 480 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: C.gray600 }}>Gói</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: C.gray900 }}>{selectedPlan.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', color: C.gray600 }}>Thanh toán</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: C.gray900 }}>{selectedPayment.label}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.6rem', borderTop: `1px solid ${C.gray100}` }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: C.gray900 }}>Ngày hết hạn</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 800, color: C.navy }}>{renewExpiryLabel ?? dynamicExpiryLabel}</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleReset}
          style={{
            padding: '0.6rem 1.5rem',
            background: C.navy, color: C.white,
            border: 'none', borderRadius: 10,
            fontSize: '0.875rem', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Demo toggle ────────────────────────────── */}
      <div style={{
        background: '#EFF6FF',
        border: '1px solid #BFDBFE',
        borderRadius: 8,
        padding: '0.5rem 0.85rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '0.8rem',
        color: '#1D4ED8',
      }}>
        <span style={{ fontWeight: 600 }}>Demo:</span>
        <button onClick={() => setCustomerType('casual')} style={{ padding: '0.2rem 0.6rem', borderRadius: 6, border: 'none', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', background: customerType === 'casual' ? C.navy : 'transparent', color: customerType === 'casual' ? C.white : C.navy }}>Chưa có gói</button>
        <button onClick={() => setCustomerType('monthly')} style={{ padding: '0.2rem 0.6rem', borderRadius: 6, border: 'none', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', background: customerType === 'monthly' ? C.navy : 'transparent', color: customerType === 'monthly' ? C.white : C.navy }}>Có gói tháng</button>
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
          Hiện tại: <strong>{hasActivePackage ? 'Có gói tháng' : 'Chưa có gói'}</strong>
        </span>
      </div>

      {/* ══════════════════════════════════════════════
          SECTION 1: Current package status (if hasActivePackage)
      ══════════════════════════════════════════════════ */}
      {hasActivePackage && mockUserPkg ? (
        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.gray400 }}>
                Gói hiện tại của bạn
              </p>
              <p style={{ margin: '0.2rem 0 0.3rem', fontSize: '1.05rem', fontWeight: 800, color: C.gray900 }}>
                {mockUserPkg.planName}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <StatusBadge status={pkgStatus!} />
                <span style={{ fontSize: '0.8rem', color: C.gray600 }}>
                  Hết hạn: <strong style={{ color: C.gray900 }}>{pkgExpiryLabel}</strong>
                </span>
              </div>
            </div>
            <div style={{
              padding: '0.4rem 0.75rem',
              background: C.amberBg,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}>
              <IconCalendar size={14} color={C.amber} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: C.amber }}>
                {mockUserPkg.durationDays} ngày
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.card} style={{ background: C.gray50, border: `1.5px dashed ${C.gray300}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 40, height: 40, background: C.gray100, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconCalendar size={20} color={C.gray400} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: C.gray600 }}>
                Bạn chưa có gói tháng
              </p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: C.gray400 }}>
                Chọn một gói bên dưới để bắt đầu
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          SECTION 2: Package selection grid
      ══════════════════════════════════════════════════ */}
      <div className={styles.card}>
        <p style={{ margin: '0 0 0.9rem', fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>
          {hasActivePackage ? 'Chọn gói gia hạn' : 'Chọn gói phù hợp với bạn'}
        </p>

        {/* Vehicle type filter */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {VEHICLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVehicleType(opt.value)}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: 8,
                border: `1.5px solid ${vehicleType === opt.value ? C.navy : C.gray200}`,
                background: vehicleType === opt.value ? C.navy : C.white,
                color: vehicleType === opt.value ? C.white : C.navy,
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {opt.value === 'CAR' ? <IconCar size={13} color={vehicleType === opt.value ? C.white : C.navy} /> : <IconBike size={13} color={vehicleType === opt.value ? C.white : C.navy} />}
              {opt.label}
            </button>
          ))}
        </div>

        {/* Package cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
          {PACKAGES.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              selected={selectedPlanId === pkg.id}
              vehicleType={vehicleType}
              onSelect={() => setSelectedPlanId(pkg.id)}
            />
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SECTION 3: Tóm tắt thanh toán
      ══════════════════════════════════════════════════ */}
      <div className={styles.card}>
        <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>
          Tóm tắt thanh toán
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {/* Ngày bắt đầu (computed) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: C.gray600 }}>Ngày bắt đầu</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.gray900 }}>
              {renewExpiryLabel ? formatDDMMYYYY(new Date(mockUserPkg!.expiryDate).toISOString()) : formatDDMMYYYY(today.toISOString())}
            </span>
          </div>

          {/* Ngày kết thúc (computed dynamically) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: C.gray600 }}>Ngày kết thúc</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.navy }}>
              {renewExpiryLabel ?? dynamicExpiryLabel}
            </span>
          </div>

          {/* Thời hạn */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: C.gray600 }}>Thời hạn</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.gray900 }}>
              {selectedPlan.durationDays} ngày ({selectedPlan.durationLabel})
            </span>
          </div>

          {/* Giá gói */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: C.gray600 }}>Giá gói</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.gray900 }}>
              {formatVND(selectedPrice.price)}
            </span>
          </div>

          {/* Giảm giá SmartPay — only when E-WALLET */}
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', color: C.green }}>Giảm giá SmartPay</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: C.green }}>
                –{formatVND(discount)}
              </span>
            </div>
          )}
        </div>

        {/* Total */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 0',
          borderTop: `2px solid ${C.gray200}`,
          marginTop: '0.25rem',
        }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>Tổng thanh toán</span>
          <span style={{ fontSize: '1.15rem', fontWeight: 900, color: C.navy }}>
            {formatVND(totalAmount)}
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SECTION 4: Payment method
      ══════════════════════════════════════════════════ */}
      <div className={styles.card}>
        <p style={{ margin: '0 0 0.85rem', fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>
          Phương thức thanh toán
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {PAYMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPaymentMethod(opt.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderRadius: 10,
                border: `1.5px solid ${paymentMethod === opt.value ? C.navy : C.gray200}`,
                background: paymentMethod === opt.value ? '#EFF6FF' : C.white,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {paymentMethod === opt.value ? (
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <IconCheck size={11} color={C.white} />
                  </div>
                ) : (
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${C.gray300}`, flexShrink: 0 }} />
                )}
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.gray900 }}>{opt.label}</span>
              </div>
              {opt.discount > 0 && (
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: C.green, background: C.greenBg, padding: '0.15rem 0.5rem', borderRadius: 20 }}>
                  –{formatVND(opt.discount)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SECTION 5: CTA
      ══════════════════════════════════════════════════ */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          width: '100%',
          padding: '0.9rem',
          background: submitting ? C.gray300 : C.navy,
          color: submitting ? C.gray400 : C.white,
          border: 'none',
          borderRadius: 12,
          fontSize: '1rem',
          fontWeight: 700,
          cursor: submitting ? 'not-allowed' : 'pointer',
          boxShadow: submitting ? 'none' : '0 4px 14px rgba(30,58,95,0.25)',
          transition: 'all 0.2s ease',
        }}
      >
        {submitting ? 'Đang xử lý...' : hasActivePackage ? 'Gia hạn gói tháng' : 'Chọn gói'}
      </button>

    </div>
  );
}
