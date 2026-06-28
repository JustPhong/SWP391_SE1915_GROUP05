import React, { useState } from 'react';
import styles from '../styles/welcome.module.css';

export function SupportPage() {
  const [activeSupportTab, setActiveSupportTab] = useState<'help' | 'faq' | 'contact'>('help');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', email: '', subject: 'Sự cố thanh toán', message: '' });
  const [isContactSubmitted, setIsContactSubmitted] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);

  const toggleFaq = (index: number) => setExpandedFaq(expandedFaq === index ? null : index);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitting(true);
    setTimeout(() => {
      setContactSubmitting(false);
      setIsContactSubmitted(true);
    }, 800);
  };

  const resetContactForm = () => {
    setContactForm({ name: '', phone: '', email: '', subject: 'Sự cố thanh toán', message: '' });
    setIsContactSubmitted(false);
  };

  return (
    <div style={{ maxWidth: 980, margin: '1.5rem auto', padding: '1rem' }}>
      <h1 style={{ marginBottom: '0.75rem' }}>Trung tâm Hỗ trợ ParkSmart</h1>
      <div className={styles.supportModalTabs} style={{ marginBottom: '1rem' }}>
        <button className={`${styles.supportModalTab} ${activeSupportTab === 'help' ? styles.supportModalTabActive : ''}`} onClick={() => { setActiveSupportTab('help'); resetContactForm(); }}>Trung tâm trợ giúp</button>
        <button className={`${styles.supportModalTab} ${activeSupportTab === 'faq' ? styles.supportModalTabActive : ''}`} onClick={() => { setActiveSupportTab('faq'); resetContactForm(); }}>Câu hỏi thường gặp</button>
        <button className={`${styles.supportModalTab} ${activeSupportTab === 'contact' ? styles.supportModalTabActive : ''}`} onClick={() => setActiveSupportTab('contact')}>Liên hệ chúng tôi</button>
      </div>

      <div className={styles.supportModalBody}>
        {activeSupportTab === 'help' && (
          <div className={styles.helpGrid}>
            <div className={styles.helpCard}>
              <div className={styles.helpCardTitle}>
                <span>Hotline 24/7</span>
              </div>
              <div className={styles.helpCardContent}>
                <p style={{ fontWeight: 600, color: '#16293f', fontSize: '1.1rem', margin: '0.2rem 0' }}>1900 6868</p>
                <p>Hỗ trợ khẩn cấp, giải quyết sự cố ra vào bãi và lỗi thanh toán mọi lúc mọi nơi.</p>
              </div>
            </div>

            <div className={styles.helpCard}>
              <div className={styles.helpCardTitle}>
                <span>Hỗ trợ qua Email</span>
              </div>
              <div className={styles.helpCardContent}>
                <p style={{ fontWeight: 600, color: '#16293f', fontSize: '1rem', margin: '0.2rem 0' }}>support@parksmart.vn</p>
                <p>Tiếp nhận phản hồi, đề xuất, yêu cầu hóa đơn hoặc đăng ký gói tháng cho doanh nghiệp.</p>
              </div>
            </div>

            <div className={styles.helpCard}>
              <div className={styles.helpCardTitle}>
                <span>Thời gian phục vụ</span>
              </div>
              <div className={styles.helpCardContent}>
                <p style={{ fontWeight: 600, color: '#16293f', margin: '0.2rem 0' }}>Thứ 2 - Chủ Nhật</p>
                <p>Mở cửa phục vụ liên tục 24 giờ mỗi ngày, kể cả các ngày lễ Tết.</p>
              </div>
            </div>

            <div className={styles.helpCard}>
              <div className={styles.helpCardTitle}>
                <span>Văn phòng Quản lý</span>
              </div>
              <div className={styles.helpCardContent}>
                <p style={{ fontWeight: 600, color: '#16293f', margin: '0.2rem 0' }}>Tầng lửng B1</p>
                <p>Bãi đỗ xe ParkSmart, 123 Đường 3/2, Quận 10, TP. Hồ Chí Minh.</p>
              </div>
            </div>
          </div>
        )}

        {activeSupportTab === 'faq' && (
          <div className={styles.faqList}>
            {[
              { q: "Làm thế nào để mua gói vé tháng?", a: "Để đăng ký vé tháng, bạn cần đăng nhập tài khoản của mình, vào mục 'Xe của tôi' để thêm phương tiện đỗ xe, sau đó điều hướng tới mục 'Gói tháng', chọn gói đỗ xe phù hợp và thanh toán bằng mã QR." },
              { q: "Tôi có thể hủy đặt chỗ trước khi vào bãi không?", a: "Có, bạn hoàn toàn có thể hủy đặt chỗ bất kỳ lúc nào trước giờ hẹn tối thiểu 30 phút." },
              { q: "Nếu tôi làm mất vé giấy/thẻ vãng lai thì phải xử lý thế nào?", a: "Liên hệ nhân viên Staff tại bốt trực cổng ra hoặc phòng điều hành. Phí đền bù mất thẻ là 500.000đ." },
            ].map((item, index) => (
              <div key={index} className={`${styles.faqItem} ${expandedFaq === index ? styles.faqItemOpen : ''}`}>
                <button className={styles.faqQuestion} onClick={() => toggleFaq(index)}>
                  <span>{item.q}</span>
                  <span style={{ transition: 'transform 0.2s', transform: expandedFaq === index ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </button>
                {expandedFaq === index && (
                  <div className={styles.faqAnswer}>{item.a}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeSupportTab === 'contact' && (
          isContactSubmitted ? (
            <div className={styles.successMessage}>
              <div className={styles.successIcon}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
              <h4 className={styles.successTitle}>Gửi phản hồi thành công!</h4>
              <p className={styles.successText}>Cảm ơn bạn. Yêu cầu hỗ trợ của bạn đã được chuyển tới bộ phận kỹ thuật. Chúng tôi sẽ phản hồi lại bạn sớm nhất có thể.</p>
              <button className={styles.btnOutline} onClick={resetContactForm}>Gửi tin nhắn khác</button>
            </div>
          ) : (
            <form className={styles.contactForm} onSubmit={handleContactSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.formGroupLabel}>Họ và tên</label>
                <input type="text" className={styles.formInput} placeholder="Nhập họ và tên của bạn" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formGroupLabel}>Số điện thoại</label>
                <input type="tel" className={styles.formInput} placeholder="Nhập số điện thoại" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formGroupLabel}>Địa chỉ Email</label>
                <input type="email" className={styles.formInput} placeholder="example@gmail.com" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formGroupLabel}>Vấn đề cần hỗ trợ</label>
                <select className={styles.formSelect} value={contactForm.subject} onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}>
                  <option value="Sự cố thanh toán">Sự cố thanh toán</option>
                  <option value="Lỗi đặt chỗ (Booking)">Lỗi đặt chỗ (Booking)</option>
                  <option value="Thẻ/Vé đỗ xe">Thẻ/Vé đỗ xe</option>
                  <option value="Gói tháng cố định">Gói tháng cố định</option>
                  <option value="Đóng góp ý kiến">Đóng góp ý kiến</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formGroupLabel}>Nội dung</label>
                <textarea className={styles.formTextarea} placeholder="Mô tả chi tiết vấn đề bạn đang gặp phải..." value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} required />
              </div>
              <button type="submit" className={styles.btnPrimary} disabled={contactSubmitting} style={{ marginTop: '0.5rem' }}>{contactSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu hỗ trợ'}</button>
            </form>
          )
        )}
      </div>
    </div>
  );
}

export default SupportPage;
