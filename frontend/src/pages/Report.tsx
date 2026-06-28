import { useEffect, useState } from 'react';
import { reportService } from '../services/report.service';
import { Table } from '../components/Table';

export function ReportPage() {
  const [occupancy, setOccupancy] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    try {
      const [occ, rev] = await Promise.all([
        reportService.getOccupancy(),
        reportService.getRevenue({ startDate: startDate || undefined, endDate: endDate || undefined }),
      ]);
      setOccupancy(occ);
      setRevenue(rev);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>Báo cáo và Thống kê</h1>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Từ ngày</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Đến ngày</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>
        <button
          onClick={loadReports}
          disabled={loading}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
        >
          Làm mới
        </button>
      </div>

      {occupancy && (
        <>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Tổng quan tình trạng</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <StatCard label="Tổng số ô" value={occupancy.totalSlots} />
            <StatCard label="Số ô trống" value={occupancy.availableSlots} color="#2ecc71" />
            <StatCard label="Số ô đã sử dụng" value={occupancy.occupiedSlots} color="#e74c3c" />
            <StatCard label="Số ô đã đặt" value={occupancy.reservedSlots} color="#f39c12" />
            <StatCard label="Tỉ lệ lấp đầy" value={`${occupancy.occupancyRate.toFixed(1)}%`} color="#3498db" />
          </div>

          {occupancy.byFloor.length > 0 && (
            <>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Theo từng tầng</h3>
              <Table
                columns={[
                  { key: 'floor', label: 'Tầng' },
                  { key: 'total', label: 'Tổng' },
                  { key: 'available', label: 'Trống' },
                  { key: 'occupied', label: 'Đã sử dụng' },
                  { key: 'reserved', label: 'Đã đặt' },
                  { key: 'occupancyRate', label: 'Tỉ lệ %', render: (row) => `${row.occupancyRate.toFixed(1)}%` },
                ]}
                data={occupancy.byFloor}
              />
            </>
          )}
        </>
      )}

      {revenue && (
        <>
          <h2 style={{ fontSize: '1.2rem', margin: '2rem 0 1rem' }}>Doanh thu</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <StatCard label="Tổng doanh thu" value={`${revenue.totalRevenue.toLocaleString()} VND`} color="#2ecc71" />
            <StatCard label="Doanh thu lượt" value={`${revenue.sessionRevenue.toLocaleString()} VND`} />
            <StatCard label="Doanh thu gói tháng" value={`${revenue.monthlyRevenue.toLocaleString()} VND`} color="#9b59b6" />
            <StatCard label="Số giao dịch" value={revenue.transactionCount} color="#3498db" />
          </div>

          {Object.keys(revenue.byMethod).length > 0 && (
            <>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Theo phương thức thanh toán</h3>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                {Object.entries(revenue.byMethod).map(([method, amount]) => (
                  <div key={method} style={{ background: '#f8f9fa', padding: '0.75rem 1rem', borderRadius: '4px' }}>
                    <strong>{method}</strong>: {Number(amount).toLocaleString()} VND
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: color || '#333' }}>{value}</div>
      <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem' }}>{label}</div>
    </div>
  );

}
