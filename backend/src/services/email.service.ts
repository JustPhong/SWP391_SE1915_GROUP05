import { Resend } from 'resend';
import { config } from '../config';

let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!config.resendApiKey) return null;
  if (!resend) resend = new Resend(config.resendApiKey);
  return resend;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const client = getResendClient();

  if (!client) {
    console.warn('[Email] RESEND_API_KEY is not configured; skipping email send. OTP logged to console only.');
    return;
  }

  const { data, error } = await client.emails.send({
    from: 'ParkSmart <onboarding@resend.dev>',
    to,
    subject,
    html,
  });

  if (error) {
    // Log the error but do NOT throw — OTP is already stored in memory.
    // In development / free Resend plan, emails can only be sent to the owner's address.
    console.warn(`[Email] Resend could not deliver to ${to}:`, error.message);
    console.warn('[Email] Tip: verify a domain at resend.com/domains or send to the Resend account email only.');
    return;
  }

  console.log(`[Email] Sent successfully. id=${data?.id}`);
}

export async function sendOtpEmail(to: string, otp: string, fullName?: string) {
  console.log(`[OTP] Code for ${to}: ${otp}`);
  const subject = 'Mã xác thực OTP - ParkSmart';
  const greeting = fullName ? `Xin chào <strong>${fullName}</strong>,` : 'Xin chào,';
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #f8fafc; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1E3A5F 0%, #2C4F78 100%); padding: 28px 32px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">🅿 ParkSmart</h1>
        <p style="color: rgba(255,255,255,0.75); margin: 6px 0 0; font-size: 13px;">Hệ thống đỗ xe thông minh</p>
      </div>
      <div style="padding: 32px; background: #ffffff;">
        <p style="margin: 0 0 12px; color: #374151; font-size: 15px;">${greeting}</p>
        <p style="margin: 0 0 24px; color: #6B7280; font-size: 14px; line-height: 1.6;">
          Chúng tôi đã nhận được yêu cầu xác thực tài khoản của bạn. Vui lòng sử dụng mã OTP dưới đây:
        </p>
        <div style="background: #F0F9FF; border: 2px dashed #BAE6FD; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="margin: 0 0 8px; font-size: 12px; color: #0284C7; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">Mã xác nhận OTP</p>
          <p style="margin: 0; font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #1E3A5F; font-family: 'Courier New', monospace;">${otp}</p>
        </div>
        <p style="margin: 0; font-size: 13px; color: #9CA3AF; line-height: 1.6;">
          ⏱ Mã có hiệu lực trong <strong>5 phút</strong>.<br/>
          🔒 Vui lòng không chia sẻ mã này với bất kỳ ai.
        </p>
      </div>
      <div style="padding: 16px 32px; background: #F9FAFB; border-top: 1px solid #E5E7EB; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #9CA3AF;">© 2025 ParkSmart DevTeam — SWP391 SE1915 FPT University</p>
      </div>
    </div>
  `;

  return sendEmail(to, subject, html);
}