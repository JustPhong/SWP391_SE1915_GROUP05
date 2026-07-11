import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { checkoutLookupPlate, submitLostTicket } from '../api/checkoutApi';
import type { CheckInRecord } from '../types';

// ── Types ────────────────────────────────────────────────
interface ActiveRecord {
  id: string;
  vehicleId: string;
  slotId: string;
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
  slot?: { code: string; floor: number };
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
    lotHours: number;
    rate: number;
    amount: number;
    note?: string;
  }[];
}

interface CheckOutResponse {
  recordId: string;
  paymentRequired: boolean;
  amountDue?: number;
  durationHours?: number;
  note?: string;
  fee?: number;
  depositCredit?: number;
  breakdown?: {
    label: string;
    minutesInBlock: number;
    lots: number;
    lotHours: number;
    rate: number;
    amount: number;
    note?: string;
  }[];
}

interface ConfirmState {
  record: ActiveRecord;
  feePreview: FeePreview;
  paymentMethod: 'CASH' | 'CARD' | 'EWALLET';
}

interface LostTicketState {
  record: ActiveRecord;
  preview: FeePreview | null;
  loading: boolean;
  error: string;
  result: CheckOutResponse | null;
  isMonthly: boolean;
}

// ── Design tokens ────────────────────────────────────────
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

// ── Icons ────────────────────────────────────────────────
function IconCheck({ size = 15, color = C.green }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
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

// ── Helpers ─────────────────────────────────────────────
function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
}

function now(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function FeeBreakdownCard({
  fee,
  breakdown,
  depositCredit,
  total,
  navy,
}: {
  fee: number;
  breakdown?: FeePreview['breakdown'];
  depositCredit?: number;
  total?: number;
  navy?: string;
}) {
  if (!breakdown || breakdown.length === 0) return null;
  const displayTotal = total ?? fee;
  return (
    <>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Chi tiết phí
      </p>
      {breakdown.map((block, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0.35rem 0',
          borderBottom: i < breakdown.length - 1 ? `1px solid ${C.gray100}` : 'none',
        }}>
          <div>
            <span style={{ fontSize: '0.82rem', color: C.gray800 }}>{block.label}</span>
            <span style={{ display: 'block', fontSize: '0.7rem', color: C.gray400 }}>
              {block.note ?? `${block.lots} × ${block.lotHours}h × ${formatCurrency(block.rate)}`}
            </span>
          </div>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.gray800 }}>{formatCurrency(block.amount)}</span>
        </div>
      ))}
      {depositCredit !== undefined && depositCredit > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: C.green }}>Trừ tiền cọc đặt chỗ</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: C.green }}>− {formatCurrency(depositCredit)}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderTop: `2px solid ${C.gray200}`, marginTop: '0.25rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: navy ?? C.navy }}>Tổng cộng</span>
        <span style={{ fontSize: '1rem', fontWeight: 800, color: C.red }}>{formatCurrency(displayTotal)}</span>
      </div>
    </>
  );
}

// ── Main component ───────────────────────────────────────
export function CheckOutPage() {
  const [plateInput, setPlateInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [foundRecord, setFoundRecord] = useState<ActiveRecord | null>(null);
  const [feePreview, setFeePreview] = useState<FeePreview | null>(null);
  const [allRecords, setAllRecords] = useState<ActiveRecord[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutResult, setCheckoutResult] = useState<CheckOutResponse | null>(null);
  const [ownerInfo, setOwnerInfo] = useState<{ name: string | null; phone: string | null; email: string | null } | null>(null);
  const autoSearchRan = useRef(false);
  const [searchParams] = useSearchParams();
  const [lostTicketState, setLostTicketState] = useState<LostTicketState | null>(null);

  // ── Load all active records (sidebar table) ───────────
  const loadAllRecords = async () => {
    setLoadingAll(true);
    try {
      const res = await api.get<{ success: boolean; data: CheckInRecord[] }>('/checkin-out/active');
      const raw: CheckInRecord[] = res.data.data ?? [];
      const mapped: ActiveRecord[] = raw.map((r) => ({
        id: r.id,
        vehicleId: r.vehicleId,
        slotId: r.slotId,
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
        slot: r.slot ? { code: r.slot.code, floor: r.slot.floorId } : undefined,
      }));
      setAllRecords(mapped);
    } catch {
      setAllRecords([]);
    } finally {
      setLoadingAll(false);
    }
  };

  useEffect(() => { loadAllRecords(); }, []);

  // ── Fetch fee preview from backend ───────────────────
  const fetchFeePreview = async (recordId: string): Promise<FeePreview | null> => {
    try {
      const res = await api.get<{ success: boolean; data: FeePreview }>(`/checkin-out/preview/${recordId}`);
      return res.data.data ?? null;
    } catch {
      return null;
    }
  };

  // ── Auto-search if plate was passed via ?plate= ──────
  useEffect(() => {
    if (autoSearchRan.current) return;
    const incoming = searchParams.get('plate');
    if (!incoming) return;
    autoSearchRan.current = true;
    const raw = incoming.trim().toUpperCase();
    setPlateInput(raw);
    setTimeout(() => performSearch(raw), 50);
  }, []);

  // ── Search ─────────────────────────────────────────────
  const performSearch = async (plate: string) => {
    if (!plate) return;
    setSearching(true);
    setSearchError('');
    setFoundRecord(null);
    setFeePreview(null);
    setOwnerInfo(null);

    try {
      const res = await api.get<{ success: boolean; data: CheckInRecord[] }>('/checkin-out/active');
      const raw: CheckInRecord[] = res.data.data ?? [];
      const matched = raw.find(
        (r) => r.vehicle?.plateNumber?.toUpperCase() === plate.toUpperCase()
      );
      if (!matched) {
        setSearchError(`Xe "${plate}" không có trong bãi đỗ.`);
        setSearching(false);
        setOwnerInfo({ name: 'Walk-in Customer', phone: null, email: 'walkin@system.local' });
        return;
      }
      const matchedVehicle = matched.vehicle as ActiveRecord['vehicle'] | undefined;
      const mapped: ActiveRecord = {
        id: matched.id,
        vehicleId: matched.vehicleId,
        slotId: matched.slotId,
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
        slot: matched.slot ? { code: matched.slot.code, floor: matched.slot.floorId } : undefined,
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
        } else {
          setOwnerInfo({ name: 'Walk-in Customer', phone: null, email: 'walkin@system.local' });
        }
      } catch {
        // ignore lookup errors, fee preview is the primary data
      }

      // Fetch fee preview from backend
      const preview = await fetchFeePreview(mapped.id);
      setFeePreview(preview);
    } catch {
      setSearchError('Không thể tra cứu. Vui lòng thử lại.');
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = () => { performSearch(plateInput.trim()); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') performSearch(plateInput.trim());
  };

  // ── Open confirm modal ─────────────────────────────────
  const openConfirm = (record: ActiveRecord, preview: FeePreview | null) => {
    if (!preview) return;
    setConfirmState({ record, feePreview: preview, paymentMethod: 'CASH' });
  };

  // ── Submit check-out ───────────────────────────────────
  const handleConfirm = async () => {
    if (!confirmState) return;
    setCheckoutError('');
    setCheckoutLoading(true);
    try {
      const res = await api.post('/checkin-out/out', {
        checkInRecordId: confirmState.record.id,
        paymentMethod: confirmState.paymentMethod,
      });
      const resultData = res.data.data ?? res.data;
      setCheckoutResult(resultData);
      setConfirmState(null);
      setFoundRecord(null);
      setFeePreview(null);
      setOwnerInfo(null);
      setPlateInput('');
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

  // ── Reset after success ───────────────────────────────
  const handleDismissResult = () => {
    setCheckoutResult(null);
  };

  // ── Cancel confirm ─────────────────────────────────────
  const handleCancelConfirm = () => {
    setConfirmState(null);
    setCheckoutError('');
  };

  // ── Dismiss found record ───────────────────────────────
  const handleDismissFound = () => {
    setFoundRecord(null);
    setFeePreview(null);
    setOwnerInfo(null);
    setPlateInput('');
  };

  // ── Open lost ticket modal ────────────────────────────
  const openLostTicket = (record: ActiveRecord) => {
    setLostTicketState({
      record,
      preview: null,
      loading: true,
      error: '',
      result: null,
      isMonthly: record.isMonthly,
    });
    setFoundRecord(record);
    setPlateInput(record.vehicle!.plateNumber);
    setOwnerInfo({ name: 'Mất thẻ / Không tìm thấy thẻ', phone: null, email: null });

    fetchFeePreview(record.id).then((preview) => {
      setLostTicketState((prev) => prev ? { ...prev, preview, loading: false } : prev);
    });
  };

  // ── Submit lost ticket ─────────────────────────────────
  const handleLostTicketConfirm = async (method: 'CASH' | 'CARD' | 'EWALLET') => {
    if (!lostTicketState) return;
    setLostTicketState((prev) => prev ? { ...prev, loading: true, error: '' } : prev);
    try {
      const result = await submitLostTicket({ plate: lostTicketState.record.vehicle!.plateNumber, method });
      setLostTicketState((prev) => prev ? { ...prev, result, loading: false } : prev);
      setCheckoutResult(result);
      setFoundRecord(null);
      setFeePreview(null);
      setOwnerInfo(null);
      setPlateInput('');
      loadAllRecords();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Xử lý mất thẻ thất bại. Vui lòng thử lại.';
      setLostTicketState((prev) => prev ? { ...prev, error: msg, loading: false } : prev);
    }
  };

  return (
    <div style={{
      minHeight: '100%',
      background: '#F0F4F8',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      padding: '1.5rem',
      boxSizing: 'border-box',
    }}>

      {/* ── PAGE TITLE ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: C.navy }}>
          Check-out xe
        </h1>
        <p style={{ margin: '0.15rem 0 0', fontSize: '0.875rem', color: C.gray500 }}>
          Tìm xe → Thanh toán → Cho xe ra bãi
        </p>
      </div>

      {/* ── TOP: plate search ── */}
      <div style={{
        background: C.white,
        borderRadius: C.radius,
        boxShadow: C.shadow,
        padding: '1.25rem 1.5rem',
        marginBottom: '1.25rem',
      }}>
        <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: C.gray800 }}>
          Tìm xe
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            type="text"
            value={plateInput}
            onChange={(e) => { setPlateInput(e.target.value.toUpperCase()); setSearchError(''); setFoundRecord(null); setFeePreview(null); setOwnerInfo(null); }}
            onKeyDown={handleKeyDown}
            placeholder="VD: 51A-11111"
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
              padding: '0.65rem 1.25rem',
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

        {searchError && (
          <div style={{
            background: C.redBg,
            border: `1.5px solid ${C.redBorder}`,
            borderRadius: 8,
            padding: '0.5rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <IconAlert size={14} color={C.red} />
            <span style={{ fontSize: '0.82rem', color: C.red }}>{searchError}</span>
          </div>
        )}

        <div style={{
          border: `2px dashed ${C.gray200}`,
          borderRadius: 12,
          padding: '1rem 1.25rem',
          background: C.gray50,
          textAlign: 'center',
          minHeight: 70,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '0.75rem',
        }}>
          {foundRecord ? (
            <div>
              <p style={{
                margin: 0,
                fontSize: '1.4rem',
                fontWeight: 800,
                fontFamily: "'Consolas','Courier New',monospace",
                color: C.navy,
                letterSpacing: '0.06em',
              }}>
                {foundRecord.vehicle!.plateNumber}
              </p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: C.gray500 }}>
                {foundRecord.vehicle!.type === 'MOTORBIKE' ? 'Xe máy' : 'Ô tô'}
                {' · '}
                Vị trí: <strong>{foundRecord.slot!.code}</strong>
                {' · '}
                Giờ vào: {formatDateTime(foundRecord.checkInTime)}
                {' · '}
                {foundRecord.isMonthly ? (
                  <span style={{ color: C.green, fontWeight: 700 }}>Khách tháng</span>
                ) : (
                  <span style={{ color: C.navy, fontWeight: 700 }}>Khách lẻ</span>
                )}
              </p>
            </div>
          ) : !searching ? (
            <p style={{ margin: 0, fontSize: '0.82rem', color: C.gray400 }}>
              Nhập biển số xe đang đỗ trong bãi để bắt đầu check-out
            </p>
          ) : null}
        </div>

        {foundRecord && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              onClick={handleDismissFound}
              style={{
                background: 'none',
                border: 'none',
                color: C.gray400,
                fontSize: '0.78rem',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              Bỏ chọn
            </button>
          </div>
        )}
      </div>

      {/* ── RESULT: monthly panel ── */}
      {foundRecord?.isMonthly && (
        <div style={{
          background: C.white,
          borderRadius: C.radius,
          boxShadow: C.shadow,
          padding: '1.25rem 1.5rem',
          marginBottom: '1.25rem',
          borderTop: `4px solid ${C.green}`,
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: C.greenBg,
            border: `1.5px solid ${C.greenBorder}`,
            borderRadius: 20,
            padding: '0.3rem 0.75rem',
            marginBottom: '1rem',
          }}>
            <IconCheck size={13} color={C.green} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: C.green }}>
              KHÁCH THÁNG · Miễn phí khi ra
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Biển số', value: foundRecord.vehicle!.plateNumber },
              { label: 'Vị trí', value: foundRecord.slot!.code },
              { label: 'Giờ vào', value: formatDateTime(foundRecord.checkInTime) },
              { label: 'Giờ ra', value: now() },
            ].map((r) => (
              <div key={r.label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.45rem 0',
                borderBottom: `1px solid ${C.gray100}`,
              }}>
                <span style={{ fontSize: '0.82rem', color: C.gray500 }}>{r.label}</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: C.gray800 }}>{r.value}</span>
              </div>
            ))}
          </div>

          {(foundRecord.vehicle!.brand || foundRecord.vehicle!.model || foundRecord.vehicle!.color || foundRecord.vehicle!.year || foundRecord.vehicle!.seats) && (
            <div style={{
              background: C.gray50,
              border: `1px solid ${C.gray200}`,
              borderRadius: 10,
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
            }}>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Thông tin xe
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 0.8rem' }}>
                {foundRecord.vehicle!.brand && (
                  <div>
                    <span style={{ fontSize: '0.7rem', color: C.gray400 }}>Hãng</span>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{foundRecord.vehicle!.brand}</div>
                  </div>
                )}
                {foundRecord.vehicle!.model && (
                  <div>
                    <span style={{ fontSize: '0.7rem', color: C.gray400 }}>Mẫu</span>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{foundRecord.vehicle!.model}</div>
                  </div>
                )}
                {foundRecord.vehicle!.color && (
                  <div>
                    <span style={{ fontSize: '0.7rem', color: C.gray400 }}>Màu</span>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{foundRecord.vehicle!.color}</div>
                  </div>
                )}
                {foundRecord.vehicle!.year && (
                  <div>
                    <span style={{ fontSize: '0.7rem', color: C.gray400 }}>Năm</span>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{foundRecord.vehicle!.year}</div>
                  </div>
                )}
                {foundRecord.vehicle!.seats != null && (
                  <div>
                    <span style={{ fontSize: '0.7rem', color: C.gray400 }}>Số chỗ</span>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{foundRecord.vehicle!.seats} chỗ</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {ownerInfo && (
            <div style={{
              background: C.greenBg,
              border: `1.5px solid ${C.greenBorder}`,
              borderRadius: 10,
              padding: '0.85rem 1rem',
            }}>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Thông tin chủ xe
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.82rem', color: '#15803D' }}>Họ tên</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{ownerInfo.name}</span>
                </div>
                {ownerInfo.phone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', color: '#15803D' }}>SĐT</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{ownerInfo.phone}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.82rem', color: '#15803D' }}>Email</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{ownerInfo.email}</span>
                </div>
              </div>
            </div>
          )}

          <div style={{
            background: C.greenBg,
            border: `1.5px solid ${C.greenBorder}`,
            borderRadius: 10,
            padding: '0.6rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.25rem',
          }}>
            <IconCheck size={14} color={C.green} />
            <span style={{ fontSize: '0.82rem', color: '#15803D', fontWeight: 500 }}>
              Khách tháng — không thu phí khi ra cổng.
            </span>
          </div>

          <button
            onClick={() => openConfirm(foundRecord, feePreview)}
            disabled={!feePreview}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: feePreview ? C.green : C.gray200,
              color: feePreview ? C.white : C.gray400,
              border: 'none',
              borderRadius: 12,
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: feePreview ? 'pointer' : 'not-allowed',
              boxShadow: feePreview ? '0 4px 14px rgba(22,163,74,0.25)' : 'none',
            }}
          >
            Xác nhận cho xe ra
          </button>
        </div>
      )}

      {/* ── RESULT: casual panel ── */}
      {foundRecord && !foundRecord.isMonthly && (
        <div style={{
          background: C.white,
          borderRadius: C.radius,
          boxShadow: C.shadow,
          padding: '1.25rem 1.5rem',
          marginBottom: '1.25rem',
          borderTop: `4px solid ${C.navy}`,
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#EFF6FF',
            border: '1.5px solid #BFDBFE',
            borderRadius: 20,
            padding: '0.3rem 0.75rem',
            marginBottom: '1rem',
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: C.navy }}>KHÁCH LẺ</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
            {[
              { label: 'Biển số', value: foundRecord.vehicle!.plateNumber },
              { label: 'Vị trí', value: foundRecord.slot!.code },
              { label: 'Giờ vào', value: formatDateTime(foundRecord.checkInTime) },
              { label: 'Giờ ra', value: now() },
            ].map((r) => (
              <div key={r.label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.45rem 0',
                borderBottom: `1px solid ${C.gray100}`,
              }}>
                <span style={{ fontSize: '0.82rem', color: C.gray500 }}>{r.label}</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: C.gray800 }}>{r.value}</span>
              </div>
            ))}
          </div>

          {(foundRecord.vehicle!.brand || foundRecord.vehicle!.model || foundRecord.vehicle!.color || foundRecord.vehicle!.year || foundRecord.vehicle!.seats) && (
            <div style={{
              background: C.gray50,
              border: `1px solid ${C.gray200}`,
              borderRadius: 10,
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
            }}>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Thông tin xe
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 0.8rem' }}>
                {foundRecord.vehicle!.brand && (
                  <div>
                    <span style={{ fontSize: '0.7rem', color: C.gray400 }}>Hãng</span>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{foundRecord.vehicle!.brand}</div>
                  </div>
                )}
                {foundRecord.vehicle!.model && (
                  <div>
                    <span style={{ fontSize: '0.7rem', color: C.gray400 }}>Mẫu</span>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{foundRecord.vehicle!.model}</div>
                  </div>
                )}
                {foundRecord.vehicle!.color && (
                  <div>
                    <span style={{ fontSize: '0.7rem', color: C.gray400 }}>Màu</span>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{foundRecord.vehicle!.color}</div>
                  </div>
                )}
                {foundRecord.vehicle!.year && (
                  <div>
                    <span style={{ fontSize: '0.7rem', color: C.gray400 }}>Năm</span>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{foundRecord.vehicle!.year}</div>
                  </div>
                )}
                {foundRecord.vehicle!.seats != null && (
                  <div>
                    <span style={{ fontSize: '0.7rem', color: C.gray400 }}>Số chỗ</span>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{foundRecord.vehicle!.seats} chỗ</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {ownerInfo && (
            <div style={{
              background: '#EFF6FF',
              border: '1.5px solid #BFDBFE',
              borderRadius: 10,
              padding: '0.85rem 1rem',
            }}>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Thông tin chủ xe
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.82rem', color: C.navy }}>Họ tên</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{ownerInfo.name}</span>
                </div>
                {ownerInfo.phone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', color: C.navy }}>SĐT</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{ownerInfo.phone}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.82rem', color: C.navy }}>Email</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.gray800 }}>{ownerInfo.email}</span>
                </div>
              </div>
            </div>
          )}

          {/* Fee breakdown from API */}
          {feePreview && (
            <div style={{ marginBottom: '1rem' }}>
              <FeeBreakdownCard
                fee={feePreview.fee}
                breakdown={feePreview.breakdown}
                depositCredit={feePreview.depositCredit}
                total={feePreview.amountDue ?? feePreview.fee}
              />
            </div>
          )}

          {!feePreview && !searching && (
            <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: C.gray400 }}>
              Đang tính phí...
            </p>
          )}

          {/* Payment method */}
          {feePreview && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Phương thức thanh toán
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['CASH', 'CARD', 'EWALLET'] as const).map((method) => {
                  const labels: Record<string, string> = { CASH: 'Tiền mặt', CARD: 'Thẻ', EWALLET: 'Ví điện tử' };
                  return (
                    <button
                      key={method}
                      onClick={() => openConfirm(foundRecord, feePreview)}
                      style={{
                        flex: 1,
                        padding: '0.6rem',
                        background: C.navy,
                        color: C.white,
                        border: 'none',
                        borderRadius: 10,
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(30,58,95,0.2)',
                      }}
                    >
                      {labels[method]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SUCCESS BANNER ── */}
      {checkoutResult && (
        <div style={{
          background: C.greenBg,
          border: `2px solid ${C.greenBorder}`,
          borderRadius: 16,
          padding: '1.25rem 1.5rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <IconCheck size={24} color={C.green} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#15803D' }}>
              Check-out thành công!
            </p>
            {checkoutResult.paymentRequired ? (
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#166534' }}>
                Xe đã ra bãi · {formatCurrency(checkoutResult.amountDue ?? checkoutResult.fee ?? 0)}
              </p>
            ) : (
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#166534' }}>
                Xe đã ra bãi · {checkoutResult.note ?? 'Miễn phí gói tháng'}
              </p>
            )}
          </div>
          <button
            onClick={handleDismissResult}
            style={{
              padding: '0.45rem 1rem',
              background: C.green,
              color: C.white,
              border: 'none',
              borderRadius: 8,
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Check-out xe mới
          </button>
        </div>
      )}

      {/* ── POST-CHECKOUT FEE DETAIL ── */}
      {checkoutResult && checkoutResult.paymentRequired && checkoutResult.breakdown && checkoutResult.breakdown.length > 0 && (
        <div style={{
          background: C.white,
          borderRadius: C.radius,
          boxShadow: C.shadow,
          padding: '1.25rem 1.5rem',
          marginBottom: '1.25rem',
          borderTop: `4px solid ${C.navy}`,
        }}>
          <FeeBreakdownCard
            fee={checkoutResult.fee ?? 0}
            breakdown={checkoutResult.breakdown}
            depositCredit={checkoutResult.depositCredit}
            total={checkoutResult.amountDue ?? checkoutResult.fee ?? 0}
          />
        </div>
      )}

      {/* ── BOTTOM: all parked vehicles ── */}
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

        {loadingAll ? (
          <p style={{ margin: 0, padding: '1rem 0', fontSize: '0.875rem', color: C.gray400, textAlign: 'center' }}>
            Đang tải...
          </p>
        ) : allRecords.length === 0 ? (
          <p style={{ margin: 0, padding: '1rem 0', fontSize: '0.875rem', color: C.gray400, textAlign: 'center' }}>
            Không có xe đang đỗ trong bãi.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.gray200}` }}>
                  {['Biển số', 'Vị trí', 'Giờ vào', 'Loại xe', 'Khách', ''].map((col) => (
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
                {allRecords.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${C.gray100}` }}>
                    <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'Consolas, monospace', fontWeight: 700, color: C.navy, letterSpacing: '0.02em' }}>
                      {r.vehicle!.plateNumber}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.82rem', color: C.gray800 }}>
                      {r.slot!.code}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.82rem', color: C.gray600 }}>
                      {formatDateTime(r.checkInTime)}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.55rem',
                        borderRadius: 20,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: r.vehicle!.type === 'MOTORBIKE' ? '#FEF9C3' : '#EFF6FF',
                        color: r.vehicle!.type === 'MOTORBIKE' ? '#854D0E' : C.navy,
                      }}>
                        {r.vehicle!.type === 'MOTORBIKE' ? 'Xe máy' : 'Ô tô'}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.55rem',
                        borderRadius: 20,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: r.isMonthly ? C.greenBg : '#EFF6FF',
                        color: r.isMonthly ? '#15803D' : C.navy,
                      }}>
                        {r.isMonthly ? 'Tháng' : 'Lẻ'}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          onClick={async () => { 
                            setFoundRecord(r); 
                            setPlateInput(r.vehicle!.plateNumber); 
                            fetchFeePreview(r.id).then(setFeePreview);
                            try {
                              const lookup = await checkoutLookupPlate(r.vehicle!.plateNumber);
                              if (lookup.found) {
                                setOwnerInfo({
                                  name: lookup.ownerName ?? null,
                                  phone: lookup.ownerPhone ?? null,
                                  email: lookup.ownerEmail ?? null,
                                });
                              } else {
                                setOwnerInfo({ name: 'Walk-in Customer', phone: null, email: 'walkin@system.local' });
                              }
                            } catch {
                              setOwnerInfo({ name: 'Walk-in Customer', phone: null, email: 'walkin@system.local' });
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
                          Check-out
                        </button>
                        <button
                          onClick={async () => { openLostTicket(r); }}
                          style={{
                            background: '#DC2626',
                            color: C.white,
                            border: 'none',
                            borderRadius: 8,
                            padding: '0.35rem 0.85rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Mất thẻ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── LOST TICKET MODAL ── */}
      {lostTicketState && !lostTicketState.result && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(17,24,39,0.45)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setLostTicketState(null); }}
        >
          <div style={{
            background: C.white,
            borderRadius: 16,
            padding: '1.5rem',
            width: 440,
            boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: 800, color: '#DC2626' }}>
              Xác nhận mất thẻ
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: '#FEE2E2', padding: '0.65rem 0.9rem', borderRadius: 10, border: '1.5px solid #FECACA' }}>
              <IconAlert size={16} color={C.red} />
              <span style={{ fontSize: '0.82rem', color: '#991B1B', fontWeight: 600 }}>
                Xe ra cổng với phương thức mất thẻ · Phí có thể cao hơn.
              </span>
            </div>

            {lostTicketState.error && (
              <div style={{
                background: C.redBg,
                border: `1.5px solid ${C.redBorder}`,
                borderRadius: 8,
                padding: '0.5rem 0.75rem',
                marginBottom: '1rem',
                fontSize: '0.82rem',
                color: C.red,
              }}>
                {lostTicketState.error}
              </div>
            )}

            <div style={{
              background: C.gray50,
              borderRadius: 10,
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
            }}>
              {[
                { label: 'Biển số', value: lostTicketState.record.vehicle!.plateNumber, mono: true },
                { label: 'Vị trí', value: lostTicketState.record.slot!.code },
                { label: 'Giờ vào', value: formatDateTime(lostTicketState.record.checkInTime) },
                { label: 'Loại xe', value: lostTicketState.record.vehicle!.type === 'MOTORBIKE' ? 'Xe máy' : 'Ô tô' },
                { label: 'Khách', value: lostTicketState.record.isMonthly ? 'Khách tháng' : 'Khách lẻ', color: lostTicketState.record.isMonthly ? C.green : undefined },
              ].map((r) => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.82rem', color: C.gray500 }}>{r.label}</span>
                  <span style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: r.color ?? C.gray800,
                    fontFamily: (r as { mono?: boolean }).mono ? "'Consolas','Courier New',monospace" : undefined,
                  }}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>

            {lostTicketState.isMonthly && (
              <div style={{
                background: C.greenBg,
                border: `1.5px solid ${C.greenBorder}`,
                borderRadius: 10,
                padding: '0.65rem 0.9rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <IconCheck size={14} color={C.green} />
                <span style={{ fontSize: '0.82rem', color: '#15803D', fontWeight: 500 }}>
                  Khách tháng — không thu phí khi ra.
                </span>
              </div>
            )}

            {!lostTicketState.isMonthly && lostTicketState.preview && (
              <div style={{ marginBottom: '1rem' }}>
                <FeeBreakdownCard
                  fee={lostTicketState.preview.fee}
                  breakdown={lostTicketState.preview.breakdown}
                  depositCredit={lostTicketState.preview.depositCredit}
                  total={lostTicketState.preview.amountDue ?? lostTicketState.preview.fee}
                />
              </div>
            )}

            {!lostTicketState.preview && !lostTicketState.loading && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: C.gray400 }}>
                Đang tính phí mất thẻ...
              </p>
            )}

            {!lostTicketState.isMonthly && (
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Phương thức thanh toán
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {(['CASH', 'CARD', 'EWALLET'] as const).map((method) => {
                    const labels: Record<string, string> = { CASH: 'Tiền mặt', CARD: 'Thẻ', EWALLET: 'Ví điện tử' };
                    return (
                      <button
                        key={method}
                        onClick={() => handleLostTicketConfirm(method)}
                        disabled={lostTicketState.loading}
                        style={{
                          flex: 1,
                          padding: '0.6rem',
                          background: lostTicketState.loading ? C.gray200 : '#DC2626',
                          color: C.white,
                          border: 'none',
                          borderRadius: 10,
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: lostTicketState.loading ? 'not-allowed' : 'pointer',
                          boxShadow: lostTicketState.loading ? 'none' : '0 2px 8px rgba(220,38,38,0.25)',
                        }}
                      >
                        {lostTicketState.loading ? 'Đang xử lý...' : labels[method]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {lostTicketState.isMonthly && (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => handleLostTicketConfirm('CASH')}
                  disabled={lostTicketState.loading}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: lostTicketState.loading ? C.gray200 : '#DC2626',
                    color: C.white,
                    border: 'none',
                    borderRadius: 12,
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: lostTicketState.loading ? 'not-allowed' : 'pointer',
                    boxShadow: lostTicketState.loading ? 'none' : '0 4px 14px rgba(220,38,38,0.25)',
                  }}
                >
                  {lostTicketState.loading ? 'Đang xử lý...' : 'Xác nhận cho xe ra (mất thẻ)'}
                </button>
                <button
                  onClick={() => setLostTicketState(null)}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: C.white,
                    color: C.gray500,
                    border: `1.5px solid ${C.gray200}`,
                    borderRadius: 12,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CONFIRM MODAL ── */}
      {confirmState && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(17,24,39,0.45)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleCancelConfirm(); }}
        >
          <div style={{
            background: C.white,
            borderRadius: 16,
            padding: '1.5rem',
            width: 420,
            boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 800, color: C.navy }}>
              Xác nhận check-out
            </h3>

            {checkoutError && (
              <div style={{
                background: C.redBg,
                border: `1.5px solid ${C.redBorder}`,
                borderRadius: 8,
                padding: '0.5rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem',
              }}>
                <IconAlert size={14} color={C.red} />
                <span style={{ fontSize: '0.82rem', color: C.red }}>{checkoutError}</span>
              </div>
            )}

            {/* Record summary */}
            <div style={{
              background: C.gray50,
              borderRadius: 10,
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
            }}>
              {[
                { label: 'Biển số', value: confirmState.record.vehicle!.plateNumber, mono: true },
                { label: 'Vị trí', value: confirmState.record.slot!.code },
                { label: 'Giờ vào', value: formatDateTime(confirmState.record.checkInTime) },
                { label: 'Loại xe', value: confirmState.record.vehicle!.type === 'MOTORBIKE' ? 'Xe máy' : 'Ô tô' },
                { label: 'Khách', value: confirmState.record.isMonthly ? 'Khách tháng' : 'Khách lẻ', color: confirmState.record.isMonthly ? C.green : undefined },
              ].map((r) => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.82rem', color: C.gray500 }}>{r.label}</span>
                  <span style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: r.color ?? C.gray800,
                    fontFamily: (r as { mono?: boolean }).mono ? "'Consolas','Courier New',monospace" : undefined,
                  }}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Monthly: no fee */}
            {confirmState.record.isMonthly && (
              <div style={{
                background: C.greenBg,
                border: `1.5px solid ${C.greenBorder}`,
                borderRadius: 10,
                padding: '0.65rem 0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1.25rem',
              }}>
                <IconCheck size={14} color={C.green} />
                <span style={{ fontSize: '0.82rem', color: '#15803D', fontWeight: 500 }}>
                  Miễn phí khi ra cổng — Đã bao gồm trong gói tháng
                </span>
              </div>
            )}

            {/* Casual: fee + payment method in modal */}
            {!confirmState.record.isMonthly && confirmState.feePreview && (
              <>
                {confirmState.feePreview.breakdown.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <FeeBreakdownCard
                      fee={confirmState.feePreview.fee}
                      breakdown={confirmState.feePreview.breakdown}
                      depositCredit={confirmState.feePreview.depositCredit}
                      total={confirmState.feePreview.amountDue ?? confirmState.feePreview.fee}
                    />
                  </div>
                )}

                {/* Payment method selector */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: C.gray500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Phương thức thanh toán
                  </p>
                  <select
                    value={confirmState.paymentMethod}
                    onChange={(e) => setConfirmState({ ...confirmState, paymentMethod: e.target.value as 'CASH' | 'CARD' | 'EWALLET' })}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      border: `1.5px solid ${C.gray200}`,
                      borderRadius: 8,
                      fontSize: '0.875rem',
                      color: C.gray800,
                      background: C.white,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="CASH">Tiền mặt (Cash)</option>
                    <option value="CARD">Thẻ (Card)</option>
                    <option value="EWALLET">Ví điện tử (E-Wallet)</option>
                  </select>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleConfirm}
                disabled={checkoutLoading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: checkoutLoading ? C.gray200 : C.navy,
                  color: checkoutLoading ? C.gray400 : C.white,
                  border: 'none',
                  borderRadius: 12,
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: checkoutLoading ? 'not-allowed' : 'pointer',
                  boxShadow: checkoutLoading ? 'none' : '0 4px 14px rgba(30,58,95,0.25)',
                }}
              >
                {checkoutLoading ? 'Đang xử lý...' : 'Xác nhận check-out'}
              </button>
              <button
                onClick={handleCancelConfirm}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: C.white,
                  color: C.gray500,
                  border: `1.5px solid ${C.gray200}`,
                  borderRadius: 12,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}