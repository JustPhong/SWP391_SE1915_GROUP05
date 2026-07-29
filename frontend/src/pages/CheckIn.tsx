import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  lookupPlate,
  submitCheckIn,
  runOcrApi,
  type LookupResult,
  type CheckinSubmitResult,
} from '../api/checkinApi';
import { normalizePlateForLookup, validatePlate } from '../utils/plate';

// ═════════════════════════════════════════════════════
//  DESIGN TOKENS
// ═════════════════════════════════════════════════════
const C = {
  navy: '#0B2F6B',
  navyLight: '#153B75',
  activeBlue: '#1F5EFF',
  bg: '#F5F8FE',
  white: '#FFFFFF',
  green: '#16A34A',
  greenBg: '#EFFAF2',
  greenBorder: '#BBF7D0',
  yellow: '#D97706',
  yellowBg: '#FEF3C3',
  yellowBorder: '#FDE68A',
  red: '#DC2626',
  redBg: '#FEE2E2',
  redBorder: '#FECACA',
  orange: '#EA580C',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E3EAF5',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray800: '#10264F',
  border: '#E3EAF5',
  cardShadow: '0 1px 3px rgba(11,47,107,0.04), 0 6px 18px rgba(11,47,107,0.06)',
};

// ═════════════════════════════════════════════════════
//  TYPES
// ═════════════════════════════════════════════════════
type VehicleType = 'CAR' | 'MOTORBIKE';
type OcrStatus = 'idle' | 'processing' | 'success' | 'low_confidence' | 'manually_edited' | 'failed';



// ─── Step index 1-4 ─────────────────────────────────
//  1 = Chọn loại xe
//  2 = Chụp và nhận diện biển số
//  3 = Kiểm tra thông tin
//  4 = Xác nhận check-in (uses confirm button in right panel)

const STEP_LABELS = [
  'Chọn loại xe',
  'Chụp và nhận diện biển số',
  'Kiểm tra thông tin',
  'Xác nhận check-in',
];

// ═════════════════════════════════════════════════════
//  UTILITY HELPERS
// ═════════════════════════════════════════════════════
const formatDateTime = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatVND = (amount: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const timeUntil = (iso: string): string => {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Đã hết hạn';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m} phút`;
};

// ═════════════════════════════════════════════════════
//  ICONS
// ═════════════════════════════════════════════════════
function IconCar({ size = 48 }: { size?: number }) {
  return <span style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-block' }}>🚗</span>;
}
function IconMoto({ size = 48 }: { size?: number }) {
  return <span style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-block' }}>🛵</span>;
}
function IconCheck({ size = 14, color = C.green }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconX({ size = 14, color = C.red }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
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
function IconCamera({ size = 32, color = '#94A3B8' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function IconSearch({ size = 16, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IconRefresh({ size = 16, color = C.gray800 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}
function IconChevronRight({ size = 16, color = C.gray400 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ═════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═════════════════════════════════════════════════════

function Card({
  title,
  children,
  style,
  accent,
}: {
  title?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  accent?: string;
}) {
  return (
    <div style={{
      background: C.white,
      borderRadius: 16,
      boxShadow: C.cardShadow,
      border: `1px solid ${accent ?? C.border}`,
      padding: '1.25rem 1.5rem',
      ...style,
    }}>
      {title && (
        <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', fontWeight: 800, color: C.navy, letterSpacing: '0.01em' }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function AlertBanner({
  type,
  children,
}: {
  type: 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
}) {
  const map = {
    success: { bg: C.greenBg, border: C.greenBorder, color: '#15803D' },
    warning: { bg: C.yellowBg, border: C.yellowBorder, color: '#92400E' },
    error: { bg: C.redBg, border: C.redBorder, color: '#991B1B' },
    info: { bg: '#EFF6FF', border: '#BFDBFE', color: C.navy },
  };
  const s = map[type];
  return (
    <div style={{
      background: s.bg,
      border: `1.5px solid ${s.border}`,
      borderRadius: 10,
      padding: '0.6rem 0.85rem',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.5rem',
    }}>
      <span style={{ flexShrink: 0, marginTop: 2 }}>
        {type === 'success' ? <IconCheck size={14} color={s.color} />
          : <IconAlert size={14} color={type === 'warning' ? C.yellow : s.color} />}
      </span>
      <span style={{ color: s.color, fontSize: '0.8rem', lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.45rem 0',
      borderBottom: `1px solid ${C.gray100}`,
    }}>
      <span style={{ fontSize: '0.78rem', color: C.gray500 }}>{label}</span>
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: valueColor ?? C.gray800, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

// ─── 4-step progress indicator ─────────────────────────────────────────────
function ProgressIndicator({ step }: { step: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginBottom: '1.5rem',
      overflowX: 'auto',
      paddingBottom: 4,
    }}>
      {STEP_LABELS.map((label, i) => {
        const active = i + 1 === step;
        const done = i + 1 < step;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: done ? C.navy : active ? C.activeBlue : '#EFF6FF',
              color: done || active ? '#fff' : '#64748B',
              fontSize: '0.72rem',
              fontWeight: 800,
              border: `2px solid ${done ? C.navy : active ? C.activeBlue : '#E3EAF5'}`,
              flexShrink: 0,
            }}>
              {done ? <IconCheck size={13} color="#fff" /> : i + 1}
            </div>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: active ? C.navy : done ? C.navyLight : '#64748B',
              whiteSpace: 'nowrap',
            }}>{label}</span>
            {i < STEP_LABELS.length - 1 && (
              <div style={{ width: 20, height: 2, background: done ? C.navy : '#E3EAF5', borderRadius: 2, flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Image capture box ─────────────────────────────────────────────────────
function CaptureBox({
  label,
  hint,
  preview,
  onCamera,
  onLibrary,
  onRemove,
  cameraRef,
  libraryRef,
  onCameraChange,
  onLibraryChange,
  ocrBadge,
}: {
  label: string;
  hint?: string;
  preview: string | null;
  onCamera: () => void;
  onLibrary: () => void;
  onRemove: () => void;
  cameraRef: React.RefObject<HTMLInputElement>;
  libraryRef: React.RefObject<HTMLInputElement>;
  onCameraChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLibraryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  ocrBadge?: React.ReactNode;
}) {
  return (
    <div 
      className="capture-card-outer"
      style={{
        border: `1.5px solid ${preview ? C.navy : C.gray200}`,
        borderRadius: 14,
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        background: preview ? '#F0F8FF' : '#FAFBFF',
      }}
    >
      <div 
        className="capture-preview-wrapper"
        style={{
          width: '100%',
          border: `1.5px dashed ${preview ? C.navy : C.gray200}`,
          borderRadius: 10,
          background: preview ? '#F1F5F9' : '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt={label}
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'contain', 
                objectPosition: 'center', 
                position: 'absolute', 
                top: 0, 
                left: 0 
              }}
            />
            <button
              onClick={onRemove}
              style={{
                position: 'absolute', top: 6, right: 6,
                background: C.white, border: `1.5px solid ${C.red}`,
                borderRadius: '50%', width: 26, height: 26,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10,
              }}
              title="Xóa ảnh"
            >
              <IconX size={12} color={C.red} />
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <IconCamera size={28} color="#94A3B8" />
            {hint && <p style={{ margin: '0.4rem 0 0', fontSize: '0.65rem', color: C.gray400, maxWidth: 140, lineHeight: 1.4 }}>{hint}</p>}
          </div>
        )}
      </div>

      <div style={{ fontWeight: 700, color: C.gray800, fontSize: '0.8rem', textAlign: 'center' }}>
        {label}
      </div>

      {ocrBadge && <div style={{ width: '100%' }}>{ocrBadge}</div>}

      <div style={{ display: 'flex', gap: 6, width: '100%', marginTop: 'auto' }}>
        <button
          onClick={onCamera}
          style={{
            flex: 1, padding: '0.45rem 0.4rem', borderRadius: 8,
            border: `1.5px solid ${C.navy}`,
            background: preview ? C.gray100 : C.navy,
            color: preview ? C.gray800 : C.white,
            fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          📷 Chụp
        </button>
        <button
          onClick={onLibrary}
          style={{
            flex: 1, padding: '0.45rem 0.4rem', borderRadius: 8,
            border: `1.5px solid ${C.navy}`,
            background: preview ? C.gray100 : C.white,
            color: preview ? C.gray800 : C.navy,
            fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          🖼️ Thư viện
        </button>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onCameraChange} />
      <input ref={libraryRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onLibraryChange} />
    </div>
  );
}

function SharedOcrStatusPanel({ status, plate }: { status: OcrStatus; plate: string }) {
  if (status === 'idle') return null;

  let title = '';
  let supportText = '';
  let bgColor = C.gray50;
  let borderColor = C.border;
  let color = C.gray800;

  if (status === 'processing') {
    title = 'Đang nhận diện biển số...';
    bgColor = '#EFF6FF'; // light blue
    borderColor = '#BFDBFE';
    color = '#1D4ED8';
  } else if (status === 'manually_edited') {
    title = 'Đã hiệu chỉnh biển số';
    supportText = 'Vui lòng nhấn Tra cứu để xác minh.';
    bgColor = C.yellowBg;
    borderColor = C.yellowBorder;
    color = C.yellow;
  } else if (status === 'low_confidence') {
    title = 'Đã nhận diện biển số';
    supportText = 'Vui lòng kiểm tra và nhấn Tra cứu.';
    bgColor = C.yellowBg;
    borderColor = C.yellowBorder;
    color = C.yellow;
  } else if (status === 'success') {
    title = 'Đã xác minh biển số';
    bgColor = C.greenBg;
    borderColor = C.greenBorder;
    color = C.green;
  } else if (status === 'failed') {
    title = 'Không nhận diện được biển số. Vui lòng chụp lại rõ hơn hoặc nhập thủ công.';
    bgColor = C.redBg;
    borderColor = C.redBorder;
    color = C.red;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      background: bgColor,
      border: `1.5px solid ${borderColor}`,
      borderRadius: 10,
      padding: '0.65rem 0.85rem',
      color: color,
      fontSize: '0.82rem',
      fontWeight: 700,
      marginTop: 10,
      width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{title}</span>
      </div>
      {supportText && (
        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: C.gray500, marginTop: 1 }}>
          {supportText}
        </div>
      )}
      {status !== 'processing' && plate && status !== 'failed' && (
        <div style={{ fontSize: '1.1rem', fontFamily: "'Consolas','Courier New',monospace", letterSpacing: '0.04em', marginTop: 2 }}>
          {plate}
        </div>
      )}
    </div>
  );
}





// ─── Customer type badge ───────────────────────────────────────────────────
function CustomerBadge({ type }: { type: 'booking' | 'monthly' | 'casual' | 'unknown' }) {
  const map = {
    booking: { bg: '#EFF6FF', border: '#BFDBFE', color: C.navy, label: 'CÓ ĐẶT CHỖ TRƯỚC' },
    monthly: { bg: C.greenBg, border: C.greenBorder, color: '#15803D', label: 'KHÁCH THÁNG' },
    casual: { bg: '#F1F5F9', border: C.gray200, color: C.gray800, label: 'KHÁCH VÃN LAI' },
    unknown: { bg: '#F1F5F9', border: C.gray200, color: C.gray500, label: 'CHƯA XÁC ĐỊNH' },
  };
  const s = map[type];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.bg, border: `1.5px solid ${s.border}`,
      borderRadius: 20, padding: '0.25rem 0.7rem',
    }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: s.color }}>{s.label}</span>
    </span>
  );
}

// ═════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════
export function CheckInPage() {

  // ── Step & vehicle type ────────────────────────────────────────────────
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);

  // ── Image state ────────────────────────────────────────────────────────
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [rearImage, setRearImage] = useState<File | null>(null);
  const [rearPreview, setRearPreview] = useState<string | null>(null);
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(null);
  const [rearImageUrl, setRearImageUrl] = useState<string | null>(null);

  const frontCameraRef = useRef<HTMLInputElement>(null);
  const frontLibraryRef = useRef<HTMLInputElement>(null);
  const rearCameraRef = useRef<HTMLInputElement>(null);
  const rearLibraryRef = useRef<HTMLInputElement>(null);

  // ── OCR state ─────────────────────────────────────────────────────────
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  const [ocrAttempted, setOcrAttempted] = useState(false);

  // ── Plate / lookup ─────────────────────────────────────────────────────
  const [plateInput, setPlateInput] = useState('');
  const [plateSource, setPlateSource] = useState<'front' | 'rear' | 'combined' | 'manual'>('manual');
  const [lookupData, setLookupData] = useState<LookupResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [vehicleTypeMismatch, setVehicleTypeMismatch] = useState(false);

  // ── Submit ──────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<CheckinSubmitResult | null>(null);

  // ── Errors ─────────────────────────────────────────────────────────────
  const [apiError, setApiError] = useState('');

  // ── URL params (auto-lookup) ────────────────────────────────────────────
  const [searchParams] = useSearchParams();
  const autoLookupRan = useRef(false);

  const ocrAbortControllerRef = useRef<AbortController | null>(null);
  const ocrRequestIdRef = useRef<number>(0);

  // Abort ongoing OCR request on unmount
  useEffect(() => {
    return () => {
      if (ocrAbortControllerRef.current) {
        ocrAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Auto-lookup from ?plate= URL param
  if (!autoLookupRan.current && searchParams.get('plate')) {
    autoLookupRan.current = true;
    const raw = searchParams.get('plate') ?? '';
    if (raw) {
      setPlateInput(raw.toUpperCase());
      setVehicleType('CAR');
    }
  }

  // ═════════════════════════════════════════════════════
  //  HANDLERS — vehicle type
  // ═════════════════════════════════════════════════════
  const handleSelectVehicleType = (t: VehicleType) => {
    if (vehicleType === t) return;

    if (ocrAbortControllerRef.current) {
      ocrAbortControllerRef.current.abort();
      ocrAbortControllerRef.current = null;
    }

    // Clear all downstream state
    setVehicleType(t);
    setFrontImage(null);
    setRearImage(null);
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (rearPreview) URL.revokeObjectURL(rearPreview);
    setFrontPreview(null);
    setRearPreview(null);
    setOcrStatus('idle');
    setOcrAttempted(false);
    setPlateInput('');
    setPlateSource('manual');
    setLookupData(null);
    setVehicleTypeMismatch(false);
    setApiError('');
  };

  // ═════════════════════════════════════════════════════
  //  HANDLERS — image capture
  // ═════════════════════════════════════════════════════
  const handleImageSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setImage: (f: File | null) => void,
    setPreview: (url: string | null) => void,
    currentPreview: string | null,
    side: 'front' | 'rear'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (currentPreview) URL.revokeObjectURL(currentPreview);
    setImage(file);
    setPreview(URL.createObjectURL(file));
    e.target.value = '';
    // Clear OCR and URL for this side
    if (side === 'front') {
      setFrontImageUrl(null);
    } else {
      setRearImageUrl(null);
      setLookupData(null);
      setOcrAttempted(false);
    }
    setOcrStatus('idle');
  };

  const handleRemoveFront = () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    setFrontImage(null);
    setFrontPreview(null);
    setFrontImageUrl(null);
    setOcrStatus('idle');
    if (ocrAbortControllerRef.current) {
      ocrAbortControllerRef.current.abort();
      ocrAbortControllerRef.current = null;
    }
  };
  const handleRemoveRear = () => {
    if (rearPreview) URL.revokeObjectURL(rearPreview);
    setRearImage(null);
    setRearPreview(null);
    setRearImageUrl(null);
    setLookupData(null);
    setOcrStatus('idle');
    setOcrAttempted(false);
    if (ocrAbortControllerRef.current) {
      ocrAbortControllerRef.current.abort();
      ocrAbortControllerRef.current = null;
    }
  };

  const runOCR = async () => {
    if (!vehicleType || !rearImage) return;

    // 1. Abort previous request if any
    if (ocrAbortControllerRef.current) {
      ocrAbortControllerRef.current.abort();
    }

    // 2. Create new controller and increment request ID
    const controller = new AbortController();
    ocrAbortControllerRef.current = controller;

    const currentRequestId = ocrRequestIdRef.current + 1;
    ocrRequestIdRef.current = currentRequestId;

    setOcrStatus('processing');
    setApiError('');

    try {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[OCR request fields]', {
          fileField: 'image',
          fileName: rearImage.name,
          vehicleType
        });
      }
      const result = await runOcrApi(rearImage, vehicleType, controller.signal);

      // Check if stale
      if (ocrRequestIdRef.current !== currentRequestId) {
        return;
      }

      setRearImageUrl(result.imageUrl);
      setPlateInput(result.plateNumber.toUpperCase());
      setPlateSource('rear');

      setOcrStatus('low_confidence');
    } catch (err: any) {
      // Check if stale
      if (ocrRequestIdRef.current !== currentRequestId) {
        return;
      }

      // Check for user-initiated/system cancellation
      if (axios.isCancel(err) || err.name === 'CanceledError' || err.message === 'canceled') {
        setOcrStatus('idle');
        return;
      }

      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout') || err.message?.includes('exceeded');
      if (isTimeout) {
        setApiError('Không nhận diện được biển số. Vui lòng chụp lại rõ hơn hoặc nhập thủ công.');
        setOcrStatus('failed');
      } else {
        setApiError('Không nhận diện được biển số. Vui lòng chụp lại rõ hơn hoặc nhập thủ công.');
        setOcrStatus('failed');
      }
    } finally {
      if (ocrRequestIdRef.current === currentRequestId) {
        ocrAbortControllerRef.current = null;
      }
      setOcrAttempted(true);
    }
  };

  // ═════════════════════════════════════════════════════
  //  HANDLERS — plate lookup
  // ═════════════════════════════════════════════════════
  const handleLookup = async () => {
    const raw = plateInput.trim();
    if (!raw || !vehicleType) return;

    const validation = validatePlate(raw, vehicleType);
    if (!validation.valid) {
      setApiError(validation.message || 'Biển số xe không hợp lệ.');
      return;
    }

    const normalized = normalizePlateForLookup(raw);
    if (!normalized) return;

    setApiError('');
    setLookupData(null);
    setVehicleTypeMismatch(false);
    setSearching(true);

    try {
      const result = await lookupPlate(normalized, vehicleType);
      setLookupData(result);

      if (result.alreadyParked) {
        setApiError(`Xe đang trong bãi — không thể check-in lần nữa.`);
        return;
      }


      // Vehicle type mismatch check
      if (result.found && result.vehicleType && result.vehicleType !== vehicleType) {
        setVehicleTypeMismatch(true);
        return;
      }

      setOcrStatus('success');

    } catch (err: unknown) {
      const msg = (err as Error).message ?? 'Không thể tra cứu biển số.';
      setApiError(msg);
    } finally {
      setSearching(false);
    }
  };

  const handlePlateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLookup();
  };

  // ═════════════════════════════════════════════════════
  //  HANDLERS — submit check-in
  // ═════════════════════════════════════════════════════
  const handleSubmit = async () => {
    if (!vehicleType || !plateInput.trim() || !lookupData) return;
    const floorId = lookupData.floorId;
    if (!floorId) return;

    const plate = plateInput.trim().toUpperCase();
    const isMonthly = lookupData.customerType === 'monthly';

    setApiError('');
    setSubmitting(true);

    try {
      const result = await submitCheckIn({
        plateNumber: plate,
        vehicleType,
        floorId,
        isMonthly,
        slotCode: lookupData.slotCode || null,
        frontImageUrl: frontImageUrl ?? undefined,
        rearImageUrl: rearImageUrl ?? undefined,
      }, frontImage, rearImage);

      setSuccessData(result);

      // Reset workflow
      handleReset();
    } catch (error: unknown) {
      const msg = (error as Error).message ?? 'Check-in thất bại. Vui lòng thử lại.';
      setApiError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ═════════════════════════════════════════════════════
  //  HANDLERS — reset
  // ═════════════════════════════════════════════════════
  const handleReset = () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (rearPreview) URL.revokeObjectURL(rearPreview);

    if (ocrAbortControllerRef.current) {
      ocrAbortControllerRef.current.abort();
      ocrAbortControllerRef.current = null;
    }

    setVehicleType(null);
    setFrontImage(null);
    setFrontPreview(null);
    setRearImage(null);
    setRearPreview(null);
    setFrontImageUrl(null);
    setRearImageUrl(null);
    setOcrStatus('idle');
    setOcrAttempted(false);
    setPlateInput('');
    setPlateSource('manual');
    setLookupData(null);
    setVehicleTypeMismatch(false);
    setApiError('');
  };

  // ═════════════════════════════════════════════════════
  //  DERIVED VALUES
  // ═════════════════════════════════════════════════════
  const workflowStep: number =
    !vehicleType ? 1
      : (!frontImage || !rearImage || !ocrAttempted) ? 2
        : lookupData ? (lookupData.alreadyParked ? 2 : 3)
          : 2;

  const canLookup = ocrAttempted && !!vehicleType && !!plateInput.trim() && !searching;

  const totalCapacity = lookupData?.totalCapacity ?? 0;
  const activeParkingCount = lookupData?.activeParkingCount ?? 0;
  const receivableCapacity = lookupData?.receivableCapacity ?? 0;

  const physicalAvailableCapacity = totalCapacity - activeParkingCount;

  const hasCapacity =
    lookupData?.customerType === 'booking'
      ? activeParkingCount < totalCapacity
      : lookupData?.customerType === 'monthly'
        ? physicalAvailableCapacity > 0
        : receivableCapacity > 0;

  const canConfirm =
    !submitting &&
    !!vehicleType &&
    !!frontImage &&
    !!rearImage &&
    !!plateInput.trim() &&
    !!normalizePlateForLookup(plateInput) &&
    !!lookupData &&
    (!lookupData.found || !lookupData.vehicleType || lookupData.vehicleType === vehicleType) &&
    !!lookupData.floorId &&
    hasCapacity &&
    !lookupData.alreadyParked &&
    !vehicleTypeMismatch &&
    !apiError;

  // Customer type display
  const customerTypeDisplay: 'booking' | 'monthly' | 'casual' | 'unknown' =
    !lookupData ? 'unknown'
      : lookupData.customerType === 'booking' ? 'booking'
        : lookupData.customerType === 'monthly' ? 'monthly'
          : 'casual';

  // Summary rows for right panel
  const expiryLabel = lookupData?.packageExpiry
    ? new Date(lookupData.packageExpiry).toLocaleDateString('vi-VN')
    : '—';

  const getFloorDisplay = () => {
    if (!lookupData || !lookupData.floorName) return '—';
    const fName = lookupData.floorName;
    if (lookupData.customerType === 'booking') {
      return `${fName} · Ô tô đặt chỗ`;
    }
    if (lookupData.customerType === 'monthly') {
      const tierLabel = lookupData.allowedTier
        ? ` (${lookupData.allowedTier === 'VIP' ? 'VIP' : lookupData.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'})`
        : '';
      return `${fName} · Khách tháng${tierLabel}`;
    }
    // casual
    const vLabel = vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy';
    return `${fName} · ${vLabel} khách vãng lai`;
  };

  const floorDisplay = getFloorDisplay();

  const summaryRows = [
    { label: 'Biển số', value: plateInput.trim() || 'Chưa có dữ liệu', valueColor: plateInput.trim() ? C.navy : C.gray400 },
    { label: 'Loại xe', value: vehicleType ? (vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy') : 'Chưa chọn', valueColor: vehicleType ? C.gray800 : C.gray400 },
    { label: 'Loại khách', value: !lookupData ? '—' : lookupData.customerType === 'booking' ? 'Có đặt chỗ trước' : lookupData.customerType === 'monthly' ? 'Khách tháng' : 'Khách vãng lai' },
    { label: 'Tầng / Khu vực', value: lookupData ? floorDisplay : '—' },
    { label: 'Hình thức đỗ', value: lookupData ? 'Tự chọn vị trí trống' : '—' },
  ];

  // ═════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════
  return (
    <div style={{ background: C.bg, fontFamily: "'Segoe UI', Arial, sans-serif", minHeight: '100vh' }}>
      <style>{`
        .checkin-main-grid {
          display: grid;
          grid-template-columns: 58% 42%;
          gap: 24px;
          align-items: start;
        }
        .checkin-step2-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .capture-card-outer {
          width: 100%;
          min-height: 380px;
          display: flex;
          flex-direction: column;
          background: #FAFBFF;
        }
        .capture-preview-wrapper {
          width: 100%;
          height: 250px;
          position: relative;
        }
        @media (max-width: 1024px) {
          .checkin-main-grid {
            grid-template-columns: 100%;
          }
        }
        @media (max-width: 640px) {
          .checkin-step2-grid {
            grid-template-columns: 100%;
          }
          .capture-card-outer {
            min-height: auto;
          }
          .capture-preview-wrapper {
            height: 180px;
          }
        }
      `}</style>
      <main style={{ padding: '1.5rem', maxWidth: 1240, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* Page title */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: C.navy }}>
            Check-in xe vào bãi
          </h1>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: C.gray500 }}>
            Chọn loại xe → Chụp ảnh → Nhận diện biển số → Xác nhận vào bãi
          </p>
        </div>

        {/* Progress indicator */}
        <ProgressIndicator step={workflowStep} />

        {/* Global API error */}
        {apiError && (
          <div style={{
            background: C.redBg, border: `1.5px solid ${C.redBorder}`,
            borderRadius: 10, padding: '0.7rem 1rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
            marginBottom: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%' }}>
              <IconAlert size={15} color={C.red} />
              <span style={{ fontSize: '0.82rem', color: C.red, fontWeight: 500, flex: 1 }}>{apiError}</span>
              <button onClick={() => setApiError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <IconX size={14} color={C.red} />
              </button>
            </div>
            {apiError.includes('Check-out') && plateInput && (
              <button
                onClick={() => window.location.href = `/staff/checkout?plate=${encodeURIComponent(plateInput.trim().toUpperCase())}`}
                style={{
                  alignSelf: 'flex-start',
                  padding: '5px 12px',
                  background: C.navy,
                  color: C.white,
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: 2,
                  boxShadow: '0 2px 6px rgba(11,47,107,0.2)',
                  transition: 'background 0.15s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = C.navyLight)}
                onMouseOut={(e) => (e.currentTarget.style.background = C.navy)}
              >
                ➡️ Đi đến trang Check-out lượt hiện tại
              </button>
            )}
          </div>
        )}

        {/* SUCCESS banner */}
        {successData && (
          <div style={{
            background: C.greenBg, border: `2px solid ${C.greenBorder}`,
            borderRadius: 16, padding: '1.25rem 1.5rem', marginBottom: '1.25rem',
            display: 'flex', alignItems: 'center', gap: '1rem',
          }}>
            <IconCheck size={24} color={C.green} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#15803D' }}>
                Check-in thành công!
              </p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#166534' }}>
                Biển số <strong>{successData.plate}</strong>
                {successData.floorCode && <> · Khu vực <strong>{successData.floorCode}</strong></>}
                {successData.zoneName && <> · <strong>{successData.zoneName}</strong></>}
                {' · '}{formatDateTime(successData.checkInTime)}
              </p>
              {successData.message && (
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: '#166534' }}>{successData.message}</p>
              )}
            </div>
            <button
              onClick={() => setSuccessData(null)}
              style={{
                padding: '0.45rem 1rem', background: C.green, color: C.white,
                border: 'none', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Check-in xe mới
            </button>
          </div>
        )}

        {/* TWO-COLUMN LAYOUT */}
        <div className="checkin-main-grid">

          {/* ══ LEFT — Workflow ═══════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ─── STEP 1: Vehicle type ─────────────────────────────────── */}
            <Card title="Bước 1 · Chọn loại xe" accent={!vehicleType ? C.activeBlue : C.border}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {(['CAR', 'MOTORBIKE'] as const).map((t) => {
                  const active = vehicleType === t;
                  return (
                    <button
                      key={t}
                      id={`vehicle-type-${t.toLowerCase()}`}
                      onClick={() => handleSelectVehicleType(t)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        padding: '1.75rem 1rem',
                        borderRadius: 14,
                        border: `2.5px solid ${active ? C.navy : C.border}`,
                        background: active ? C.navy : C.white,
                        color: active ? '#fff' : C.gray800,
                        cursor: 'pointer',
                        transition: 'all 0.18s',
                        boxShadow: active ? '0 6px 20px rgba(11,47,107,0.2)' : 'none',
                      }}
                    >
                      {t === 'CAR' ? <IconCar size={44} /> : <IconMoto size={44} />}
                      <span style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                        {t === 'CAR' ? 'Ô tô' : 'Xe máy'}
                      </span>
                      {active && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: 'rgba(255,255,255,0.15)',
                          borderRadius: 10, padding: '0.15rem 0.5rem',
                          fontSize: '0.7rem', fontWeight: 700,
                        }}>
                          <IconCheck size={11} color="#fff" /> Đã chọn
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {vehicleType && (
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.78rem', color: C.gray500 }}>
                  {vehicleType === 'CAR'
                    ? 'Ô tô: chụp đầy đủ ảnh phía trước và phía sau để lưu hồ sơ và hỗ trợ đối chiếu khi cần.'
                    : 'Xe máy: chụp đầy đủ ảnh phía trước và phía sau để lưu hồ sơ và hỗ trợ đối chiếu khi cần.'}
                </p>
              )}
            </Card>

            {/* ─── STEP 2: Capture & OCR ────────────────────────────────── */}
            <div style={{ opacity: vehicleType ? 1 : 0.4, pointerEvents: vehicleType ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
              <Card title="Bước 2 · Chụp ảnh và nhận diện biển số">
                {!vehicleType && (
                  <div style={{ textAlign: 'center', padding: '1.25rem 0', color: C.gray400, fontSize: '0.82rem' }}>
                    Vui lòng chọn loại xe ở Bước 1 trước.
                  </div>
                )}

                {vehicleType === 'CAR' && (
                  <>
                    <div className="checkin-step2-grid">
                      <CaptureBox
                        label="Ảnh phía trước"
                        hint="Chụp rõ toàn bộ biển số phía trước xe"
                        preview={frontPreview}
                        onCamera={() => frontCameraRef.current?.click()}
                        onLibrary={() => frontLibraryRef.current?.click()}
                        onRemove={handleRemoveFront}
                        cameraRef={frontCameraRef}
                        libraryRef={frontLibraryRef}
                        onCameraChange={(e) => handleImageSelect(e, setFrontImage, setFrontPreview, frontPreview, 'front')}
                        onLibraryChange={(e) => handleImageSelect(e, setFrontImage, setFrontPreview, frontPreview, 'front')}
                      />
                      <CaptureBox
                        label="Ảnh phía sau"
                        hint="Chụp rõ toàn bộ biển số phía sau xe"
                        preview={rearPreview}
                        onCamera={() => rearCameraRef.current?.click()}
                        onLibrary={() => rearLibraryRef.current?.click()}
                        onRemove={handleRemoveRear}
                        cameraRef={rearCameraRef}
                        libraryRef={rearLibraryRef}
                        onCameraChange={(e) => handleImageSelect(e, setRearImage, setRearPreview, rearPreview, 'rear')}
                        onLibraryChange={(e) => handleImageSelect(e, setRearImage, setRearPreview, rearPreview, 'rear')}
                      />
                    </div>
                     <p style={{ margin: '0.65rem 0 0', fontSize: '0.75rem', color: C.gray500, lineHeight: 1.5 }}>
                       Đưa biển số vào giữa khung, chụp rõ nét và đủ gần để hệ thống nhận diện chính xác.
                     </p>
                  </>
                )}

                {vehicleType === 'MOTORBIKE' && (
                  <>
                    <div className="checkin-step2-grid">
                      <CaptureBox
                        label="Ảnh phía trước"
                        hint="Chụp rõ toàn bộ phía trước xe"
                        preview={frontPreview}
                        onCamera={() => frontCameraRef.current?.click()}
                        onLibrary={() => frontLibraryRef.current?.click()}
                        onRemove={handleRemoveFront}
                        cameraRef={frontCameraRef}
                        libraryRef={frontLibraryRef}
                        onCameraChange={(e) => handleImageSelect(e, setFrontImage, setFrontPreview, frontPreview, 'front')}
                        onLibraryChange={(e) => handleImageSelect(e, setFrontImage, setFrontPreview, frontPreview, 'front')}
                      />
                      <CaptureBox
                        label="Ảnh phía sau"
                        hint="Chụp rõ toàn bộ phía sau xe"
                        preview={rearPreview}
                        onCamera={() => rearCameraRef.current?.click()}
                        onLibrary={() => rearLibraryRef.current?.click()}
                        onRemove={handleRemoveRear}
                        cameraRef={rearCameraRef}
                        libraryRef={rearLibraryRef}
                        onCameraChange={(e) => handleImageSelect(e, setRearImage, setRearPreview, rearPreview, 'rear')}
                        onLibraryChange={(e) => handleImageSelect(e, setRearImage, setRearPreview, rearPreview, 'rear')}
                      />
                    </div>
                    <p style={{ margin: '0.65rem 0 0', fontSize: '0.75rem', color: C.gray500, lineHeight: 1.5 }}>
                      Đưa biển số vào giữa khung, chụp rõ nét và đủ gần để hệ thống nhận diện chính xác.
                    </p>
                  </>
                )}

                {/* Shared OCR status panel */}
                {vehicleType && <SharedOcrStatusPanel status={ocrStatus} plate={plateInput} />}

                {/* OCR error status */}
                {ocrStatus === 'failed' && !apiError && (
                  <div style={{ marginTop: 10 }}>
                    <AlertBanner type="warning">Không thể nhận diện biển số từ ảnh. Vui lòng nhập thủ công bên dưới.</AlertBanner>
                  </div>
                )}

                {/* OCR run button */}
                {vehicleType && rearImage && (
                  <button
                    id="run-ocr-btn"
                    onClick={runOCR}
                    disabled={ocrStatus === 'processing'}
                    style={{
                      marginTop: 12, width: '100%',
                      padding: '0.6rem 1rem', borderRadius: 10,
                      border: `1.5px solid ${ocrStatus === 'processing' ? C.gray200 : C.activeBlue}`,
                      background: ocrStatus === 'processing' ? C.gray100 : '#EFF6FF',
                      color: ocrStatus === 'processing' ? C.gray400 : C.activeBlue,
                      fontSize: '0.82rem', fontWeight: 700,
                      cursor: ocrStatus === 'processing' ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'all 0.15s',
                    }}
                  >
                    {ocrStatus === 'processing' ? 'Đang nhận diện biển số...' : '🔍 Nhận diện biển số từ ảnh'}
                  </button>
                )}

                {/* Plate input */}
                {vehicleType && (
                  <div style={{ marginTop: 14 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      Điều chỉnh biển số
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        id="plate-input"
                        type="text"
                        value={plateInput}
                        onChange={(e) => {
                          setPlateInput(e.target.value.toUpperCase());
                          setPlateSource('manual');
                          setOcrStatus('manually_edited');
                          setLookupData(null);
                          setApiError('');
                        }}
                        onKeyDown={handlePlateKeyDown}
                        placeholder="VD: 51A-12345"
                        disabled={!ocrAttempted}
                        style={{
                          flex: 1,
                          padding: '0.6rem 0.85rem',
                          border: `1.5px solid ${C.border}`,
                          borderRadius: 10,
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          fontFamily: "'Consolas','Courier New',monospace",
                          color: C.gray800,
                          background: !ocrAttempted ? '#F1F5F9' : C.white,
                          outline: 'none',
                          letterSpacing: '0.04em',
                        }}
                      />
                      <button
                        id="lookup-btn"
                        onClick={handleLookup}
                        disabled={!canLookup}
                        style={{
                          padding: '0.6rem 1rem',
                          background: canLookup ? C.navy : '#E5E7EB',
                          color: canLookup ? C.white : '#9CA3AF',
                          border: 'none', borderRadius: 10,
                          fontSize: '0.82rem', fontWeight: 700,
                          cursor: canLookup ? 'pointer' : 'not-allowed',
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          whiteSpace: 'nowrap', transition: 'all 0.15s',
                        }}
                      >
                        {searching ? 'Đang tra...' : <><IconSearch size={14} />Tra cứu</>}
                      </button>
                    </div>
                    {plateSource !== 'manual' && plateInput && (
                      <p style={{ margin: '0.3rem 0 0', fontSize: '0.7rem', color: C.gray400 }}>
                        Chỉ chỉnh sửa khi kết quả nhận diện chưa chính xác.
                      </p>
                    )}
                  </div>
                )}
              </Card>
            </div>

            {/* ─── STEP 3: Lookup results ────────────────────────────────── */}
            {lookupData && (
              <div style={{ animation: 'fadeIn 0.2s ease' }}>
                <Card
                  title="Bước 3 · Kiểm tra thông tin xe"
                  accent={vehicleTypeMismatch ? C.redBorder : lookupData.alreadyParked ? C.yellowBorder : C.greenBorder}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Customer type badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <CustomerBadge type={customerTypeDisplay} />
                      {vehicleTypeMismatch && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: C.redBg, border: `1.5px solid ${C.redBorder}`,
                          borderRadius: 16, padding: '0.2rem 0.6rem',
                          fontSize: '0.7rem', fontWeight: 700, color: C.red,
                        }}>
                          <IconAlert size={11} color={C.red} /> Sai loại xe
                        </span>
                      )}
                    </div>

                    {/* Already parked */}
                    {lookupData.alreadyParked && (
                      <AlertBanner type="error">
                        Xe đang ở trong bãi — không thể check-in lần nữa.
                      </AlertBanner>
                    )}

                    {/* Type mismatch */}
                    {vehicleTypeMismatch && (
                      <AlertBanner type="error">
                        Loại xe được chọn không khớp với thông tin phương tiện đã đăng ký. Vui lòng chọn lại loại xe ở Bước 1.
                      </AlertBanner>
                    )}

                    {/* Active booking info */}
                    {lookupData.customerType === 'booking' && lookupData.activeBooking && !lookupData.alreadyParked && (
                      <div style={{
                        background: '#EFF6FF', border: '1.5px solid #BFDBFE',
                        borderRadius: 12, padding: '0.85rem 1rem',
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: C.navy, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Thông tin đặt chỗ
                          </span>
                        </div>
                        <InfoRow label="Tầng / Khu vực" value={`${lookupData.activeBooking.floorName} (${lookupData.activeBooking.floorCode})`} valueColor={C.navy} />
                        <InfoRow label="Đặt cọc đã trả" value={formatVND(lookupData.activeBooking.depositAmount)} valueColor={C.green} />
                        <InfoRow label="Hiệu lực còn lại" value={timeUntil(lookupData.activeBooking.expiresAt)} valueColor={C.orange} />
                        {lookupData.receivableCapacity != null && (
                          <InfoRow label="Tầng còn nhận thêm" value={`${lookupData.receivableCapacity} xe`} />
                        )}
                        <AlertBanner type="success">
                          Đặt chỗ hợp lệ. Khi vào bãi, khách tự chọn vị trí trống trong tầng được phân bổ.
                        </AlertBanner>
                      </div>
                    )}

                    {/* Monthly info */}
                    {lookupData.customerType === 'monthly' && !lookupData.alreadyParked && (
                      <div style={{
                        background: C.greenBg, border: `1.5px solid ${C.greenBorder}`,
                        borderRadius: 12, padding: '0.85rem 1rem',
                        display: 'flex', flexDirection: 'column', gap: 4,
                      }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Gói tháng
                        </span>
                        <InfoRow label="Hết hạn" value={expiryLabel} valueColor={lookupData.isExpired ? C.red : C.green} />
                        {lookupData.allowedTier && <InfoRow label="Khu vực" value={`Khu ${lookupData.allowedTier === 'VIP' ? 'VIP' : lookupData.allowedTier === 'POPULAR' ? 'Phổ biến' : 'Cơ bản'}`} valueColor={C.navy} />}
                        {lookupData.isExpired
                          ? <AlertBanner type="error">Gói tháng đã hết hạn. Vui lòng gia hạn hoặc thanh toán vãng lai.</AlertBanner>
                          : <AlertBanner type="success">Khách tháng — không thu phí vào.</AlertBanner>
                        }
                      </div>
                    )}

                    {/* Casual */}
                    {lookupData.customerType === 'casual' && !lookupData.alreadyParked && (
                      <div style={{
                        background: C.gray100, border: `1px solid ${C.gray200}`,
                        borderRadius: 12, padding: '0.85rem 1rem',
                      }}>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: C.gray800, lineHeight: 1.5 }}>
                          Khách vãng lai. Phí gửi xe sẽ được tính theo thời gian khi ra bãi.<br />
                          Khách tự chọn vị trí trống trong khu vực được phân bổ.
                        </p>
                      </div>
                    )}

                    {/* Vehicle details grid */}
                    {lookupData.found && (
                      <div style={{
                        background: '#F8FAFC', border: `1px solid ${C.gray200}`,
                        borderRadius: 10, padding: '0.75rem 0.9rem',
                      }}>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.7rem', fontWeight: 800, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Thông tin phương tiện
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem 1rem' }}>
                          {[
                            { k: 'Hãng', v: lookupData.brand },
                            { k: 'Mẫu', v: lookupData.model },
                            { k: 'Màu', v: lookupData.color },
                            { k: 'Năm', v: lookupData.year?.toString() },
                          ].map(({ k, v }) => (
                            <div key={k}>
                              <span style={{ fontSize: '0.62rem', color: '#9CA3AF' }}>{k}</span>
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.navy }}>{v ?? '—'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Owner info */}
                    {lookupData.found && (lookupData.ownerName || lookupData.ownerPhone) && (
                      <div style={{
                        background: '#F8FAFC', border: `1px solid ${C.gray200}`,
                        borderRadius: 10, padding: '0.75rem 0.9rem',
                      }}>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.7rem', fontWeight: 800, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Chủ xe
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem 1rem' }}>
                          <div>
                            <span style={{ fontSize: '0.62rem', color: '#9CA3AF' }}>Họ tên</span>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.navy }}>{lookupData.ownerName ?? '—'}</div>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.62rem', color: '#9CA3AF' }}>SĐT</span>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.navy }}>{lookupData.ownerPhone ?? '—'}</div>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </Card>
              </div>
            )}

          </div>

          {/* ══ RIGHT — Sticky summary ══════════════════════════════════════ */}
          <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Summary card */}
            <Card title="Tóm tắt check-in" style={{ minHeight: 300 }}>
              <div>
                {summaryRows.map((r) => (
                  <InfoRow key={r.label} label={r.label} value={r.value} valueColor={r.valueColor} />
                ))}
              </div>

              {/* Capacity notice */}
              {lookupData?.receivableCapacity != null && (
                <div style={{
                  marginTop: 10,
                  background: '#EFF6FF', border: '1px solid #BFDBFE',
                  borderRadius: 8, padding: '0.45rem 0.7rem',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ fontSize: '0.72rem', color: C.navy }}>
                    🅿️ Tầng còn nhận thêm: <strong>{lookupData.receivableCapacity} xe</strong>
                  </span>
                </div>
              )}

              {/* Instruction */}
              {lookupData && !lookupData.alreadyParked && !vehicleTypeMismatch && (
                <div style={{ marginTop: 12 }}>
                  <AlertBanner type="info">
                    Khách tự chọn vị trí trống trong khu vực được phân bổ sau khi vào bãi.
                  </AlertBanner>
                </div>
              )}
            </Card>

            {/* Confirm button */}
            <button
              id="confirm-checkin-btn"
              onClick={handleSubmit}
              disabled={!canConfirm}
              style={{
                width: '100%',
                padding: '0.9rem 1.5rem',
                background: canConfirm ? C.navy : '#E5E7EB',
                color: canConfirm ? C.white : '#9CA3AF',
                border: 'none',
                borderRadius: 14,
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: canConfirm ? 'pointer' : 'not-allowed',
                boxShadow: canConfirm ? '0 4px 14px rgba(30,58,95,0.25)' : 'none',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {submitting ? 'Đang xử lý…' : (
                <>
                  <IconCheck size={16} color={canConfirm ? '#fff' : '#9CA3AF'} />
                  Xác nhận xe vào bãi
                </>
              )}
            </button>

            {/* Reset button */}
            <button
              id="reset-checkin-btn"
              onClick={handleReset}
              style={{
                width: '100%',
                padding: '0.65rem 1.25rem',
                background: C.white,
                color: C.gray500,
                border: `1.5px solid ${C.gray200}`,
                borderRadius: 12,
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <IconRefresh size={15} />
              Làm mới / Check-in xe mới
            </button>

            {/* Quick nav hint */}
            <div style={{
              background: C.gray50, border: `1px solid ${C.gray200}`,
              borderRadius: 10, padding: '0.7rem 0.85rem',
            }}>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Quy trình
              </p>
              {STEP_LABELS.map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.2rem 0' }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: i + 1 < workflowStep ? C.navy : i + 1 === workflowStep ? C.activeBlue : C.gray200,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {i + 1 < workflowStep
                      ? <IconCheck size={10} color="#fff" />
                      : <span style={{ fontSize: '0.55rem', fontWeight: 800, color: i + 1 === workflowStep ? '#fff' : C.gray400 }}>{i + 1}</span>
                    }
                  </div>
                  <span style={{ fontSize: '0.72rem', color: i + 1 === workflowStep ? C.navy : C.gray400, fontWeight: i + 1 === workflowStep ? 700 : 400 }}>
                    {label}
                  </span>
                  {i + 1 === workflowStep && <IconChevronRight size={12} color={C.activeBlue} />}
                </div>
              ))}
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}