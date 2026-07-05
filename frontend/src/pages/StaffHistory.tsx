import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { HistoryIcon, SearchIcon } from '../components/ui/Icons';

const C = {
  navy: '#1E3A5F',
  navyLight: '#2C4F78',
  bg: 'linear-gradient(160deg, #EFF6FF 0%, #DBEAFE 50%, #EFF6FF 100%)',
  white: '#FFFFFF',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  greenBorder: '#86EFAC',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray800: '#1F2937',
  red: '#DC2626',
  redBg: '#FEE2E2',
  redBorder: '#FECACA',
  shadow: '0 8px 32px rgba(30, 58, 95, 0.08)',
};

interface CheckInRecord {
  id: string;
  recordType: 'CHECKIN' | 'BOOKING';
  plateNumber: string;
  vehicleType: string;
  slotCode: string;
  timeIn: string | null;
  timeOut: string | null;
  status: string; // COMPLETED, PARKING, ACTIVE, CANCELLED, NO_SHOW
  isMonthly: boolean;
  amount: number;
  isLostTicket: boolean;
  expectedArrival: string | null;
  bookingTime: string | null;
  driverName: string | null;
  driverEmail: string | null;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function formatDuration(inTime: string, outTime: string | null): string {
  const start = new Date(inTime).getTime();
  const end = outTime ? new Date(outTime).getTime() : Date.now();
  const diffMs = end - start;
  if (diffMs < 0) return '—';
  
  const diffMins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  
  if (hrs > 0) {
    return `${hrs}g ${mins}ph`;
  }
  return `${mins}ph`;
}

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
}

export function StaffHistoryPage() {
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchPlate, setSearchPlate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'monthly' | 'casual'>('all');

  const fetchHistory = useCallback(async (plate?: string) => {
    setLoading(true);
    setError('');
    try {
      const url = plate ? `/checkin-out/history?plate=${encodeURIComponent(plate.toUpperCase())}` : '/checkin-out/history';
      const res = await api.get(url);
      setRecords(res.data.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không tải được lịch sử gửi xe');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(searchQuery);
  }, [searchQuery, fetchHistory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchPlate.trim());
  };

  const handleClearSearch = () => {
    setSearchPlate('');
    setSearchQuery('');
    setCustomerTypeFilter('all');
  };

  // Lọc ở frontend
  const filteredRecords = records.filter((r) => {
    if (customerTypeFilter === 'all') return true;
    if (customerTypeFilter === 'monthly') return r.isMonthly;
    if (customerTypeFilter === 'casual') return !r.isMonthly;
    return true;
  });

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '1.5rem 1rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* ── Page Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: C.navy }}>Lịch sử lượt gửi xe &amp; Đặt chỗ</h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: C.gray600 }}>
              Xem toàn bộ lượt xe vào/ra bãi đỗ và thông tin đặt chỗ trước
            </p>
          </div>
          <button
            onClick={() => fetchHistory(searchQuery)}
            disabled={loading}
            style={{
              padding: '10px 20px', borderRadius: 12, border: `1.5px solid ${C.gray200}`,
              background: C.white, color: C.navy, fontWeight: 700, fontSize: '0.88rem',
              cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.15s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            }}
          >
            <HistoryIcon size={14} />
            Làm mới
          </button>
        </div>

        {/* ── Search & Filter Bar ── */}
        <div style={{
          background: C.white,
          borderRadius: 16,
          boxShadow: C.shadow,
          padding: '1.25rem',
          marginBottom: '1.5rem'
        }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.gray500, display: 'flex', alignItems: 'center' }}>
                <SearchIcon size={18} />
              </span>
              <input
                type="text"
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.currentTarget.value)}
                placeholder="Nhập biển số xe cần tìm kiếm... (VD: 51A-11111)"
                style={{
                  width: '100%',
                  padding: '0.85rem 1rem 0.85rem 2.6rem',
                  borderRadius: 12,
                  border: `1.5px solid ${C.gray200}`,
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>
            
            {/* Bộ lọc loại khách */}
            <select
              value={customerTypeFilter}
              onChange={(e) => setCustomerTypeFilter(e.target.value as any)}
              style={{
                padding: '0.85rem 1rem',
                borderRadius: 12,
                border: `1.5px solid ${C.gray200}`,
                fontSize: '0.95rem',
                outline: 'none',
                cursor: 'pointer',
                background: C.white,
                minWidth: 200,
                boxSizing: 'border-box',
              }}
            >
              <option value="all">Tất cả loại khách</option>
              <option value="monthly">Cư dân (Gói tháng)</option>
              <option value="casual">Khách thường (Vé lượt)</option>
            </select>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.85rem 1.5rem',
                borderRadius: 12,
                border: 'none',
                background: C.navy,
                color: C.white,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
                boxShadow: '0 4px 12px rgba(30, 58, 95, 0.15)',
              }}
            >
              Tìm kiếm
            </button>
            {(searchQuery || customerTypeFilter !== 'all') && (
              <button
                type="button"
                onClick={handleClearSearch}
                style={{
                  padding: '0.85rem 1.25rem',
                  borderRadius: 12,
                  border: `1.5px solid ${C.gray200}`,
                  background: C.white,
                  color: C.gray600,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                }}
              >
                Xóa bộ lọc
              </button>
            )}
          </form>
        </div>

        {/* ── Table Card ── */}
        <div style={{
          background: C.white, borderRadius: 16, boxShadow: C.shadow,
          overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: C.gray500, fontSize: '0.95rem' }}>
              Đang tải danh sách lịch sử…
            </div>
          ) : error ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: C.red, fontSize: '0.95rem' }}>
              {error}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: C.gray500, fontSize: '0.95rem' }}>
              Không tìm thấy lượt đỗ xe hay đặt chỗ nào trùng khớp.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: C.gray50, borderBottom: `1px solid ${C.gray200}` }}>
                    {['Biển số', 'Tài xế', 'Loại xe', 'Vị trí', 'Thời gian vào', 'Thời gian ra', 'Thời lượng', 'Doanh thu/Cọc', 'Trạng thái'].map((h) => (
                      <th key={h} style={{
                        padding: '14px 16px',
                        fontSize: '0.75rem', fontWeight: 700, color: C.navy,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r) => {
                    const isCar = r.vehicleType === 'CAR';
                    const isBooking = r.recordType === 'BOOKING';
                    
                    return (
                      <tr
                        key={r.id}
                        style={{ borderBottom: `1px solid ${C.gray100}`, transition: 'background 0.15s' }}
                        onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = C.gray50; }}
                        onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        {/* Biển số & Phân loại */}
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: C.navy, letterSpacing: '0.02em' }}>
                              {r.plateNumber}
                            </span>
                            {r.isMonthly ? (
                              <span style={{
                                fontSize: '0.68rem', color: '#16A34A', fontWeight: 700,
                                background: '#DCFCE7', border: `1px solid ${C.greenBorder}`,
                                padding: '1px 6px', borderRadius: 4, width: 'fit-content'
                              }}>
                                Cư dân (Gói tháng)
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '0.68rem', color: '#B45309', fontWeight: 700,
                                background: '#FFFBEB', border: `1px solid #FDE68A`,
                                padding: '1px 6px', borderRadius: 4, width: 'fit-content'
                              }}>
                                Khách thường (Vé lượt)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Tài xế */}
                        <td style={{ padding: '14px 16px', fontSize: '0.88rem', color: C.gray800 }}>
                          {r.driverEmail === 'walkin@system.local' || !r.driverName ? (
                            <span style={{ color: C.gray500, fontStyle: 'italic' }}>Khách vãng lai</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 700, color: C.navy }}>{r.driverName}</span>
                              <span style={{ fontSize: '0.72rem', color: C.gray500 }}>{r.driverEmail}</span>
                            </div>
                          )}
                        </td>

                        {/* Loại xe */}
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: C.gray800 }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: isCar ? '#EFF6FF' : '#FEF9C3',
                            color: isCar ? '#1D4ED8' : '#854D0E',
                          }}>
                            {isCar ? '🚗 Ô tô' : '🛵 Xe máy'}
                          </span>
                        </td>

                        {/* Vị trí */}
                        <td style={{ padding: '14px 16px', fontSize: '0.88rem', fontWeight: 600, color: C.navy }}>
                          {r.slotCode}
                        </td>

                        {/* Thời gian vào */}
                        <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: C.gray600 }}>
                          {isBooking ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.72rem', color: C.gray500 }}>Hẹn lúc:</span>
                              <span style={{ fontWeight: 500 }}>{formatDateTime(r.expectedArrival)}</span>
                            </div>
                          ) : (
                            formatDateTime(r.timeIn)
                          )}
                        </td>

                        {/* Thời gian ra */}
                        <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: C.gray600 }}>
                          {isBooking ? '—' : formatDateTime(r.timeOut)}
                        </td>

                        {/* Thời lượng */}
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: C.gray600, fontWeight: 500 }}>
                          {isBooking ? '—' : formatDuration(r.timeIn!, r.timeOut)}
                        </td>

                        {/* Doanh thu/Đặt cọc */}
                        <td style={{ padding: '14px 16px', fontSize: '0.88rem', fontWeight: 700, color: C.gray800 }}>
                          {r.amount > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{formatCurrency(r.amount)}</span>
                              {isBooking && (
                                <span style={{ fontSize: '0.65rem', color: C.gray500, fontWeight: 400 }}>
                                  (Tiền đặt cọc)
                                </span>
                              )}
                            </div>
                          ) : '—'}
                        </td>

                        {/* Trạng thái */}
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          {isBooking ? (
                            r.status === 'ACTIVE' ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                fontSize: '0.75rem', fontWeight: 700, color: '#7C3AED',
                                background: '#EDE9FE', padding: '4px 10px', borderRadius: 20
                              }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C3AED' }} />
                                Chờ xe vào
                              </span>
                            ) : r.status === 'CANCELLED' ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                fontSize: '0.75rem', fontWeight: 700, color: C.gray500,
                                background: C.gray100, padding: '4px 10px', borderRadius: 20
                              }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.gray500 }} />
                                Đã hủy đặt
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                fontSize: '0.75rem', fontWeight: 700, color: C.red,
                                background: C.redBg, padding: '4px 10px', borderRadius: 20
                              }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.red }} />
                                Không đến (Quá hạn)
                              </span>
                            )
                          ) : r.status === 'COMPLETED' ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              fontSize: '0.75rem', fontWeight: 700, color: C.gray500,
                              background: '#F3F4F6', padding: '4px 10px', borderRadius: 20
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.gray500 }} />
                              Đã rời bãi
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              fontSize: '0.75rem', fontWeight: 700, color: '#16A34A',
                              background: '#DCFCE7', padding: '4px 10px', borderRadius: 20
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} />
                              Đang đỗ xe
                            </span>
                          )}
                          {!isBooking && r.isLostTicket && (
                            <span style={{
                              marginLeft: 6,
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              background: C.redBg,
                              color: C.red,
                              border: `1px solid ${C.redBorder}`,
                            }}>
                              Mất vé
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Legend / Ghi chú (Kèm chức năng Click để Lọc nhanh) ── */}
        <div style={{
          marginTop: '1.25rem',
          background: C.white,
          borderRadius: 16,
          padding: '1.25rem 1.5rem',
          boxShadow: C.shadow,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: C.navy, display: 'flex', alignItems: 'center', gap: 6 }}>
            💡 Hướng dẫn phân loại khách hàng (Click vào để lọc nhanh):
          </p>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {/* Lọc Cư dân */}
            <div 
              onClick={() => setCustomerTypeFilter(prev => prev === 'monthly' ? 'all' : 'monthly')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flex: 1,
                minWidth: 280,
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 8,
                background: customerTypeFilter === 'monthly' ? '#DCFCE7' : 'transparent',
                transition: 'all 0.2s',
                border: customerTypeFilter === 'monthly' ? `1px solid ${C.greenBorder}` : '1px solid transparent'
              }}
              onMouseOver={(e) => { if (customerTypeFilter !== 'monthly') e.currentTarget.style.background = '#F0FDF4'; }}
              onMouseOut={(e) => { if (customerTypeFilter !== 'monthly') e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{
                fontSize: '0.68rem', color: '#16A34A', fontWeight: 700,
                background: '#DCFCE7', border: `1px solid ${C.greenBorder}`,
                padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap'
              }}>
                Cư dân (Gói tháng)
              </span>
              <span style={{ fontSize: '0.82rem', color: C.gray600, lineHeight: 1.4 }}>
                Dành cho cư dân đăng ký gói cố định theo tháng. {customerTypeFilter === 'monthly' && <strong>[ĐANG LỌC]</strong>}
              </span>
            </div>

            {/* Lọc Khách thường */}
            <div 
              onClick={() => setCustomerTypeFilter(prev => prev === 'casual' ? 'all' : 'casual')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flex: 1,
                minWidth: 280,
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 8,
                background: customerTypeFilter === 'casual' ? '#FFFBEB' : 'transparent',
                transition: 'all 0.2s',
                border: customerTypeFilter === 'casual' ? '1px solid #FDE68A' : '1px solid transparent'
              }}
              onMouseOver={(e) => { if (customerTypeFilter !== 'casual') e.currentTarget.style.background = '#FFFDF2'; }}
              onMouseOut={(e) => { if (customerTypeFilter !== 'casual') e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{
                fontSize: '0.68rem', color: '#B45309', fontWeight: 700,
                background: '#FFFBEB', border: `1px solid #FDE68A`,
                padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap'
              }}>
                Khách thường (Vé lượt)
              </span>
              <span style={{ fontSize: '0.82rem', color: C.gray600, lineHeight: 1.4 }}>
                Dành cho xe vãng lai gửi theo lượt thông thường. {customerTypeFilter === 'casual' && <strong>[ĐANG LỌC]</strong>}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default StaffHistoryPage;
