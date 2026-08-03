import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTierAreaLabel } from '../constants/packages';
import { vehicleService } from '../services/vehicle.service';
import { monthlyPackageService } from '../services/monthlyPackage.service';
import type { Vehicle, PackagePlan } from '../types/index';
import { PlateInput } from './PlateInput';

const C = {
  navy: '#0F172A',
  white: '#FFFFFF',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#6B7280',
  gray800: '#1F2937',
  gray900: '#111827',
  red: '#EF4444',
  redBg: '#FEF2F2',
  redBorder: '#FECACA',
  blue: '#3B82F6',
  blueLight: '#DBEAFE',
  blueDark: '#1D4ED8',
};

const VEHICLE_PROFILE_OPTIONS = {
  CAR: [
    { label: 'Toyota', models: ['Vios', 'Corolla Cross', 'Camry', 'Fortuner', 'Innova', 'Veloz Cross'] },
    { label: 'Honda', models: ['City', 'Civic', 'CR-V', 'HR-V', 'Accord'] },
    { label: 'Hyundai', models: ['Accent', 'Elantra', 'Tucson', 'Santa Fe', 'Creta'] },
    { label: 'Kia', models: ['Morning', 'K3', 'Seltos', 'Sonet', 'Carnival'] },
    { label: 'Mazda', models: ['Mazda 2', 'Mazda 3', 'CX-5', 'CX-8', 'BT-50'] },
    { label: 'Ford', models: ['Ranger', 'Everest', 'Territory', 'EcoSport'] },
    { label: 'VinFast', models: ['VF 3', 'VF 5', 'VF 6', 'VF 7', 'VF 8', 'VF 9'] }
  ],
  MOTORBIKE: [
    { label: 'Honda', models: ['Wave Alpha', 'Vision', 'Air Blade', 'Lead', 'SH Mode', 'SH'] },
    { label: 'Yamaha', models: ['Sirius', 'Jupiter', 'Grande', 'Janus', 'Exciter', 'NVX'] },
    { label: 'Suzuki', models: ['Raider', 'Satria', 'Address', 'Burgman Street'] },
    { label: 'Piaggio', models: ['Vespa Sprint', 'Vespa Primavera', 'Liberty', 'Medley'] },
    { label: 'SYM', models: ['Attila', 'Galaxy', 'Elite', 'Husky'] },
    { label: 'VinFast', models: ['Klara', 'Feliz', 'Evo200', 'Vento', 'Theon'] }
  ]
};

const VEHICLE_COLORS = ['Trắng', 'Đen', 'Bạc', 'Xám', 'Đỏ', 'Xanh dương', 'Xanh lá', 'Vàng', 'Nâu', 'Cam'];
const VEHICLE_YEARS = Array.from({ length: new Date().getFullYear() - 1989 }, (_, index) => new Date().getFullYear() - index);
const CAR_SEAT_OPTIONS = [2, 4, 5, 7, 9, 16];

export interface PackagePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
}

export function PackagePurchaseModal({
  isOpen,
  onClose,
  planId,
  vehicleType
}: PackagePurchaseModalProps) {
  const { user } = useAuth();

  // States
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [hasVehiclesOfThisType, setHasVehiclesOfThisType] = useState(true);

  // Payment step states
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Inline add vehicle states
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newColor, setNewColor] = useState(VEHICLE_COLORS[0]);
  const [newYear, setNewYear] = useState<number | ''>(VEHICLE_YEARS[0]);
  const [newSeats, setNewSeats] = useState<number | ''>(5);
  const [addVehicleError, setAddVehicleError] = useState('');
  const [addingVehicle, setAddingVehicle] = useState(false);

  // Refs for trapping focus
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInteractiveRef = useRef<any>(null);

  const [plans, setPlans] = useState<PackagePlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoadingPlans(true);
      setPlansError('');
      monthlyPackageService.getPlans()
        .then(setPlans)
        .catch(err => {
          console.error('Failed to load plans from backend:', err);
          setPlansError('Không thể tải cấu hình gói từ máy chủ.');
        })
        .finally(() => setLoadingPlans(false));
    }
  }, [isOpen]);

  const plan = plans.find(p => p.id === planId);
  const priceObj = plan?.prices[vehicleType];
  const price = priceObj?.price ?? 0;

  const loadVehicles = async () => {
    if (!user) return;
    setLoadingVehicles(true);
    try {
      const data = await vehicleService.getMyVehicles();
      const rawVehicles = data ?? [];
      const sameType = rawVehicles.filter((v: Vehicle) => v.type === vehicleType);
      setHasVehiclesOfThisType(sameType.length > 0);

      const now = new Date();
      const filtered = sameType.filter((v: Vehicle) => {
        if (v.monthlyPackage && v.monthlyPackage.status === 'ACTIVE') {
          const expiryDate = new Date(v.monthlyPackage.expiryDate);
          if (expiryDate > now) {
            const payments = v.monthlyPackage.payments || [];
            const isPaid = payments.length === 0 || payments.some((p: any) => p.status === 'SUCCESS');
            if (isPaid) {
              return false; // Exclude from eligible list
            }
          }
        }
        return true;
      });

      setVehicles(filtered);
      setSelectedVehicleId('');
    } catch (e) {
      console.error('Failed to load vehicles', e);
    } finally {
      setLoadingVehicles(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      loadVehicles();
      setSubmitError('');
      setShowAddVehicle(false);
      setNewPlate('');

      // Auto-set initial options for brand/model matching type
      const brandOpts = VEHICLE_PROFILE_OPTIONS[vehicleType];
      setNewBrand(brandOpts[0].label);
      setNewModel(brandOpts[0].models[0]);
    }
  }, [isOpen, planId, vehicleType, user]);

  // Trap focus & keyboard interactions
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0] as HTMLElement;
        const last = focusable[focusable.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Set initial focus
    setTimeout(() => {
      if (firstInteractiveRef.current) {
        firstInteractiveRef.current.focus();
      }
    }, 100);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Sync new brand and models
  useEffect(() => {
    const brandEntries = VEHICLE_PROFILE_OPTIONS[vehicleType];
    const currentBrand = brandEntries.find((item) => item.label === newBrand) ?? brandEntries[0];
    if (currentBrand.label !== newBrand) setNewBrand(currentBrand.label);
    if (!currentBrand.models.includes(newModel)) setNewModel(currentBrand.models[0]);
  }, [newBrand, vehicleType]);

  if (!isOpen) return null;

  // Expected dates
  const today = new Date();
  const expiryDate = new Date();
  if (plan) {
    expiryDate.setDate(today.getDate() + plan.durationDays);
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatVND = (val: number) => {
    return val.toLocaleString('vi-VN') + 'đ';
  };

  const getZoneText = () => {
    return getTierAreaLabel(plan?.allowedTier);
  };

  // Handlers
  const handleAddVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const plate = newPlate.trim();
    if (!plate) {
      setAddVehicleError('Vui lòng nhập biển số xe');
      return;
    }

    setAddVehicleError('');
    setAddingVehicle(true);
    try {
      const yearVal = newYear === '' ? undefined : Number(newYear);
      const seatsVal = vehicleType === 'CAR' && newSeats !== '' ? Number(newSeats) : undefined;

      const newVeh = await vehicleService.create({
        plateNumber: plate,
        type: vehicleType,
        brand: newBrand,
        model: newModel,
        color: newColor,
        year: yearVal,
        seats: seatsVal
      });

      // Reload vehicles and set newly added as active
      const data = await vehicleService.getMyVehicles();
      const filtered = (data ?? []).filter((v: Vehicle) => v.type === vehicleType);
      setVehicles(filtered);

      const createdInList = filtered.find((v: Vehicle) => v.plateNumber === newVeh.plateNumber);
      if (createdInList) {
        setSelectedVehicleId(createdInList.id);
      } else if (filtered.length > 0) {
        setSelectedVehicleId(filtered[0].id);
      }

      setShowAddVehicle(false);
      setNewPlate('');
    } catch (err: any) {
      setAddVehicleError(err.response?.data?.message ?? 'Lỗi khi thêm phương tiện mới');
    } finally {
      setAddingVehicle(false);
    }
  };

  const handleProceedToPaymentScreen = async () => {
    if (!selectedVehicleId) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await monthlyPackageService.createCheckoutSession({
        vehicleId: selectedVehicleId,
        planId: planId!,
      });
      if (res.status === 'ALREADY_PROCESSED') {
        // Session was already paid — treat as success
        sessionStorage.removeItem('pending_monthly_package_id');
        sessionStorage.removeItem('pending_monthly_payment_id');
        sessionStorage.removeItem('pending_monthly_session_id');
        onClose();
        return;
      }
      sessionStorage.setItem('pending_monthly_package_id', res.packageId);
      sessionStorage.setItem('pending_monthly_payment_id', res.paymentId);
      sessionStorage.setItem('pending_monthly_session_id', res.sessionId);
      window.location.href = res.url;
    } catch (err: any) {
      setSubmitError(err.response?.data?.message ?? 'Không thể tạo phiên thanh toán Stripe');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const headerBg = vehicleType === 'CAR' ? 'linear-gradient(135deg,#065F46 0%,#097969 100%)' : 'linear-gradient(135deg,#1E3A5F 0%,#2D5BA3 100%)';
  const themeColor = vehicleType === 'CAR' ? '#065F46' : '#2563EB';

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1rem',
  };

  const containerStyle: React.CSSProperties = {
    backgroundColor: C.white,
    borderRadius: 24,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.25rem 0.6rem',
    borderRadius: 8,
    fontSize: '0.75rem',
    fontWeight: 800,
    backgroundColor: vehicleType === 'CAR' ? '#D1FAE5' : '#DBEAFE',
    color: vehicleType === 'CAR' ? '#065F46' : '#1D4ED8',
    marginBottom: '0.35rem',
    textTransform: 'uppercase',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.65rem 0.85rem',
    fontSize: '0.9rem',
    border: `1.5px solid ${C.gray200}`,
    borderRadius: 12,
    background: C.white,
    color: C.gray900,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div style={containerStyle} ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="modal-title">

        {/* Header */}
        <div style={{ background: headerBg, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTopLeftRadius: 24, borderTopRightRadius: 24, flexShrink: 0 }}>
          <div>
            <h3 id="modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: C.white }}>
              Xác nhận đăng ký gói
            </h3>
          </div>
          {!submitting && (
            <button onClick={handleClose} aria-label="Đóng" ref={firstInteractiveRef} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {loadingPlans ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: C.gray600 }}>
              <div style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid #3B82F6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Đang tải thông tin cấu hình gói...</p>
            </div>
          ) : plansError ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>❌</div>
              <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#B91C1C' }}>Lỗi tải cấu hình</p>
              <p style={{ margin: '0.5rem 0 1.5rem', fontSize: '0.85rem', color: C.gray600, lineHeight: 1.5 }}>
                {plansError}
              </p>
              <button onClick={handleClose} style={{ width: '100%', padding: '0.75rem', background: C.gray100, border: `1px solid ${C.gray200}`, borderRadius: 12, fontSize: '0.88rem', fontWeight: 700, color: C.gray900, cursor: 'pointer' }}>
                Đóng
              </button>
            </div>
          ) : !plan ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>❌</div>
              <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#B91C1C' }}>Không tìm thấy gói</p>
              <p style={{ margin: '0.5rem 0 1.5rem', fontSize: '0.85rem', color: C.gray600, lineHeight: 1.5 }}>
                Gói đỗ xe đã chọn không còn tồn tại hoặc không hợp lệ.
              </p>
              <button onClick={handleClose} style={{ width: '100%', padding: '0.75rem', background: C.gray100, border: `1px solid ${C.gray200}`, borderRadius: 12, fontSize: '0.88rem', fontWeight: 700, color: C.gray900, cursor: 'pointer' }}>
                Đóng
              </button>
            </div>
          ) : (
            <>
              {/* If user lacks phone number */}
              {!user?.phoneNumber ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚠️</div>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>Yêu cầu thông tin số điện thoại</p>
                  <p style={{ margin: '0.5rem 0 1.5rem', fontSize: '0.85rem', color: C.gray600, lineHeight: 1.5 }}>
                    Vui lòng cập nhật số điện thoại trong <Link to="/profile" onClick={onClose} style={{ color: '#2563EB', fontWeight: 700, textDecoration: 'underline' }}>Hồ sơ</Link> trước khi đăng ký gói.
                  </p>
                  <button onClick={handleClose} style={{ width: '100%', padding: '0.75rem', background: C.gray100, border: `1px solid ${C.gray200}`, borderRadius: 12, fontSize: '0.88rem', fontWeight: 700, color: C.gray900, cursor: 'pointer' }}>
                    Đóng
                  </button>
                </div>
              ) : showAddVehicle ? (
                /* INLINE ADD VEHICLE FORM */
                <form onSubmit={handleAddVehicleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>Thêm xe mới</h4>
                    <button type="button" onClick={() => setShowAddVehicle(false)} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Quay lại</button>
                  </div>

                  {addVehicleError && (
                    <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 10, padding: '0.6rem 0.85rem', fontSize: '0.8rem', color: '#B91C1C', fontWeight: 500 }}>
                      {addVehicleError}
                    </div>
                  )}

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Biển số xe</span>
                    <PlateInput value={newPlate} onChange={setNewPlate} placeholder="VD: 51A-12345" disabled={addingVehicle} autoFocus style={{ ...inputStyle, fontFamily: "'Consolas',monospace", fontWeight: 600 }} />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Hãng</span>
                    <select value={newBrand} onChange={(e) => setNewBrand(e.target.value)} disabled={addingVehicle} style={inputStyle}>
                      {VEHICLE_PROFILE_OPTIONS[vehicleType].map(b => <option key={b.label} value={b.label}>{b.label}</option>)}
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Mẫu</span>
                    <select value={newModel} onChange={(e) => setNewModel(e.target.value)} disabled={addingVehicle} style={inputStyle}>
                      {(VEHICLE_PROFILE_OPTIONS[vehicleType].find((item) => item.label === newBrand)?.models ?? VEHICLE_PROFILE_OPTIONS[vehicleType][0].models).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Màu sắc</span>
                    <select value={newColor} onChange={(e) => setNewColor(e.target.value)} disabled={addingVehicle} style={inputStyle}>
                      {VEHICLE_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Năm sản xuất</span>
                    <select value={newYear === '' ? '' : newYear.toString()} onChange={(e) => setNewYear(e.target.value === '' ? '' : Number(e.target.value))} disabled={addingVehicle} style={inputStyle}>
                      {VEHICLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </label>

                  {vehicleType === 'CAR' && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Số chỗ ngồi</span>
                      <select value={newSeats === '' ? '' : newSeats.toString()} onChange={(e) => setNewSeats(e.target.value === '' ? '' : Number(e.target.value))} disabled={addingVehicle} style={inputStyle}>
                        {CAR_SEAT_OPTIONS.map(s => <option key={s} value={s}>{s} chỗ</option>)}
                      </select>
                    </label>
                  )}

                  <button type="submit" disabled={addingVehicle || !newPlate.trim()} style={{ width: '100%', padding: '0.8rem', background: addingVehicle || !newPlate.trim() ? C.gray300 : '#2563EB', color: C.white, border: 'none', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem' }}>
                    {addingVehicle ? 'Đang lưu...' : '+ Thêm phương tiện'}
                  </button>
                </form>
              ) : (
                /* MAIN CONFIRMATION VIEW */
                <>
                  {/* Selected Package Card */}
                  <div style={{ background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 18, padding: '1.25rem' }}>
                    <span style={badgeStyle}>{vehicleType === 'CAR' ? '🚗 ĐĂNG KÝ GÓI Ô TÔ' : '🏍️ ĐĂNG KÝ GÓI XE MÁY'}</span>
                    <h4 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 800, color: C.gray900 }}>{plan.name}</h4>
                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: C.gray600 }}>Thời hạn: <strong>{plan.durationDays} ngày</strong></p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '0.75rem', borderTop: `1px solid ${C.gray200}` }}>
                      <span style={{ fontSize: '0.82rem', color: C.gray600 }}>Chi phí:</span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: themeColor }}>{formatVND(price)}</div>
                        <span style={{ fontSize: '0.75rem', color: C.gray500 }}>~ {priceObj ? formatVND(Math.round(priceObj.price / plan.durationDays)) + '/ngày' : 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Zone & Usage Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: C.gray600 }}>Khu vực áp dụng:</span>
                      <span style={{ fontWeight: 700, color: C.gray900 }}>{getZoneText()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: C.gray600 }}>Ngày bắt đầu:</span>
                      <span style={{ fontWeight: 600, color: C.gray900 }}>{formatDate(today)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: C.gray600 }}>Ngày hết hạn (dự kiến):</span>
                      <span style={{ fontWeight: 600, color: C.gray900 }}>{formatDate(expiryDate)}</span>
                    </div>
                  </div>

                  {/* Vehicle selector */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray600 }}>Chọn xe sử dụng gói</label>
                    {loadingVehicles ? (
                      <div style={{ padding: '0.75rem', textAlign: 'center', color: C.gray400, fontSize: '0.85rem' }}>Đang tải danh sách phương tiện...</div>
                    ) : !hasVehiclesOfThisType ? (
                      <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, padding: '0.75rem 1rem', borderRadius: 14, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: '#B91C1C', fontWeight: 600, textAlign: 'center' }}>
                          Bạn chưa có phương tiện phù hợp để đăng ký gói này.
                        </span>
                      </div>
                    ) : vehicles.length === 0 ? (
                      <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, padding: '0.75rem 1rem', borderRadius: 14, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: '#B91C1C', fontWeight: 600, textAlign: 'center' }}>
                          Không có phương tiện đủ điều kiện để đăng ký gói này.
                        </span>
                      </div>
                    ) : (
                      <select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)} style={inputStyle}>
                        <option value="">-- Chọn phương tiện --</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.plateNumber} - {v.brand} {v.model} ({v.type === 'CAR' ? 'Ô tô' : 'Xe máy'})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Wording Note */}
                  <div style={{ padding: '0.85rem 1rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 14, fontSize: '0.82rem', color: '#1E40AF', lineHeight: 1.5 }}>
                    <strong>Lưu ý sử dụng:</strong> Gói này cấp quyền sử dụng khu vực tương ứng. Bạn không sở hữu ô đỗ cố định và có thể đỗ tại bất kỳ vị trí trống nào trong đúng khu vực của gói.
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button type="button" onClick={handleClose} disabled={submitting} style={{ flex: 1, padding: '0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 14, background: C.white, color: C.gray600, fontSize: '0.9rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                      Hủy
                    </button>
                    <button type="button" onClick={handleProceedToPaymentScreen} disabled={!selectedVehicleId || submitting} style={{ flex: 1.5, padding: '0.85rem', border: 'none', borderRadius: 14, background: !selectedVehicleId || submitting ? C.gray300 : themeColor, color: C.white, fontSize: '0.9rem', fontWeight: 700, cursor: !selectedVehicleId || submitting ? 'not-allowed' : 'pointer', boxShadow: !selectedVehicleId || submitting ? 'none' : '0 4px 12px rgba(0,0,0,0.15)' }}>
                      {submitting ? 'Đang kết nối Stripe...' : 'Thanh toán qua Stripe'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {submitError && (
            <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#B91C1C', fontWeight: 600 }}>
              {submitError}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
