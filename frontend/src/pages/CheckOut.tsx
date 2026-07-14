import CheckoutWizard from '../components/checkout/CheckoutWizard';

export function CheckOutPage() {
  return (
    <div style={{ minHeight: '100%', background: '#F0F4F8', fontFamily: "'Segoe UI', Arial, sans-serif", padding: '1.5rem', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#1E3A5F' }}>Check-out xe</h1>
        <p style={{ margin: '0.15rem 0 0', fontSize: '0.875rem', color: '#6B7280' }}>Tìm xe → Thanh toán → Cho xe ra bãi</p>
      </div>
      <CheckoutWizard />
    </div>
  );
}