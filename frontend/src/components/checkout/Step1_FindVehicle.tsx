import { useState, useEffect } from 'react';
import type { CheckoutFormData } from './CheckoutWizard';

export interface Props {
  onFound: (data: CheckoutFormData) => void;
}

interface ParkedItem {
  recordId: string;
  plate: string;
  vehicleType: 'CAR' | 'MOTORBIKE';
  slotCode: string;
  checkInTime: string;
  isMonthly: boolean;
}

export default function Step1_FindVehicle({ onFound }: Props) {
  const [plate, setPlate] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [parked, setParked] = useState<ParkedItem[]>([]);

  useEffect(() => {
    loadParked();
  }, []);

  const loadParked = async () => {
    try {
      const res = await fetch('/api/checkout/parked', { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      const j = await res.json();
      if (j.success) setParked(j.data);
    } catch {}
  };

  const handleSelect = (raw: ParkedItem) => {
    const mapped: CheckoutFormData = {
      ticketId: raw.recordId,
      vehicleInfo: {
        plate: raw.plate,
        vehicleType: raw.vehicleType,
        slotCode: raw.slotCode,
        checkInTime: raw.checkInTime,
        isMonthly: raw.isMonthly,
      },
      checkoutPhotos: { front: null, back: null },
      paymentInfo: { method: 'CASH', amount: 0 },
    };
    onFound(mapped);
  };

  const handleSearch = async () => {
    if (!plate.trim()) return;
    setSearching(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/checkout/lookup/${encodeURIComponent(plate.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (!j.success || !j.data?.found) {
        setError(`Không tìm thấy xe "${plate.trim()}" trong bãi đỗ.`);
        return;
      }
      const d = j.data;
      const formData: CheckoutFormData = {
        ticketId: d.recordId,
        vehicleInfo: {
          plate: d.plate,
          vehicleType: d.vehicleType,
          slotCode: d.slotCode,
          checkInTime: d.checkInTime,
          isMonthly: d.isMonthly,
          brand: d.brand,
          model: d.model,
          color: d.color,
          year: d.year,
          seats: d.seats,
          ownerName: d.ownerName,
          ownerPhone: d.ownerPhone,
          ownerEmail: d.ownerEmail,
        },
        checkoutPhotos: { front: null, back: null },
        paymentInfo: { method: 'CASH', amount: d.fee || 0, feeBreakdown: d.breakdown },
      };
      onFound(formData);
    } catch {
      setError('Tra cứu thất bại. Vui lòng thử lại.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '1.25rem 1.5rem', marginBottom: '1.25rem', boxShadow: '0 8px 32px rgba(30,58,95,0.08)' }}>
      <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>Tìm xe</p>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <input
          value={plate}
          onChange={(e) => { setPlate(e.target.value.toUpperCase()); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="VD: 51A-11111"
          style={{ flex: 1, padding: '0.65rem 0.85rem', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: '0.9rem', fontWeight: 600, fontFamily: 'Consolas, monospace', color: '#111827', background: '#fff', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.04em' }}
        />
        <button onClick={handleSearch} disabled={!plate.trim() || searching} style={{ padding: '0.65rem 1.25rem', background: plate.trim() && !searching ? '#0B2F6B' : '#E5E7EB', color: plate.trim() && !searching ? '#fff' : '#9CA3AF', border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: plate.trim() && !searching ? 'pointer' : 'not-allowed', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
          {searching ? 'Đang tìm...' : 'Tìm xe'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', border: '1.5px solid #FECACA', borderRadius: 8, padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span style={{ fontSize: '0.82rem', color: '#DC2626' }}>{error}</span>
        </div>
      )}

      {parked.length > 0 && (
        <div>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>Xe đang đỗ trong bãi (chọn nhanh)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 240, overflowY: 'auto' }}>
            {parked.map((p, idx) => (
              <button key={idx} onClick={() => handleSelect(p)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 700, color: '#0B2F6B', letterSpacing: '0.02em' }}>{p.plate}</span>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>{p.slotCode} · {new Date(p.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}