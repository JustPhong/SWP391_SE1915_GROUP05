import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportService } from '../services/report.service';

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState({ activeCheckIns: 0, activeBookings: 0, activePackages: 0 });

  useEffect(() => {
    reportService.getSummary().then(setSummary).catch(console.error);
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>Dashboard</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>Welcome back, {user?.fullName}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <StatCard label="Active Check-ins" value={summary.activeCheckIns} color="#3498db" />
        <StatCard label="Active Bookings" value={summary.activeBookings} color="#f39c12" />
        <StatCard label="Monthly Packages" value={summary.activePackages} color="#2ecc71" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color }}>{value}</div>
      <div style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.5rem' }}>{label}</div>
    </div>
  );
}
