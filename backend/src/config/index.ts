import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-me',
  databaseUrl: process.env.DATABASE_URL || '',
  emailHost: process.env.EMAIL_HOST || '',
  emailPort: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587,
  emailUser: process.env.EMAIL_USER || '',
  emailPass: process.env.EMAIL_PASS || '',
  emailFrom: process.env.EMAIL_FROM || 'no-reply@parkingsmart.local',
  resendApiKey: process.env.RESEND_API_KEY || '',
  vietqr: {
    bankId: process.env.VIETQR_BANK_ID || '',
    accountNo: process.env.VIETQR_ACCOUNT_NO || '',
    accountName: process.env.VIETQR_ACCOUNT_NAME || '',
    template: process.env.VIETQR_TEMPLATE || 'compact2',
  },
};