import { useState, useEffect, useCallback, useRef } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { vehicleService } from '../services/vehicle.service';
import type { Vehicle } from '../types';
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
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray600: '#6B7280',
  gray900: '#111827',
  red: '#EF4444',
  redBg: '#FEF2F2',
  redBorder: '#FECACA',
  blue: '#3B82F6',
  blueBg: '#EFF6FF',
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

function IconTrash({ size = 14, color = C.gray600 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════
type VehicleType = 'CAR' | 'MOTORBIKE';

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'CAR', label: 'Ô tô' },
  { value: 'MOTORBIKE', label: 'Xe máy' },
];

const TYPE_LABEL: Record<VehicleType, string> = {
  CAR: 'Ô tô',
  MOTORBIKE: 'Xe máy',
};

const VEHICLE_PROFILE_OPTIONS: Record<VehicleType, { label: string; models: string[] }[]> = {
  CAR: [
    { label: 'Toyota', models: ['Vios', 'Corolla Cross', 'Camry', 'Fortuner', 'Innova', 'Veloz Cross'] },
    { label: 'Honda', models: ['City', 'Civic', 'CR-V', 'HR-V', 'Accord'] },
    { label: 'Hyundai', models: ['Accent', 'Elantra', 'Tucson', 'Santa Fe', 'Creta'] },
    { label: 'Kia', models: ['Morning', 'K3', 'Seltos', 'Sonet', 'Carnival'] },
    { label: 'Mazda', models: ['Mazda 2', 'Mazda 3', 'CX-5', 'CX-8', 'BT-50'] },
    { label: 'Ford', models: ['Ranger', 'Everest', 'Territory', 'EcoSport'] },
    { label: 'VinFast', models: ['VF 3', 'VF 5', 'VF 6', 'VF 7', 'VF 8', 'VF 9'] },
  ],
  MOTORBIKE: [
    { label: 'Honda', models: ['Wave Alpha', 'Vision', 'Air Blade', 'Lead', 'SH Mode', 'SH'] },
    { label: 'Yamaha', models: ['Sirius', 'Jupiter', 'Grande', 'Janus', 'Exciter', 'NVX'] },
    { label: 'Suzuki', models: ['Raider', 'Satria', 'Address', 'Burgman Street'] },
    { label: 'Piaggio', models: ['Vespa Sprint', 'Vespa Primavera', 'Liberty', 'Medley'] },
    { label: 'SYM', models: ['Attila', 'Galaxy', 'Elite', 'Husky'] },
    { label: 'VinFast', models: ['Klara', 'Feliz', 'Evo200', 'Vento', 'Theon'] },
  ],
};

const VEHICLE_COLORS = ['Trắng', 'Đen', 'Bạc', 'Xám', 'Đỏ', 'Xanh dương', 'Xanh lá', 'Vàng', 'Nâu', 'Cam'];
const VEHICLE_YEARS = Array.from({ length: new Date().getFullYear() - 1989 }, (_, index) => new Date().getFullYear() - index);
const CAR_SEAT_OPTIONS = [2, 4, 5, 6, 7, 8, 9, 12];

// ═══════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

function VehicleCard({
  vehicle,
  phase,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  vehicle: Vehicle;
  phase: DeletePhase;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const isCar = vehicle.type === 'CAR';
  const busy = phase === 'deleting';
  return (
    <div
      className={styles.card}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
        padding: '0.85rem 1rem',
        opacity: busy ? 0.6 : 1,
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

      {phase === 'confirming' ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '0.78rem', color: C.gray900, fontWeight: 600 }}>
            Xác nhận xoá?
          </span>
          <button
            type="button"
            onClick={onConfirmDelete}
            disabled={busy}
            style={{
              padding: '0.35rem 0.7rem',
              background: C.red,
              color: C.white,
              border: 'none',
              borderRadius: 8,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Xoá
          </button>
          <button
            type="button"
            onClick={onCancelDelete}
            disabled={busy}
            style={{
              padding: '0.35rem 0.7rem',
              background: C.white,
              color: C.gray600,
              border: `1px solid ${C.gray200}`,
              borderRadius: 8,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Huỷ
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAskDelete}
          disabled={busy}
          aria-label={`Xoá xe ${vehicle.plateNumber}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '0.35rem 0.6rem',
            background: 'transparent',
            color: C.gray600,
            border: 'none',
            borderRadius: 8,
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.4 : 1,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.red)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.gray600)}
        >
          <IconTrash size={13} color="currentColor" />
          {busy ? 'Đang xoá...' : 'Xoá'}
        </button>
      )}
    </div>
  );
}

type DeletePhase = 'idle' | 'confirming' | 'deleting';

function DeleteErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      style={{
        background: C.redBg,
        border: `1.5px solid ${C.redBorder}`,
        borderRadius: 10,
        padding: '0.55rem 0.85rem',
        fontSize: '0.8rem',
        color: '#B91C1C',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      <span style={{ flex: 1, lineHeight: 1.4 }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Đóng thông báo"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#B91C1C',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
        }}
      >
        <IconClose size={12} color="#B91C1C" />
      </button>
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
  onSubmit: (
    plateNumber: string,
    type: VehicleType,
    brand?: string,
    model?: string,
    color?: string,
    year?: number,
    seats?: number,
  ) => Promise<void>;
}) {
  const [plateNumber, setPlateNumber] = useState('');
  const [type, setType] = useState<VehicleType>('CAR');
  const [brand, setBrand] = useState(VEHICLE_PROFILE_OPTIONS.CAR[0].label);
  const [model, setModel] = useState(VEHICLE_PROFILE_OPTIONS.CAR[0].models[0]);
  const [color, setColor] = useState(VEHICLE_COLORS[0]);
  const [year, setYear] = useState<number | ''>(VEHICLE_YEARS[0]);
  const [seats, setSeats] = useState<number | ''>(CAR_SEAT_OPTIONS[2] ?? 5);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    const brandEntries = VEHICLE_PROFILE_OPTIONS[type];
    const currentBrand = brandEntries.find((item) => item.label === brand) ?? brandEntries[0];
    if (currentBrand.label !== brand) {
      setBrand(currentBrand.label);
    }
    if (!currentBrand.models.includes(model)) {
      setModel(currentBrand.models[0]);
    }
  }, [type, brand]);

  const availableModels = VEHICLE_PROFILE_OPTIONS[type].find((item) => item.label === brand)?.models ?? VEHICLE_PROFILE_OPTIONS[type][0].models;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = plateNumber.trim();
    if (!trimmed) {
      setLocalError('Vui lòng nhập biển số xe');
      return;
    }
    if (type === 'CAR' && seats === '') {
      setLocalError('Vui lòng chọn số chỗ cho ô tô');
      return;
    }
    setLocalError('');
    const yearVal = year === '' ? undefined : Number(year);
    const seatsVal = type === 'CAR' && seats !== '' ? Number(seats) : undefined;
    await onSubmit(trimmed, type, brand?.trim() || undefined, model?.trim() || undefined, color?.trim() || undefined, yearVal, seatsVal);
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.9rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Hãng</span>
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            disabled={submitting}
            style={{ padding: '0.65rem 0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 10, background: C.white }}
          >
            {VEHICLE_PROFILE_OPTIONS[type].map((brandOption) => (
              <option key={brandOption.label} value={brandOption.label}>
                {brandOption.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Mẫu</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={submitting}
            style={{ padding: '0.65rem 0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 10, background: C.white }}
          >
            {availableModels.map((modelOption) => (
              <option key={modelOption} value={modelOption}>
                {modelOption}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Màu</span>
          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={submitting}
            style={{ padding: '0.65rem 0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 10, background: C.white }}
          >
            {VEHICLE_COLORS.map((colorOption) => (
              <option key={colorOption} value={colorOption}>
                {colorOption}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Năm</span>
          <select
            value={year === '' ? '' : year.toString()}
            onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={submitting}
            style={{ padding: '0.65rem 0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 10, background: C.white }}
          >
            {VEHICLE_YEARS.map((yearOption) => (
              <option key={yearOption} value={yearOption}>
                {yearOption}
              </option>
            ))}
          </select>
        </label>
        {type === 'CAR' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Số chỗ</span>
            <select
              value={seats === '' ? '' : seats.toString()}
              onChange={(e) => setSeats(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={submitting}
              style={{ padding: '0.65rem 0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 10, background: C.white }}
            >
              <option value="">Chọn số chỗ</option>
              {CAR_SEAT_OPTIONS.map((seatCount) => (
                <option key={seatCount} value={seatCount}>
                  {seatCount} chỗ
                </option>
              ))}
            </select>
          </label>
        )}
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
  const [deleteState, setDeleteState] = useState<Record<string, { phase: DeletePhase; error: string }>>({});
  const loadEpoch = useRef(0);

  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadVehicles = useCallback(async () => {
    const epoch = ++loadEpoch.current;
    setLoading(true);
    setLoadError('');
    try {
      const data = await vehicleService.getMyVehicles();
      if (epoch !== loadEpoch.current) return;
      setVehicles(data ?? []);
    } catch (e: any) {
      if (epoch !== loadEpoch.current) return;
      setLoadError(
        e?.response?.data?.message ?? 'Không thể tải danh sách xe. Vui lòng thử lại.'
      );
    } finally {
      if (epoch === loadEpoch.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    loadVehicles();
  }, [authLoading, user, loadVehicles]);

  const handleAddVehicle = async (
    plateNumber: string,
    type: VehicleType,
    brand?: string,
    model?: string,
    color?: string,
    year?: number,
    seats?: number,
  ) => {
    setSubmitting(true);
    setFormError('');
    try {
      await vehicleService.create({ plateNumber, type, brand, model, color, year, seats });
      setFormOpen(false);
      setFormError('');
      await loadVehicles();
    } catch (e: any) {
      setFormError(e?.response?.data?.message ?? 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  const askDelete = (id: string) => {
    setDeleteState((prev) => ({
      ...prev,
      [id]: { phase: 'confirming', error: '' },
    }));
  };

  const cancelDelete = (id: string) => {
    setDeleteState((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const clearDeleteError = (id: string) => {
    setDeleteState((prev) => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { phase: 'idle', error: '' } };
    });
  };

  const handleDelete = async (id: string) => {
    setDeleteState((prev) => ({
      ...prev,
      [id]: { phase: 'deleting', error: '' },
    }));
    try {
      await vehicleService.remove(id);
      setDeleteState((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadVehicles();
    } catch (e: any) {
      const message = e?.response?.data?.message ?? 'Không thể xoá xe';
      setDeleteState((prev) => ({
        ...prev,
        [id]: { phase: 'idle', error: message },
      }));
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
          {vehicles.map((v) => {
            const cardState = deleteState[v.id];
            const phase: DeletePhase = cardState?.phase ?? 'idle';
            const error = cardState?.error ?? '';
            return (
              <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <VehicleCard
                  vehicle={v}
                  phase={phase}
                  onAskDelete={() => askDelete(v.id)}
                  onConfirmDelete={() => handleDelete(v.id)}
                  onCancelDelete={() => cancelDelete(v.id)}
                />
                {error && phase !== 'deleting' && (
                  <DeleteErrorBanner message={error} onDismiss={() => clearDeleteError(v.id)} />
                )}
              </div>
            );
          })}
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
