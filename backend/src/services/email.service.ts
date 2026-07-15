import nodemailer from 'nodemailer';
import { config } from '../config';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  const user = config.gmailUser;
  const pass = config.gmailAppPassword;

  if (!user || !pass) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const client = getTransporter();

  if (!client) {
    console.warn('[Email] GMAIL_USER / GMAIL_APP_PASSWORD chưa được cấu hình. OTP chỉ in ra console.');
    return;
  }

  try {
    const info = await client.sendMail({
      from: `"ParkSmart" <${config.gmailUser}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] Gửi thành công: ${info.messageId}`);
  } catch (err: any) {
    console.error(`[Email] Lỗi khi gửi email tới ${to}:`, err?.message);
    // Không throw — OTP đã lưu trong bộ nhớ, người dùng có thể dùng mã bypass 123456 nếu cần.
  }
}

export async function sendOtpEmail(to: string, otp: string, fullName?: string) {
  console.log(`[OTP] Mã cho ${to}: ${otp}  ← (mã bypass: 123456)`);
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