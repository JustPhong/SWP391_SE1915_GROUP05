import dotenv from 'dotenv';
import path from 'path';

// Load environment variables explicitly first
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function verifySmtp() {
  console.log('=== SMTP Configuration Verification ===');
  
  // Dynamically import configurations and functions after dotenv has completed loading env variables
  const { verifyOtpSmtpConnection, closeOtpGmailTransporter } = await import('../services/email.service');
  const { config } = await import('../config');

  const user = process.env.GMAIL_USER || config.gmailUser;
  const hasPass = !!(process.env.GMAIL_APP_PASSWORD || config.gmailAppPassword);

  console.log('GMAIL_USER exists:', !!user);
  console.log('GMAIL_APP_PASSWORD exists:', hasPass);
  console.log('SMTP Host: smtp.gmail.com');
  console.log('SMTP Port: 465');
  console.log('Secure Mode: true');

  if (user) {
    // Mask email for safety
    const parts = user.split('@');
    const maskedUser = parts[0].substring(0, Math.min(3, parts[0].length)) + '***@' + (parts[1] || '');
    console.log('Sender/Authenticated User:', maskedUser);
  } else {
    console.log('Sender/Authenticated User: (not configured)');
  }

  try {
    await verifyOtpSmtpConnection();
    console.log('\n✅ SMTP connection and authentication verified successfully!');
    process.exitCode = 0;
  } catch (error) {
    console.error('\n❌ SMTP connection verification failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    closeOtpGmailTransporter();
  }
}

verifySmtp();
