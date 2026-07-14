import { useState } from 'react';

export interface Props {
  open: boolean;
  type: 'LOST_TICKET' | 'DAMAGE' | null;
  onClose: () => void;
}

export default function IncidentModal({ open, type, onClose }: Props) {
  const [note, setNote] = useState('');

  if (!open || !type) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(17,24,39,0.45)' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', width: 440, boxShadow: '0 16px 48px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: 800, color: '#DC2626' }}>
          {type === 'LOST_TICKET' ? 'Xác nhận mất thẻ' : 'Ghi nhận sự cố'}
        </h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#374151', lineHeight: 1.5 }}>
          {type === 'LOST_TICKET'
            ? 'Xe ra cổng với phương thức mất thẻ. Hãy xác nhận để áp dụng phí phạt theo quy định.'
            : 'Ghi nhận sự cố trầy xước, biển số không khớp hoặc khiếm khuyết khác. Thông tin sẽ được lưu vào hệ thống.'}
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={type === 'LOST_TICKET' ? 'Ghi chú thêm (tuỳ chọn)' : 'Mô tả sự cố...'}
          style={{ width: '100%', minHeight: 120, padding: '0.75rem', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '0.9rem', color: '#111827', background: '#fff', outline: 'none', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', background: '#DC2626', color: '#fff', border: 'none', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
            Xác nhận
          </button>
          <button onClick={onClose} style={{ padding: '0.75rem 1.25rem', background: '#fff', color: '#6B7280', border: '1.5px solid #E5E7EB', borderRadius: 12, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}