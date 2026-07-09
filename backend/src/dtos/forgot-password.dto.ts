import { body } from 'express-validator';

export const forgotPasswordSchema = [
  body('email').isEmail().normalizeEmail().withMessage('Email hợp lệ là bắt buộc'),
  // fullName có thể hỗ trợ sendOtpEmail (nếu FE gửi)
  body('fullName').optional().isString().trim().notEmpty().withMessage('fullName không hợp lệ'),
];

export const resetPasswordSchema = [
  body('email').isEmail().normalizeEmail().withMessage('Email hợp lệ là bắt buộc'),
  body('otp').notEmpty().withMessage('OTP là bắt buộc'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu mới phải có ít nhất 6 ký tự'),
];

