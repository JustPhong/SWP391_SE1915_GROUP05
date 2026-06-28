import React from 'react';

export function NotificationsPage() {
  const sample = [
    { id: '1', title: 'Hệ thống: Bảo trì định kỳ', body: 'Bãi sẽ được bảo trì vào 24/06/2026, 02:00-04:00.' },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '1.5rem auto', padding: '1rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Thông báo</h1>
      <p style={{ color: '#64748B', marginTop: 0 }}>Các thông báo liên quan đến ca trực và hệ thống.</p>

      <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
        {sample.map(n => (
          <div key={n.id} style={{ background: '#fff', padding: '0.85rem 1rem', borderRadius: 8, border: '1px solid #e6eef8' }}>
            <div style={{ fontWeight: 700 }}>{n.title}</div>
            <div style={{ color: '#475569', fontSize: '0.95rem' }}>{n.body}</div>
          </div>
        ))}
        {sample.length === 0 && (
          <div style={{ color: '#94a3b8' }}>Không có thông báo mới.</div>
        )}
      </div>
    </div>
  );
}

export default NotificationsPage;
