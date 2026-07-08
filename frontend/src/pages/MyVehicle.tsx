import { useState, useEffect, useCallback, useRef } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { vehicleService } from '../services/vehicle.service';
import type { Vehicle } from '../types';
import { PlateInput } from '../components/PlateInput';

const C = {
  navy: '#1E3A5F', bg: '#EEF2F7', white: '#FFFFFF',
  green: '#16A34A', greenBg: '#DCFCE7', greenLight: '#F0FDF4',
  orange: '#EA580C', orangeBg: '#FFF7ED', orangeLight: '#FFEDD5',
  gray50: '#F9FAFB', gray100: '#F3F4F6', gray200: '#E5E7EB',
  gray300: '#D1D5DB', gray400: '#9CA3AF', gray600: '#6B7280',
  gray900: '#111827', red: '#EF4444', redBg: '#FEF2F2',
  redBorder: '#FECACA', blue: '#3B82F6', blueBg: '#EFF6FF',
  blueLight: '#DBEAFE', blueDark: '#1D4ED8',
};

function hasMonthlyPackage(vehicle: Vehicle): boolean { return !!((vehicle as any).isMonthly || (vehicle as any).monthlyPackage); }
function getVehicleTypeLabel(vehicle: Vehicle): string { if (!vehicle?.type) return 'Phương tiện'; return vehicle.type === 'CAR' ? 'Ô tô' : 'Xe máy'; }
function getPackageExpiryText(vehicle: Vehicle): string { try { const pkg = (vehicle as any).monthlyPackage; if (!pkg?.expiryDate) return ''; const d = new Date(pkg.expiryDate); if (isNaN(d.getTime())) return ''; return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return ''; } }
function getParkingAreaText(vehicle: Vehicle): string { try { const pkg = (vehicle as any).monthlyPackage; const floorName = pkg?.slot?.floor?.name; const slotCode = pkg?.slot?.code; if (floorName && slotCode) return `Tầng ${floorName} · Ô ${slotCode}`; if (floorName) return `Tầng ${floorName}`; if (slotCode) return `Ô ${slotCode}`; return 'Chưa phân khu'; } catch { return 'Chưa phân khu'; } }
function isExpiringSoon(vehicle: Vehicle): boolean { try { const pkg = (vehicle as any).monthlyPackage; if (!pkg?.expiryDate) return false; const expiry = new Date(pkg.expiryDate); if (isNaN(expiry.getTime())) return false; const diff = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24); return diff >= 0 && diff <= 7; } catch { return false; } }

type VehicleType = 'CAR' | 'MOTORBIKE';
const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [{ value: 'CAR', label: 'Ô tô' }, { value: 'MOTORBIKE', label: 'Xe máy' }];
const VEHICLE_PROFILE_OPTIONS: Record<VehicleType, { label: string; models: string[] }[]> = {
  CAR: [{ label: 'Toyota', models: ['Vios', 'Corolla Cross', 'Camry', 'Fortuner', 'Innova', 'Veloz Cross'] }, { label: 'Honda', models: ['City', 'Civic', 'CR-V', 'HR-V', 'Accord'] }, { label: 'Hyundai', models: ['Accent', 'Elantra', 'Tucson', 'Santa Fe', 'Creta'] }, { label: 'Kia', models: ['Morning', 'K3', 'Seltos', 'Sonet', 'Carnival'] }, { label: 'Mazda', models: ['Mazda 2', 'Mazda 3', 'CX-5', 'CX-8', 'BT-50'] }, { label: 'Ford', models: ['Ranger', 'Everest', 'Territory', 'EcoSport'] }, { label: 'VinFast', models: ['VF 3', 'VF 5', 'VF 6', 'VF 7', 'VF 8', 'VF 9'] }],
  MOTORBIKE: [{ label: 'Honda', models: ['Wave Alpha', 'Vision', 'Air Blade', 'Lead', 'SH Mode', 'SH'] }, { label: 'Yamaha', models: ['Sirius', 'Jupiter', 'Grande', 'Janus', 'Exciter', 'NVX'] }, { label: 'Suzuki', models: ['Raider', 'Satria', 'Address', 'Burgman Street'] }, { label: 'Piaggio', models: ['Vespa Sprint', 'Vespa Primavera', 'Liberty', 'Medley'] }, { label: 'SYM', models: ['Attila', 'Galaxy', 'Elite', 'Husky'] }, { label: 'VinFast', models: ['Klara', 'Feliz', 'Evo200', 'Vento', 'Theon'] }],
};
const VEHICLE_COLORS = ['Trắng', 'Đen', 'Bạc', 'Xám', 'Đỏ', 'Xanh dương', 'Xanh lá', 'Vàng', 'Nâu', 'Cam'];
const VEHICLE_YEARS = Array.from({ length: new Date().getFullYear() - 1989 }, (_, i) => new Date().getFullYear() - i);
const CAR_SEAT_OPTIONS = [2, 4, 5, 6, 7, 8, 9, 12];

const RESPONSIVE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  .mv-page { font-family: 'Inter', 'Segoe UI', sans-serif; }
  .mv-header-row { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
  .mv-summary-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:1.25rem; }
  .mv-vehicle-inner { display:grid; grid-template-columns:1fr auto auto; gap:1.5rem; align-items:center; }
  .mv-vehicle-left { display:flex; align-items:center; gap:1rem; min-width:0; }
  .mv-vehicle-mid { display:flex; flex-direction:column; gap:0.35rem; min-width:160px; }
  .mv-vehicle-actions { display:flex; align-items:center; gap:0.5rem; flex-shrink:0; }
  @media(max-width:1100px){ .mv-summary-grid{ grid-template-columns:repeat(2,1fr); } }
  @media(max-width:768px){
    .mv-summary-grid{ grid-template-columns:1fr; }
    .mv-vehicle-inner{ grid-template-columns:1fr; }
    .mv-vehicle-mid{ min-width:unset; }
    .mv-vehicle-actions{ flex-wrap:wrap; }
    .mv-header-row{ flex-direction:column; align-items:stretch; }
  }
  @keyframes mv-pulse{ 0%{transform:scale(1);opacity:1;} 50%{transform:scale(1.3);opacity:0.5;} 100%{transform:scale(1);opacity:1;} }
  @keyframes mv-fadein{ from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
  .mv-anim{ animation:mv-fadein 0.3s ease both; }
`;

function IconCar({ size = 16 }: { size?: number; color?: string }) { return <span style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>🚗</span>; }
function IconBike({ size = 16 }: { size?: number; color?: string }) { return <span style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>🛵</span>; }
function IconPlus({ size = 14, color = C.white }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconClose({ size = 14, color = C.navy }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconTrash({ size = 14, color = C.gray600 }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>; }
function IconChevronRight({ size = 16, color = C.gray400 }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>; }
function IconCalendar({ size = 14, color = C.gray600 }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function IconMapPin({ size = 14, color = C.gray600 }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function IconInfo({ size = 14, color = C.gray600 }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>; }
function IconTicket({ size = 14, color = C.gray600 }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/></svg>; }
function IconDots({ size = 16, color = C.gray600 }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>; }
function IconLightBulb({ size = 18, color = '#2563EB' }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21h6"/><path d="M12 3a6 6 0 0 1 6 6c0 3-2 5-3 6H9c-1-1-3-3-3-6a6 6 0 0 1 6-6z"/></svg>; }
function IconShieldCheck({ size = 16, color = C.navy }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 11 2 2 4-4"/></svg>; }
function IconSeat({ size = 16, color = C.navy }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 18v-6a5 5 0 0 1 10 0v6"/><path d="M5 18h14"/><path d="M9 18v3"/><path d="M15 18v3"/><path d="M19 10h1a2 2 0 0 1 2 2v1"/><path d="M5 10H4a2 2 0 0 0-2 2v1"/></svg>; }
function IconPaintBrush({ size = 16, color = C.navy }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.35857 19.5 5.5 20 5.5 20.5C5.5 21.3284 6.17157 22 7 22H12Z"/><circle cx="7.5" cy="10.5" r="1.5" fill="currentColor"/><circle cx="11.5" cy="7.5" r="1.5" fill="currentColor"/><circle cx="16.5" cy="9.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="14.5" r="1.5" fill="currentColor"/></svg>; }
function IconTag({ size = 16, color = C.navy }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>; }
function IconBuilding({ size = 16, color = C.navy }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="16"/><line x1="15" y1="22" x2="15" y2="16"/><line x1="9" y1="16" x2="15" y2="16"/><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01"/></svg>; }

function SummaryCard({ label, value, icon, accentColor, accentBg }: {
  label: string; value: number; icon: React.ReactNode; accentColor: string; accentBg: string;
}) {
  return (
    <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.gray200}`, boxShadow: '0 2px 12px rgba(0,0,0,0.04)', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s ease', cursor: 'default' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(30,58,95,0.06)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#bfdbfe'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.borderColor = C.gray200; }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: accentColor }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: C.gray900, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.78rem', color: C.gray600, fontWeight: 500, marginTop: 3 }}>{label}</div>
      </div>
      <IconChevronRight size={18} color={C.gray300} />
    </div>
  );
}

type DeletePhase = 'idle' | 'confirming' | 'deleting';

function RichVehicleCard({ vehicle, phase, onAskDelete, onConfirmDelete, onCancelDelete, onViewDetail }: {
  vehicle: Vehicle; phase: DeletePhase;
  onAskDelete: () => void; onConfirmDelete: () => void; onCancelDelete: () => void; onViewDetail: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isCar = vehicle.type === 'CAR';
  const isMonthly = hasMonthlyPackage(vehicle);
  const busy = phase === 'deleting';
  const expiryText = getPackageExpiryText(vehicle);
  const areaText = getParkingAreaText(vehicle);

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="mv-anim" style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.gray200}`, boxShadow: '0 4px 18px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02)', padding: '1.25rem 1.5rem', opacity: busy ? 0.6 : 1, transition: 'all 0.2s ease', position: 'relative' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 30px rgba(30, 58, 95, 0.06), 0 2px 6px rgba(30, 58, 95, 0.02)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#bfdbfe';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 18px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.borderColor = C.gray200;
      }}>
      {phase === 'confirming' && (
        <div style={{ position: 'absolute', inset: 0, borderRadius: 20, background: 'rgba(254,242,242,0.97)', border: `2px solid ${C.redBorder}`, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '1rem' }}>
          <IconTrash size={18} color={C.red} />
          <span style={{ fontSize: '0.9rem', color: '#B91C1C', fontWeight: 700 }}>Xác nhận xoá xe <span style={{ fontFamily: 'Consolas, monospace' }}>{vehicle.plateNumber}</span>?</span>
          <button type="button" onClick={onConfirmDelete} disabled={busy} style={{ padding: '0.5rem 1.1rem', background: C.red, color: C.white, border: 'none', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>Xoá</button>
          <button type="button" onClick={onCancelDelete} disabled={busy} style={{ padding: '0.5rem 1.1rem', background: C.white, color: C.gray600, border: `1px solid ${C.gray200}`, borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>Huỷ</button>
        </div>
      )}
      <div className="mv-vehicle-inner">
        <div className="mv-vehicle-left">
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: isCar ? C.blueBg : C.orangeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `2px solid ${isCar ? C.blueLight : C.orangeLight}` }}>
            {isCar ? <IconCar size={26} /> : <IconBike size={26} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'Consolas','Courier New',monospace", fontSize: '1.05rem', fontWeight: 900, color: C.gray900, letterSpacing: '0.04em' }}>{vehicle.plateNumber}</span>
              <span style={{ background: isMonthly ? C.greenBg : C.orangeLight, color: isMonthly ? C.green : C.orange, fontSize: '0.6rem', fontWeight: 800, padding: '0.15rem 0.6rem', borderRadius: 20, letterSpacing: '0.06em', border: `1px solid ${isMonthly ? '#A7F3D0' : '#FED7AA'}` }}>{isMonthly ? 'GÓI THÁNG' : 'VÃNG LAI'}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: C.gray600, fontWeight: 500, marginBottom: '0.3rem' }}>{getVehicleTypeLabel(vehicle)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: isMonthly ? '#22C55E' : C.blue, display: 'inline-block', animation: isMonthly ? 'mv-pulse 2s infinite' : 'none', boxShadow: isMonthly ? '0 0 0 2px #DCFCE7' : '0 0 0 2px #DBEAFE' }} />
              <span style={{ fontSize: '0.75rem', color: isMonthly ? C.green : C.blue, fontWeight: 600 }}>{isMonthly ? 'Đang hoạt động' : 'Sẵn sàng đặt chỗ'}</span>
            </div>
          </div>
        </div>
        <div className="mv-vehicle-mid">
          {isMonthly ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><IconCalendar size={13} color={C.gray600} /><span style={{ fontSize: '0.78rem', color: C.gray600, fontWeight: 500 }}>Hết hạn: <span style={{ color: C.gray900, fontWeight: 700 }}>{expiryText || '—'}</span></span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><IconMapPin size={13} color={C.gray600} /><span style={{ fontSize: '0.78rem', color: C.gray600, fontWeight: 500 }}>Khu đỗ: <span style={{ color: C.gray900, fontWeight: 700 }}>{areaText}</span></span></div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><IconInfo size={13} color={C.gray600} /><span style={{ fontSize: '0.78rem', color: C.gray600, fontWeight: 500 }}>Chưa có gói tháng</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><IconTicket size={13} color={C.gray600} /><span style={{ fontSize: '0.78rem', color: C.gray600, fontWeight: 500 }}>Có thể đặt chỗ theo lượt</span></div>
            </>
          )}
        </div>
        <div className="mv-vehicle-actions">
          {isMonthly ? (
            <>
              <button type="button" onClick={onViewDetail} style={{ padding: '0.5rem 1rem', background: C.gray100, color: C.gray900, border: `1px solid ${C.gray200}`, borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = C.gray200; }} onMouseLeave={(e) => { e.currentTarget.style.background = C.gray100; }}>Chi tiết</button>
              <button type="button" style={{ padding: '0.5rem 1rem', background: C.white, color: C.blue, border: `1.5px solid ${C.blue}`, borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = C.blueBg; }} onMouseLeave={(e) => { e.currentTarget.style.background = C.white; }}>Gia hạn</button>
            </>
          ) : (
            <>
              <button type="button" onClick={onViewDetail} style={{ padding: '0.5rem 1rem', background: C.blue, color: C.white, border: 'none', borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(59,130,246,0.3)', transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = C.blueDark; }} onMouseLeave={(e) => { e.currentTarget.style.background = C.blue; }}>Đặt chỗ</button>
              <button type="button" style={{ padding: '0.5rem 1rem', background: C.white, color: C.gray900, border: `1px solid ${C.gray200}`, borderRadius: 10, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = C.gray100; }} onMouseLeave={(e) => { e.currentTarget.style.background = C.white; }}>Mua gói</button>
            </>
          )}
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button type="button" onClick={() => setMenuOpen(o => !o)} aria-label="Thêm tùy chọn" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: menuOpen ? C.gray100 : C.white, border: `1px solid ${C.gray200}`, borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={(e) => { e.currentTarget.style.background = C.gray100; }} onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.background = C.white; }}>
              <IconDots size={16} color={C.gray600} />
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', right: 0, top: 42, background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '0.35rem', zIndex: 50, minWidth: 160, animation: 'mv-fadein 0.15s ease both' }}>
                <button type="button" onClick={() => { setMenuOpen(false); onViewDetail(); }} style={{ width: '100%', padding: '0.55rem 0.85rem', background: 'transparent', border: 'none', borderRadius: 8, textAlign: 'left', fontSize: '0.82rem', fontWeight: 600, color: C.gray900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onMouseEnter={(e) => { e.currentTarget.style.background = C.gray50; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}><IconInfo size={14} color={C.gray600} /> Xem chi tiết</button>
                <div style={{ height: 1, background: C.gray100, margin: '0.2rem 0.5rem' }} />
                <button type="button" onClick={() => { setMenuOpen(false); onAskDelete(); }} disabled={busy} style={{ width: '100%', padding: '0.55rem 0.85rem', background: 'transparent', border: 'none', borderRadius: 8, textAlign: 'left', fontSize: '0.82rem', fontWeight: 600, color: C.red, cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: busy ? 0.5 : 1 }} onMouseEnter={(e) => { e.currentTarget.style.background = C.redBg; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}><IconTrash size={14} color={C.red} /> {busy ? 'Đang xoá...' : 'Xoá xe'}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = { ACTIVE: { label: 'Đang hiệu lực', bg: '#DCFCE7', color: '#16A34A' }, FULFILLED: { label: 'Đã hoàn thành', bg: '#EFF6FF', color: '#3B82F6' }, NO_SHOW: { label: 'Không đến', bg: '#FEF3C7', color: '#D97706' }, CANCELLED: { label: 'Đã hủy', bg: '#FEF2F2', color: '#EF4444' } };
  const s = map[status] ?? { label: status, bg: C.gray100, color: C.gray600 };
  return <span style={{ background: s.bg, color: s.color, fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 20 }}>{s.label}</span>;
}
function PackageStatusBadge({ status }: { status: string }) {
  const isActive = status === 'ACTIVE';
  return <span style={{ background: isActive ? '#DCFCE7' : '#F3F4F6', color: isActive ? '#16A34A' : '#6B7280', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 20 }}>{isActive ? 'Còn hiệu lực' : 'Hết hạn'}</span>;
}

function VehicleDetailModal({ vehicleId, onClose }: { vehicleId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'specs' | 'activity'>('specs');
  useEffect(() => {
    let cancelled = false; setLoading(true); setError('');
    vehicleService.getDetail(vehicleId).then((data) => { if (!cancelled) { setDetail(data); setLoading(false); } }).catch((e: any) => { if (!cancelled) { setError(e?.response?.data?.message ?? 'Không thể tải thông tin xe'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [vehicleId]);
  const fmt = (d: string) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtDatetime = (d: string) => new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const COLOR_MAP: Record<string, string> = { 'Trắng': '#FFFFFF', 'Đen': '#0F172A', 'Bạc': '#CBD5E1', 'Xám': '#64748B', 'Đỏ': '#EF4444', 'Xanh dương': '#3B82F6', 'Xanh lá': '#10B981', 'Vàng': '#F59E0B', 'Nâu': '#78350F', 'Cam': '#F97316' };
  const specs = detail ? [
    { label: 'Hãng xe', value: detail.brand || 'Chưa cập nhật', icon: <IconBuilding size={16} color={C.navy} /> },
    { label: 'Dòng xe', value: detail.model || 'Chưa cập nhật', icon: <IconTag size={16} color={C.navy} /> },
    { label: 'Màu sắc', value: detail.color || 'Chưa cập nhật', icon: <IconPaintBrush size={16} color={C.navy} />, isColor: !!detail.color },
    { label: 'Năm sản xuất', value: detail.year || 'Chưa cập nhật', icon: <IconCalendar size={16} color={C.navy} /> },
    ...(detail.type === 'CAR' ? [{ label: 'Số chỗ ngồi', value: detail.seats ? `${detail.seats} chỗ` : 'Chưa cập nhật', icon: <IconSeat size={16} color={C.navy} /> }] : []),
    { label: 'Ngày đăng ký', value: detail.createdAt ? fmt(detail.createdAt) : 'Chưa cập nhật', icon: <IconShieldCheck size={16} color={C.navy} /> },
  ] : [];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={onClose}>
      <style>{`@keyframes pulse{0%{transform:scale(1);opacity:1;}50%{transform:scale(1.25);opacity:0.5;}100%{transform:scale(1);opacity:1;}}`}</style>
      <div style={{ background: C.white, borderRadius: '24px', width: '100%', maxWidth: 460, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ background: 'linear-gradient(135deg,#1E3A5F 0%,#0F172A 100%)', padding: '2.25rem 1.5rem 1.75rem', textAlign: 'center', position: 'relative', color: '#FFFFFF' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', borderRadius: '50%' }} onMouseEnter={(e) => { e.currentTarget.style.background='rgba(255,255,255,0.25)'; }} onMouseLeave={(e) => { e.currentTarget.style.background='rgba(255,255,255,0.15)'; }} aria-label="Đóng"><IconClose size={14} color="#FFFFFF" /></button>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', opacity: 0.8, textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Thông tin chi tiết</span>
          {detail && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: '#FFFFFF', border: '2px solid #1E293B', borderRadius: '10px', boxShadow: '0 8px 16px -4px rgba(0,0,0,0.2)', padding: '8px 20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily:"'Consolas','Courier New',monospace", fontWeight: 900, color: '#0F172A', fontSize: '1.4rem', letterSpacing: '2px', position: 'relative', minWidth: '160px' }}>
                <div style={{ position: 'absolute', top: '3px', left: '50%', transform: 'translateX(-50%)', width: '5px', height: '5px', borderRadius: '50%', background: '#CBD5E1', border: '1px solid #94A3B8' }} />
                {detail.plateNumber}
              </div>
              <span style={{ marginTop: '4px', background: 'rgba(255,255,255,0.15)', fontSize: '0.75rem', fontWeight: 700, padding: '3px 12px', borderRadius: '20px', letterSpacing: '0.04em' }}>{detail.type === 'CAR' ? '🚗 Ô TÔ' : '🛵 XE MÁY'}</span>
            </div>
          )}
        </div>
        {loading && <div style={{ textAlign: 'center', padding: '3.5rem', color: C.gray600, fontSize: '0.9rem', fontWeight: 600 }}>Đang tải dữ liệu...</div>}
        {error && <div style={{ padding: '1.5rem' }}><div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 12, padding: '1rem', color: '#B91C1C', fontSize: '0.85rem', fontWeight: 500 }}>{error}</div></div>}
        {detail && !loading && (
          <>
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '12px', padding: '4px', margin: '1.25rem 1.25rem 0.5rem' }}>
              {(['specs', 'activity'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none', background: activeTab === tab ? '#FFFFFF' : 'transparent', color: activeTab === tab ? '#1E3A5F' : '#64748B', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === tab ? '0 2px 4px rgba(0,0,0,0.06)' : 'none' }}>
                  {tab === 'specs' ? 'Thông số xe' : 'Hoạt động & Gói'}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.25rem 2rem' }}>
              {activeTab === 'specs' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {specs.map((s, idx) => (
                    <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
                        <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>{s.label}</span>
                      </div>
                      {(s as any).isColor ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '2px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: COLOR_MAP[s.value as string] ?? '#94A3B8', border: s.value === 'Trắng' ? '1px solid #CBD5E1' : 'none' }} />
                          <span style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 700 }}>{s.value}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.88rem', color: '#0F172A', fontWeight: 700, paddingLeft: '2px' }}>{s.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {detail.monthlyPackage ? (
                    <div style={{ background: 'linear-gradient(135deg,#1E3A5F 0%,#3B82F6 100%)', borderRadius: '16px', padding: '1.25rem', color: '#FFFFFF', boxShadow: '0 10px 20px -5px rgba(59,130,246,0.25)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                      <div style={{ position: 'absolute', right: '16px', top: '16px', opacity: 0.15 }}>{detail.type === 'CAR' ? <IconCar size={56} /> : <IconBike size={56} />}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div><span style={{ background: 'rgba(255,255,255,0.2)', fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: '20px', letterSpacing: '0.05em' }}>GÓI ĐỖ XE THÁNG</span><h3 style={{ margin: '6px 0 0 0', fontSize: '1.1rem', fontWeight: 800 }}>{detail.monthlyPackage.planName ?? 'Gói VIP'}</h3></div>
                        <PackageStatusBadge status={detail.monthlyPackage.status} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', opacity: 0.9 }}>
                        <div>Thời hạn: <strong>{fmt(detail.monthlyPackage.startDate)}</strong> – <strong>{fmt(detail.monthlyPackage.expiryDate)}</strong></div>
                        {detail.monthlyPackage.slot && <div>Vị trí cố định: <strong>Tầng {detail.monthlyPackage.slot.floor?.name ?? '—'} · Ô {detail.monthlyPackage.slot.code}</strong></div>}
                        <div style={{ marginTop: '8px', fontSize: '1rem', fontWeight: 800, color: '#FCD34D', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '8px' }}>{Number(detail.monthlyPackage.price).toLocaleString('vi-VN')} đ</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#F8FAFC', border: '1.5px dashed #E2E8F0', borderRadius: '16px', padding: '1.25rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '6px' }}>🎫</span>
                      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: C.navy }}>Chưa đăng ký gói tháng</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>Mua gói tháng giúp tối ưu chi phí đỗ xe.</p>
                    </div>
                  )}
                  {detail.bookings?.length > 0 && (
                    <div>
                      <h4 style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', fontWeight: 800, color: C.navy, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lịch đặt chỗ gần đây</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {detail.bookings.map((b: any) => (<div key={b.id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>Tầng {b.slot?.floor?.name ?? '—'} · Ô {b.slot?.code ?? '—'}</div><div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>Dự kiến đến: {b.expectedArrival ? fmtDatetime(b.expectedArrival) : '—'}</div></div><BookingStatusBadge status={b.status} /></div>))}
                      </div>
                    </div>
                  )}
                  {detail.checkInRecords?.length > 0 && (
                    <div>
                      <h4 style={{ margin: '0 0 0.8rem', fontSize: '0.78rem', fontWeight: 800, color: C.navy, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lịch sử gửi xe gần đây</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '10px', borderLeft: '2px solid #E2E8F0', gap: '16px', marginLeft: '6px', marginTop: '6px' }}>
                        {detail.checkInRecords.map((r: any) => { const isCurrentlyParked = !r.checkOutTime; return (<div key={r.id} style={{ position: 'relative', paddingLeft: '14px' }}><div style={{ position: 'absolute', left: '-21px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: isCurrentlyParked ? '#10B981' : '#94A3B8', border: '2px solid #FFFFFF', boxShadow: `0 0 0 2px ${isCurrentlyParked ? '#A7F3D0' : '#E2E8F0'}`, animation: isCurrentlyParked ? 'pulse 2s infinite' : 'none' }} /><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}><div><div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>Tầng {r.slot?.floor?.name ?? '—'} · Ô {r.slot?.code ?? '—'}</div><div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>Vào: {fmtDatetime(r.checkInTime)}</div>{r.checkOutTime && <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Ra: {fmtDatetime(r.checkOutTime)}</div>}</div><span style={{ background: isCurrentlyParked ? '#D1FAE5' : '#F1F5F9', color: isCurrentlyParked ? '#065F46' : '#475569', fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', flexShrink: 0 }}>{isCurrentlyParked ? 'Đang đỗ' : 'Đã ra'}</span></div></div>); })}
                      </div>
                    </div>
                  )}
                  {detail.bookings?.length === 0 && !detail.monthlyPackage && detail.checkInRecords?.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94A3B8' }}><span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '8px' }}>📭</span><span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Chưa có hoạt động gửi xe nào gần đây</span></div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DeleteErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 10, padding: '0.55rem 0.85rem', fontSize: '0.8rem', color: '#B91C1C', fontWeight: 500, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Đóng thông báo" style={{ background: 'transparent', border: 'none', color: '#B91C1C', cursor: 'pointer', padding: 0, display: 'flex' }}><IconClose size={12} color="#B91C1C" /></button>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ background: C.white, border: `2px dashed ${C.gray300}`, borderRadius: 24, padding: '3rem 1.5rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚗</div>
      <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: C.gray900 }}>Bạn chưa có xe nào</p>
      <p style={{ margin: '0.4rem 0 1.5rem', fontSize: '0.85rem', color: C.gray600 }}>Nhấn "Thêm xe" để đăng ký phương tiện và quản lý dễ dàng hơn.</p>
      <button onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.7rem 1.5rem', background: C.navy, color: C.white, border: 'none', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(30,58,95,0.3)', transition: 'transform 0.15s,box-shadow 0.15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 8px 20px rgba(30,58,95,0.35)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(30,58,95,0.3)'; }}>
        <IconPlus size={14} color={C.white} /> Thêm xe ngay
      </button>
    </div>
  );
}

function TipBanner({ onClose }: { onClose: () => void }) {
  return (
    <div className="mv-anim" style={{ background: '#eef6ff', border: '1px solid #bfdbfe', borderRadius: 16, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #bfdbfe' }}>
        <IconLightBulb size={18} color="#2563eb" />
      </div>
      <p style={{ flex: 1, margin: 0, fontSize: '0.83rem', color: '#1e40af', fontWeight: 600, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 800 }}>Mẹo:</span> Gia hạn gói tháng trước ngày hết hạn để giữ ưu tiên chỗ đỗ và tránh mất suất ưu đãi.
      </p>
      <button type="button" onClick={onClose} aria-label="Đóng gợi ý" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0, opacity: 0.7 }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}>
        <IconClose size={14} color="#3b82f6" />
      </button>
    </div>
  );
}

function AddVehicleForm({ submitting, error, onCancel, onSubmit }: {
  submitting: boolean; error: string; onCancel: () => void;
  onSubmit: (plateNumber: string, type: VehicleType, brand?: string, model?: string, color?: string, year?: number, seats?: number) => Promise<void>;
}) {
  const [plateNumber, setPlateNumber] = useState('');
  const [type, setType] = useState<VehicleType>('CAR');
  const [brand, setBrand] = useState(VEHICLE_PROFILE_OPTIONS.CAR[0].label);
  const [model, setModel] = useState(VEHICLE_PROFILE_OPTIONS.CAR[0].models[0]);
  const [color, setColor] = useState(VEHICLE_COLORS[0]);
  const [year, setYear] = useState<number | ''>(VEHICLE_YEARS[0]);
  const [seats, setSeats] = useState<number | ''>(CAR_SEAT_OPTIONS[2] ?? 5);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    const brandEntries = VEHICLE_PROFILE_OPTIONS[type];
    const currentBrand = brandEntries.find((item) => item.label === brand) ?? brandEntries[0];
    if (currentBrand.label !== brand) setBrand(currentBrand.label);
    if (!currentBrand.models.includes(model)) setModel(currentBrand.models[0]);
  }, [type, brand]);

  const availableModels = VEHICLE_PROFILE_OPTIONS[type].find((item) => item.label === brand)?.models ?? VEHICLE_PROFILE_OPTIONS[type][0].models;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = plateNumber.trim();
    if (!trimmed) { setLocalError('Vui lòng nhập biển số xe'); return; }
    if (type === 'CAR' && seats === '') { setLocalError('Vui lòng chọn số chỗ cho ô tô'); return; }
    setLocalError('');
    const yearVal = year === '' ? undefined : Number(year);
    const seatsVal = type === 'CAR' && seats !== '' ? Number(seats) : undefined;
    await onSubmit(trimmed, type, brand?.trim() || undefined, model?.trim() || undefined, color?.trim() || undefined, yearVal, seatsVal);
  };

  const displayError = localError || error;
  const sel = { padding: '0.65rem 0.85rem', border: `1.5px solid ${C.gray200}`, borderRadius: 10, background: C.white, fontSize: '0.9rem', color: C.gray900, width: '100%', fontFamily: 'inherit' };

  return (
    <div className="mv-anim" style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.gray200}`, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <div style={{ background: 'linear-gradient(135deg,#1E3A5F 0%,#2D5BA3 100%)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: C.white }}>Thêm xe mới</p>
          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>Điền thông tin phương tiện của bạn</p>
        </div>
        <button type="button" onClick={onCancel} disabled={submitting} aria-label="Đóng" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', opacity: submitting ? 0.5 : 1 }} onMouseEnter={(e) => { e.currentTarget.style.background='rgba(255,255,255,0.25)'; }} onMouseLeave={(e) => { e.currentTarget.style.background='rgba(255,255,255,0.15)'; }}>
          <IconClose size={16} color={C.white} />
        </button>
      </div>
      <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
        {displayError && <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 10, padding: '0.6rem 0.85rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#B91C1C', fontWeight: 500 }}>{displayError}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Biển số xe</span>
            <PlateInput value={plateNumber} onChange={setPlateNumber} placeholder="VD: 51A-12345" disabled={submitting} autoFocus style={{ ...sel, fontFamily:"'Consolas',monospace", fontWeight: 600 }} />
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Loại xe</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {VEHICLE_TYPES.map(opt => { const selected = type === opt.value; return (
                <button key={opt.value} type="button" onClick={() => setType(opt.value)} disabled={submitting} style={{ flex: 1, padding: '0.6rem 0.85rem', borderRadius: 10, border: `1.5px solid ${selected ? C.navy : C.gray200}`, background: selected ? C.navy : C.white, color: selected ? C.white : C.navy, fontSize: '0.85rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}>
                  {opt.value === 'CAR' ? <IconCar size={14} color={selected ? C.white : C.blue} /> : <IconBike size={14} color={selected ? C.white : C.orange} />}
                  {opt.label}
                </button>
              ); })}
            </div>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Hãng</span><select value={brand} onChange={(e) => setBrand(e.target.value)} disabled={submitting} style={sel}>{VEHICLE_PROFILE_OPTIONS[type].map(b => <option key={b.label} value={b.label}>{b.label}</option>)}</select></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Mẫu</span><select value={model} onChange={(e) => setModel(e.target.value)} disabled={submitting} style={sel}>{availableModels.map(m => <option key={m} value={m}>{m}</option>)}</select></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Màu</span><select value={color} onChange={(e) => setColor(e.target.value)} disabled={submitting} style={sel}>{VEHICLE_COLORS.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Năm</span><select value={year === '' ? '' : year.toString()} onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))} disabled={submitting} style={sel}>{VEHICLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
          {type === 'CAR' && (<label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: '0.78rem', fontWeight: 700, color: C.gray600 }}>Số chỗ</span><select value={seats === '' ? '' : seats.toString()} onChange={(e) => setSeats(e.target.value === '' ? '' : Number(e.target.value))} disabled={submitting} style={sel}><option value="">Chọn số chỗ</option>{CAR_SEAT_OPTIONS.map(s => <option key={s} value={s}>{s} chỗ</option>)}</select></label>)}
        </div>
        <button type="submit" disabled={submitting || !plateNumber.trim()} style={{ width: '100%', padding: '0.8rem', background: submitting || !plateNumber.trim() ? C.gray300 : C.navy, color: submitting || !plateNumber.trim() ? C.gray400 : C.white, border: 'none', borderRadius: 12, fontSize: '0.95rem', fontWeight: 700, cursor: submitting || !plateNumber.trim() ? 'not-allowed' : 'pointer', marginTop: '1.25rem', boxShadow: submitting || !plateNumber.trim() ? 'none' : '0 4px 14px rgba(30,58,95,0.25)', transition: 'background 0.15s' }}>
          {submitting ? 'Đang thêm...' : '+ Thêm xe'}
        </button>
      </form>
    </div>
  );
}

export function MyVehiclePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deleteState, setDeleteState] = useState<Record<string, { phase: DeletePhase; error: string }>>({});
  const loadEpoch = useRef(0);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [detailVehicleId, setDetailVehicleId] = useState<string | null>(null);
  const [tipVisible, setTipVisible] = useState(true);

  const loadVehicles = useCallback(async () => {
    const epoch = ++loadEpoch.current;
    setLoading(true); setLoadError('');
    try {
      const data = await vehicleService.getMyVehicles();
      if (epoch !== loadEpoch.current) return;
      setVehicles(data ?? []);
    } catch (e: any) {
      if (epoch !== loadEpoch.current) return;
      setLoadError(e?.response?.data?.message ?? 'Không thể tải danh sách xe. Vui lòng thử lại.');
    } finally {
      if (epoch === loadEpoch.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    loadVehicles();
  }, [authLoading, user, loadVehicles]);

  const handleAddVehicle = async (plateNumber: string, type: VehicleType, brand?: string, model?: string, color?: string, year?: number, seats?: number) => {
    setSubmitting(true); setFormError('');
    try {
      await vehicleService.create({ plateNumber, type, brand, model, color, year, seats });
      setFormOpen(false); setFormError(''); await loadVehicles();
    } catch (e: any) { setFormError(e?.response?.data?.message ?? 'Có lỗi xảy ra'); }
    finally { setSubmitting(false); }
  };

  const askDelete = (id: string) => setDeleteState(prev => ({ ...prev, [id]: { phase: 'confirming', error: '' } }));
  const cancelDelete = (id: string) => setDeleteState(prev => { const next = { ...prev }; delete next[id]; return next; });
  const clearDeleteError = (id: string) => setDeleteState(prev => { if (!prev[id]) return prev; return { ...prev, [id]: { phase: 'idle', error: '' } }; });
  const handleDelete = async (id: string) => {
    setDeleteState(prev => ({ ...prev, [id]: { phase: 'deleting', error: '' } }));
    try {
      await vehicleService.remove(id);
      setDeleteState(prev => { const next = { ...prev }; delete next[id]; return next; });
      await loadVehicles();
    } catch (e: any) {
      const message = e?.response?.data?.message ?? 'Không thể xoá xe';
      setDeleteState(prev => ({ ...prev, [id]: { phase: 'idle', error: message } }));
    }
  };

  const totalVehicles = vehicles.length;
  const withPackage = vehicles.filter(hasMonthlyPackage).length;
  const withoutPackage = totalVehicles - withPackage;
  const expiringSoon = vehicles.filter(isExpiringSoon).length;

  if (authLoading) return <div style={{ padding: '3rem', textAlign: 'center', color: C.gray400, fontSize: '0.9rem', fontWeight: 600 }}>Đang tải...</div>;
  if (!user) return <div style={{ padding: '3rem', textAlign: 'center', color: C.gray600, fontSize: '0.9rem' }}>Vui lòng đăng nhập để xem danh sách xe của bạn.</div>;

  return (
    <div className="mv-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '100%' }}>
      <style>{RESPONSIVE_CSS}</style>

      <div className="mv-header-row">
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: C.navy, letterSpacing: '-0.02em' }}>Xe của tôi</h1>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.875rem', color: C.gray600, fontWeight: 500 }}>Quản lý phương tiện, gói tháng và lịch sử sử dụng của từng xe.</p>
        </div>
        {!formOpen && (
          <button onClick={() => setFormOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.65rem 1.35rem', background: 'linear-gradient(135deg,#1E3A5F 0%,#2D5BA3 100%)', color: C.white, border: 'none', borderRadius: 12, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(30, 58, 95, 0.15)', transition: 'all 0.2s ease', whiteSpace: 'nowrap', flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.transform='translateY(-1.5px)'; e.currentTarget.style.boxShadow='0 8px 25px rgba(30, 58, 95, 0.25)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(30, 58, 95, 0.15)'; }}>
            <IconPlus size={14} color={C.white} /> Thêm xe
          </button>
        )}
      </div>

      {!loading && (
        <div className="mv-summary-grid">
          <SummaryCard label="Tổng phương tiện" value={totalVehicles} accentColor={C.blue} accentBg={C.blueBg}
            icon={<svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v3h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>} />
          <SummaryCard label="Có gói tháng" value={withPackage} accentColor={C.green} accentBg={C.greenBg}
            icon={<svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 11 2 2 4-4"/></svg>} />
          <SummaryCard label="Chưa có gói" value={withoutPackage} accentColor={C.orange} accentBg={C.orangeBg}
            icon={<svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/></svg>} />
          <SummaryCard label="Sắp hết hạn" value={expiringSoon} accentColor="#DC2626" accentBg="#FEF2F2"
            icon={<svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>} />
        </div>
      )}

      {loadError && <div style={{ background: C.redBg, border: `1.5px solid ${C.redBorder}`, borderRadius: 12, padding: '0.85rem 1rem', fontSize: '0.875rem', color: '#B91C1C', fontWeight: 500 }}>{loadError}</div>}

      <div style={{ marginTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: C.navy, letterSpacing: '-0.01em' }}>Danh sách phương tiện</h2>
          {!loading && vehicles.length > 0 && <span style={{ fontSize: '0.78rem', color: C.gray600, fontWeight: 600, background: C.gray100, padding: '0.25rem 0.75rem', borderRadius: 20 }}>{vehicles.length} xe</span>}
        </div>
        {loading ? (
          <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.gray200}`, padding: '3rem', textAlign: 'center', color: C.gray400, fontSize: '0.9rem', fontWeight: 600 }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>Đang tải danh sách xe...
          </div>
        ) : vehicles.length === 0 ? (
          <EmptyState onAdd={() => setFormOpen(true)} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {vehicles.map((v) => {
              const cardState = deleteState[v.id];
              const phase: DeletePhase = cardState?.phase ?? 'idle';
              const err = cardState?.error ?? '';
              return (
                <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <RichVehicleCard vehicle={v} phase={phase} onAskDelete={() => askDelete(v.id)} onConfirmDelete={() => handleDelete(v.id)} onCancelDelete={() => cancelDelete(v.id)} onViewDetail={() => setDetailVehicleId(v.id)} />
                  {err && phase !== 'deleting' && <DeleteErrorBanner message={err} onDismiss={() => clearDeleteError(v.id)} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {formOpen && <AddVehicleForm submitting={submitting} error={formError} onCancel={() => { setFormOpen(false); setFormError(''); }} onSubmit={handleAddVehicle} />}

      {tipVisible && !loading && <TipBanner onClose={() => setTipVisible(false)} />}

      {detailVehicleId && <VehicleDetailModal vehicleId={detailVehicleId} onClose={() => setDetailVehicleId(null)} />}
    </div>
  );
}
