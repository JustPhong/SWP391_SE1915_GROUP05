import { useState } from 'react';
import { lookupPlate, type LookupResult } from '../api/checkinApi';

const C = {
  navy: '#1E3A5F',
  navyLight: '#2C4F78',
  bg: 'linear-gradient(160deg,#EFF6FF 0%,#DBEAFE 50%,#EFF6FF 100%)',
  white: '#FFFFFF',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  greenBorder: '#86EFAC',
  gray50: '#F9FAFB',
  gray100: '#E5E7EB',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  red: '#DC2626',
  redBg: '#FEE2E2',
  redBorder: '#FECACA',
  shadow: '0 8px 32px rgba(30,58,95,0.08)',
};

function normalizePlate(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function formatPlate(raw: string): { valid: boolean; formatted: string } {
  const s = normalizePlate(raw);
  if (!s) return { valid: false, formatted: '' };
  const match = s.match(/^(\d{2})([A-Z])(\d?)(\d{4,5})$/);
  if (!match) return { valid: false, formatted: '' };
  const prov = match[1];
  const letter = match[2];
  const series = match[3];
  const numbers = match[4];
  const formatted = numbers.length === 5
    ? `${prov}${letter}${series}-${numbers.slice(0, 3)}.${numbers.slice(3)}`
    : `${prov}${letter}${series}-${numbers}`;
  return { valid: true, formatted };
}

function isPlateValid(raw: string): boolean {
  return formatPlate(raw).valid;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: C.white,
      borderRadius: 18,
      boxShadow: C.shadow,
      padding: '1.5rem',
      minHeight: 160,
    }}>
      <p style={{ margin: 0, marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 700, color: C.navy }}>
        {title}
      </p>
      {children}
    </div>
  );
}

export function SearchVehiclePage() {
  const [plateInput, setPlateInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [lookupData, setLookupData] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string>('');

  const handleSearch = async () => {
    const raw = plateInput.trim();
    if (!raw) return;
    const { valid, formatted } = formatPlate(raw);
    if (!valid) {
      setError('Biển số không hợp lệ. Vui lòng kiểm tra lại.');
      setLookupData(null);
      return;
    }

    setPlateInput(formatted);
    setError('');
    setSearching(true);
    setLookupData(null);

    try {
      const result = await lookupPlate(normalizePlate(formatted));
      setLookupData(result);
    } catch (err: unknown) {
      setError((err as Error).message || 'Không thể tra cứu biển số. Vui lòng thử lại.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '1.5rem 1rem' }}>
      <div style={{ maxWidth: 1050, margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: C.navy, fontWeight: 800 }}>
            Tra cứu xe
          </h1>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.95rem', color: C.gray500 }}>
            Tìm kiếm thông tin xe theo biển số mà không cần thực hiện check-in.
          </p>
        </div>

        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <Card title="Nhập biển số">
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={plateInput}
                onChange={(e) => { setPlateInput(e.target.value.toUpperCase()); setError(''); }}
                placeholder="VD: 51A-11111"
                disabled={searching}
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: '0.9rem 1rem',
                  borderRadius: 12,
                  border: `1.5px solid ${error ? C.redBorder : C.gray200}`,
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={!isPlateValid(plateInput) || searching}
                style={{
                  padding: '0.9rem 1.25rem',
                  borderRadius: 12,
                  border: 'none',
                  background: isPlateValid(plateInput) && !searching ? C.navy : C.gray200,
                  color: isPlateValid(plateInput) && !searching ? C.white : C.gray500,
                  fontWeight: 700,
                  cursor: isPlateValid(plateInput) && !searching ? 'pointer' : 'not-allowed',
                }}
              >
                {searching ? 'Đang tra cứu...' : 'Tra cứu'}
              </button>
            </div>
            {error && (
              <p style={{ margin: '0.75rem 0 0', color: C.red, fontSize: '0.88rem' }}>
                {error}
              </p>
            )}
          </Card>

          <Card title="Kết quả tra cứu">
            {!lookupData && !error && (
              <p style={{ margin: 0, color: C.gray500, fontSize: '0.92rem' }}>
                Nhập biển số và nhấn Tra cứu để xem thông tin xe.
              </p>
            )}

            {lookupData && (
              <div style={{ display: 'grid', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: C.gray500 }}>Biển số</p>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '1.25rem', fontWeight: 800, color: C.navy }}>
                      {plateInput}
                    </p>
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: C.gray500 }}>Loại khách</p>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '1rem', fontWeight: 700, color: C.gray800 }}>
                      {lookupData.customerType === 'monthly' ? 'Khách tháng' : 'Khách lẻ'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '0.75rem', paddingTop: '0.75rem', borderTop: `1px solid ${C.gray100}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: C.gray500, fontSize: '0.85rem' }}>Xe đang trong bãi</span>
                    <span style={{ fontWeight: 700, color: lookupData.alreadyParked ? C.red : C.green }}>
                      {lookupData.alreadyParked ? 'Có' : 'Không'}
                    </span>
                  </div>
                  {lookupData.slotCode && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: C.gray500, fontSize: '0.85rem' }}>Slot hiện tại</span>
                      <span style={{ fontWeight: 700 }}>{lookupData.slotCode}</span>
                    </div>
                  )}
                  {lookupData.vehicleType && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: C.gray500, fontSize: '0.85rem' }}>Loại xe</span>
                      <span style={{ fontWeight: 700 }}>{lookupData.vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy'}</span>
                    </div>
                  )}
                  {lookupData.customerType === 'monthly' && lookupData.packageExpiry && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: C.gray500, fontSize: '0.85rem' }}>Hạn gói tháng</span>
                      <span style={{ fontWeight: 700 }}>{new Date(lookupData.packageExpiry).toLocaleDateString('vi-VN')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default SearchVehiclePage;
