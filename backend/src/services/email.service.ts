import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { config } from '../config';

let resend: Resend | null = null;
let nodemailerTransporter: any = null;

function getResendClient(): Resend | null {
  if (!config.resendApiKey || config.resendApiKey === 'your-resend-api-key-here') {
    return null;
  }
  if (!resend) resend = new Resend(config.resendApiKey);
  return resend;
}

function getNodemailerTransporter() {
  if (!config.gmailUser || !config.gmailAppPassword) return null;
  if (!nodemailerTransporter) {
    nodemailerTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.gmailUser,
        pass: config.gmailAppPassword,
      },
    });
  }
  return nodemailerTransporter;
}

export async function sendEmail(to: string, subject: string, html: string) {
  // 1. Try Gmail SMTP first if credentials are set
  const transporter = getNodemailerTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"ParkSmart" <${config.gmailUser}>`,
        to,
        subject,
        html,
      });
      console.log(`[Email] Sent successfully via Gmail SMTP to ${to}. MessageId: ${info.messageId}`);
      return;
    } catch (err: any) {
      console.error(`[Email] Failed to send via Gmail SMTP to ${to}:`, err.message);
      // Fallback to Resend or console log if Gmail fails
    }
  }

  // 2. Fallback to Resend API
  const client = getResendClient();
  if (client) {
    const { data, error } = await client.emails.send({
      from: 'ParkSmart <onboarding@resend.dev>',
      to,
      subject,
      html,
    });

    if (error) {
      console.warn(`[Email] Resend could not deliver to ${to}:`, error.message);
      console.warn('[Email] Tip: verify a domain at resend.com/domains or send to the Resend account email only.');
      return;
    }

    console.log(`[Email] Sent successfully via Resend. id=${data?.id}`);
    return;
  }

  console.warn('[Email] No email sending credentials (Gmail or Resend) configured; skipping email send. OTP logged to console only.');
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
        <p style="margin: 0; font-size: 12px; color: #9CA3AF;">© 2026 ParkSmart DevTeam — SWP391 SE1915 FPT University</p>
      </div>
    </div>
  `;

  return sendEmail(to, subject, html);
}

export async function sendBookingEmail(
  to: string,
  fullName: string,
  bookingDetails: {
    bookingId: string;
    plateNumber: string;
    vehicleType: 'CAR' | 'MOTORBIKE';
    slotCode: string;
    floorName: string;
    expectedArrival: Date;
    depositAmount: number;
  }
) {
  const subject = `[ParkSmart] Xác nhận giữ chỗ thành công – ${bookingDetails.bookingId}`;
  const d = new Date(bookingDetails.expectedArrival);
  const pad = (n: number) => String(n).padStart(2, '0');
  const formattedArrival = `${pad(d.getHours())}:${pad(d.getMinutes())} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

  const formattedDeposit = new Intl.NumberFormat('vi-VN').format(bookingDetails.depositAmount) + ' ₫';

  const floorText = bookingDetails.floorName.toLowerCase().startsWith('tầng') || bookingDetails.floorName.toLowerCase().startsWith('tang')
    ? bookingDetails.floorName
    : `Tầng ${bookingDetails.floorName}`;

  const html = `
    <table style="width: 100%; border-collapse: collapse; background-color: #F3F6FA; margin: 0; padding: 0;">
      <tr>
        <td align="center" style="padding: 24px 16px;">
          <!-- Hidden Preheader -->
          <div style="display: none; max-height: 0px; overflow: hidden; font-size: 0px; line-height: 0px; color: #ffffff;">
            Yêu cầu giữ chỗ và thanh toán phí giữ chỗ của bạn đã được xác nhận.
          </div>
          
          <!-- Main Container Card -->
          <table style="width: 100%; max-width: 640px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #D9E2EE;">
            
            <!-- Header Banner -->
            <tr>
              <td style="background-color: #031B3D; padding: 28px 32px; text-align: left;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="vertical-align: middle;">
                      <table style="border-collapse: collapse;">
                        <tr>
                          <td style="padding-right: 12px; vertical-align: middle;">
                            <div style="background-color: #ffffff; border-radius: 8px; width: 44px; height: 44px; text-align: center; font-family: Arial, Helvetica, sans-serif; font-weight: 900; font-size: 26px; color: #031B3D; line-height: 44px;">P</div>
                          </td>
                          <td style="vertical-align: middle;">
                            <span style="color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 26px; font-weight: 800; line-height: 1; vertical-align: middle;">ParkSmart</span>
                            <div style="color: #93c5fd; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 500; margin-top: 4px; line-height: 1.2;">Đỗ xe thông minh, cuộc sống thuận tiện</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Main Body -->
            <tr>
              <td style="padding: 32px 32px 24px; text-align: left; background-color: #ffffff;">
                <p style="margin: 0 0 12px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 700; color: #101828;">Xin chào ${fullName || 'Quý khách'},</p>
                <p style="margin: 0 0 24px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #475467; line-height: 1.6; font-weight: 500;">
                  ParkSmart đã xác nhận yêu cầu giữ chỗ và thanh toán phí giữ chỗ thành công.<br/>
                  Vui lòng đưa phương tiện đến bãi trước thời hạn dưới đây.
                </p>

                <!-- Green Status Banner -->
                <table style="width: 100%; border-collapse: collapse; background-color: #ECFDF3; border: 1px solid #D1FAE5; border-radius: 8px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 16px; vertical-align: middle;">
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="width: 32px; vertical-align: middle; padding-right: 12px;">
                            <table style="width: 24px; height: 24px; border-collapse: collapse; background-color: #087A3E; border-radius: 12px; border-spacing: 0;">
                              <tr>
                                <td style="vertical-align: middle; text-align: center; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: bold; color: #ffffff; padding: 0; line-height: 24px;">
                                  ✓
                                </td>
                              </tr>
                            </table>
                          </td>
                          <td style="vertical-align: middle; text-align: left;">
                            <h4 style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; color: #087A3E; line-height: 1.4;">ĐẶT CHỖ ĐÃ ĐƯỢC XÁC NHẬN</h4>
                            <p style="margin: 2px 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #475467; line-height: 1.4; font-weight: 500;">Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của ParkSmart!</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Details Card -->
                <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border: 1px solid #D9E2EE; border-radius: 12px; box-shadow: 0 1px 3px rgba(11,47,107,0.04); margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 20px 24px;">
                      <table style="width: 100%; border-collapse: collapse;">
                        <!-- Card Header -->
                        <tr>
                          <td style="width: 50%; padding-bottom: 16px; border-bottom: 1px solid #D9E2EE; text-align: left; vertical-align: middle; white-space: nowrap !important;">
                            <span style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; color: #031B3D; vertical-align: middle; letter-spacing: 0.5px;">THÔNG TIN ĐẶT CHỖ</span>
                          </td>
                          <td style="width: 50%; padding-bottom: 16px; border-bottom: 1px solid #D9E2EE; text-align: right; vertical-align: middle; white-space: nowrap !important;">
                            <span style="background-color: #EFF6FF; border: 1px solid #BFDBFE; color: #1D4ED8; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; display: inline-block; white-space: nowrap !important;">Mã đặt chỗ: ${bookingDetails.bookingId}</span>
                          </td>
                        </tr>

                        <!-- Row 1: Biển số xe -->
                        <tr style="border-bottom: 1px solid #D9E2EE;">
                          <td style="padding: 14px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #475467; font-weight: 500; text-align: left; width: 35%; white-space: nowrap !important;">Biển số xe</td>
                          <td style="padding: 14px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #101828; font-weight: 700; text-align: right; width: 65%; font-family: monospace; white-space: nowrap !important;">${bookingDetails.plateNumber}</td>
                        </tr>

                        <!-- Row 2: Khu vực đỗ -->
                        <tr style="border-bottom: 1px solid #D9E2EE;">
                          <td style="padding: 14px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #475467; font-weight: 500; text-align: left; width: 35%; white-space: nowrap !important;">Khu vực đỗ</td>
                          <td style="padding: 14px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #101828; font-weight: 700; text-align: right; width: 65%; white-space: nowrap !important;">${floorText} · ${bookingDetails.vehicleType === 'CAR' ? 'Khu ô tô' : 'Khu xe máy'}</td>
                        </tr>

                        <!-- Row 3: Hạn đến bãi -->
                        <tr style="border-bottom: 1px solid #D9E2EE;">
                          <td style="padding: 14px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #475467; font-weight: 500; text-align: left; width: 35%; white-space: nowrap !important;">Hạn đến bãi</td>
                          <td style="padding: 14px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #EA580C; font-weight: 700; text-align: right; width: 65%; white-space: nowrap !important;">Trước ${formattedArrival}</td>
                        </tr>

                        <!-- Row 4: Thời gian giữ chỗ -->
                        <tr style="border-bottom: 1px solid #D9E2EE;">
                          <td style="padding: 14px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #475467; font-weight: 500; text-align: left; width: 35%; white-space: nowrap !important;">Thời gian giữ chỗ</td>
                          <td style="padding: 14px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #101828; font-weight: 700; text-align: right; width: 65%; white-space: nowrap !important;">30 phút</td>
                        </tr>

                        <!-- Row 5: Phí giữ chỗ -->
                        <tr style="border-bottom: 1px solid #D9E2EE;">
                          <td style="padding: 14px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #475467; font-weight: 500; text-align: left; width: 35%; white-space: nowrap !important;">Phí giữ chỗ đã thanh toán</td>
                          <td style="padding: 14px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #087A3E; font-weight: 700; text-align: right; width: 65%; white-space: nowrap !important;">${formattedDeposit}</td>
                        </tr>

                        <!-- Row 6: Trạng thái -->
                        <tr>
                          <td style="padding: 14px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #475467; font-weight: 500; text-align: left; width: 35%; white-space: nowrap !important;">Trạng thái</td>
                          <td style="padding: 14px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #087A3E; font-weight: 700; text-align: right; width: 65%; white-space: nowrap !important;">Đã xác nhận</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Warning Disclaimer Box -->
                <table style="width: 100%; border-collapse: collapse; background-color: #FFF9ED; border: 1px solid #F5D58A; border-radius: 8px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 18px; text-align: left;">
                      <h4 style="margin: 0 0 10px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; color: #EA580C; letter-spacing: 0.5px;">LƯU Ý QUAN TRỌNG</h4>
                      <ul style="margin: 0; padding-left: 18px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #78350f; line-height: 1.6;">
                        <li style="margin-bottom: 6px;">Vui lòng đưa đúng phương tiện có biển số trên đến bãi trước thời hạn.</li>
                        <li style="margin-bottom: 6px;">Khi đến bãi, vui lòng di chuyển đến đúng khu vực đã xác nhận và đỗ xe tại một ô còn trống.</li>
                        <li style="margin-bottom: 6px;">Nếu xe không đến đúng hạn, yêu cầu giữ chỗ sẽ tự động hết hiệu lực.</li>
                        <li style="margin-bottom: 6px;">Phí giữ chỗ không được hoàn lại khi khách không đến đúng hạn.</li>
                        <li>Mỗi lượt giữ chỗ chỉ áp dụng cho một phương tiện.</li>
                      </ul>
                    </td>
                  </tr>
                </table>

                <!-- Support Panel -->
                <table style="width: 100%; border-collapse: collapse; background-color: #F3F6FA; border: 1px solid #D9E2EE; border-radius: 8px;">
                  <tr>
                    <td style="padding: 16px; text-align: left;">
                      <h4 style="margin: 0 0 4px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 700; color: #031B3D;">Cần hỗ trợ?</h4>
                      <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #475467; line-height: 1.5; font-weight: 500;">
                        Liên hệ hotline <strong style="color: #031B3D;">1900 1234</strong> hoặc email <strong style="color: #031B3D;">support@parksmart.vn</strong>.<br/>
                        Chúng tôi luôn sẵn sàng hỗ trợ bạn 24/7.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Copyright Footer -->
            <tr>
              <td style="background-color: #031B3D; padding: 28px 32px; text-align: center;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding-bottom: 12px;">
                      <div style="background-color: #ffffff; border-radius: 6px; width: 32px; height: 32px; text-align: center; font-family: Arial, Helvetica, sans-serif; font-weight: 900; font-size: 18px; color: #031B3D; line-height: 32px; display: inline-block; vertical-align: middle;">P</div>
                      <span style="color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 800; vertical-align: middle; margin-left: 8px;">ParkSmart</span>
                      <div style="color: #93c5fd; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 500; margin-top: 4px;">Đỗ xe thông minh, cuộc sống thuận tiện</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #93c5fd; line-height: 1.5;">
                      Hotline: 1900 1234 &nbsp;|&nbsp; Email: support@parksmart.vn &nbsp;|&nbsp; Website: www.parksmart.vn<br/>
                      <span style="color: rgba(255,255,255,0.5); display: inline-block; margin-top: 6px;">© 2026 ParkSmart. All rights reserved.</span><br/>
                      <span style="color: rgba(255,255,255,0.4); font-size: 11px;">Email này được gửi tự động, vui lòng không trả lời.</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  `;

  return sendEmail(to, subject, html);
}