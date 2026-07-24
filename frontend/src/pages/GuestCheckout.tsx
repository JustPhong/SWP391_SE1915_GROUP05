import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  lookupGuestCode,
  prepayGuestCode,
  payOverstayGuestCode,
  confirmGuestExit,
} from '../api/guestCheckoutApi';

interface State {
  code: string;
  lookupLoading: boolean;
  lookupError: string;
  result: any;
  paying: boolean;
  payingError: string;
  payingMethod: 'CASH' | 'CARD' | 'EWALLET';
  exiting: boolean;
  exitError: string;
  success: string | null;
}

export const GuestCheckoutPage: React.FC = () => {
  const location = useLocation();
  const [state, setState] = useState<State>({
    code: '',
    lookupLoading: false,
    lookupError: '',
    result: null,
    paying: false,
    payingError: '',
    payingMethod: 'CASH',
    exiting: false,
    exitError: '',
    success: null,
  });
  const autoRan = useRef(false);

  useEffect(() => {
    if (autoRan.current) return;
    const fromState = (location.state as any);
    const initialCode = fromState?.guestCode as string | undefined;
    if (initialCode && /^\d{6}$/.test(initialCode)) {
      setState((s) => ({ ...s, code: initialCode }));
      autoRan.current = true;
      setTimeout(() => doLookup(initialCode), 50);
    }
  }, []);

  const set = (partial: Partial<State>) => setState((s) => ({ ...s, ...partial }));

  const doLookup = async (code: string) => {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      set({ lookupError: 'Mã khách phải là 6 chữ số.' });
      return;
    }
    set({ lookupLoading: true, lookupError: '', result: null, success: null });
    try {
      const data = await lookupGuestCode(trimmed);
      set({ result: data, lookupLoading: false, lookupError: data.message || '' });
    } catch {
      set({ lookupLoading: false, lookupError: 'Không thể tra cứu mã khách.' });
    }
  };

  const doPrepay = async () => {
    if (!state.result?.found || !state.code) return;
    set({ paying: true, payingError: '' });
    try {
      const data = await prepayGuestCode(state.code.trim(), state.payingMethod);
      if (!data.ok) {
        set({ paying: false, payingError: data.message || 'Thanh toán thất bại.' });
        return;
      }
      set({ paying: false, success: 'Thanh toán thành công! Vui lòng ra cổng trong 15 phút.' });
      await doLookup(state.code.trim());
    } catch {
      set({ paying: false, payingError: 'Không thể thanh toán.' });
    }
  };

  const doPayOverstay = async () => {
    if (!state.result?.found || !state.code) return;
    set({ paying: true, payingError: '' });
    try {
      const data = await payOverstayGuestCode(state.code.trim(), state.payingMethod);
      if (!data.ok) {
        set({ paying: false, payingError: data.message || 'Thanh toán phí phát sinh thất bại.' });
        return;
      }
      set({ paying: false, success: 'Đã thanh toán phí phát sinh. Vui lòng ra cổng trong 15 phút.' });
      await doLookup(state.code.trim());
    } catch {
      set({ paying: false, payingError: 'Không thể thanh toán phí phát sinh.' });
    }
  };

  const doConfirmExit = async () => {
    if (!state.result?.found || !state.code) return;
    set({ exiting: true, exitError: '' });
    try {
      const data = await confirmGuestExit(state.code.trim());
      set({ exiting: false, success: 'Xác nhận xe ra cổng thành công!' });
      setState((s) => ({ ...s, result: { ...s.result, ...data }, code: '' }));
    } catch {
      set({ exiting: false, exitError: 'Không thể xác nhận xe ra cổng.' });
    }
  };

  const formatCurrency = (amount: number | undefined) =>
    amount == null ? '---' : new Intl.NumberFormat('vi-VN').format(amount) + ' đ';

  const formatDateTime = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const countdownTo = (iso?: string) => {
    if (!iso) return null;
    const target = new Date(iso).getTime();
    const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isOverdue = (r: any) => {
    if (!r || !r.graceExpiresAt) return false;
    return new Date() > new Date(r.graceExpiresAt);
  };

  const needsPayOverstay = (r: any) => {
    if (!r) return false;
    return !r.isMonthly && r.fee > 0 && isOverdue(r);
  };

  const canExit = (r: any) => {
    if (!r) return false;
    if (r.isMonthly) return true;
    if (isOverdue(r)) return false;
    return true;
  };

  return (
    <div style={{ minHeight: '100%', background: '#F0F4F8', fontFamily: "'Segoe UI', Arial, sans-serif", padding: '1.5rem', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#1E3A5F' }}>Check-out khách vãng lai</h1>
        <p style={{ margin: '0.15rem 0 0', fontSize: '0.875rem', color: '#6B7280' }}>Nhập mã 6 số được cấp khi check-in để thanh toán và ra cổng.</p>
      </div>

      <div style={{ background: '#FFFFFF', borderRadius: 18, boxShadow: '0 8px 32px rgba(30,58,95,0.08)', padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Nhập mã khách</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={state.code}
            onChange={(e) => set({ code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
            onKeyDown={(e) => { if (e.key === 'Enter') doLookup(state.code); }}
            placeholder="VD: 471829"
            maxLength={6}
            style={{
              flex: 1,
              padding: '0.65rem 0.85rem',
              border: `1.5px solid ${state.lookupError ? '#FECACA' : '#E5E7EB'}`,
              borderRadius: 10,
              fontSize: '1.1rem',
              fontWeight: 700,
              fontFamily: "'Consolas','Courier New',monospace",
              color: '#111827',
              background: '#FFFFFF',
              outline: 'none',
              boxSizing: 'border-box',
              letterSpacing: '0.12em',
            }}
          />
          <button
            onClick={() => doLookup(state.code)}
            disabled={!state.code.trim() || state.lookupLoading}
            style={{
              padding: '0.65rem 1.25rem',
              background: state.code.trim() && !state.lookupLoading ? '#1E3A5F' : '#E5E7EB',
              color: state.code.trim() && !state.lookupLoading ? '#FFFFFF' : '#9CA3AF',
              border: 'none',
              borderRadius: 10,
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: state.code.trim() && !state.lookupLoading ? 'pointer' : 'not-allowed',
            }}
          >
            {state.lookupLoading ? 'Đang tìm...' : 'Tra cứu'}
          </button>
        </div>

        {state.lookupError && (
          <div style={{ marginTop: '0.5rem', background: '#FEE2E2', border: '1.5px solid #FECACA', borderRadius: 8, padding: '0.5rem 0.75rem', color: '#DC2626', fontSize: '0.82rem' }}>
            {state.lookupError}
          </div>
        )}
      </div>

      {state.success && (
        <div style={{ background: '#DCFCE7', border: '2px solid #86EFAC', borderRadius: 16, padding: '1.25rem 1.5rem', marginBottom: '1.25rem', color: '#15803D', fontWeight: 700 }}>
          {state.success}
        </div>
      )}

      {state.result?.found && (
        <div style={{ background: '#FFFFFF', borderRadius: 18, boxShadow: '0 8px 32px rgba(30,58,95,0.08)', padding: '1.25rem 1.5rem', marginBottom: '1.25rem', borderTop: `4px solid ${state.result.isMonthly ? '#16A34A' : '#1E3A5F'}` }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: state.result.isMonthly ? '#DCFCE7' : '#EFF6FF', border: `1.5px solid ${state.result.isMonthly ? '#86EFAC' : '#BFDBFE'}`, borderRadius: 20, padding: '0.3rem 0.75rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: state.result.isMonthly ? '#16A34A' : '#1E3A5F' }}>
              {state.result.isMonthly ? 'KHÁCH THÁNG' : 'KHÁCH LẺ'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
            {[
              { label: 'Biển số', value: state.result.plate },
              { label: 'Vị trí', value: state.result.slotCode ?? '---' },
              { label: 'Giờ vào', value: formatDateTime(state.result.checkInTime) },
              { label: 'Thời gian đỗ', value: `${state.result.durationMinutes} phút` },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid #F3F5F7' }}>
                <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>{item.label}</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111827' }}>{item.value}</span>
              </div>
            ))}
          </div>

          {!state.result.isMonthly && (
            <>
              {state.result.graceExpiresAt && (
                <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: '#1E3A5F' }}>Thời gian còn lại miễn phí</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: isOverdue(state.result) ? '#DC2626' : '#15803D' }}>
                    {isOverdue(state.result) ? 'Hết hạn' : countdownTo(state.result.graceExpiresAt)}
                  </span>
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderTop: '2px solid #E5E7EB' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E3A5F' }}>Phí cần thanh toán</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#DC2626' }}>{formatCurrency(state.result.amountDue)}</span>
                </div>
                {state.result.prepaidFee > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0' }}>
                    <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>Đã trả trước</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#15803D' }}>- {formatCurrency(state.result.prepaidFee)}</span>
                  </div>
                )}
              </div>

              {state.payingError && (
                <div style={{ marginBottom: '0.75rem', background: '#FEE2E2', border: '1.5px solid #FECACA', borderRadius: 8, padding: '0.5rem 0.75rem', color: '#DC2626', fontSize: '0.82rem' }}>
                  {state.payingError}
                </div>
              )}

              {!needsPayOverstay(state.result) && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Phương thức thanh toán</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['CASH', 'CARD', 'EWALLET'] as const).map((method) => {
                      const label = method === 'CASH' ? 'Tiền mặt' : method === 'CARD' ? 'Thẻ' : 'Ví điện tử';
                      return (
                        <button key={method} onClick={() => set({ payingMethod: method })} style={{
                          flex: 1,
                          padding: '0.6rem',
                          background: state.payingMethod === method ? '#1E3A5F' : '#F3F5F7',
                          color: state.payingMethod === method ? '#FFFFFF' : '#6B7280',
                          border: 'none',
                          borderRadius: 10,
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {canExit(state.result) && (
                  <button onClick={doConfirmExit} disabled={state.exiting} style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: state.exiting ? '#9CA3AF' : '#16A34A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: state.exiting ? 'not-allowed' : 'pointer',
                  }}>
                    {state.exiting ? 'Đang xác nhận...' : 'Xác nhận xe đã ra cổng'}
                  </button>
                )}
                {!needsPayOverstay(state.result) && (
                  <button onClick={doPrepay} disabled={state.paying} style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: state.paying ? '#9CA3AF' : '#1E3A5F',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: state.paying ? 'not-allowed' : 'pointer',
                  }}>
                    {state.paying ? 'Đang xử lý...' : 'Thanh toán ngay'}
                  </button>
                )}
                {needsPayOverstay(state.result) && (
                  <button onClick={doPayOverstay} disabled={state.paying} style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: state.paying ? '#9CA3AF' : '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: state.paying ? 'not-allowed' : 'pointer',
                  }}>
                    {state.paying ? 'Đang xử lý...' : 'Thanh toán phí phát sinh'}
                  </button>
                )}
              </div>

              {state.exitError && (
                <div style={{ marginTop: '0.5rem', background: '#FEE2E2', border: '1.5px solid #FECACA', borderRadius: 8, padding: '0.5rem 0.75rem', color: '#DC2626', fontSize: '0.82rem' }}>
                  {state.exitError}
                </div>
              )}
            </>
          )}

          {state.result.isMonthly && (
            <button onClick={doConfirmExit} disabled={state.exiting} style={{
              width: '100%',
              marginTop: '0.5rem',
              padding: '0.75rem',
              background: state.exiting ? '#9CA3AF' : '#16A34A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 12,
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: state.exiting ? 'not-allowed' : 'pointer',
            }}>
              {state.exiting ? 'Đang xác nhận...' : 'Xác nhận cho xe ra'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
