import type { CheckoutFormData } from './CheckoutWizard';

export interface Props {
  data: CheckoutFormData;
  onBack: () => void;
  onComplete?: () => void;
}

export default function Step4_Complete({ data, onBack, onComplete }: Props) {
  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '1.25rem 1.5rem', marginBottom: '1.25rem', boxShadow: '0 8px 32px rgba(30,58,95,0.08)' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>Hoàn tất check-out</p>
      </div>

      <div style={{ background: '#F3F4F6', borderRadius: 12, padding: '0.85rem 1rem', marginBottom: '1rem' }}>
        {[
          { label: 'Biển số', value: data.vehicleInfo.plate, mono: true },
          { label: 'Vị trí', value: data.vehicleInfo.slotCode },
          { label: 'Giờ vào', value: new Date(data.vehicleInfo.checkInTime).toLocaleString('vi-VN') },
          { label: 'Giờ ra', value: new Date().toLocaleString('vi-VN') },
          { label: 'Loại xe', value: data.vehicleInfo.isMonthly ? 'Khách tháng' : 'Khách lẻ' },
          { label: 'Phương thức', value: data.paymentInfo.method === 'CASH' ? 'Tiền mặt' : data.paymentInfo.method === 'CARD' ? 'Thẻ' : 'Ví điện tử' },
        ].map((r) => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #E5E7EB' }}>
            <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>{r.label}</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111827', fontFamily: r.mono ? 'Consolas, monospace' : undefined }}>{r.value}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderTop: '2px solid #E5E7EB', marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#111827' }}>Tổng phí</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#DC2626' }}>{data.paymentInfo.amount.toLocaleString('vi-VN')}đ</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={onBack} style={{ flex: 1, padding: '0.75rem', background: '#0B2F6B', color: '#fff', border: 'none', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
          Check-out xe mới
        </button>
        {onComplete && (
          <button onClick={onComplete} style={{ flex: 1, padding: '0.75rem', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
            Hoàn tất
          </button>
        )}
      </div>
    </div>
  );
}