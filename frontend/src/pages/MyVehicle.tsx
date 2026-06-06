import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { calcFee } from '../utils/fee';
import styles from '../styles/driver.module.css';

// ═══════════════════════════════════════════════════════
//  PALETTE  (matches DriverDashboard / driver.module.css)
// ═══════════════════════════════════════════════════════
const C = {
  navy:     '#1E3A5F',
  bg:       '#F3F4F6',
  white:    '#FFFFFF',
  green:    '#16A34A',
  greenBg:  '#DCFCE7',
  gray100:  '#F9FAFB',
  gray200:  '#E5E7EB',
  gray300:  '#D1D5DB',
  gray400:  '#9CA3AF',
  gray600:  '#6B7280',
  gray800:  '#374151',
  gray900:  '#111827',
  blueBg:   '#EFF6FF',
  blue:     '#1E3A5F',
  red:      '#EF4444',
  yellowBg: '#FEF9C3',
  yellow:   '#A16207',
};

// ═══════════════════════════════════════════════════════
//  MOCK DATA
// ═══════════════════════════════════════════════════════
type CustomerType = 'monthly' | 'casual';

interface ActiveSession {
  plateNumber: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
  slotCode: string;
  floor: string;
  checkInTime: string;
  estimatedAmount: number;
  customerType: CustomerType;
}

interface MonthlyPackage {
  planName: string;
  expiryDate: string;
  status: 'ACTIVE' | 'EXPIRED';
}

const MOCK_SESSION: ActiveSession = {
  plateNumber: '51K-123.45',
  vehicleType: 'CAR',
  slotCode: 'B1 · A03',
  floor: 'Tầng B1',
  checkInTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  estimatedAmount: 30000,
  customerType: 'casual',
};

const MOCK_MONTHLY_PACKAGE: MonthlyPackage = {
  planName: 'Gói Premium 3 tháng',
  expiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'ACTIVE',
};

// ═══════════════════════════════════════════════════════
//  ICONS  (all local — Icons.tsx components don't accept color props)
// ═══════════════════════════════════════════════════════
function IconCar({ size = 20, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h11l5 5v4" />
      <path d="M5 17a2 2 0 104 0 2 2 0 00-4 0zM15 17a2 2 0 104 0 2 2 0 00-4 0z" />
    </svg>
  );
}
function IconCheck({ size = 16, color = C.green }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12 11 15 16 9" />
    </svg>
  );
}

function IconClock({ size = 16, color = C.gray600 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function IconMap({ size = 16, color = C.gray600 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

function IconTicket({ size = 16, color = C.gray600 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 010-3h20a3 3 0 010 6M2 15a3 3 0 000 3h20a3 3 0 000-6" />
      <rect x="2" y="6" width="20" height="12" rx="2" />
    </svg>
  );
}

function IconRefresh({ size = 14, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0115-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 01-15 6.7L3 16" />
    </svg>
  );
}

function IconChevronRight({ size = 14, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════
//  FORMATTERS
// ═══════════════════════════════════════════════════════
function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getDuration(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}p`;
  return `${minutes}p`;
}

// ═══════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

// ── Vehicle banner ────────────────────────────────────
function VehicleBanner({ session }: { session: ActiveSession }) {
  return (
    <div style={{
      background: C.navy,
      borderRadius: 12,
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 1 }}>
        <div style={{
          width: 44,
          height: 44,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <IconCar size={22} color={C.white} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <span style={{
              fontFamily: "'Consolas', monospace",
              fontSize: '1rem',
              fontWeight: 800,
              color: C.white,
              letterSpacing: '0.03em',
            }}>
              {session.plateNumber}
            </span>
            <span style={{
              background: C.greenBg,
              color: C.green,
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              borderRadius: 20,
              letterSpacing: '0.03em',
            }}>
              Đang gửi
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' }}>
            {session.vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy'}
          </span>
        </div>
      </div>
      {/* Decorative circle */}
      <div style={{
        position: 'absolute',
        right: -20,
        top: -20,
        width: 120,
        height: 120,
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '50%',
      }} />
    </div>
  );
}

// ── Monthly package banner ─────────────────────────────
function MonthlyBanner({ pkg }: { pkg: MonthlyPackage }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.navy} 0%, #2C4F78 100%)`,
      borderRadius: 12,
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{ zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: C.white }}>
            Gói tháng Premium đang hoạt động
          </span>
          <span style={{
            background: C.greenBg,
            color: C.green,
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '0.15rem 0.5rem',
            borderRadius: 20,
          }}>
            ACTIVE
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' }}>
          {pkg.planName} — Hết hạn: {new Date(pkg.expiryDate).toLocaleDateString('vi-VN')}
        </p>
      </div>
      <div style={{
        position: 'absolute',
        right: 20,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '0.4rem',
        zIndex: 1,
      }}>
        <button style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '0.35rem 0.75rem',
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 8,
          color: C.white,
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}>
          <IconRefresh size={13} color={C.white} />
          Gia hạn gói tháng
        </button>
      </div>
      <div style={{
        position: 'absolute',
        right: -30,
        top: -30,
        width: 140,
        height: 140,
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '50%',
      }} />
    </div>
  );
}

// ── Session detail row ─────────────────────────────────
function DetailRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: JSX.Element;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.65rem 0',
      borderBottom: `1px solid ${C.gray200}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ color: C.gray600, display: 'flex', alignItems: 'center' }}>{icon}</span>
        <span style={{ fontSize: '0.875rem', color: C.gray600 }}>{label}</span>
      </div>
      <span style={{
        fontSize: '0.875rem',
        fontWeight: valueColor ? 700 : 600,
        color: valueColor ?? C.gray900,
      }}>
        {value}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export function MyVehiclePage() {
  useAuth(); // AuthContext available for future user-driven data

  // Toggle between 'casual' and 'monthly' for demo — in production this comes from API/AuthContext
  const [customerType, setCustomerType] = useState<CustomerType>('casual');

  const session = { ...MOCK_SESSION, customerType };
  const isMonthly = customerType === 'monthly';

  // Dynamic fee using block-based calculator
  const checkInDate = new Date(session.checkInTime);
  const checkOutDate = new Date(); // now
  const fee = calcFee(checkInDate, checkOutDate, session.vehicleType, isMonthly);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Demo toggle (development helper — remove in production) */}
      <div style={{
        background: C.blueBg,
        border: `1px solid #BFDBFE`,
        borderRadius: 8,
        padding: '0.5rem 0.85rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '0.8rem',
        color: '#1D4ED8',
      }}>
        <span style={{ fontWeight: 600 }}>Demo:</span>
        <button
          onClick={() => setCustomerType('casual')}
          style={{
            padding: '0.2rem 0.6rem',
            borderRadius: 6,
            border: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: !isMonthly ? C.navy : 'transparent',
            color: !isMonthly ? C.white : C.navy,
          }}
        >
          Khách lẻ
        </button>
        <button
          onClick={() => setCustomerType('monthly')}
          style={{
            padding: '0.2rem 0.6rem',
            borderRadius: 6,
            border: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: isMonthly ? C.navy : 'transparent',
            color: isMonthly ? C.white : C.navy,
          }}
        >
          Khách tháng
        </button>
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
          Đang hiển thị: <strong>{isMonthly ? 'Khách tháng (monthly)' : 'Khách lẻ (casual)'}</strong>
        </span>
      </div>

      {/* ── ALWAYS: Vehicle banner ──────────────────────── */}
      <VehicleBanner session={session} />

      {/* ── ALWAYS: Chi tiết phiên gửi card ───────────── */}
      <div className={styles.card}>
        <p className={styles.sectionTitle} style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>
          Chi tiết phiên gửi
        </p>
        <div>
          <DetailRow
            icon={<IconMap size={15} />}
            label="Vị trí"
            value={session.slotCode}
          />
          <DetailRow
            icon={<IconClock size={15} />}
            label="Giờ vào"
            value={formatDateTime(session.checkInTime)}
          />
          <DetailRow
            icon={<IconClock size={15} />}
            label="Thời gian gửi"
            value={getDuration(session.checkInTime)}
          />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.65rem 0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ color: C.gray600, display: 'flex', alignItems: 'center' }}>
                <IconTicket size={15} />
              </span>
              <span style={{ fontSize: '0.875rem', color: C.gray600 }}>Mã phiên</span>
            </div>
            <span style={{ fontSize: '0.8rem', fontFamily: "'Consolas', monospace", fontWeight: 700, color: C.navy }}>
              PS-{Date.now().toString().slice(-8)}
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MONTHLY BANNER  — only when isMonthly
      ══════════════════════════════════════════════════ */}
      {isMonthly && (
        <MonthlyBanner pkg={MOCK_MONTHLY_PACKAGE} />
      )}

      {/* ══════════════════════════════════════════════════
          PHÍ TẠM TÍNH  — different content per type
      ══════════════════════════════════════════════════ */}
      <div className={styles.card}>
        <p className={styles.sectionTitle} style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>
          Phí tạm tính
        </p>

        {isMonthly ? (
          /* CASE A — Monthly: free at gate */
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: C.greenBg,
            border: `1.5px solid #86EFAC`,
            borderRadius: 10,
            padding: '0.85rem 1rem',
          }}>
            <IconCheck size={22} color={C.green} />
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: C.green }}>
                Miễn phí khi ra cổng
              </p>
              <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: '#166534' }}>
                Đã bao gồm trong gói tháng
              </p>
            </div>
          </div>
        ) : (
          /* CASE B — Casual: block-based fee breakdown */
          <div>
            {fee.breakdown.map((block, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  padding: '0.55rem 0',
                  borderBottom: i < fee.breakdown.length - 1 ? `1px solid ${C.gray100}` : undefined,
                  gap: '0.5rem',
                }}
              >
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.875rem', color: C.gray600 }}>{block.label}</span>
                  {block.note ? (
                    <span style={{ display: 'block', fontSize: '0.7rem', color: C.gray400 }}>{block.note}</span>
                  ) : (
                    <span style={{ display: 'block', fontSize: '0.7rem', color: C.gray400 }}>
                      {block.lots} × {block.lotHours}h × {formatVND(block.rate)}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: C.gray900, whiteSpace: 'nowrap' }}>
                  {formatVND(block.amount)}
                </span>
              </div>
            ))}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.65rem 0',
            }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: C.gray900 }}>Tổng cộng</span>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: C.navy }}>
                {formatVND(fee.total)}
              </span>
            </div>

            {/* CTA — casual only */}
            <div style={{
              marginTop: '0.75rem',
              padding: '0.75rem 1rem',
              background: C.yellowBg,
              border: `1px solid #FCD34D`,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: C.yellow }}>
                Mua gói tháng để được miễn phí khi ra cổng
              </p>
              <Link
                to="/monthly-package"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0.3rem 0.75rem',
                  background: C.navy,
                  borderRadius: 8,
                  color: C.white,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Mua ngay
                <IconChevronRight size={12} color={C.white} />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── ALWAYS: QR button ──────────────────────────── */}
      <button
        style={{
          width: '100%',
          padding: '0.85rem',
          background: C.navy,
          color: C.white,
          border: 'none',
          borderRadius: 12,
          fontSize: '0.95rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          boxShadow: '0 4px 14px rgba(30, 58, 95, 0.25)',
        }}
      >
        Mã QR ra cổng
      </button>

    </div>
  );
}
