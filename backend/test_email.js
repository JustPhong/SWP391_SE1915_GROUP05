const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ducpo123321@gmail.com',
    pass: 'azdd zbvc hrol eyuw'
  }
});

transporter.sendMail({
  from: '"ParkSmart" <ducpo123321@gmail.com>',
  to: 'ducpo123321@gmail.com',
  subject: 'Test OTP - ParkSmart',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #f8fafc; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1E3A5F 0%, #2C4F78 100%); padding: 28px 32px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;">&#x1F17F; ParkSmart</h1>
        <p style="color: rgba(255,255,255,0.75); margin: 6px 0 0; font-size: 13px;">He thong do xe thong minh</p>
      </div>
      <div style="padding: 32px; background: #ffffff;">
        <p style="margin: 0 0 12px; color: #374151; font-size: 15px;">Xin chao,</p>
        <p style="margin: 0 0 24px; color: #6B7280; font-size: 14px;">Day la email thu nghiem xac nhan he thong gui OTP qua Gmail da hoat dong.</p>
        <div style="background: #F0F9FF; border: 2px dashed #BAE6FD; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="margin: 0 0 8px; font-size: 12px; color: #0284C7; font-weight: 600; text-transform: uppercase;">Ma xac nhan OTP (thu nghiem)</p>
          <p style="margin: 0; font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #1E3A5F; font-family: monospace;">123456</p>
        </div>
        <p style="margin: 0; font-size: 13px; color: #10B981; font-weight: 600;">&#x2705; He thong gui OTP qua Gmail hoat dong binh thuong!</p>
      </div>
    </div>
  `
}).then(info => {
  console.log('Email gui thanh cong! ID:', info.messageId);
  console.log('Kiem tra hop thu cua: ducpo123321@gmail.com');
}).catch(e => {
  console.error('Loi gui email:', e.message);
});
