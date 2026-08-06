import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import {
  checkoutLookupPlate,
  createCheckoutStripeSession,
  getCheckoutStripeStatusBySession,
  lookupCheckoutByPin
} from '../api/checkoutApi';
import type { CheckoutLookupResult, CheckoutLookupByPinResult } from '../api/checkoutApi';
import { lookupGuestVehicle } from '../api/guestApi';
import type { CheckInRecord } from '../types/index';
import {
  initializeFaceComparison,
  loadImageFromFile,
  loadImageFromUrl,
  extractSingleFaceEmbedding,
  compareEmbeddings,
  type ModelStatus,
  type FaceComparisonResult
} from '../services/faceComparison';

// ���� Types ������������������������������������������������������������������������������������������������
interface ActiveRecord {
  id: string;
  vehicleId: string;
  slotId: string | null;
  checkInTime: string;
  checkOutTime: string | null;
  isMonthly: boolean;
  vehicle?: {
    plateNumber: string;
    type?: 'CAR' | 'MOTORBIKE';
    brand?: string | null;
    model?: string | null;
    color?: string | null;
    year?: number | null;
    seats?: number | null;
  };
  slot?: { code: string; floor: number } | null;
  floor?: { id: number; name: string; floorCode: string } | null;
  allowedTier?: string | null;
  bookingId?: string | null;
}

interface FeePreview {
  recordId: string;
  plate: string;
  slotCode: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
  isMonthly: boolean;
  checkInTime: string;
  now: string;
  durationMinutes: number;
  fee: number;
  depositCredit?: number;
  amountDue?: number;
  breakdown: {
    label: string;
    minutesInBlock: number;
    lots: number;
    lotHours?: number;
    rate: number;
    amount: number;
    note?: string;
  }[];
  baseParkingFee?: number;
  bookingDepositApplied?: number;
  discountAmount?: number;
  totalSuccessfullyPaid?: number;
  prepaidAt?: string | null;
  graceExpiresAt?: string | null;
}

interface CheckOutResponse {
  recordId: string;
  paymentRequired: boolean;
  amountDue?: number;
  durationHours?: number;
  note?: string;
  fee?: number;
  depositCredit?: number;
  isMonthly: boolean;
  breakdown?: {
    label: string;
    minutesInBlock: number;
    lots: number;
    lotHours?: number;
    rate: number;
    amount: number;
    note?: string;
  }[];
  plate: string;
  slotCode?: string;
  checkInTime: string;
  checkOutTime: string;
  durationMinutes?: number;
  floorName?: string;
  floorCode?: string;
  paymentMethod?: string;
  grossParkingFee?: number;
  bookingDepositPaid?: number;
  bookingId?: string | null;
  vehicleType?: 'CAR' | 'MOTORBIKE' | string | null;
}




// ���� Design tokens ��������������������������������������������������������������������������������
const C = {
  navy: '#1E3A5F',
  white: '#FFFFFF',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  greenBorder: '#86EFAC',
  red: '#DC2626',
  redBg: '#FEE2E2',
  redBorder: '#FECACA',
  gray50: '#F9FAFB',
  gray100: '#F3F5F7',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#5C6B7A',
  gray800: '#111827',
  shadow: '0 8px 32px rgba(30,58,95,0.08)',
  radius: 18,
};

function IconCheck({
  size = 20,
  color = 'currentColor',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 12.5l4.2 4.2L19 7"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAlert({ size = 16, color = C.red }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────
function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
}


function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatFloorLocation(
  floor: { name?: string | null; floorCode?: string | null } | null | undefined,
  slot: { code: string; floor: number } | null | undefined,
  allowedTier?: string | null
): string {
  let label = '';
  if (floor) {
    const name = floor.name ? floor.name.trim() : '';
    const code = floor.floorCode ? floor.floorCode.trim() : '';
    if (name && code) {
      if (name.toLowerCase().endsWith(code.toLowerCase()) || name.toLowerCase().includes(`tầng ${code.toLowerCase()}`)) {
        label = name;
      } else {
        label = `${name} (${code})`;
      }
    } else if (name) {
      label = name;
    } else if (code) {
      label = `Tầng ${code}`;
    }
  } else if (slot?.floor != null) {
    label = `Tầng ${slot.floor}`;
  } else {
    label = 'Không cố định';
  }

  if (allowedTier) {
    const tierLabel = allowedTier === 'VIP' ? 'VIP' : allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản';
    label += ` · Khu ${tierLabel}`;
  }
  return label;
}

function formatReceiptLocation(
  floorName?: string | null,
  floorCode?: string | null,
  slotCode?: string | null,
  vehicleType?: 'CAR' | 'MOTORBIKE' | string | null
): string {
  let label = '';
  const name = floorName ? floorName.trim() : '';
  const code = floorCode ? floorCode.trim() : '';
  if (name && code) {
    if (name.toLowerCase().endsWith(code.toLowerCase()) || name.toLowerCase().includes(`tầng ${code.toLowerCase()}`)) {
      label = name;
    } else {
      label = `${name} (${code})`;
    }
  } else if (name) {
    label = name;
  } else if (code) {
    label = `Tầng ${code}`;
  } else {
    label = 'Không cố định';
  }

  const cleanSlot = slotCode?.trim();
  const isSlotMissingOrGeneric = !cleanSlot || 
    cleanSlot === 'Không cố định' || 
    cleanSlot.includes('Không') || 
    cleanSlot.includes('cố định') || 
    cleanSlot.includes('c');

  if (!isSlotMissingOrGeneric) {
    if (cleanSlot.startsWith('Khu ')) {
      label += ` · ${cleanSlot}`;
    } else {
      label += ` · Vị trí ${cleanSlot}`;
    }
  }

  if (vehicleType) {
    const area = vehicleType === 'CAR' ? 'Khu ô tô' : 'Khu xe máy';
    label += ` · ${area}`;
  }

  return label;
}



// ���� Main component ������������������������������������������������������������������������������
export function CheckOutPage() {
  const [plateInput, setPlateInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [foundRecord, setFoundRecord] = useState<ActiveRecord | null>(null);
  const [feePreview, setFeePreview] = useState<FeePreview | null>(null);
  const [allRecords, setAllRecords] = useState<ActiveRecord[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutResult, setCheckoutResult] = useState<CheckOutResponse | null>(null);
  const [ownerInfo, setOwnerInfo] = useState<{ name: string | null; phone: string | null; email: string | null } | null>(null);
  const autoSearchRan = useRef(false);
  const [searchParams] = useSearchParams();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  type CheckoutPaymentOption = 'CASH' | 'STRIPE_CARD';
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<CheckoutPaymentOption>('CASH');
  const [stripeStatus, setStripeStatus] = useState<'NONE' | 'CHECKING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'>('NONE');
  const [isFeeBreakdownOpen, setIsFeeBreakdownOpen] = useState(false);
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(null);
  const [rearImageUrl, setRearImageUrl] = useState<string | null>(null);
  const [frontImgError, setFrontImgError] = useState(false);
  const [rearImgError, setRearImgError] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; label: string } | null>(null);
  const [isLegacy, setIsLegacy] = useState(false);

  // ���� Lookup Panel State ����
  // Plate fallback (collapsed by default)
  const [plateFallbackOpen, setPlateFallbackOpen] = useState(false);

  // QR section state
  const [qrError, setQrError] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const qrControlsRef = useRef<{ stop: () => void } | null>(null);

  // PIN section state
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // monthlyAccessPin is kept in state because POST /api/checkin-out/out
  // re-verifies it server-side for monthly packages
  const [monthlyAccessPin, setMonthlyAccessPin] = useState('');

  // Camera helpers
  const stopCamera = useCallback(() => {
    qrControlsRef.current?.stop();
    qrControlsRef.current = null;

    const video = videoRef.current;
    const stream = video?.srcObject;

    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    if (video) {
      video.srcObject = null;
    }

    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  // ���� Shared success handler ����
  interface ValidatedLookupResult {
    recordId: string;
    vehicleId: string;
    plate: string;
    vehicleType: 'CAR' | 'MOTORBIKE';
    checkInTime: string;
    isMonthly: boolean;
    slotCode?: string;
    now?: string;
    durationMinutes?: number;
    fee?: number;
    amountDue?: number;
    breakdown?: {
      label: string;
      minutesInBlock: number;
      lots: number;
      lotHours: number;
      rate: number;
      amount: number;
      note?: string;
    }[];
    brand?: string | null;
    model?: string | null;
    color?: string | null;
    year?: number | null;
    seats?: number | null;
    ownerName?: string | null;
    ownerPhone?: string | null;
    ownerEmail?: string | null;
    frontImageUrl?: string | null;
    rearImageUrl?: string | null;
    driverCheckInImageUrl?: string | null;
    isLegacy?: boolean;
  }

  const validateLookupResult = (
    res: CheckoutLookupResult | CheckoutLookupByPinResult
  ): ValidatedLookupResult => {
    if (
      !res.found ||
      typeof res.recordId !== 'string' || !res.recordId ||
      typeof res.vehicleId !== 'string' || !res.vehicleId ||
      typeof res.plate !== 'string' || !res.plate ||
      (res.vehicleType !== 'CAR' && res.vehicleType !== 'MOTORBIKE') ||
      typeof res.checkInTime !== 'string' || !res.checkInTime
    ) {
      throw new Error('Dữ li�!u phiên gửi xe không �ầy �ủ. Vui lòng thử lại.');
    }
    return {
      ...res,
      recordId: res.recordId,
      vehicleId: res.vehicleId,
      plate: res.plate,
      vehicleType: res.vehicleType,
      checkInTime: res.checkInTime,
      isMonthly: res.isMonthly ?? false,
    };
  };

  const onLookupSuccess = (
    result: CheckoutLookupResult | CheckoutLookupByPinResult,
    resolvedMonthlyPin?: string
  ) => {
    const validated = validateLookupResult(result);

    // Reset face comparison and payments from previous vehicle
    setFoundRecord(null);
    setFeePreview(null);
    setOwnerInfo(null);
    setFrontImageUrl(null);
    setRearImageUrl(null);
    setFrontImgError(false);
    setRearImgError(false);
    setPreviewImage(null);
    setIsLegacy(false);
    resetFaceVerification();
    setMonthlyAccessPin(resolvedMonthlyPin ?? '');
    setPlateInput(validated.plate);

    const mapped: ActiveRecord = {
      id: validated.recordId,
      vehicleId: validated.vehicleId,
      slotId: null,
      checkInTime: validated.checkInTime,
      checkOutTime: null,
      isMonthly: validated.isMonthly,
      vehicle: {
        plateNumber: validated.plate,
        type: validated.vehicleType,
        brand: validated.brand ?? null,
        model: validated.model ?? null,
        color: validated.color ?? null,
        year: validated.year ?? null,
        seats: validated.seats ?? null,
      },
      slot: validated.slotCode ? { code: validated.slotCode, floor: 0 } : null,
      floor: null,
    };

    setFoundRecord(mapped);
    setOwnerInfo({
      name: validated.ownerName ?? null,
      phone: validated.ownerPhone ?? null,
      email: validated.ownerEmail ?? null,
    });
    setFrontImageUrl(validated.frontImageUrl ?? null);
    setRearImageUrl(validated.rearImageUrl ?? null);
    setDriverCheckInImageUrl(validated.driverCheckInImageUrl ?? null);
    setIsLegacy(validated.isLegacy ?? false);

    setFeePreview({
      recordId: validated.recordId,
      plate: validated.plate,
      slotCode: validated.slotCode || 'Không c� ��9nh',
      vehicleType: validated.vehicleType,
      isMonthly: validated.isMonthly,
      checkInTime: validated.checkInTime,
      now: validated.now || new Date().toISOString(),
      durationMinutes: validated.durationMinutes || 0,
      fee: validated.fee || 0,
      amountDue: validated.amountDue || 0,
      breakdown: validated.breakdown || [],
    });
  };

  // ���� Guest QR verification ����
  const extractQrToken = (raw: string): { type: 'GUEST_TOKEN'; token: string } | { type: 'MONTHLY_PLATE'; plate: string } | { type: 'RAW_TOKEN'; token: string } | null => {
    const trimmed = raw.trim();
    // Try parse as URL
    try {
      const url = new URL(trimmed);
      const qr = url.searchParams.get('qr');
      if (qr && /^[0-9a-f]{64}$/i.test(qr)) {
        return { type: 'GUEST_TOKEN', token: qr };
      }
    } catch { /* not a URL */ }
    // Try parse as monthly QR JSON
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed.ticketType === 'MONTHLY_PASS' && typeof parsed.plateNumber === 'string' && parsed.plateNumber) {
        return { type: 'MONTHLY_PLATE', plate: parsed.plateNumber as string };
      }
    } catch { /* not JSON */ }
    // Treat raw 64-char hex as guest token
    if (/^[0-9a-f]{64}$/i.test(trimmed)) {
      return { type: 'RAW_TOKEN', token: trimmed };
    }
    return null;
  };

  const handleQrConfirm = async (rawValue: string) => {
    setQrError('');
    const parsed = extractQrToken(rawValue);
    if (!parsed) {
      setQrError('N�"i dung không phải mã QR hợp l�!. Vui lòng thử lại.');
      return;
    }
    if (parsed.type === 'MONTHLY_PLATE') {
      // Monthly QR: plate-prefill only � not credential verification
      setQrError('');
      setPlateInput(parsed.plate.toUpperCase());
      setPlateFallbackOpen(true);
      setSearchError('Mã QR xe tháng �ã �iền biỒn s�. Vui lòng dùng "Tra cứu bằng biỒn s�" bên dư�:i �Ồ xác nhận.');
      return;
    }

    setQrLoading(true);

    // Reset details to prevent stale checkout
    setFoundRecord(null);
    setFeePreview(null);
    setOwnerInfo(null);
    setFrontImageUrl(null);
    setRearImageUrl(null);
    setFrontImgError(false);
    setRearImgError(false);
    setPreviewImage(null);
    setIsLegacy(false);
    resetFaceVerification();
    setMonthlyAccessPin('');

    try {
      const guestResult = await lookupGuestVehicle(undefined, parsed.token);
      const activeRes = await api.get<{ success: boolean; data: CheckInRecord[] }>('/checkin-out/active');
      const raw = activeRes.data.data ?? [];
      const cleanPlate = guestResult.plate.replace(/[-.\s]/g, '').toUpperCase();
      const matched = raw.find((r) => {
        const p = (r.vehicle?.plateNumber || '').trim().replace(/[-.\s]/g, '').toUpperCase();
        return p === cleanPlate;
      });
      if (!matched) throw new Error('Không tìm thấy phiên gửi xe �ang hoạt ��"ng.');

      const lookup = await checkoutLookupPlate(matched.vehicle?.plateNumber || '');
      onLookupSuccess(lookup);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Mã QR không hợp l�! hoặc �ã hết hạn.';
      setQrError(msg);
    } finally {
      setQrLoading(false);
    }
  };

  // ���� Camera QR scanning ����
  const startCamera = async () => {
    setQrError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setQrError('Trình duy�!t không h�· trợ truy cập camera.');
      return;
    }

    if (!videoRef.current) {
      setQrError('Không thỒ kh�xi ��"ng camera quét QR.');
      return;
    }

    stopCamera();

    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();

      const constraints = {
        audio: false,
        video: { facingMode: { ideal: 'environment' } }
      };

      let qrHandled = false;

      const controls = await reader.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result) => {
          if (!result || qrHandled) return;
          const decodedText = result.getText();
          if (!decodedText) return;
          qrHandled = true;

          controls.stop();
          qrControlsRef.current = null;
          setCameraActive(false);

          void handleQrConfirm(decodedText);
        }
      );

      qrControlsRef.current = controls;
      setCameraActive(true);
    } catch (err: any) {
      stopCamera();

      const errName = err?.name;
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setQrError('Không có quyền sử dụng camera. Vui lòng cấp quyền camera cho trình duy�!t.');
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setQrError('Không tìm thấy camera trên thiết b�9.');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setQrError('Không thỒ m�x camera. Camera có thỒ �ang �ược ứng dụng khác sử dụng.');
      } else {
        setQrError('Không thỒ kh�xi ��"ng camera quét QR.');
      }
    }
  };

  // ���� Local QR Photo Library Select ����
  const handleQrImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    stopCamera();
    setQrError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setQrError('Ảnh mã QR ch�0 h�· trợ ��9nh dạng JPG, PNG hoặc WEBP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setQrError('Ảnh mã QR không �ược vượt quá 5 MB.');
      return;
    }

    let objectUrl = '';
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();

      objectUrl = URL.createObjectURL(file);
      const result = await reader.decodeFromImageUrl(objectUrl);
      const decodedText = result.getText();

      if (decodedText) {
        await handleQrConfirm(decodedText);
      } else {
        setQrError('Không tìm thấy mã QR trong ảnh �ã chọn.');
      }
    } catch (err) {
      setQrError('Không tìm thấy mã QR trong ảnh �ã chọn.');
    } finally {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      e.target.value = '';
    }
  };

  // ���� Unified PIN verification ����
  const handlePinConfirm = async () => {
    stopCamera();
    setPinError('');
    const pin = pinInput.trim();
    if (!/^\d{6}$/.test(pin)) {
      setPinError('Mã PIN phải g�m �úng 6 chữ s�.');
      return;
    }
    setPinLoading(true);

    // Reset details to prevent stale checkout
    setFoundRecord(null);
    setFeePreview(null);
    setOwnerInfo(null);
    setFrontImageUrl(null);
    setRearImageUrl(null);
    setFrontImgError(false);
    setRearImgError(false);
    setPreviewImage(null);
    setIsLegacy(false);
    resetFaceVerification();
    setMonthlyAccessPin('');

    try {
      const result = await lookupCheckoutByPin(pin);
      onLookupSuccess(result, result.credentialType === 'MONTHLY_PIN' ? pin : undefined);
      setPinInput('');
    } catch (err: any) {
      setPinError(err.message || 'Mã PIN không �úng hoặc �ã hết hạn.');
    } finally {
      setPinLoading(false);
    }
  };

  // ���� Full lookup panel reset ����
  const resetLookupPanel = useCallback(() => {
    stopCamera();
    setQrError('');
    setPinInput('');
    setPinError('');
    setPlateInput('');
    setSearchError('');
    setPlateFallbackOpen(false);
    setMonthlyAccessPin('');
  }, [stopCamera]);

  // ���� Face Comparison States ����
  const [driverCheckInImageUrl, setDriverCheckInImageUrl] = useState<string | null>(null);
  const [checkoutImage, setCheckoutImage] = useState<File | null>(null);
  const [checkoutImagePreview, setCheckoutImagePreview] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<FaceComparisonResult | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('IDLE');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewImage(null);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // ���� Face Verification Cleanup and Helpers ����
  const resetFaceVerification = () => {
    setDriverCheckInImageUrl(null);
    setCheckoutImage(null);
    if (checkoutImagePreview) {
      URL.revokeObjectURL(checkoutImagePreview);
      setCheckoutImagePreview(null);
    }
    setComparisonResult(null);
    setComparisonError(null);
    setIsComparing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    return () => {
      if (checkoutImagePreview) {
        URL.revokeObjectURL(checkoutImagePreview);
      }
    };
  }, [checkoutImagePreview]);

  // Lazy initialize model when record is loaded and has check-in image URL
  useEffect(() => {
    if (foundRecord && driverCheckInImageUrl) {
      if (modelStatus === 'IDLE') {
        setModelStatus('LOADING');
        initializeFaceComparison()
          .then(() => {
            setModelStatus('READY');
          })
          .catch((err) => {
            console.error('Failed to load face comparison model:', err);
            setModelStatus('ERROR');
          });
      }
    }
  }, [foundRecord, driverCheckInImageUrl]);

  const ensureModelInitialized = async (): Promise<boolean> => {
    if (modelStatus === 'READY') return true;
    setModelStatus('LOADING');
    try {
      await initializeFaceComparison();
      setModelStatus('READY');
      return true;
    } catch (err) {
      console.error('Failed to load face comparison model:', err);
      setModelStatus('ERROR');
      return false;
    }
  };

  const handleCheckoutFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setComparisonResult(null);
    setComparisonError(null);

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setComparisonError('Ảnh người nhận xe ch�0 h�· trợ ��9nh dạng JPG, PNG hoặc WEBP.');
      setCheckoutImage(null);
      if (checkoutImagePreview) {
        URL.revokeObjectURL(checkoutImagePreview);
        setCheckoutImagePreview(null);
      }
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setComparisonError('Ảnh người nhận xe không �ược vượt quá 5 MB.');
      setCheckoutImage(null);
      if (checkoutImagePreview) {
        URL.revokeObjectURL(checkoutImagePreview);
        setCheckoutImagePreview(null);
      }
      return;
    }

    if (checkoutImagePreview) {
      URL.revokeObjectURL(checkoutImagePreview);
    }
    setCheckoutImage(file);
    setCheckoutImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveCheckoutImage = () => {
    setCheckoutImage(null);
    if (checkoutImagePreview) {
      URL.revokeObjectURL(checkoutImagePreview);
      setCheckoutImagePreview(null);
    }
    setComparisonResult(null);
    setComparisonError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleComparison = async () => {
    if (!foundRecord || !driverCheckInImageUrl || !checkoutImage) return;

    setIsComparing(true);
    setComparisonError(null);
    setComparisonResult(null);

    const recordIdAtStart = foundRecord.id;
    const checkoutImageAtStart = checkoutImage;

    const startTime = performance.now();

    try {
      const initialized = await ensureModelInitialized();
      if (!initialized) {
        throw new Error('Không thỒ tải mô hình ��i chiếu. Nhân viên có thỒ tiếp tục kiỒm tra thủ công.');
      }

      let referenceImg: HTMLImageElement;
      try {
        referenceImg = await loadImageFromUrl(driverCheckInImageUrl);
      } catch (err) {
        throw new Error('Không thỒ �ọc ảnh người gửi lúc check-in.');
      }

      const referenceExtract = await extractSingleFaceEmbedding(referenceImg, true);
      if (referenceExtract.code !== 'OK' || !referenceExtract.embedding) {
        throw new Error(referenceExtract.message || 'Không thỒ tải mô hình ��i chiếu. Nhân viên vui lòng kiỒm tra thủ công.');
      }

      let checkoutImg: HTMLImageElement;
      try {
        checkoutImg = await loadImageFromFile(checkoutImage);
      } catch (err) {
        throw new Error('Không thỒ �ọc ảnh người nhận xe �ã chọn.');
      }

      const checkoutExtract = await extractSingleFaceEmbedding(checkoutImg, false);
      if (checkoutExtract.code !== 'OK' || !checkoutExtract.embedding) {
        throw new Error(checkoutExtract.message || 'Không thỒ tải mô hình ��i chiếu. Nhân viên vui lòng kiỒm tra thủ công.');
      }

      const durationMs = Math.round(performance.now() - startTime);
      const compResult = compareEmbeddings(referenceExtract.embedding, checkoutExtract.embedding, durationMs);

      if (foundRecord.id !== recordIdAtStart || checkoutImage !== checkoutImageAtStart) {
        return;
      }

      setComparisonResult(compResult);
    } catch (err: any) {
      if (foundRecord.id !== recordIdAtStart || checkoutImage !== checkoutImageAtStart) {
        return;
      }
      setComparisonError(err.message || 'Không thỒ thực hi�!n ��i chiếu khuôn mặt. Nhân viên vui lòng kiỒm tra thủ công.');
    } finally {
      if (foundRecord.id === recordIdAtStart && checkoutImage === checkoutImageAtStart) {
        setIsComparing(false);
      }
    }
  };

  // ���� Load all active records (sidebar table) ����������������������
  const [loadError, setLoadError] = useState('');

  const loadAllRecords = async () => {
    setLoadingAll(true);
    setLoadError('');
    try {
      const res = await api.get<{ success: boolean; data: CheckInRecord[] }>('/checkin-out/active');
      const raw: CheckInRecord[] = res.data.data ?? [];
      const mapped: ActiveRecord[] = raw.map((r) => ({
        id: r.id,
        vehicleId: r.vehicleId,
        slotId: r.slotId ?? null,
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        isMonthly: r.isMonthly ?? false,
        vehicle: r.vehicle ? {
          plateNumber: r.vehicle.plateNumber,
          type: r.vehicle.type,
          brand: r.vehicle.brand,
          model: r.vehicle.model,
          color: r.vehicle.color,
          year: r.vehicle.year,
          seats: r.vehicle.seats,
        } : undefined,
        slot: r.slot ? { code: r.slot.code, floor: r.slot.floorId } : null,
        floor: r.floor ? { id: r.floor.id, name: r.floor.name, floorCode: r.floor.floorCode } : null,
        allowedTier: r.allowedTier,
        bookingId: r.bookingId,
      }));
      setAllRecords(mapped);
    } catch (err: unknown) {
      setAllRecords([]);
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Không thỒ tải danh sách xe. Bạn có thỒ cần �Ēng nhập lại.';
      setLoadError(msg);
    } finally {
      setLoadingAll(false);
    }
  };

  useEffect(() => { loadAllRecords(); }, []);

  useRefreshOnFocus({ enabled: true, onRefresh: loadAllRecords });

  // ���� Stripe success polling / cancel state restoration ����
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeParam = params.get('stripe');
    const sessionId = params.get('session_id');

    if (stripeParam === 'success' && sessionId) {
      setStripeStatus('CHECKING');
      setCheckoutLoading(true);
      let attempts = 0;
      const maxAttempts = 15;

      const interval = setInterval(async () => {
        attempts++;
        try {
          const res = await getCheckoutStripeStatusBySession(sessionId);
          if (res.status === 'SUCCESS' && res.receipt) {
            clearInterval(interval);
            const savedType = localStorage.getItem('checkout_stripe_vehicle_type_' + sessionId);
            const checkoutRes: CheckOutResponse = {
              recordId: sessionId,
              paymentRequired: true,
              amountDue: res.receipt.amountDue,
              fee: res.receipt.fee,
              isMonthly: res.receipt.isMonthly,
              plate: res.receipt.plate,
              slotCode: res.receipt.slotCode ?? undefined,
              checkInTime: res.receipt.checkInTime,
              checkOutTime: res.receipt.checkOutTime,
              durationMinutes: res.receipt.durationMinutes,
              floorName: res.receipt.floorName,
              floorCode: res.receipt.floorCode,
              paymentMethod: 'CARD',
              grossParkingFee: res.receipt.grossParkingFee,
              bookingDepositPaid: res.receipt.bookingDepositPaid,
              vehicleType: savedType || undefined,
            };
            if (savedType) {
              localStorage.removeItem('checkout_stripe_vehicle_type_' + sessionId);
            }
            setCheckoutResult(checkoutRes);
            setStripeStatus('SUCCESS');
            setIsFeeBreakdownOpen(false);
            setCheckoutLoading(false);
            localStorage.removeItem('checkout_cancelled_record');
            window.history.replaceState({}, document.title, window.location.pathname);
            loadAllRecords();
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            setStripeStatus('FAILED');
            setCheckoutLoading(false);
            setCheckoutError('Xác nhận thanh toán từ Stripe quá lâu. Vui lòng kiỒm tra lại trạng thái.');
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (err: unknown) {
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            setStripeStatus('FAILED');
            setCheckoutLoading(false);
            const msg = err instanceof Error ? err.message : 'Xác nhận thanh toán thất bại.';
            setCheckoutError(msg);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      }, 2000);

      return () => clearInterval(interval);
    } else if (stripeParam === 'cancelled') {
      setStripeStatus('CANCELLED');
      setCheckoutError('Thanh toán �ã �ược hủy. Xe chưa �ược check-out.');
      window.history.replaceState({}, document.title, window.location.pathname);

      const saved = localStorage.getItem('checkout_cancelled_record');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.record) {
            setFoundRecord(parsed.record);
            if (parsed.record.vehicle) {
              setPlateInput(parsed.record.vehicle.plateNumber);
            }
            fetchFeePreview(parsed.record.id).then(setFeePreview);
            if (parsed.ownerInfo) {
              setOwnerInfo(parsed.ownerInfo);
            }
          }
        } catch (e) {
          console.error('Failed to parse cancelled record', e);
        }
        localStorage.removeItem('checkout_cancelled_record');
      }
    }
  }, []);

  // ���� Fetch fee preview from backend ��������������������������������������
  const fetchFeePreview = async (recordId: string): Promise<FeePreview | null> => {
    try {
      const res = await api.get<{ success: boolean; data: FeePreview }>(`/checkin-out/preview/${recordId}`);
      return res.data.data ?? null;
    } catch {
      return null;
    }
  };

  // ���� Auto-search if plate was passed via ?plate= ������������
  useEffect(() => {
    if (autoSearchRan.current) return;
    const incoming = searchParams.get('plate');
    if (!incoming) return;
    autoSearchRan.current = true;
    const raw = incoming.trim().toUpperCase();
    setPlateInput(raw);
    setPlateFallbackOpen(true);
    setTimeout(() => performSearch(raw), 50);
  }, []);

  // ���� Search ������������������������������������������������������������������������������������������
  const performSearch = async (plate: string) => {
    stopCamera();
    if (!plate) return;
    setIsFeeBreakdownOpen(false);
    setSearching(true);
    setSearchError('');
    setFoundRecord(null);
    setFeePreview(null);
    setOwnerInfo(null);
    setFrontImageUrl(null);
    setRearImageUrl(null);
    setFrontImgError(false);
    setRearImgError(false);
    setPreviewImage(null);
    setIsLegacy(false);
    resetFaceVerification();

    try {
      const res = await api.get<{ success: boolean; data: CheckInRecord[] }>('/checkin-out/active');
      const raw: CheckInRecord[] = res.data.data ?? [];
      const cleanInput = plate.trim().replace(/[-.\s]/g, '').toUpperCase();

      const matched = raw.find((r) => {
        const p = (r.vehicle?.plateNumber || '').trim().replace(/[-.\s]/g, '').toUpperCase();
        return p === cleanInput;
      });

      if (!matched) {
        setSearchError('Không tìm thấy xe �ang �x trong bãi.');
        setSearching(false);
        return;
      }

      const matchedVehicle = matched.vehicle as ActiveRecord['vehicle'] | undefined;
      const mapped: ActiveRecord = {
        id: matched.id,
        vehicleId: matched.vehicleId,
        slotId: matched.slotId ?? null,
        checkInTime: matched.checkInTime,
        checkOutTime: matched.checkOutTime,
        isMonthly: matched.isMonthly ?? false,
        vehicle: matchedVehicle ? {
          plateNumber: matchedVehicle.plateNumber,
          type: matchedVehicle.type,
          brand: matchedVehicle.brand,
          model: matchedVehicle.model,
          color: matchedVehicle.color,
          year: matchedVehicle.year,
          seats: matchedVehicle.seats,
        } : undefined,
        slot: matched.slot ? { code: matched.slot.code, floor: matched.slot.floorId } : null,
        floor: matched.floor ? { id: matched.floor.id, name: matched.floor.name, floorCode: matched.floor.floorCode } : null,
        allowedTier: matched.allowedTier,
        bookingId: matched.bookingId,
      };
      setFoundRecord(mapped);

      // Fetch full vehicle and owner details via checkout lookup
      try {
        const lookup = await checkoutLookupPlate(plate);
        if (lookup.found) {
          setFoundRecord((prev) => prev ? {
            ...prev,
            vehicle: prev.vehicle ? {
              ...prev.vehicle,
              brand: lookup.brand ?? prev.vehicle.brand,
              model: lookup.model ?? prev.vehicle.model,
              color: lookup.color ?? prev.vehicle.color,
              year: lookup.year ?? prev.vehicle.year,
              seats: lookup.seats ?? prev.vehicle.seats,
            } : prev.vehicle,
          } : prev);
          setOwnerInfo({
            name: lookup.ownerName ?? null,
            phone: lookup.ownerPhone ?? null,
            email: lookup.ownerEmail ?? null,
          });
          setFrontImageUrl(lookup.frontImageUrl ?? null);
          setRearImageUrl(lookup.rearImageUrl ?? null);
          setDriverCheckInImageUrl(lookup.driverCheckInImageUrl ?? null);
          setIsLegacy(lookup.isLegacy ?? false);
        } else {
          setOwnerInfo({ name: 'Walk-in Customer', phone: null, email: 'walkin@system.local' });
          setFrontImageUrl(null);
          setRearImageUrl(null);
          setDriverCheckInImageUrl(null);
          setIsLegacy(false);
        }
      } catch (err: any) {
        setOwnerInfo({ name: 'Walk-in Customer', phone: null, email: 'walkin@system.local' });
        setFrontImageUrl(null);
        setRearImageUrl(null);
        setDriverCheckInImageUrl(null);
        setIsLegacy(false);
        throw err;
      }

      // Fetch fee preview from backend
      const preview = await fetchFeePreview(mapped.id);
      setFeePreview(preview);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (err instanceof Error ? err.message : 'Không thỒ tra cứu. Vui lòng thử lại.');
      setSearchError(msg);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = () => { performSearch(plateInput.trim()); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') performSearch(plateInput.trim());
  };



  // ���� Submit check-out (for zero amount due or monthly packages) ����
  const handleConfirm = async () => {
    if (!foundRecord) return;
    setCheckoutError('');
    setCheckoutLoading(true);
    try {
      const res = await api.post('/checkin-out/out', {
        checkInRecordId: foundRecord.id,
        paymentMethod: 'CASH',
        pin: monthlyAccessPin || undefined,
      });
      const resultData = res.data.data ?? res.data;
      const checkoutRes: CheckOutResponse = {
        ...resultData,
        recordId: foundRecord.id,
        paymentRequired: false,
        bookingId: foundRecord.bookingId,
        vehicleType: foundRecord.vehicle?.type,
      };
      setCheckoutResult(checkoutRes);
      setFoundRecord(null);
      setFeePreview(null);
      setOwnerInfo(null);
      setFrontImageUrl(null);
      setRearImageUrl(null);
      setFrontImgError(false);
      setRearImgError(false);
      setPreviewImage(null);
      setIsLegacy(false);
      resetFaceVerification();
      resetLookupPanel();
      setIsFeeBreakdownOpen(false);
      loadAllRecords();

    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Check-out thất bại. Vui lòng thử lại.';
      setCheckoutError(msg);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleExecutePayment = async () => {
    if (!foundRecord || !feePreview) return;

    if (selectedPaymentOption === 'CASH') {
      setCheckoutError('');
      setCheckoutLoading(true);
      try {
        const res = await api.post('/checkin-out/out', {
          checkInRecordId: foundRecord.id,
          paymentMethod: 'CASH',
          pin: monthlyAccessPin || undefined,
        });
        const resultData = res.data.data ?? res.data;
        const checkoutRes: CheckOutResponse = {
          ...resultData,
          recordId: foundRecord.id,
          paymentRequired: true,
          bookingId: foundRecord.bookingId,
          vehicleType: foundRecord.vehicle?.type,
        };
        setCheckoutResult(checkoutRes);
        setFoundRecord(null);
        setFeePreview(null);
        setOwnerInfo(null);
        setFrontImageUrl(null);
        setRearImageUrl(null);
        setFrontImgError(false);
        setRearImgError(false);
        setPreviewImage(null);
        setIsLegacy(false);
        resetFaceVerification();
        setIsPaymentModalOpen(false);
        setIsFeeBreakdownOpen(false);
        resetLookupPanel();
        loadAllRecords();

      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? 'Check-out thất bại. Vui lòng thử lại.';
        setCheckoutError(msg);
      } finally {
        setCheckoutLoading(false);
      }
    } else {
      setCheckoutError('');
      setCheckoutLoading(true);
      try {
        const res = await createCheckoutStripeSession(foundRecord.id);
        if (res.checkoutUrl) {
          localStorage.setItem('checkout_cancelled_record', JSON.stringify({
            record: foundRecord,
            ownerInfo,
          }));
          localStorage.setItem('checkout_stripe_vehicle_type_' + res.sessionId, foundRecord.vehicle?.type || '');
          setIsFeeBreakdownOpen(false);
          window.location.href = res.checkoutUrl;
        } else {
          throw new Error('Không nhận �ược URL thanh toán từ Stripe.');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Tạo phiên thanh toán Stripe thất bại.';
        setCheckoutError(msg);
        setIsPaymentModalOpen(false);
      } finally {
        setCheckoutLoading(false);
      }
    }
  };

  // ���� Reset after success ��������������������������������������������������������������
  const handleDismissResult = () => {
    setCheckoutResult(null);
    setIsFeeBreakdownOpen(false);
    resetLookupPanel();
  };


  // ���� Dismiss found record ��������������������������������������������������������������
  const handleDismissFound = () => {
    setFoundRecord(null);
    setFeePreview(null);
    setOwnerInfo(null);
    setFrontImageUrl(null);
    setRearImageUrl(null);
    setFrontImgError(false);
    setRearImgError(false);
    setPreviewImage(null);
    setIsLegacy(false);
    resetFaceVerification();
    setIsFeeBreakdownOpen(false);
    resetLookupPanel();
  };



  return (
    <div style={{
      minHeight: '100%',
      background: '#F0F4F8',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      padding: '1.5rem',
      boxSizing: 'border-box',
    }}>

      {/* --- PAGE TITLE --- */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: C.navy }}>
          Check-out xe
        </h1>
        <p style={{ margin: '0.15rem 0 0', fontSize: '0.875rem', color: C.gray500 }}>
          Tìm xe → Thanh toán → Cho xe ra bãi
        </p>
      </div>

      {stripeStatus === 'CHECKING' && (
        <div style={{
          background: C.white,
          borderRadius: C.radius,
          boxShadow: C.shadow,
          padding: '2rem',
          marginBottom: '1.25rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: `4px solid ${C.gray200}`,
            borderTopColor: '#1E3A5F',
            animation: 'spin 1s linear infinite',
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: C.navy }}>
            Đang xác nhận thanh toán...
          </p>
          <p style={{ margin: 0, fontSize: '0.82rem', color: C.gray500 }}>
            Vui lòng đợi trong khi hệ thống xác thực giao dịch với Stripe.
          </p>
        </div>
      )}

      {/* --- TOP: Credential Lookup Panel --- */}
      <div style={{
        background: C.white,
        borderRadius: C.radius,
        boxShadow: C.shadow,
        padding: '1.25rem 1.5rem',
        marginBottom: '1.25rem',
      }}>
        {/* Panel header */}
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: C.navy }}>Xác thực phiếu gửi xe</p>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: C.gray500 }}>Ưu tiên sử dụng mã QR hoặc PIN được cấp khi check-in. Biển số chỉ dùng để tra cứu dự phòng.</p>
        </div>

        {/* SECTION 1: Quét mã QR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem', borderBottom: `1px solid ${C.gray100}`, paddingBottom: '1.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: C.navy }}>1. Quét mã QR</p>
          <p style={{ margin: 0, fontSize: '0.82rem', color: C.gray500 }}>Đưa mã QR của khách vào khung quét hoặc tải lên hình ảnh từ thư viện để xác định phiên gửi xe.</p>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => cameraActive ? stopCamera() : startCamera()}
              disabled={qrLoading}
              style={{
                padding: '0.55rem 1.1rem',
                border: `1.5px solid ${C.navy}`,
                borderRadius: 10,
                background: cameraActive ? C.redBg : '#EFF6FF',
                color: cameraActive ? C.red : C.navy,
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: qrLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {cameraActive ? 'Dừng camera' : 'Bật camera quét QR'}
            </button>

            <input
              type="file"
              id="qr-image-upload"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleQrImageSelect}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => document.getElementById('qr-image-upload')?.click()}
              style={{
                padding: '0.55rem 1.1rem',
                border: `1.5px solid ${C.gray400}`,
                borderRadius: 10,
                background: C.white,
                color: C.gray600,
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Chọn ảnh QR từ thư viện
            </button>
          </div>

          {/* Bounded Camera Preview Container (always mounted to keep videoRef active, shown only when cameraActive is true) */}
          <div style={{
            display: cameraActive ? 'block' : 'none',
            width: '100%',
            maxWidth: 360,
            height: 240,
            borderRadius: 12,
            overflow: 'hidden',
            border: `2px solid ${C.navy}`,
            background: '#000',
            position: 'relative',
            marginTop: '0.5rem',
          }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                width: 160,
                height: 160,
                border: '2.5px solid rgba(255,255,255,0.7)',
                borderRadius: 10,
                boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)',
              }} />
            </div>
          </div>

          {qrError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: C.red, fontSize: '0.82rem', fontWeight: 600 }}>
              <IconAlert size={14} color={C.red} />
              <span>{qrError}</span>
            </div>
          )}
        </div>

        {/* SECTION 2: Nhập mã PIN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: C.navy }}>2. Nhập mã PIN</p>
          <p style={{ margin: 0, fontSize: '0.82rem', color: C.gray500 }}>Nhập mã PIN 6 số được cấp khi check-in hoặc mã PIN dự phòng của vé tháng để tra cứu nhanh.</p>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pinInput}
              onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && pinInput.length === 6) handlePinConfirm(); }}
              placeholder="Nhập mã PIN 6 chữ số..."
              style={{
                flex: 1,
                padding: '0.65rem 0.85rem',
                border: `1.5px solid ${pinError ? C.redBorder : C.gray200}`,
                borderRadius: 10,
                fontSize: '0.95rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                fontFamily: 'Consolas, monospace',
                color: C.gray800,
                background: C.white,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handlePinConfirm}
              disabled={pinInput.length !== 6 || pinLoading}
              style={{
                padding: '0.65rem 1.25rem',
                background: pinInput.length === 6 && !pinLoading ? C.navy : C.gray200,
                color: pinInput.length === 6 && !pinLoading ? C.white : C.gray400,
                border: 'none',
                borderRadius: 10,
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: pinInput.length === 6 && !pinLoading ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
              }}
            >
              {pinLoading ? 'Đang xác nhận...' : 'Xác nhận mã PIN'}
            </button>
          </div>

          {pinError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: C.red, fontSize: '0.82rem', fontWeight: 600 }}>
              <IconAlert size={14} color={C.red} />
              <span>{pinError}</span>
            </div>
          )}
        </div>

        {/* --- PLATE FALLBACK BLOCK (separated, collapsed by default) --- */}
        <div style={{ marginTop: '1.25rem', borderTop: `1px solid ${C.gray200}`, paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', color: C.gray500, fontWeight: 600 }}>
              Không có mã QR hoặc PIN?
            </span>
            <button
              onClick={() => { setPlateFallbackOpen((v) => !v); setSearchError(''); }}
              style={{
                background: 'none',
                border: `1.5px solid ${C.gray200}`,
                borderRadius: 8,
                padding: '0.3rem 0.85rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: plateFallbackOpen ? C.gray500 : C.navy,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              {plateFallbackOpen ? 'Thu gọn' : 'Tra cứu bằng biển số'}
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
                style={{ transform: plateFallbackOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {plateFallbackOpen && (
            <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: C.gray500 }}>Chỉ sử dụng khi khách không có mã QR hoặc PIN.</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={plateInput}
                  onChange={(e) => {
                    setPlateInput(e.target.value.toUpperCase());
                    setSearchError('');
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhập biển số xe (VD: 51A11111)..."
                  style={{
                    flex: 1,
                    padding: '0.65rem 0.85rem',
                    border: `1.5px solid ${searchError ? C.redBorder : C.gray200}`,
                    borderRadius: 10,
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    fontFamily: "'Consolas','Courier New',monospace",
                    color: C.gray800,
                    background: C.white,
                    outline: 'none',
                    boxSizing: 'border-box',
                    letterSpacing: '0.04em',
                  }}
                />
                <button
                  onClick={handleSearch}
                  disabled={!plateInput.trim() || searching}
                  style={{
                    padding: '0.65rem 1.1rem',
                    background: plateInput.trim() && !searching ? C.navy : C.gray200,
                    color: plateInput.trim() && !searching ? C.white : C.gray400,
                    border: 'none',
                    borderRadius: 10,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: plateInput.trim() && !searching ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {searching ? 'Đang tìm...' : 'Tìm xe'}
                </button>
              </div>
              {searching && <span style={{ fontSize: '0.82rem', color: C.navy, fontWeight: 500 }}>Đang tìm xe...</span>}
              {searchError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: C.red, fontSize: '0.82rem', fontWeight: 600 }}>
                  <IconAlert size={14} color={C.red} />
                  <span>{searchError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {checkoutError && (
        <div style={{
          background: C.redBg,
          border: `1.5px solid ${C.redBorder}`,
          borderRadius: 12,
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <IconAlert size={14} color={C.red} />
          <span style={{ fontSize: '0.82rem', color: C.red }}>{checkoutError}</span>
        </div>
      )}

      {/* --- SUCCESS STATE VIEW --- */}
      {checkoutResult && (
        <div style={{
          background: C.white,
          borderRadius: C.radius,
          boxShadow: C.shadow,
          padding: '1.5rem',
          marginBottom: '1.25rem',
          borderTop: `4px solid ${C.green}`,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.25rem',
            background: C.greenBg,
            border: `1.5px solid ${C.greenBorder}`,
            borderRadius: 12,
            padding: '0.75rem 1rem',
          }}>
            <IconCheck size={22} color={C.green} />
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#166534' }}>
              Check-out thành công
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* LEFT COLUMN: Thông tin xe ra */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Thông tin xe ra
              </h4>
              {[
                { label: 'Biển số', value: checkoutResult.plate, isMono: true },
                { label: 'Loại khách', value: checkoutResult.isMonthly ? 'Khách tháng' : checkoutResult.bookingId ? 'Khách đặt trước' : 'Khách vãng lai' },
                {
                  label: 'Tầng/Khu vực',
                  value: formatReceiptLocation(checkoutResult.floorName, checkoutResult.floorCode, checkoutResult.slotCode, checkoutResult.vehicleType)
                },
                { label: 'Giờ vào', value: formatDateTime(checkoutResult.checkInTime) },
                { label: 'Giờ ra', value: formatDateTime(checkoutResult.checkOutTime) },
                {
                  label: 'Tổng thời gian gửi',
                  value: (() => {
                    const durationMins = checkoutResult.durationMinutes ?? 0;
                    const hours = Math.floor(durationMins / 60);
                    const mins = durationMins % 60;
                    return hours > 0 ? `${hours} giờ ${mins} phút` : `${mins} phút`;
                  })()
                }
              ].map((r) => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: C.gray500 }}>{r.label}</span>
                  <span style={{ fontWeight: 700, color: C.gray800, fontFamily: r.isMono ? 'Consolas, monospace' : undefined }}>{r.value}</span>
                </div>
              ))}
            </div>

            {/* RIGHT COLUMN: Biên lai thanh toán */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Biên lai thanh toán
              </h4>
              {[
                { label: 'Phí gửi xe', value: formatCurrency(checkoutResult.grossParkingFee ?? checkoutResult.fee ?? 0) },
                {
                  label: 'Cọc đặt chỗ đã được trừ',
                  value: checkoutResult.bookingDepositPaid && checkoutResult.bookingDepositPaid > 0
                    ? `- ${formatCurrency(checkoutResult.bookingDepositPaid)}`
                    : '0 đ',
                  color: checkoutResult.bookingDepositPaid && checkoutResult.bookingDepositPaid > 0 ? C.green : undefined
                },
                { label: 'Tổng đã thanh toán', value: formatCurrency(checkoutResult.amountDue ?? checkoutResult.fee ?? 0), isTotal: true },
                {
                  label: 'Phương thức thanh toán',
                  value: (() => {
                    const method = checkoutResult.paymentMethod ?? 'CASH';
                    const labels: Record<string, string> = {
                      CASH: 'Tiền mặt tại quầy',
                      CARD: 'Thẻ quốc tế qua Stripe',
                      EWALLET: 'Ví điện tử'
                    };
                    return labels[method] ?? 'Tiền mặt tại quầy';
                  })()
                }
              ].map((r) => (
                <div key={r.label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: r.isTotal ? '0.9rem' : '0.82rem',
                  fontWeight: r.isTotal ? 800 : undefined,
                  borderTop: r.isTotal ? `1px dashed ${C.gray200}` : undefined,
                  paddingTop: r.isTotal ? '0.4rem' : undefined,
                  marginTop: r.isTotal ? '0.2rem' : undefined,
                }}>
                  <span style={{ color: r.isTotal ? C.navy : C.gray500 }}>{r.label}</span>
                  <span style={{ fontWeight: 700, color: r.color ?? (r.isTotal ? C.red : C.gray800) }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleDismissResult}
            style={{
              padding: '0.7rem 1.5rem',
              background: C.green,
              color: C.white,
              border: 'none',
              borderRadius: 10,
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(22,163,74,0.2)',
            }}
          >
            Check-out xe tiếp theo
          </button>
        </div>
      )}

      {/* --- TWO COLUMN CHECKOUT DETAILS --- */}
      {foundRecord && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          marginBottom: '1.25rem',
          background: C.white,
          borderRadius: C.radius,
          boxShadow: C.shadow,
          padding: '1.5rem',
        }}>
          {/* LEFT COLUMN: Thông tin xe */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: `1px solid ${C.gray200}`, paddingRight: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: C.navy, borderBottom: `2px solid ${C.navy}`, paddingBottom: '0.4rem' }}>
              Thông tin xe
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[
                { label: 'Biển số', value: foundRecord.vehicle?.plateNumber, isMono: true },
                { label: 'Loại xe', value: foundRecord.vehicle?.type === 'MOTORBIKE' ? 'Xe máy' : 'Ô tô' },
                { label: 'Loại khách', value: foundRecord.isMonthly ? 'Khách tháng' : foundRecord.bookingId ? 'Khách đặt trước' : 'Khách vãng lai' },
                {
                  label: 'Tầng / Khu vực',
                  value: formatFloorLocation(foundRecord.floor, foundRecord.slot, foundRecord.allowedTier)
                },
                { label: 'Thời gian vào', value: formatDateTime(foundRecord.checkInTime) },
                {
                  label: 'Thời gian gửi',
                  value: (() => {
                    const durationMs = new Date().getTime() - new Date(foundRecord.checkInTime).getTime();
                    const durationMins = Math.max(0, Math.round(durationMs / 60000));
                    const hours = Math.floor(durationMins / 60);
                    const mins = durationMins % 60;
                    return hours > 0 ? `${hours} giờ ${mins} phút` : `${mins} phút`;
                  })()
                }
              ].map((r) => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: C.gray500 }}>{r.label}</span>
                  <span style={{ fontWeight: 700, color: C.gray800, fontFamily: r.isMono ? 'Consolas, monospace' : undefined }}>{r.value}</span>
                </div>
              ))}
            </div>

            {/* Extra monthly package details if monthly */}
            {foundRecord.isMonthly && (
              <div style={{
                background: C.greenBg,
                border: `1.5px solid ${C.greenBorder}`,
                borderRadius: 10,
                padding: '0.75rem 1rem',
                color: '#15803D',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}>
                <span style={{ display: 'block', marginBottom: '0.2rem' }}>✅ Xe sử dụng gói tháng đang hoạt động.</span>
                {ownerInfo && ownerInfo.name && (
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#166534' }}>
                    Chủ xe: {ownerInfo.name} ({ownerInfo.phone || 'N/A'})
                  </span>
                )}
              </div>
            )}

            {/* Ảnh khi vào bãi */}
            <div style={{ marginTop: '1.25rem', borderTop: `1px solid ${C.gray200}`, paddingTop: '1rem' }}>
              <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Ảnh khi vào bãi
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {/* Ảnh phía trước */}
                <div style={{
                  background: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.4rem',
                  minHeight: 180,
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: C.gray500 }}>Ảnh phía trước</span>
                  {isLegacy ? (
                    (!frontImageUrl || frontImgError) ? (
                      <div style={{ fontSize: '0.78rem', color: C.gray400, flex: 1, display: 'flex', alignItems: 'center' }}>Không có ảnh Check-in cũ</div>
                    ) : (
                      <img
                        src={frontImageUrl}
                        alt="Ảnh phía trước"
                        onError={() => setFrontImgError(true)}
                        onClick={() => setPreviewImage({ url: frontImageUrl, label: 'Ảnh phía trước' })}
                        style={{
                          width: '100%',
                          height: 140,
                          objectFit: 'contain',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: '#CBD5E1',
                          transition: 'transform 0.15s',
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                        onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      />
                    )
                  ) : (
                    !frontImageUrl ? (
                      <div style={{ fontSize: '0.78rem', color: C.gray400, flex: 1, display: 'flex', alignItems: 'center' }}>Không có ảnh Check-in</div>
                    ) : frontImgError ? (
                      <div style={{ fontSize: '0.78rem', color: C.red, flex: 1, display: 'flex', alignItems: 'center' }}>Không thể tải ảnh Check-in</div>
                    ) : (
                      <img
                        src={frontImageUrl}
                        alt="Ảnh phía trước"
                        onError={() => setFrontImgError(true)}
                        onClick={() => setPreviewImage({ url: frontImageUrl, label: 'Ảnh phía trước' })}
                        style={{
                          width: '100%',
                          height: 140,
                          objectFit: 'contain',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: '#CBD5E1',
                          transition: 'transform 0.15s',
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                        onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      />
                    )
                  )}
                </div>

                {/* Ảnh phía sau */}
                <div style={{
                  background: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.4rem',
                  minHeight: 180,
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: C.gray500 }}>Ảnh phía sau</span>
                  {isLegacy ? (
                    (!rearImageUrl || rearImgError) ? (
                      <div style={{ fontSize: '0.78rem', color: C.gray400, flex: 1, display: 'flex', alignItems: 'center' }}>Không có ảnh Check-in cũ</div>
                    ) : (
                      <img
                        src={rearImageUrl}
                        alt="Ảnh phía sau"
                        onError={() => setRearImgError(true)}
                        onClick={() => setPreviewImage({ url: rearImageUrl, label: 'Ảnh phía sau' })}
                        style={{
                          width: '100%',
                          height: 140,
                          objectFit: 'contain',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: '#CBD5E1',
                          transition: 'transform 0.15s',
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                        onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      />
                    )
                  ) : (
                    !rearImageUrl ? (
                      <div style={{ fontSize: '0.78rem', color: C.gray400, flex: 1, display: 'flex', alignItems: 'center' }}>Không có ảnh Check-in</div>
                    ) : rearImgError ? (
                      <div style={{ fontSize: '0.78rem', color: C.red, flex: 1, display: 'flex', alignItems: 'center' }}>Không thể tải ảnh Check-in</div>
                    ) : (
                      <img
                        src={rearImageUrl}
                        alt="Ảnh phía sau"
                        onError={() => setRearImgError(true)}
                        onClick={() => setPreviewImage({ url: rearImageUrl, label: 'Ảnh phía sau' })}
                        style={{
                          width: '100%',
                          height: 140,
                          objectFit: 'contain',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: '#CBD5E1',
                          transition: 'transform 0.15s',
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                        onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Tóm tắt thanh toán */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: C.navy, borderBottom: `2px solid ${C.navy}`, paddingBottom: '0.4rem' }}>
              Tóm tắt thanh toán
            </h3>

            {searching ? (
              <p style={{ fontSize: '0.85rem', color: C.gray500, fontStyle: 'italic' }}>Đang tính phí...</p>
            ) : feePreview ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: C.gray500 }}>Phí gửi xe</span>
                  <span style={{ fontWeight: 600, color: C.gray800 }}>{formatCurrency(feePreview.baseParkingFee ?? feePreview.fee)}</span>
                </div>

                {feePreview.bookingDepositApplied !== undefined && feePreview.bookingDepositApplied > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: C.gray500 }}>Cọc đặt chỗ đã được trừ</span>
                    <span style={{ fontWeight: 600, color: C.green }}>
                      - {formatCurrency(feePreview.bookingDepositApplied)}
                    </span>
                  </div>
                )}

                {feePreview.discountAmount !== undefined && feePreview.discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: C.gray500 }}>Giảm giá</span>
                    <span style={{ fontWeight: 600, color: C.gray800 }}>- {formatCurrency(feePreview.discountAmount)}</span>
                  </div>
                )}

                {(() => {
                  const hasBreakdown = feePreview && feePreview.breakdown && feePreview.breakdown.length > 0 && (feePreview.baseParkingFee ?? feePreview.fee) > 0;
                  if (!hasBreakdown) return null;
                  return (
                    <div style={{ margin: '0.25rem 0' }}>
                      <button
                        type="button"
                        onClick={() => setIsFeeBreakdownOpen(!isFeeBreakdownOpen)}
                        aria-expanded={isFeeBreakdownOpen}
                        aria-controls="fee-breakdown-details"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: C.navy,
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <span>{isFeeBreakdownOpen ? 'Thu gọn chi tiết' : 'Xem chi tiết cách tính phí'}</span>
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          style={{
                            transform: isFeeBreakdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                          }}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isFeeBreakdownOpen && (
                        <div
                          id="fee-breakdown-details"
                          style={{
                            marginTop: '0.5rem',
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: 8,
                            padding: '0.75rem',
                            maxHeight: 240,
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                          }}
                        >
                          <p style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', fontWeight: 800, color: C.navy, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Chi tiết tính phí
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {feePreview.breakdown.map((item, idx) => {
                              let desc = '';
                              if (item.note) {
                                desc = item.note;
                              } else {
                                const units = item.lots;
                                const rate = item.rate;
                                const amount = item.amount;
                                if (Math.abs(units * rate - amount) < 1) {
                                  const unitLabel = item.lotHours === 1 ? 'giờ' : 'lượt';
                                  desc = `${units} ${unitLabel} ở ${formatCurrency(rate)}/${unitLabel}`;
                                }
                              }

                              return (
                                <div
                                  key={idx}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    fontSize: '0.8rem',
                                    borderBottom: idx < feePreview.breakdown.length - 1 ? '1px dashed #E2E8F0' : 'none',
                                    paddingBottom: idx < feePreview.breakdown.length - 1 ? '0.4rem' : 0,
                                  }}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                    <span style={{ fontWeight: 600, color: C.gray800 }}>{item.label}</span>
                                    {desc && <span style={{ fontSize: '0.72rem', color: C.gray500, whiteSpace: 'pre-line' }}>{desc}</span>}
                                  </div>
                                  <span style={{ fontWeight: 700, color: C.gray800 }}>{formatCurrency(item.amount)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800, borderTop: `2px solid ${C.gray200}`, paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <span style={{ color: C.navy }}>Tổng cần thanh toán</span>
                  <span style={{ color: C.red }}>{formatCurrency(feePreview.amountDue ?? feePreview.fee)}</span>
                </div>

                {feePreview.totalSuccessfullyPaid !== undefined && feePreview.totalSuccessfullyPaid > 0 && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: '#F0FDF4',
                    border: '1.5px solid #BBF7D0',
                    borderRadius: 10,
                    fontSize: '0.8rem',
                    color: '#15803D',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }}>
                    <div style={{ fontWeight: 800 }}>Đã thanh toán trước: {formatCurrency(feePreview.totalSuccessfullyPaid)}</div>
                    {feePreview.graceExpiresAt && (
                      <div style={{ fontSize: '0.75rem', marginTop: 2 }}>
                        {Date.now() <= new Date(feePreview.graceExpiresAt).getTime() ? (
                          <>
                            <span style={{ fontWeight: 700 }}>Thời hạn ra bãi: </span>
                            <span style={{ color: '#16A34A', fontWeight: 800 }}>
                              {new Date(feePreview.graceExpiresAt).toLocaleTimeString('vi-VN')}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.7rem', color: '#166534', marginTop: 2 }}>
                              (Còn trong thời hạn 5 phút ân hạn)
                            </span>
                          </>
                        ) : (
                          <>
                            <span style={{ fontWeight: 700, color: C.red }}>Thời hạn ra bãi đã hết hạn: </span>
                            <span style={{ color: C.red, fontWeight: 800 }}>
                              {new Date(feePreview.graceExpiresAt).toLocaleTimeString('vi-VN')}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.7rem', color: '#991B1B', marginTop: 2 }}>
                              (Đã quá 5 phút kể từ lúc thanh toán. Cần nộp thêm phí phát sinh)
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Zero due info message */}
                {((feePreview.amountDue ?? feePreview.fee) === 0 || foundRecord.isMonthly) && (
                  <div style={{
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: 10,
                    padding: '0.65rem 0.85rem',
                    color: '#15803D',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    marginTop: '0.5rem',
                  }}>
                    Không phát sinh thêm phí cần thanh toán. Sẵn sàng ra bãi.
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  {!foundRecord.isMonthly && (feePreview.amountDue ?? feePreview.fee) > 0 ? (
                    <button
                      onClick={() => {
                        setCheckoutError('');
                        setIsPaymentModalOpen(true);
                      }}
                      disabled={checkoutLoading}
                      style={{
                        flex: 2,
                        padding: '0.75rem',
                        background: checkoutLoading ? C.gray400 : C.navy,
                        color: C.white,
                        border: 'none',
                        borderRadius: 10,
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        cursor: checkoutLoading ? 'not-allowed' : 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      Tiếp tục thanh toán
                    </button>
                  ) : (
                    <button
                      onClick={handleConfirm}
                      disabled={checkoutLoading}
                      style={{
                        flex: 2,
                        padding: '0.75rem',
                        background: checkoutLoading ? C.gray400 : C.navy,
                        color: C.white,
                        border: 'none',
                        borderRadius: 10,
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        cursor: checkoutLoading ? 'not-allowed' : 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      {checkoutLoading ? 'Đang xử lý...' : 'Xác nhận Check-out'}
                    </button>
                  )}
                  <button
                    onClick={handleDismissFound}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      background: C.white,
                      color: C.gray600,
                      border: `1px solid ${C.gray400}`,
                      borderRadius: 10,
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    Hủy bỏ
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: C.gray400, fontStyle: 'italic' }}>Đang tính toán chi tiết phí gửi xe...</p>
            )}
          </div>
        </div>
      )}

      {/* --- Face Verification Section --- */}
      {foundRecord && (
        <div style={{
          background: C.white,
          borderRadius: C.radius,
          boxShadow: C.shadow,
          padding: '1.5rem',
          marginBottom: '1.25rem',
        }}>
          {/* Header */}
          <div style={{ borderBottom: `2px solid ${C.navy}`, paddingBottom: '0.4rem', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: C.navy }}>
              Xác minh người nhận xe
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: C.gray500 }}>
              Ảnh người nhận xe được đối chiếu với ảnh người gửi đã ghi nhận khi check-in.
            </p>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: C.gray500, fontStyle: 'italic' }}>
              * Kết quả chỉ hỗ trợ nhân viên kiểm tra và không tự động quyết định việc cho xe rời bãi.
            </p>
          </div>

          {/* Model Status Bar */}
          <div style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            marginBottom: '1rem',
            color: modelStatus === 'READY' ? C.green : modelStatus === 'LOADING' ? C.navy : modelStatus === 'ERROR' ? C.red : C.gray500
          }}>
            Trạng thái mô hình: {
              modelStatus === 'READY' ? '✅ Mô hình đã sẵn sàng' :
                modelStatus === 'LOADING' ? 'Đang tải mô hình đối chiếu...' :
                  modelStatus === 'ERROR' ? 'Không thể tải mô hình đối chiếu. Nhân viên có thể tiếp tục kiểm tra thủ công.' :
                    'Chưa khởi tạo mô hình'
            }
          </div>

          {/* Image Cards Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginBottom: '1rem',
          }}>
            {/* LEFT CARD: Check-in Image */}
            <div style={{
              background: '#F1F5F9',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              boxSizing: 'border-box',
            }}>
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: C.navy }}>
                Ảnh lúc check-in
              </h4>
              <span style={{ fontSize: '0.75rem', color: C.gray500 }}>Ảnh người gửi xe</span>
              <div style={{
                flex: 1,
                minHeight: 220,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#CBD5E1',
                borderRadius: 8,
                overflow: 'hidden',
                padding: '0.25rem',
              }}>
                {driverCheckInImageUrl ? (
                  <img
                    src={driverCheckInImageUrl}
                    alt="Ảnh người gửi xe check-in"
                    onClick={() => setPreviewImage({ url: driverCheckInImageUrl, label: 'Ảnh người gửi xe check-in' })}
                    style={{
                      width: '100%',
                      height: 220,
                      objectFit: 'contain',
                      cursor: 'pointer',
                      transition: 'transform 0.15s',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                    onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  />
                ) : (
                  <span style={{ fontSize: '0.8rem', color: C.gray600, textAlign: 'center', padding: '1rem' }}>
                    Phiên gửi xe này chưa có ảnh người gửi để đối chiếu.
                  </span>
                )}
              </div>
            </div>

            {/* RIGHT CARD: Check-out Image */}
            <div style={{
              background: '#F1F5F9',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              boxSizing: 'border-box',
            }}>
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: C.navy }}>
                Ảnh lúc check-out
              </h4>
              <span style={{ fontSize: '0.75rem', color: C.gray500 }}>Ảnh người đang nhận xe</span>
              <div style={{
                flex: 1,
                minHeight: 220,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#CBD5E1',
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative',
                padding: '0.25rem',
              }}>
                {checkoutImagePreview ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                      src={checkoutImagePreview}
                      alt="Ảnh người nhận xe check-out"
                      onClick={() => setPreviewImage({ url: checkoutImagePreview, label: 'Ảnh người nhận xe check-out' })}
                      style={{
                        width: '100%',
                        height: 180,
                        objectFit: 'contain',
                        cursor: 'pointer',
                        transition: 'transform 0.15s',
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                      onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    />
                    <div style={{ fontSize: '0.7rem', color: C.gray800, marginTop: '0.4rem', textAlign: 'center', wordBreak: 'break-all', padding: '0 0.5rem' }}>
                      {checkoutImage?.name} ({(checkoutImage ? checkoutImage.size / 1024 / 1024 : 0).toFixed(2)} MB)
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: C.gray600, textAlign: 'center', padding: '1rem' }}>
                    Chưa có ảnh người nhận xe
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleCheckoutFileChange}
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                />
                {!checkoutImage ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      flex: 1,
                      padding: '0.55rem',
                      background: C.navy,
                      color: C.white,
                      border: 'none',
                      borderRadius: 8,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Chọn ảnh từ thư viện
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        flex: 1,
                        padding: '0.55rem',
                        background: '#EFF6FF',
                        color: C.navy,
                        border: `1.5px solid ${C.navy}`,
                        borderRadius: 8,
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Chọn lại
                    </button>
                    <button
                      onClick={handleRemoveCheckoutImage}
                      style={{
                        flex: 1,
                        padding: '0.55rem',
                        background: C.redBg,
                        color: C.red,
                        border: `1.5px solid ${C.redBorder}`,
                        borderRadius: 8,
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Xóa ảnh
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Trigger and Comparison Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', borderTop: `1px solid ${C.gray200}`, paddingTop: '1rem' }}>
            <button
              onClick={handleComparison}
              disabled={!foundRecord || !driverCheckInImageUrl || !checkoutImage || isComparing}
              style={{
                alignSelf: 'flex-start',
                padding: '0.65rem 1.5rem',
                background: (!foundRecord || !driverCheckInImageUrl || !checkoutImage || isComparing) ? C.gray200 : C.navy,
                color: (!foundRecord || !driverCheckInImageUrl || !checkoutImage || isComparing) ? C.gray400 : C.white,
                border: 'none',
                borderRadius: 8,
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: (!foundRecord || !driverCheckInImageUrl || !checkoutImage || isComparing) ? 'not-allowed' : 'pointer',
              }}
            >
              {isComparing ? 'Đang đối chiếu...' : 'So sánh khuôn mặt'}
            </button>

            {comparisonError && (
              <div style={{
                background: C.redBg,
                border: `1.5px solid ${C.redBorder}`,
                borderRadius: 8,
                padding: '0.75rem 1rem',
                fontSize: '0.82rem',
                color: C.red,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <IconAlert size={14} color={C.red} />
                <span>{comparisonError}</span>
              </div>
            )}

            {comparisonResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {comparisonResult.status === 'MATCHED' && (
                  <div style={{
                    background: C.greenBg,
                    border: `1.5px solid ${C.greenBorder}`,
                    borderRadius: 8,
                    padding: '0.75rem 1rem',
                    color: '#166534',
                  }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <IconCheck size={18} color={C.green} />
                      ✅ Hai ảnh có độ tương đồng cao
                    </div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.2rem', fontWeight: 700 }}>
                      Độ tương đồng: {(comparisonResult.similarity * 100).toFixed(2)}%
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                      Kết quả phù hợp để nhân viên tiếp tục kiểm tra nghiệp vụ.
                    </div>
                  </div>
                )}

                {comparisonResult.status === 'REVIEW_REQUIRED' && (
                  <div style={{
                    background: '#FEF3C7',
                    border: '1.5px solid #FCD34D',
                    borderRadius: 8,
                    padding: '0.75rem 1rem',
                    color: '#92400E',
                  }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <IconAlert size={18} color="#D97706" />
                      ⚠️ Kết quả chưa đủ chắc chắn
                    </div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.2rem', fontWeight: 700 }}>
                      Độ tương đồng: {(comparisonResult.similarity * 100).toFixed(2)}%
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                      Nhân viên nên kiểm tra lại ảnh, biển số, QR/PIN và thông tin phiên gửi xe.
                    </div>
                  </div>
                )}

                {comparisonResult.status === 'NOT_MATCHED' && (
                  <div style={{
                    background: C.redBg,
                    border: `1.5px solid ${C.redBorder}`,
                    borderRadius: 8,
                    padding: '0.75rem 1rem',
                    color: '#991B1B',
                  }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <IconAlert size={18} color={C.red} />
                      ⚠️ Hai khuôn mặt có độ tương đồng thấp
                    </div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.2rem', fontWeight: 700 }}>
                      Độ tương đồng: {(comparisonResult.similarity * 100).toFixed(2)}%
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                      Đây chỉ là cảnh báo hỗ trợ. Nhân viên cần kiểm tra kỹ trước khi cho xe rời bãi.
                    </div>
                  </div>
                )}

                <div style={{ fontSize: '0.75rem', color: C.gray500, fontStyle: 'italic', paddingLeft: '0.5rem' }}>
                  Thời gian xử lý: {comparisonResult.processingTimeMs} ms
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- BOTTOM: all parked vehicles --- */}
      <div style={{
        background: C.white,
        borderRadius: C.radius,
        boxShadow: C.shadow,
        padding: '1.25rem 1.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: C.gray800 }}>
            Xe đang đỗ trong bãi
          </p>
          <button
            onClick={loadAllRecords}
            disabled={loadingAll}
            style={{
              background: 'none',
              border: `1.5px solid ${C.gray200}`,
              borderRadius: 8,
              padding: '0.35rem 0.85rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: C.gray500,
              cursor: 'pointer',
            }}
          >
            {loadingAll ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>

        {loadError && (
          <div style={{
            background: C.redBg,
            border: `1.5px solid ${C.redBorder}`,
            borderRadius: 8,
            padding: '0.6rem 0.85rem',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <IconAlert size={14} color={C.red} />
            <span style={{ fontSize: '0.82rem', color: C.red }}>{loadError}</span>
          </div>
        )}

        {loadingAll ? (
          <p style={{ margin: 0, padding: '1rem 0', fontSize: '0.875rem', color: C.gray400, textAlign: 'center' }}>
            Đang tải...
          </p>
        ) : allRecords.length === 0 ? (
          <p style={{ margin: 0, padding: '1rem 0', fontSize: '0.875rem', color: C.gray400, textAlign: 'center' }}>
            Hiện không có xe nào đang đỗ trong bãi.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.gray200}` }}>
                  {['Biển số', 'Tầng / Khu vực', 'Giờ vào', 'Thời gian gửi', 'Loại xe', 'Loại khách', 'Thao tác'].map((col) => (
                    <th key={col} style={{
                      padding: '0.6rem 0.75rem',
                      textAlign: 'left',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: C.gray400,
                      background: C.gray100,
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allRecords.map((r) => {
                  if (!r.vehicle) return null;
                  const locationText = formatFloorLocation(r.floor, r.slot, r.allowedTier);
                  const durationMs = new Date().getTime() - new Date(r.checkInTime).getTime();
                  const durationMins = Math.max(0, Math.round(durationMs / 60000));
                  const hours = Math.floor(durationMins / 60);
                  const mins = durationMins % 60;
                  const durationText = hours > 0 ? `${hours} giờ ${mins} phút` : `${mins} phút`;

                  const customerLabel = r.isMonthly ? 'Khách tháng' : r.bookingId ? 'Khách đặt trước' : 'Khách vãng lai';

                  return (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'Consolas, monospace', fontWeight: 700, color: C.navy, letterSpacing: '0.02em' }}>
                        {r.vehicle.plateNumber}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.82rem', color: C.gray800 }}>
                        {locationText}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.82rem', color: C.gray600 }}>
                        {formatDateTime(r.checkInTime)}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.82rem', color: C.gray600 }}>
                        {durationText}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.55rem',
                          borderRadius: 20,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: r.vehicle?.type === 'MOTORBIKE' ? '#FEF9C3' : '#EFF6FF',
                          color: r.vehicle?.type === 'MOTORBIKE' ? '#854D0E' : C.navy,
                        }}>
                          {r.vehicle?.type === 'MOTORBIKE' ? 'Xe máy' : 'Ô tô'}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.55rem',
                          borderRadius: 20,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: r.isMonthly ? C.greenBg : r.bookingId ? '#FEF3C7' : '#EFF6FF',
                          color: r.isMonthly ? '#15803D' : r.bookingId ? '#D97706' : C.navy,
                        }}>
                          {customerLabel}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            onClick={async () => {
                              const v = r.vehicle;
                              if (!v) return;
                              setFoundRecord(r);
                              setPlateInput(v.plateNumber);
                              fetchFeePreview(r.id).then(setFeePreview);
                              setFrontImageUrl(null);
                              setRearImageUrl(null);
                              setFrontImgError(false);
                              setRearImgError(false);
                              setPreviewImage(null);
                              setIsLegacy(false);
                              resetFaceVerification();
                              try {
                                const lookup = await checkoutLookupPlate(v.plateNumber);
                                if (lookup.found) {
                                  setFoundRecord((prev) => prev ? {
                                    ...prev,
                                    vehicle: prev.vehicle ? {
                                      ...prev.vehicle,
                                      brand: lookup.brand ?? prev.vehicle.brand,
                                      model: lookup.model ?? prev.vehicle.model,
                                      color: lookup.color ?? prev.vehicle.color,
                                      year: lookup.year ?? prev.vehicle.year,
                                      seats: lookup.seats ?? prev.vehicle.seats,
                                    } : prev.vehicle,
                                  } : prev);
                                  setOwnerInfo({
                                    name: lookup.ownerName ?? null,
                                    phone: lookup.ownerPhone ?? null,
                                    email: lookup.ownerEmail ?? null,
                                  });
                                  setFrontImageUrl(lookup.frontImageUrl ?? null);
                                  setRearImageUrl(lookup.rearImageUrl ?? null);
                                  setDriverCheckInImageUrl(lookup.driverCheckInImageUrl ?? null);
                                  setIsLegacy(lookup.isLegacy ?? false);
                                } else {
                                  setOwnerInfo({ name: 'Walk-in Customer', phone: null, email: 'walkin@system.local' });
                                  setFrontImageUrl(null);
                                  setRearImageUrl(null);
                                  setDriverCheckInImageUrl(null);
                                  setIsLegacy(false);
                                }
                              } catch {
                                setOwnerInfo({ name: 'Walk-in Customer', phone: null, email: 'walkin@system.local' });
                                setFrontImageUrl(null);
                                setRearImageUrl(null);
                                setDriverCheckInImageUrl(null);
                                setIsLegacy(false);
                              }
                            }}
                            style={{
                              background: C.navy,
                              color: C.white,
                              border: 'none',
                              borderRadius: 8,
                              padding: '0.35rem 0.85rem',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Xử lý
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>



      {/* --- PAYMENT MODAL --- */}
      {isPaymentModalOpen && foundRecord && feePreview && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)',
          padding: '1rem',
          boxSizing: 'border-box',
        }}>
          <div style={{
            background: C.white,
            borderRadius: 24,
            width: '100%',
            maxWidth: 520,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{
              background: '#1E3A5F',
              padding: '1.25rem 1.5rem',
              color: C.white,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Thanh toán phí gửi xe</h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.white,
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.8,
                }}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Compact summary */}
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 16,
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: C.gray500 }}>Biển số</span>
                  <span style={{ fontWeight: 700, color: C.navy, fontFamily: 'Consolas, monospace' }}>{foundRecord.vehicle?.plateNumber}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: C.gray500 }}>Tầng / Khu vực</span>
                  <span style={{ fontWeight: 600, color: C.gray800 }}>
                    {formatFloorLocation(foundRecord.floor, foundRecord.slot, foundRecord.allowedTier)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: C.gray500 }}>Thời gian gửi</span>
                  <span style={{ fontWeight: 600, color: C.gray800 }}>
                    {(() => {
                      const durationMs = new Date().getTime() - new Date(foundRecord.checkInTime).getTime();
                      const durationMins = Math.max(0, Math.round(durationMs / 60000));
                      const hours = Math.floor(durationMins / 60);
                      const mins = durationMins % 60;
                      return hours > 0 ? `${hours} giờ ${mins} phút` : `${mins} phút`;
                    })()}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1rem',
                  fontWeight: 800,
                  borderTop: '1px dashed #E2E8F0',
                  paddingTop: '0.5rem',
                  marginTop: '0.25rem',
                }}>
                  <span style={{ color: C.navy }}>Tổng cần thanh toán</span>
                  <span style={{ color: C.red }}>{formatCurrency(feePreview.amountDue ?? feePreview.fee)}</span>
                </div>
              </div>

              {/* Selection */}
              <div>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', fontWeight: 700, color: C.gray600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Chọn phương thức thanh toán
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* OPTION 1: Tiền mặt */}
                  <button
                    onClick={() => setSelectedPaymentOption('CASH')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1.15rem 1.25rem',
                      borderRadius: 16,
                      background: C.white,
                      border: `2px solid ${selectedPaymentOption === 'CASH' ? '#1E3A5F' : '#E2E8F0'}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: selectedPaymentOption === 'CASH' ? '#E0F2FE' : '#F1F5F9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: selectedPaymentOption === 'CASH' ? '#0284C7' : C.gray500,
                    }}>
                      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="6" width="20" height="12" rx="2" />
                        <circle cx="12" cy="12" r="3" />
                        <path d="M6 12h.01M18 12h.01" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: C.gray800 }}>Tiền mặt tại quầy</p>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: C.gray500 }}>Nhân viên xác nhận sau khi đã nhận đủ tiền</p>
                    </div>
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: `2px solid ${selectedPaymentOption === 'CASH' ? '#1E3A5F' : '#CBD5E1'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                    }}>
                      {selectedPaymentOption === 'CASH' && (
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1E3A5F' }} />
                      )}
                    </div>
                  </button>

                  {/* OPTION 2: Stripe CARD */}
                  <button
                    onClick={() => setSelectedPaymentOption('STRIPE_CARD')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1.15rem 1.25rem',
                      borderRadius: 16,
                      background: C.white,
                      border: `2px solid ${selectedPaymentOption === 'STRIPE_CARD' ? '#1E3A5F' : '#E2E8F0'}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: selectedPaymentOption === 'STRIPE_CARD' ? '#E0F2FE' : '#F1F5F9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: selectedPaymentOption === 'STRIPE_CARD' ? '#0284C7' : C.gray500,
                    }}>
                      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: C.gray800 }}>Thẻ quốc tế qua Stripe</p>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: C.gray500 }}>Visa / Mastercard / JCB</p>
                    </div>
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: `2px solid ${selectedPaymentOption === 'STRIPE_CARD' ? '#1E3A5F' : '#CBD5E1'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxSizing: 'border-box',
                    }}>
                      {selectedPaymentOption === 'STRIPE_CARD' && (
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1E3A5F' }} />
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  disabled={checkoutLoading}
                  style={{
                    flex: 1,
                    padding: '0.85rem',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: 14,
                    background: C.white,
                    color: C.gray600,
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: checkoutLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleExecutePayment}
                  disabled={checkoutLoading}
                  style={{
                    flex: 1.5,
                    padding: '0.85rem',
                    border: 'none',
                    borderRadius: 14,
                    background: checkoutLoading ? C.gray400 : '#1E3A5F',
                    color: C.white,
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: checkoutLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(30,58,95,0.15)',
                  }}
                >
                  {checkoutLoading ? 'Đang xử lý...' : (selectedPaymentOption === 'CASH' ? 'Xác nhận đã nhận tiền' : 'Thanh toán qua Stripe')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Evidence Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.white,
              borderRadius: 16,
              padding: '1.25rem',
              maxWidth: '90%',
              maxHeight: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: '#F1F5F9',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: C.gray600,
                transition: 'background 0.15s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#E2E8F0')}
              onMouseOut={(e) => (e.currentTarget.style.background = '#F1F5F9')}
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: C.navy, alignSelf: 'flex-start', paddingRight: '2rem' }}>
              {previewImage.label}
            </span>

            <img
              src={previewImage.url}
              alt={previewImage.label}
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: 8,
                background: '#CBD5E1',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
