import type { VehicleLookupResponse } from '../api/vehicleApi';

interface Props {
  vehicle: VehicleLookupResponse;
}

const C = {
  navy: '#1E3A5F',
  navyLight: '#2C4F78',
  bg: '#F0F4F8',
  white: '#FFFFFF',
  blue: '#3B82F6',
  blueBg: '#EFF6FF',
  green: '#22C55E',
  greenBg: '#DCFCE7',
  gray50: '#F9FAFB',
  gray100: '#F3F5F7',
  gray200: '#E2E8F0',
  gray400: '#9BA8B4',
  gray600: '#5C6B7A',
  gray800: '#2D3A45',
  amberBg: '#FEF3C7',
  amberBorder: '#F59E0B',
  redBg: '#FEE2E2',
  red: '#DC2626',
};

function formatDateTime(iso: string | null) {
  if (!iso) return 'Chưa có';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Chưa có';
  return d.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function VehicleInfoCard({ vehicle }: Props) {
  const ownerName = vehicle.owner?.fullName ?? '-';
  const ownerPhone = vehicle.owner?.phoneNumber ?? '-';
  const ownerEmail = vehicle.owner?.email ?? '-';

  return (
    <div
      style={{
        background: C.white,
        border: `1.5px solid ${C.gray200}`,
        borderRadius: 12,
        padding: '0.9rem 1rem',
        marginTop: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 800, color: C.gray600 }}>
            Biển số
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: C.navy, marginTop: '0.15rem' }}>
            {vehicle.plateNumber}
          </div>
        </div>

        <div>
          {vehicle.isMonthly ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.6rem',
                borderRadius: 999,
                background: C.greenBg,
                border: `1.5px solid ${C.greenBg}`,
                color: '#15803D',
                fontWeight: 900,
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
            >
              🟢 Khách quen
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.6rem',
                borderRadius: 999,
                background: C.gray100,
                border: `1.5px solid ${C.gray200}`,
                color: C.gray600,
                fontWeight: 900,
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
            >
              ⚪ Khách lẻ
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 0.8rem', marginTop: '0.85rem' }}>
        <Field label="Tên chủ xe" value={ownerName} />
        <Field label="Màu xe" value={vehicle.color ?? '-'} />

        <Field label="SĐT" value={ownerPhone} />
        <Field label="Email" value={ownerEmail} />

        <Field label="Hãng" value={vehicle.brand ?? '-'} />
        <Field label="Model" value={vehicle.model ?? '-'} />
      </div>

      <div style={{ marginTop: '0.9rem', paddingTop: '0.85rem', borderTop: `1px dashed ${C.gray200}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 900, color: C.gray600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Lần gửi gần nhất
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: C.navy }}>
            {formatDateTime(vehicle.lastParking)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: C.gray600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: C.gray800, marginTop: '0.2rem' }}>{value ?? '-'}</div>
    </div>
  );
}

