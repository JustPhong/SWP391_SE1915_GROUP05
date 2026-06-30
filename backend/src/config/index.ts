import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-me',
  databaseUrl: process.env.DATABASE_URL || '',
  vietqr: {
    bankId: process.env.VIETQR_BANK_ID || 'MB',
    accountNo: process.env.VIETQR_ACCOUNT_NO || '0000000000',
    accountName: process.env.VIETQR_ACCOUNT_NAME || 'PARKSMART OWNER',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
  },
};

