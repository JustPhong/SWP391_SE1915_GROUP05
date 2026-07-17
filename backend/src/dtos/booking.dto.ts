import { body, param } from 'express-validator';

export const createBookingSchema = [
  body('plateNumber')
    .notEmpty().withMessage('Biển số xe không được để trống')
    .isString().trim()
    .isLength({ min: 4 }).withMessage('Biển số xe không hợp lệ'),
  body('expectedArrival')
    .isISO8601().withMessage('Thời gian đến dự kiến phải là ngày hợp lệ'),

  body('ownerFullName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Tên chủ xe tối đa 100 ký tự'),
  body('ownerEmail')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Email không hợp lệ'),
  body('ownerPhone')
    .optional()
    .trim()
    .matches(/^0\d{9,10}$/)
    .withMessage('Số điện thoại không hợp lệ'),
];


export const cancelBookingSchema = [
  param('id')
    .matches(/^(BK-[A-Z0-9]{6}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)
    .withMessage('Mã đặt chỗ không hợp lệ'),
];