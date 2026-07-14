import { useState, useEffect } from 'react';
import type { CheckoutFormData } from './CheckoutWizard';

export interface Props {
  data: CheckoutFormData;
  onNext: (method: 'CASH' | 'CARD' | 'EWALLET') => void;
}

export default function Step3_Payment({ data, onNext }: Props) {
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'EWALLET'>('CASH');
  const [checkoutTime, setCheckoutTime] = useState('');
  const [fee, setFee] = useState<number>(data.paymentInfo.amount || 0);
  const [breakdown, setBreakdown] = useState<any[]>(data.paymentInfo.feeBreakdown || []);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const d = new Date();
    setCheckoutTime(d.toISOString().slice(0, 16));
  }, []);

  const handleConfirm = async () => {
    setProcessing(true);
    // Simulate or call API to calculate fee with checkoutTime
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/checkout/calculate-fee/${data.ticketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ checkOutTime: new Date(checkoutTime).toISOString() }),
      });
      const j = await res.json();
      if (j.success) {
        setFee(j.data.fee || 0);
        setBreakdown(j.data.breakdown || []);
      }
    } catch {
      // keep current fee
    } finally {
      setProcessing(false);
    }
    onNext(method);
  };

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '1.25rem 1.5rem', marginBottom: '1.25rem', boxShadow: '0 8px 32px rgba(30,58,95,0.08)' }}>
      <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Thanh toán</p>

      <div style={{ background: '#F3F4F6', borderRadius: 12, padding: '0.85rem 1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>Biển số</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111827', fontFamily: 'Consolas, monospace' }}>{data.vehicleInfo.plate}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>Vị trí</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111827' }}>{data.vehicleInfo.slotCode}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>Giờ vào</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111827' }}>{new Date(data.vehicleInfo.checkInTime).toLocaleString('vi-VN')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>Giờ ra</span>
          <input type="datetime-local" value={checkoutTime} onChange={(e) => setCheckoutTime(e.target.value)} style={{ padding: '0.35rem 0.5rem', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: '0.85rem', color: '#111827', background: '#fff' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>Loại</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111827' }}>{data.vehicleInfo.isMonthly ? 'Khách tháng' : 'Khách lẻ'}</span>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Chi tiết phí</p>
        {breakdown.map((b: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #F3F4F6' }}>
            <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>{b.label}</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111827' }}>{b.amount?.toLocaleString('vi-VN')}đ</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderTop: '2px solid #E5E7EB', marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#111827' }}>Tổng cộng</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#DC2626' }}>{fee.toLocaleString('vi-VN')}đ</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['CASH', 'CARD', 'EWALLET'] as const).map((m) => (
          <button key={m} onClick={() => setMethod(m)} style={{ flex: 1, padding: '0.6rem', background: method === m ? '#0B2F6B' : '#fff', color: method === m ? '#fff' : '#111827', border: method === m ? 'none' : '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
            {m === 'CASH' ? 'Tiền mặt' : m === 'CARD' ? 'Thẻ' : 'Ví điện tử'}
          </button>
        ))}
      </div>

      <button onClick={handleConfirm} disabled={processing} style={{ width: '100%', padding: '0.75rem', background: '#0B2F6B', color: '#fff', border: 'none', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(11,47,107,0.25)' }}>
        {processing ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
      </button>
    </div>
  );
}