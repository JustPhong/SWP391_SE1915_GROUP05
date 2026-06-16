import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { vehicleService } from '../services/vehicle.service';
import type { Vehicle } from '../types';
import styles from '../styles/driver.module.css';

// ═══════════════════════════════════════════════════════
//  PALETTE  (matches driver.module.css / DriverLayout)
// ═══════════════════════════════════════════════════════
const C = {
  navy:     '#1E3A5F',
  bg:       '#F3F4F6',
  white:    '#FFFFFF',
  green:    '#16A34A',
  greenBg:  '#DCFCE7',
  gray50:   '#F9FAFB',
  gray100:  '#F3F4F6',
  gray200:  '#E5E7EB',
  gray300:  '#D1D5DB',
  gray400:  '#9CA3AF',
  gray600:  '#6B7280',
  gray900:  '#111827',
  red:      '#EF4444',
  redBg:    '#FEF2F2',
  redBorder:'#FECACA',
  blue:     '#3B82F6',
  blueBg:   '#EFF6FF',
};

// ═══════════════════════════════════════════════════════
//  ICONS
// ═══════════════════════════════════════════════════════
function IconCar({ size = 16, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h11l5 5v4" />
      <path d="M5 17a2 2 0 104 0 2 2 0 00-4 0zM15 17a2 2 0 104 0 2 2 0 00-4 0z" />
    </svg>
  );
}
function IconBike({ size = 16, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="17" r="3" />
      <circle cx="19" cy="17" r="3" />
      <path d="M12 17V9l4-4M12 5h3l2 4" />
    </svg>
  );
}
function IconPlus({ size = 14, color = C.white }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconClose({ size = 14, color = C.navy }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════
type VehicleType = 'CAR' | 'MOTORBIKE';

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'CAR',       label: 'Ô tô' },
  { value: 'MOTORBIKE', label: 'Xe máy' },
];

const TYPE_LABEL: Record<VehicleType, string> = {
  CAR:       'Ô tô',
  MOTORBIKE: 'Xe máy',
};

// ═══════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const isCar = vehicle.type === 'CAR';
  return (
    <div
      className={styles.card}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
        padding: '0.85rem 1rem',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          background: C.blueBg,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isCar ? <IconCar size={22} color={C.navy} /> : <IconBike size={22} color={C.navy} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: "'Consolas', monospace",
              fontSize: '1rem',
              fontWeight: 800,
              color: C.gray900,
              letterSpacing: '0.03em',
            }}
          >
            {vehicle.plateNumber}
          </span>
          {vehicle.isMonthly && (
            <span
              style={{
                background: C.greenBg,
                color: C.green,
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '0.15rem 0.55rem',
                borderRadius: 20,
                letterSpacing: '0.04em',
              }}
            >
              GÓI THÁNG
            </span>
          )}
        </div>
        <span style={{ fontSize: '0.78rem', color: C.gray600 }}>
          {TYPE_LABEL[vehicle.type]}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      className={styles.card}
      style={{
        background: C.gray50,
        border: `1.5px dashed ${C.gray300}`,
        padding: '2rem 1.25rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          background: C.white,
          border: `1.5px solid ${C.gray200}`,
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 0.75rem',
        }}
      >
        <IconCar size={24} color={C.gray400} />
      </div>
      <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: C.gray900 }}>
        Bạn chưa có xe nào
      </p>
      <p style={{ margin: '0.25rem 0 1rem', fontSize: '0.82rem', color: C.gray600 }}>
        Nhấn "Thêm xe" bên dưới để đăng ký phương tiện
      </p>
      <button
        onClick={onAdd}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '0.55rem 1.1rem',
          background: C.navy,
          color: C.white,
          border: 'none',
          borderRadius: 10,
          fontSize: '0.85rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <IconPlus size={13} color={C.white} />
        Thêm xe ngay
      </button>
    </div>
  );
}

function AddVehicleForm({
  submitting,
  error,
  onCancel,
  onSubmit,
}: {
  submitting: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (plateNumber: string, type: VehicleType) => Promise<void>;
}) {
  const [plateNumber, setPlateNumber] = useState('');
  const [type, setType] = useState<VehicleType>('CAR');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = plateNumber.trim();
    if (!trimmed) {
      setLocalError('Vui lòng nhập biển số xe');
      return;
    }
    setLocalError('');
    await onSubmit(trimmed, type);
  };

  const displayError = localError || error;

  return (
    <form onSubmit={handleSubmit} className={styles.card}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.85rem',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>
          Thêm xe mới
        </p>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: submitting ? 0.5 : 1,
          }}
          aria-label="Đóng"
        >
          <IconClose size={16} color={C.gray600} />
        </button>
      </div>

      {displayError && (
        <div
          style={{
            background: C.redBg,
            border: `1.5px solid ${C.redBorder}`,
            borderRadius: 10,
            padding: '0.6rem 0.85rem',
            marginBottom: '0.85rem',
            fontSize: '0.8rem',
            color: '#B91C1C',
            fontWeight: 500,
          }}
        >
          {displayError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.9rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Biển số xe</span>
          <input
            type="text"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
            placeholder="VD: 51A-12345"
            disabled={submitting}
            autoFocus
            style={{
              padding: '0.65rem 0.85rem',
              border: `1.5px solid ${C.gray200}`,
              borderRadius: 10,
              fontSize: '0.95rem',
              fontFamily: "'Consolas', monospace",
              fontWeight: 600,
              color: C.gray900,
              background: C.white,
              outline: 'none',
            }}
          />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Loại xe</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {VEHICLE_TYPES.map((opt) => {
              const selected = type === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '0.6rem 0.85rem',
                    borderRadius: 10,
                    border: `1.5px solid ${selected ? C.navy : C.gray200}`,
                    background: selected ? C.navy : C.white,
                    color: selected ? C.white : C.navy,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.value === 'CAR' ? (
                    <IconCar size={14} color={selected ? C.white : C.navy} />
                  ) : (
                    <IconBike size={14} color={selected ? C.white : C.navy} />
                  )}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !plateNumber.trim()}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: submitting || !plateNumber.trim() ? C.gray300 : C.navy,
          color: submitting || !plateNumber.trim() ? C.gray400 : C.white,
          border: 'none',
          borderRadius: 10,
          fontSize: '0.9rem',
          fontWeight: 700,
          cursor: submitting || !plateNumber.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? 'Đang thêm...' : 'Thêm xe'}
      </button>
    </form>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export function MyVehiclePage() {
  const { user, isLoading: authLoading } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await vehicleService.getMyVehicles();
      setVehicles(data ?? []);
    } catch (e: any) {
      setLoadError(
        e?.response?.data?.message ?? 'Không thể tải danh sách xe. Vui lòng thử lại.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    loadVehicles();
  }, [authLoading, user, loadVehicles]);

  const handleAddVehicle = async (plateNumber: string, type: VehicleType) => {
    setSubmitting(true);
    setFormError('');
    try {
      await vehicleService.create({ plateNumber, type });
      setFormOpen(false);
      setFormError('');
      await loadVehicles();
    } catch (e: any) {
      setFormError(e?.response?.data?.message ?? 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div
        style={{
          padding: '3rem',
          textAlign: 'center',
          color: C.gray400,
          fontSize: '0.9rem',
          fontWeight: 600,
        }}
      >
        Đang tải...
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          padding: '3rem',
          textAlign: 'center',
          color: C.gray600,
          fontSize: '0.9rem',
        }}
      >
        Vui lòng đăng nhập để xem danh sách xe của bạn.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: C.navy }}>
          Xe của tôi
        </h1>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: C.gray600 }}>
          Quản lý các phương tiện đã đăng ký với tài khoản {user.email}
        </p>
      </div>

      {loadError && (
        <div
          style={{
            background: C.redBg,
            border: `1.5px solid ${C.redBorder}`,
            borderRadius: 10,
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            color: '#B91C1C',
            fontWeight: 500,
          }}
        >
          {loadError}
        </div>
      )}

      {loading ? (
        <div
          className={styles.card}
          style={{
            padding: '2.5rem',
            textAlign: 'center',
            color: C.gray400,
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          Đang tải danh sách xe...
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState onAdd={() => setFormOpen(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {vehicles.map((v) => (
            <VehicleCard key={v.id} vehicle={v} />
          ))}
        </div>
      )}

      {vehicles.length > 0 && !formOpen && (
        <button
          onClick={() => setFormOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '0.85rem',
            background: C.navy,
            color: C.white,
            border: 'none',
            borderRadius: 12,
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(30, 58, 95, 0.25)',
          }}
        >
          <IconPlus size={15} color={C.white} />
          Thêm xe
        </button>
      )}

      {formOpen && (
        <AddVehicleForm
          submitting={submitting}
          error={formError}
          onCancel={() => {
            setFormOpen(false);
            setFormError('');
          }}
          onSubmit={handleAddVehicle}
        />
      )}
    </div>
  );
}
