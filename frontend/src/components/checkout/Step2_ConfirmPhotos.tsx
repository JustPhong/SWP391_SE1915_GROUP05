import { useState, useRef } from 'react';
import type { CheckoutFormData } from './CheckoutWizard';

export interface Props {
  data: CheckoutFormData;
  onNext: (photos: { front: string; back: string }) => void;
  onOpenIncident: (type: 'LOST_TICKET' | 'DAMAGE') => void;
}

export default function Step2_ConfirmPhotos({ data, onNext, onOpenIncident }: Props) {
  const [photos, setPhotos] = useState<{ front: string | null; back: string | null }>({ front: null, back: null });
  const [incident, setIncident] = useState(false);
  const fileFront = useRef<HTMLInputElement>(null);
  const fileBack = useRef<HTMLInputElement>(null);

  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>, which: 'front' | 'back') => {
    const f = e.target.files?.[0];
    if (!f) return;
    const b64 = await toBase64(f);
    setPhotos((p) => ({ ...p, [which]: b64 }));
  };

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '1.25rem 1.5rem', marginBottom: '1.25rem', boxShadow: '0 8px 32px rgba(30,58,95,0.08)' }}>
      <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Xác nhận xe & Chụp ảnh ra</p>

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
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.82rem', color: '#6B7280' }}>Loại</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111827' }}>{data.vehicleInfo.isMonthly ? 'Khách tháng' : 'Khách lẻ'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ảnh đầu xe (ra) *</p>
          <input type="file" accept="image/*" ref={fileFront} onChange={(e) => onFile(e, 'front')} style={{ display: 'none' }} />
          <button onClick={() => fileFront.current?.click()} style={{ width: '100%', padding: '0.6rem', border: '1.5px dashed #D1D5DB', borderRadius: 10, background: photos.front ? '#ECFDF5' : '#F9FAFB', color: '#111827', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
            {photos.front ? 'Đã chụp ảnh đầu xe' : 'Chụp ảnh đầu xe'}
          </button>
          {photos.front && <img src={photos.front} style={{ width: '100%', marginTop: '0.5rem', borderRadius: 10, maxHeight: 160, objectFit: 'cover' }} />}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ảnh đuôi xe (ra) *</p>
          <input type="file" accept="image/*" ref={fileBack} onChange={(e) => onFile(e, 'back')} style={{ display: 'none' }} />
          <button onClick={() => fileBack.current?.click()} style={{ width: '100%', padding: '0.6rem', border: '1.5px dashed #D1D5DB', borderRadius: 10, background: photos.back ? '#ECFDF5' : '#F9FAFB', color: '#111827', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
            {photos.back ? 'Đã chụp ảnh đuôi xe' : 'Chụp ảnh đuôi xe'}
          </button>
          {photos.back && <img src={photos.back} style={{ width: '100%', marginTop: '0.5rem', borderRadius: 10, maxHeight: 160, objectFit: 'cover' }} />}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button onClick={() => photos.front && photos.back && onNext({ front: photos.front, back: photos.back })} disabled={!photos.front || !photos.back} style={{ flex: 1, padding: '0.75rem', background: (!photos.front || !photos.back) ? '#E5E7EB' : '#0B2F6B', color: (!photos.front || !photos.back) ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: (!photos.front || !photos.back) ? 'not-allowed' : 'pointer' }}>
          Tiếp tục
        </button>
        <button onClick={() => onOpenIncident('LOST_TICKET')} style={{ padding: '0.75rem 1rem', background: '#fff', color: '#DC2626', border: '1.5px solid #FECACA', borderRadius: 12, fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
          Mất thẻ
        </button>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={incident} onChange={(e) => { setIncident(e.target.checked); if (e.target.checked) onOpenIncident('DAMAGE'); }} />
        <span style={{ fontSize: '0.85rem', color: '#111827', fontWeight: 600 }}>Ghi nhận sự cố (trầy xước, biển số không khớp...)</span>
      </label>
    </div>
  );
}