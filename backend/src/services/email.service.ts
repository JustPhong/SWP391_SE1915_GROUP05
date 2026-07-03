import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = nodemailer.createTransport({
  host: config.emailHost,
  port: config.emailPort,
  secure: config.emailPort === 465,
  auth: {
    user: config.emailUser,
    pass: config.emailPass,
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  if (!config.emailHost || !config.emailUser || !config.emailPass) {
    console.warn('[Email] SMTP config is missing; skipping email send.');
    if (html.includes('Mã OTP của bạn là:')) {
      // Very basic fallback to extract OTP and log it if possible, but actually we can just warn
      console.warn('[Email] You might need to configure SMTP in .env to test OTP.');
    }
    return;
  }

  await transporter.sendMail({
    from: config.emailFrom,
    to,
    subject,
    html,
  });
}

export async function sendOtpEmail(to: string, otp: string, fullName?: string) {
  console.log(`[Email] OTP for ${to} is: ${otp}`);
  const subject = 'Mã xác thực OTP';
  const greeting = fullName ? `Xin chào ${fullName},` : 'Xin chào,';
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #333;">Xác thực tài khoản</h2>
      <p>${greeting}</p>
      <p>Mã OTP của bạn là:</p>
      <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #2563eb;">${otp}</p>
      <p style="color: #666;">Mã có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
    </div>
  `;

  return sendEmail(to, subject, html);
}