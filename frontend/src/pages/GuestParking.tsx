import { useState, useEffect } from 'react';
import api from '../services/api';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  navy: '#0B2F6B',
  blue: '#1F5EFF',
  blueDark: '#1447CC',
  bg: '#F0F4FF',
  white: '#FFFFFF',
  green: '#16A34A',
  greenBg: '#F0FDF4',
  greenBorder: '#86EFAC',
  red: '#DC2626',
  redBg: '#FEF2F2',
  redBorder: '#FECACA',
  yellow: '#D97706',
  yellowBg: '#FFFBEB',
  yellowBorder: '#FDE68A',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray700: '#374151',
  gray900: '#111827',
};

const VALID_PROVINCE_CODES = [
  11,12,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,
  30,31,32,33,34,35,36,37,38,39,40,41,43,
  47,48,49,50,51,52,53,54,55,56,57,58,59,
  60,61,62,63,64,65,66,67,68,69,
  70,71,72,73,74,75,76,77,78,79,
  81,82,83,84,85,86,88,89,90,
  92,93,94,95,97,98,99,
];

function isValidPlate(raw: string, type: 'CAR' | 'MOTORBIKE'): boolean {
  const upper = raw.toUpperCase().replace(/[\s.]/g, '');
  let m: RegExpMatchArray | null;
  if (type === 'CAR') {
    m = upper.match(/^(\d{2})([A-Z])[-]?(\d{4,5})$/);
    if (!m) return false;
    if (!VALID_PROVINCE_CODES.includes(parseInt(m[1], 10))) return false;
  } else {
    m = upper.match(/^(\d{2})C([0-9A-Z])[-]?(\d{4,5})$/);
    if (!m) return false;
    if (!VALID_PROVINCE_CODES.includes(parseInt(m[1], 10))) return false;
  }
  return true;
}

type Step = 'form' | 'success' | 'checkout_lookup' | 'checkout_result';
type VehicleType = 'CAR' | 'MOTORBIKE';

interface CheckinResult { plate: string; slotCode: string; checkInTime: string; guestName: string; message: string; }
interface CheckoutInfo {
  plate: string; vehicleType: string; slotCode: string;
  checkInTime: string; durationMinutes: number; fee: number; message: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function IconCar() { return <span style={{ fontSize: 20 }}>🚗</span>; }
function IconMoto() { return <span style={{ fontSize: 20 }}>🛵</span>; }
function IconCheck({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} phút`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
}
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function GuestParkingPage() {
  const [step, setStep] = useState<Step>('form');
  const [mode, setMode] = useState<'checkin' | 'checkout'>('checkin');

  // Check-in form
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('MOTORBIKE');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [plateError, setPlateError] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // Results
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);
  const [checkoutInfo, setCheckoutInfo] = useState<CheckoutInfo | null>(null);

  // Shared
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Checkout
  const [checkoutPlate, setCheckoutPlate] = useState('');
  const [checkoutPlateError, setCheckoutPlateError] = useState('');

  useEffect(() => {
    document.title = 'Gửi xe vãng lai — ParkSmart';
  }, []);

  // ── Direct Check-in (Backend auto-assigns optimal slot) ───────────────────
  const handleDirectCheckin = async () => {
    let valid = true;
    setError('');

    if (!plate.trim() || !isValidPlate(plate.trim(), vehicleType)) {
      setPlateError('Biển số không hợp lệ');
      valid = false;
    } else setPlateError('');

    if (!guestName.trim() || guestName.trim().length < 2) {
      setNameError('Vui lòng nhập họ tên (tối thiểu 2 ký tự)');
      valid = false;
    } else setNameError('');

    const phoneClean = guestPhone.replace(/\s/g, '');
    if (!phoneClean || !/^(0|\+84)[0-9]{8,10}$/.test(phoneClean)) {
      setPhoneError('Số điện thoại không hợp lệ (VD: 0987654321)');
      valid = false;
    } else setPhoneError('');

    if (!valid) return;

    setSubmitting(true);
    try {
      const cleanedPlate = plate.trim().toUpperCase();
      const res = await api.post<{ success: boolean; data: CheckinResult }>('/public/guest-checkin', {
        plateNumber: cleanedPlate,
        vehicleType,
        guestName: guestName.trim(),
        guestPhone: phoneClean,
      });
      setCheckinResult(res.data.data);
      setStep('success');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Check-in thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Checkout lookup ───────────────────────────────────────────────────────
  const handleCheckoutLookup = async () => {
    if (!checkoutPlate.trim()) { setCheckoutPlateError('Vui lòng nhập biển số xe'); return; }
    setCheckoutPlateError('');
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post<{ success: boolean; data: CheckoutInfo }>('/public/guest-checkout', {
        plateNumber: checkoutPlate.trim().toUpperCase(),
      });
      setCheckoutInfo(res.data.data);
      setStep('checkout_result');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Không tìm thấy thông tin xe. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep('form');
    setPlate('');
    setGuestName('');
    setGuestPhone('');
    setPlateError('');
    setNameError('');
    setPhoneError('');
    setCheckinResult(null);
    setCheckoutInfo(null);
    setCheckoutPlate('');
    setCheckoutPlateError('');
    setError('');
  };

  // ── Shared input style ────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    border: `1.5px solid ${C.gray200}`,
    borderRadius: 12,
    fontSize: '0.95rem',
    fontFamily: 'inherit',
    color: C.gray900,
    background: C.white,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Inter','Segoe UI',sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        input:focus { border-color: ${C.blue} !important; box-shadow: 0 0 0 3px rgba(31,94,255,0.15); }
        .slot-btn { transition: all 0.15s; }
        .slot-btn:hover { transform: translateY(-1px); }
        .slot-btn.selected { background: ${C.navy} !important; color: ${C.white} !important; border-color: ${C.navy} !important; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.35s ease both; }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.55rem', marginBottom: '0.75rem' }}>
          <img src="/logo.png" alt="ParkSmart Logo" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          <span style={{ fontSize: '1.55rem', fontWeight: 900, color: C.navy, letterSpacing: '-0.01em' }}>
            Park<span style={{ color: C.blue }}>Smart</span>
          </span>
        </div>
        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 700, color: C.navy }}>
          Gửi xe vãng lai
        </h1>
        <p style={{ margin: 0, color: C.gray500, fontSize: '0.88rem' }}>
          Không cần đăng ký tài khoản — gửi xe nhanh chóng
        </p>
      </div>

      {/* Card */}
      <div className="fade-in" style={{ width: '100%', maxWidth: 480, background: C.white, borderRadius: 20, boxShadow: '0 8px 40px rgba(11,47,107,0.12)', padding: '2rem' }}>

        {/* Mode tabs */}
        {(step === 'form' || step === 'checkout_lookup') && (
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', background: C.gray100, borderRadius: 12, padding: 4 }}>
            {(['checkin', 'checkout'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setStep(m === 'checkin' ? 'form' : 'checkout_lookup'); setError(''); }}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: mode === m ? C.navy : 'transparent',
                  color: mode === m ? C.white : C.gray500,
                  fontWeight: 700, fontSize: '0.88rem', transition: 'all 0.2s',
                  textAlign: 'center',
                }}
              >
                {m === 'checkin' ? 'Gửi xe (Check-in)' : 'Tra cứu phí (Check-out)'}
              </button>
            ))}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 10, padding: '0.7rem 1rem', marginBottom: '1rem', fontSize: '0.84rem', color: C.red, fontWeight: 500 }}>
            {error}
          </div>
        )}

        {/* ── STEP: Form ──────────────────────────────────────────────────── */}
        {step === 'form' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Vehicle type */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: C.gray700, marginBottom: 8 }}>Loại xe</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['MOTORBIKE', 'CAR'] as const).map(vt => (
                  <button
                    key={vt}
                    onClick={() => setVehicleType(vt)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '0.7rem', borderRadius: 12, border: `2px solid ${vehicleType === vt ? C.navy : C.gray200}`,
                      background: vehicleType === vt ? C.navy : C.white,
                      color: vehicleType === vt ? C.white : C.gray700,
                      fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {vt === 'CAR' ? <IconCar /> : <IconMoto />}
                    {vt === 'CAR' ? 'Ô tô' : 'Xe máy'}
                  </button>
                ))}
              </div>
            </div>

            {/* Plate */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                Biển số xe <span style={{ color: C.red }}>*</span>
              </label>
              <input
                style={{ ...inputStyle, fontFamily: "'Consolas',monospace", fontWeight: 700, fontSize: '1rem', letterSpacing: '0.06em', borderColor: plateError ? C.red : C.gray200 }}
                value={plate}
                onChange={e => { setPlate(e.target.value.toUpperCase()); setPlateError(''); }}
                placeholder={vehicleType === 'CAR' ? 'VD: 51A-12345' : 'VD: 51C1-12345'}
              />
              {plateError && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: C.red }}>{plateError}</p>}
            </div>

            {/* Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                Họ và tên <span style={{ color: C.red }}>*</span>
              </label>
              <input
                style={{ ...inputStyle, borderColor: nameError ? C.red : C.gray200 }}
                value={guestName}
                onChange={e => { setGuestName(e.target.value); setNameError(''); }}
                placeholder="VD: Nguyễn Văn A"
              />
              {nameError && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: C.red }}>{nameError}</p>}
            </div>

            {/* Phone */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                Số điện thoại <span style={{ color: C.red }}>*</span>
              </label>
              <input
                type="tel"
                style={{ ...inputStyle, borderColor: phoneError ? C.red : C.gray200 }}
                value={guestPhone}
                onChange={e => { setGuestPhone(e.target.value); setPhoneError(''); }}
                placeholder="VD: 0987654321"
              />
              {phoneError && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: C.red }}>{phoneError}</p>}
            </div>

            <button
              onClick={handleDirectCheckin}
              disabled={submitting}
              style={{
                width: '100%', padding: '0.85rem', background: C.blue, color: C.white, border: 'none',
                borderRadius: 12, fontSize: '1rem', fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1, transition: 'all 0.15s', marginTop: 4,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.blueDark; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.blue; }}
            >
              {submitting ? 'Đang xử lý...' : '🚀 Xác nhận gửi xe'}
            </button>
          </div>
        )}



        {/* ── STEP: Check-in Success ───────────────────────────────────────── */}
        {step === 'success' && checkinResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center' }}>
            <div style={{ background: C.greenBg, border: `2px solid ${C.greenBorder}`, borderRadius: 16, padding: '1.5rem' }}>
              <div style={{ marginBottom: '0.75rem' }}><IconCheck size={40} /></div>
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 900, color: '#15803D' }}>
                Gửi xe thành công!
              </h2>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#166534' }}>
                Hãy lưu lại thông tin bên dưới
              </p>
            </div>

            <div style={{ background: C.gray100, borderRadius: 14, padding: '1.25rem', textAlign: 'left' }}>
              {[
                ['Biển số', checkinResult.plate],
                ['Vị trí đỗ', checkinResult.slotCode],
                ['Giờ vào', formatTime(checkinResult.checkInTime)],
                ['Khách', checkinResult.guestName],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: `1px solid ${C.gray200}` }}>
                  <span style={{ fontSize: '0.82rem', color: C.gray500 }}>{label}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: C.navy }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ background: C.yellowBg, border: `1.5px solid ${C.yellowBorder}`, borderRadius: 12, padding: '0.85rem 1rem', fontSize: '0.82rem', color: C.yellow, fontWeight: 600 }}>
              📌 Khi ra xe, vui lòng nhập lại biển số để tra cứu phí và thanh toán tại quầy.
            </div>

            <button
              onClick={reset}
              style={{ width: '100%', padding: '0.8rem', background: C.navy, color: C.white, border: 'none', borderRadius: 12, fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Gửi xe mới
            </button>
          </div>
        )}

        {/* ── STEP: Checkout Lookup ────────────────────────────────────────── */}
        {step === 'checkout_lookup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.88rem', color: C.gray500 }}>
              Nhập biển số xe để tra cứu thời gian gửi xe và phí cần thanh toán.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: C.gray700, marginBottom: 6 }}>
                Biển số xe <span style={{ color: C.red }}>*</span>
              </label>
              <input
                style={{ ...inputStyle, fontFamily: "'Consolas',monospace", fontWeight: 700, fontSize: '1rem', letterSpacing: '0.06em', borderColor: checkoutPlateError ? C.red : C.gray200 }}
                value={checkoutPlate}
                onChange={e => { setCheckoutPlate(e.target.value.toUpperCase()); setCheckoutPlateError(''); }}
                placeholder="VD: 51A-12345"
                onKeyDown={e => e.key === 'Enter' && handleCheckoutLookup()}
              />
              {checkoutPlateError && <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: C.red }}>{checkoutPlateError}</p>}
            </div>
            <button
              onClick={handleCheckoutLookup}
              disabled={submitting}
              style={{ width: '100%', padding: '0.85rem', background: C.blue, color: C.white, border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Đang tra cứu...' : '🔍 Tra cứu phí'}
            </button>
          </div>
        )}

        {/* ── STEP: Checkout Result ────────────────────────────────────────── */}
        {step === 'checkout_result' && checkoutInfo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <button onClick={() => { setStep('checkout_lookup'); setCheckoutInfo(null); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, fontWeight: 700, fontSize: '0.85rem', padding: 0, display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
              ← Tra cứu xe khác
            </button>

            <div style={{ background: C.gray100, borderRadius: 14, padding: '1.25rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: C.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Thông tin lượt gửi xe</div>
              {[
                ['Biển số', checkoutInfo.plate],
                ['Loại xe', checkoutInfo.vehicleType === 'CAR' ? '🚗 Ô tô' : '🛵 Xe máy'],
                ['Vị trí', checkoutInfo.slotCode],
                ['Giờ vào', formatTime(checkoutInfo.checkInTime)],
                ['Thời gian gửi', formatDuration(checkoutInfo.durationMinutes)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: `1px solid ${C.gray200}` }}>
                  <span style={{ fontSize: '0.82rem', color: C.gray500 }}>{label}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: C.navy }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ background: 'linear-gradient(135deg,#1E3A5F 0%,#2D5BA3 100%)', borderRadius: 16, padding: '1.5rem', textAlign: 'center', color: C.white }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.75, marginBottom: 6 }}>Phí đỗ xe cần thanh toán</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                {checkoutInfo.fee.toLocaleString('vi-VN')} ₫
              </div>
            </div>

            <div style={{ background: C.yellowBg, border: `1.5px solid ${C.yellowBorder}`, borderRadius: 12, padding: '0.85rem 1rem', fontSize: '0.82rem', color: C.yellow, fontWeight: 600 }}>
              💳 Vui lòng thanh toán tại quầy thu phí khi ra khỏi bãi xe.
            </div>

            <button
              onClick={reset}
              style={{ width: '100%', padding: '0.8rem', background: C.gray100, color: C.gray700, border: `1.5px solid ${C.gray200}`, borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Tra cứu xe khác
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <p style={{ marginTop: '1.5rem', fontSize: '0.78rem', color: C.gray400, textAlign: 'center' }}>
        ParkSmart · Bãi xe thông minh · Hỗ trợ:{' '}
        <a href="tel:19001234" style={{ color: C.blue, textDecoration: 'none', fontWeight: 600 }}>1900-1234</a>
      </p>
    </div>
  );
}
