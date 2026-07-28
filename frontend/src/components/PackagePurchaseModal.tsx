import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { PACKAGES, getTierAreaLabel } from '../constants/packages';
import { vehicleService } from '../services/vehicle.service';
import { monthlyPackageService } from '../services/monthlyPackage.service';
import { Link } from 'react-router-dom';
import type { Vehicle } from '../types/index';
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
  gray600: '#4B5563',
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
  onSuccess?: () => void;
}

export function PackagePurchaseModal({
  isOpen,
  onClose,
  planId,
  vehicleType,
  onSuccess
}: PackagePurchaseModalProps) {
  const { user } = useAuth();

  // States
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [hasVehiclesOfThisType, setHasVehiclesOfThisType] = useState(true);

  // Payment step states
  const [step, setStep] = useState<'CONFIRM' | 'PAYMENT_METHOD' | 'QR' | 'CARD' | 'SUCCESS'>('CONFIRM');
  const [paymentMethod, setPaymentMethod] = useState<'EWALLET' | 'CARD'>('EWALLET');
  const [createdPkg, setCreatedPkg] = useState<any>(null);
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

  // Card payment form states
  const [cardForm, setCardForm] = useState({ number: '', name: '', expiry: '', cvv: '' });

  // Refs for trapping focus
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInteractiveRef = useRef<any>(null);

  const plan = PACKAGES.find(p => p.id === planId);
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
      setStep('CONFIRM');
      setSubmitError('');
      setCreatedPkg(null);
      setShowAddVehicle(false);
      setNewPlate('');
      setCardForm({ number: '', name: '', expiry: '', cvv: '' });

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

  if (!isOpen || !plan) return null;

  // Expected dates
  const today = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(today.getDate() + plan.durationDays);

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

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

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

  const handleProceedToPaymentMethod = () => {
    if (!selectedVehicleId) return;
    setStep('PAYMENT_METHOD');
  };

  const handleProceedToPaymentScreen = async () => {
    if (paymentMethod === 'CARD') {
      setSubmitting(true);
      setSubmitError('');
      try {
        const res = await monthlyPackageService.createCheckoutSession({
          vehicleId: selectedVehicleId,
          planId: planId!,
        });
        window.location.href = res.url;
      } catch (err: any) {
        setSubmitError(err.response?.data?.message ?? 'Không thể tạo phiên thanh toán Stripe');
      } finally {
        setSubmitting(false);
      }
    } else {
      setStep('QR');
    }
  };

  const handleConfirmPurchase = async () => {
    if (!user || !selectedVehicleId) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      // Immediate Cash/EWallet flow
      const created = await monthlyPackageService.create({
        userId: user.id,
        vehicleId: selectedVehicleId,
        startDate: today.toISOString(),
        expiryDate: expiryDate.toISOString(),
        price,
        paymentMethod,
        planId,
        vehicleType,
      });
      setCreatedPkg(created);
      setStep('SUCCESS');
      if (onSuccess) onSuccess();
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message ?? 'Đăng ký gói tháng thất bại. Vui lòng thử lại.');
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
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget && step !== 'SUCCESS' && !submitting) onClose(); }}>
      <div style={containerStyle} ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="modal-title">

        {/* Header */}
        <div style={{ background: headerBg, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTopLeftRadius: 24, borderTopRightRadius: 24, flexShrink: 0 }}>
          <div>
            <h3 id="modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: C.white }}>
              {step === 'SUCCESS' ? 'Đăng ký thành công' : step === 'QR' || step === 'CARD' ? 'Thanh toán hóa đơn' : 'Xác nhận đăng ký gói'}
            </h3>
          </div>
          {step !== 'SUCCESS' && !submitting && (
            <button onClick={handleClose} aria-label="Đóng" ref={firstInteractiveRef} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* STEP 1: CONFIRMATION & VEHICLE SELECTION */}
          {step === 'CONFIRM' && (
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
                    <span style={badgeStyle}>{vehicleType === 'CAR' ? '🚗 Gói ô tô' : '🛵 Gói xe máy'}</span>
                    <h4 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 800, color: C.gray900 }}>{plan.name}</h4>
                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: C.gray600 }}>Thời hạn: <strong>{plan.durationDays} ngày</strong></p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '0.75rem', borderTop: `1px solid ${C.gray200}` }}>
                      <span style={{ fontSize: '0.82rem', color: C.gray600 }}>Chi phí gói:</span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: themeColor }}>{formatVND(price)}</div>
                        <span style={{ fontSize: '0.75rem', color: C.gray500 }}>~ {priceObj?.pricePerDay}</span>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray600 }}>Chọn xe sử dụng gói</label>
                      <button type="button" onClick={() => setShowAddVehicle(true)} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>+ Thêm xe mới</button>
                    </div>
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
                    <button type="button" onClick={handleClose} style={{ flex: 1, padding: '0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 14, background: C.white, color: C.gray600, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
                      Hủy
                    </button>
                    <button type="button" onClick={handleProceedToPaymentMethod} disabled={!selectedVehicleId} style={{ flex: 1.5, padding: '0.85rem', border: 'none', borderRadius: 14, background: !selectedVehicleId ? C.gray300 : themeColor, color: C.white, fontSize: '0.9rem', fontWeight: 700, cursor: !selectedVehicleId ? 'not-allowed' : 'pointer', boxShadow: !selectedVehicleId ? 'none' : '0 4px 12px rgba(0,0,0,0.15)' }}>
                      Tiếp tục thanh toán
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* STEP 2: PAYMENT METHOD SELECTION */}
          {step === 'PAYMENT_METHOD' && (
            <>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: C.gray900 }}>Chọn phương thức thanh toán</h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button type="button" onClick={() => setPaymentMethod('EWALLET')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: `2px solid ${paymentMethod === 'EWALLET' ? themeColor : C.gray200}`, borderRadius: 16, background: C.white, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ fontSize: '1.5rem' }}>📱</div>
                    <div>
                      <div style={{ fontWeight: 700, color: C.gray900, fontSize: '0.9rem' }}>Ví điện tử MoMo / VNPAY</div>
                      <div style={{ fontSize: '0.75rem', color: C.gray500 }}>Quét mã QR để hoàn tất thanh toán nhanh</div>
                    </div>
                  </div>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${paymentMethod === 'EWALLET' ? themeColor : C.gray300}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {paymentMethod === 'EWALLET' && <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: themeColor }}></div>}
                  </div>
                </button>

                <button type="button" onClick={() => setPaymentMethod('CARD')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: `2px solid ${paymentMethod === 'CARD' ? themeColor : C.gray200}`, borderRadius: 16, background: C.white, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ fontSize: '1.5rem' }}>💳</div>
                    <div>
                      <div style={{ fontWeight: 700, color: C.gray900, fontSize: '0.9rem' }}>Thẻ Quốc tế Visa / Mastercard / JCB</div>
                      <div style={{ fontSize: '0.75rem', color: C.gray500 }}>Nhập thông tin thẻ tín dụng của bạn</div>
                    </div>
                  </div>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${paymentMethod === 'CARD' ? themeColor : C.gray300}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {paymentMethod === 'CARD' && <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: themeColor }}></div>}
                  </div>
                </button>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setStep('CONFIRM')} style={{ flex: 1, padding: '0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 14, background: C.white, color: C.gray600, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
                  Quay lại
                </button>
                <button type="button" onClick={handleProceedToPaymentScreen} style={{ flex: 1.5, padding: '0.85rem', border: 'none', borderRadius: 14, background: themeColor, color: C.white, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                  Tiếp tục
                </button>
              </div>
            </>
          )}

          {/* STEP 3A: QR PAYMENT FLOW */}
          {step === 'QR' && (
            <>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.88rem', color: C.gray600 }}>Quét mã QR bằng ứng dụng ngân hàng hoặc Ví điện tử để thanh toán</p>

                {/* QR Mock image */}
                <div style={{ padding: '1rem', background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 16, display: 'inline-block' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=PARKSMART_PLAN_${planId}_PRICE_${price}`}
                    alt="QR Payment Code"
                    style={{ width: 180, height: 180 }}
                  />
                </div>

                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: themeColor }}>{formatVND(price)}</div>

                <div style={{ width: '100%', background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 14, padding: '0.85rem', fontSize: '0.8rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: C.gray500 }}>Gói đăng ký:</span>
                    <span style={{ fontWeight: 600, color: C.gray800 }}>{plan.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: C.gray500 }}>Phương tiện:</span>
                    <span style={{ fontWeight: 600, color: C.gray800 }}>{selectedVehicle?.plateNumber}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: C.gray500 }}>Nội dung:</span>
                    <span style={{ fontWeight: 600, color: C.gray800 }}>Dang ky goi thang {selectedVehicle?.plateNumber}</span>
                  </div>
                </div>
              </div>

              {submitError && (
                <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 10, padding: '0.6rem 0.85rem', fontSize: '0.8rem', color: '#B91C1C', fontWeight: 500 }}>
                  {submitError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setStep('PAYMENT_METHOD')} disabled={submitting} style={{ flex: 1, padding: '0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 14, background: C.white, color: C.gray600, fontSize: '0.9rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  Quay lại
                </button>
                <button type="button" onClick={handleConfirmPurchase} disabled={submitting} style={{ flex: 1.5, padding: '0.85rem', border: 'none', borderRadius: 14, background: themeColor, color: C.white, fontSize: '0.9rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  {submitting ? 'Đang xử lý...' : 'Xác nhận đã chuyển khoản'}
                </button>
              </div>
            </>
          )}

          {/* STEP 3B: CARD FORM FLOW */}
          {step === 'CARD' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: C.gray600 }}>Tổng thanh toán:</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 900, color: themeColor }}>{formatVND(price)}</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: C.gray600, marginBottom: 4 }}>Số thẻ</label>
                  <input
                    type="text"
                    placeholder="0000 0000 0000 0000"
                    value={cardForm.number}
                    onChange={(e) => setCardForm(prev => ({ ...prev, number: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: C.gray600, marginBottom: 4 }}>Tên chủ thẻ</label>
                  <input
                    type="text"
                    placeholder="NGUYEN VAN A"
                    value={cardForm.name}
                    onChange={(e) => setCardForm(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: C.gray600, marginBottom: 4 }}>Ngày hết hạn</label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      value={cardForm.expiry}
                      onChange={(e) => setCardForm(prev => ({ ...prev, expiry: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: C.gray600, marginBottom: 4 }}>CVV</label>
                    <input
                      type="password"
                      placeholder="•••"
                      maxLength={3}
                      value={cardForm.cvv}
                      onChange={(e) => setCardForm(prev => ({ ...prev, cvv: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: '0.75rem', color: C.gray400, textAlign: 'center' }}>
                  Cổng thanh toán giả lập cho mục đích trình diễn.
                </p>
              </div>

              {submitError && (
                <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 10, padding: '0.6rem 0.85rem', fontSize: '0.8rem', color: '#B91C1C', fontWeight: 500 }}>
                  {submitError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setStep('PAYMENT_METHOD')} disabled={submitting} style={{ flex: 1, padding: '0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 14, background: C.white, color: C.gray600, fontSize: '0.9rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  Quay lại
                </button>
                <button type="button" onClick={handleConfirmPurchase} disabled={submitting || !cardForm.number || !cardForm.name || !cardForm.expiry || !cardForm.cvv} style={{ flex: 1.5, padding: '0.85rem', border: 'none', borderRadius: 14, background: (!cardForm.number || !cardForm.name || !cardForm.expiry || !cardForm.cvv) ? C.gray300 : themeColor, color: C.white, fontSize: '0.9rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  {submitting ? 'Đang xử lý...' : `Thanh toán ${formatVND(price)}`}
                </button>
              </div>
            </>
          )}

          {/* STEP 4: SUCCESS SCREEN */}
          {step === 'SUCCESS' && createdPkg && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', padding: '1rem 0' }}>
              <div style={{ width: 72, height: 72, background: C.greenBg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `3px solid ${C.green}` }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: C.gray900 }}>Thanh toán thành công!</h4>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: C.gray600 }}>Bạn đã đăng ký gói tháng thành công.</p>
              </div>

              <div style={{ width: '100%', background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 16, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: C.gray500 }}>Gói:</span>
                  <span style={{ fontWeight: 700, color: C.gray900 }}>{plan.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: C.gray500 }}>Thanh toán:</span>
                  <span style={{ fontWeight: 700, color: C.gray900 }}>{paymentMethod === 'CARD' ? 'Thẻ Quốc tế' : 'Ví điện tử'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: C.gray500 }}>Số tiền:</span>
                  <span style={{ fontWeight: 800, color: themeColor }}>{formatVND(Number(createdPkg.price))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: C.gray500 }}>Khu vực đỗ:</span>
                  <span style={{ fontWeight: 700, color: C.gray900 }}>
                    {createdPkg.floor?.name
                      ? `Tầng ${createdPkg.floor.name} · ${getTierAreaLabel(createdPkg.allowedTier)}`
                      : `Tầng G · ${getTierAreaLabel(createdPkg.allowedTier)}`}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', paddingTop: '0.5rem', borderTop: `1px solid ${C.gray200}`, marginTop: '0.25rem' }}>
                  <span style={{ fontWeight: 700, color: C.gray900 }}>Ngày hết hạn:</span>
                  <span style={{ fontWeight: 800, color: themeColor }}>{formatDate(new Date(createdPkg.expiryDate))}</span>
                </div>
              </div>

              <button onClick={handleClose} style={{ width: '100%', padding: '0.85rem', border: 'none', borderRadius: 14, background: themeColor, color: C.white, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                Hoàn tất
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
