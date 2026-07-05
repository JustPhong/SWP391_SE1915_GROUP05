import { useEffect, useState } from 'react';
import api from '../services/api';

interface HistoryEntry {
  id: string;
  plateNumber: string;
  slotCode: string;
  date: string;
  duration: string;
  amount: number;
  status: string;
}

const C = {
  navy: '#1E3A5F',
  blue: '#3B82F6',
  blueBg: '#EFF6FF',
  green: '#10B981',
  greenBg: '#ECFDF5',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray500: '#6B7280',
  gray800: '#1F2937',
  white: '#FFFFFF',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const getStatusStyles = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s.includes('đang đỗ') || s.includes('parking') || s.includes('active')) {
    return { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' };
  }
  if (s.includes('hoàn thành') || s.includes('completed')) {
    return { bg: '#DCFCE7', text: '#15803D', dot: '#16A34A' };
  }
  if (s.includes('đặt chỗ') || s.includes('booking') || s.includes('reserve') || s.includes('đã đặt')) {
    return { bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B' };
  }
  return { bg: '#F3F4F6', text: '#4B5563', dot: '#9CA3AF' };
};

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[] | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await api.get('/driver-dashboard/history');
        if (cancelled) return;
        setHistory(res.data.data ?? []);
      } catch {
        if (cancelled) return;
        setHistory([]);
        setError('Không thể tải lịch sử. Vui lòng thử lại.');
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{
      background: C.white,
      borderRadius: 20,
      boxShadow: '0 10px 30px rgba(30, 58, 95, 0.05)',
      border: '1px solid #E5E7EB',
      padding: '2rem',
    }}>
      {/* Page Title & Subtitle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #F3F4F6',
        paddingBottom: '1.25rem',
        marginBottom: '1.5rem',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: C.navy, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Lịch sử gửi xe
          </h2>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: C.gray500 }}>
            Danh sách tất cả các lượt đỗ xe và giao dịch của bạn
          </p>
        </div>
        {history !== undefined && history.length > 0 && (
          <span style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            color: C.blue,
            background: C.blueBg,
            padding: '0.4rem 0.85rem',
            borderRadius: 20,
          }}>
            {history.length} Giao dịch
          </span>
        )}
      </div>

      {history === undefined ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: C.gray500, fontSize: '0.88rem' }}>Đang tải...</p>
      ) : error ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: '#EF4444', fontSize: '0.88rem' }}>{error}</p>
      ) : history.length > 0 ? (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #E5E7EB' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['Biển số', 'Mã chỗ', 'Thời gian vào', 'Thời lượng', 'Số tiền', 'Trạng thái'].map((h) => (
                  <th key={h} style={{
                    padding: '0.85rem 1.25rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: C.gray500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => {
                const statusStyle = getStatusStyles(entry.status);
                return (
                  <tr key={entry.id} style={{
                    borderBottom: '1px solid #F3F4F6',
                  }}>
                    {/* Biển số */}
                    <td style={{ padding: '0.9rem 1.25rem' }}>
                      <span style={{
                        display: 'inline-block',
                        background: '#F3F4F6',
                        color: C.gray800,
                        fontFamily: "'Consolas', monospace",
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: 6,
                        border: '1px solid #E5E7EB',
                        letterSpacing: '0.02em',
                      }}>
                        {entry.plateNumber}
                      </span>
                    </td>

                    {/* Mã chỗ */}
                    <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.88rem', fontWeight: 600, color: C.gray800 }}>
                       {entry.slotCode}
                    </td>

                    {/* Ngày */}
                    <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.85rem', color: C.gray500 }}>
                      {formatDateTime(entry.date)}
                    </td>

                    {/* Thời gian */}
                    <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.85rem', color: C.gray800, fontWeight: 500 }}>
                      {entry.duration}
                    </td>

                    {/* Số tiền */}
                    <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.88rem', fontWeight: 700, color: C.navy }}>
                      {formatCurrency(entry.amount)}
                    </td>

                    {/* Trạng thái */}
                    <td style={{ padding: '0.9rem 1.25rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: statusStyle.bg,
                        color: statusStyle.text,
                        padding: '0.25rem 0.65rem',
                        borderRadius: 20,
                        fontSize: '0.74rem',
                        fontWeight: 700,
                      }}>
                        <span style={{
                          width: 6, height: 6,
                          borderRadius: '50%',
                          background: statusStyle.dot,
                        }} />
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ textAlign: 'center', padding: '3rem', color: C.gray500, fontSize: '0.88rem' }}>Chưa có lịch sử đỗ xe</p>
      )}
    </div>
  );
}

