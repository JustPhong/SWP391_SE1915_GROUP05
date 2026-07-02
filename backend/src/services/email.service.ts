import { Resend } from 'resend';
import { config } from '../config';

export async function sendOtpEmail(to: string, otpCode: string, fullName: string): Promise<void> {
  if (!config.resend.apiKey || config.resend.apiKey.startsWith('re_xxxx')) {
    console.warn('[Email] Resend API Key not configured — OTP would be:', otpCode);
    return;
  }

  const resend = new Resend(config.resend.apiKey);

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="margin: 0; font-size: 1.5rem; color: #1E3A5F; font-weight: 800;">🅿️ ParkSmart</h1>
        <p style="margin: 4px 0 0; font-size: 0.85rem; color: #6B7280;">Hệ thống quản lý bãi đỗ xe thông minh</p>
      </div>

      <div style="background: #F9FAFB; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px;">
        <p style="margin: 0 0 8px; font-size: 0.9rem; color: #374151;">Xin chào <strong>${fullName}</strong>,</p>
        <p style="margin: 0 0 16px; font-size: 0.85rem; color: #6B7280;">Mã xác nhận đăng ký tài khoản của bạn:</p>
        <div style="background: #1E3A5F; color: #ffffff; font-size: 2rem; font-weight: 900; letter-spacing: 0.5em; padding: 16px 24px; border-radius: 12px; display: inline-block; font-family: 'Consolas', monospace;">
          ${otpCode}
        </div>
        <p style="margin: 16px 0 0; font-size: 0.78rem; color: #9CA3AF;">Mã có hiệu lực trong <strong>5 phút</strong>. Không chia sẻ mã này với bất kỳ ai.</p>
      </div>

      <p style="margin: 0; font-size: 0.75rem; color: #9CA3AF; text-align: center;">
        Nếu bạn không yêu cầu đăng ký tài khoản, vui lòng bỏ qua email này.
      </p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'ParkSmart <onboarding@resend.dev>', // Email mặc định của Resend dùng để test
      to: to,
      subject: `[ParkSmart] Mã xác nhận đăng ký: ${otpCode}`,
      html: html,
    });

    if (error) {
      console.error('[Email] Error sending email via Resend:', error);
    } else {
      console.log('[Email] Email sent successfully via Resend:', data);
    }
  } catch (err) {
    console.error('[Email] Failed to send email via Resend:', err);
  }
}

export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
  if (!config.resend.apiKey || config.resend.apiKey.startsWith('re_xxxx')) {
    console.warn('[Email] Resend API Key not configured — would send:', subject);
    return;
  }
  const resend = new Resend(config.resend.apiKey);
  try {
    const { data, error } = await resend.emails.send({
      from: 'ParkSmart <onboarding@resend.dev>',
      to: to,
      subject: subject,
      html: htmlBody,
    });
    if (error) {
      console.error('[Email] Error sending email via Resend:', error);
    } else {
      console.log('[Email] Email sent successfully via Resend:', data);
    }
  } catch (err) {
    console.error('[Email] Failed to send email via Resend:', err);
  }
}