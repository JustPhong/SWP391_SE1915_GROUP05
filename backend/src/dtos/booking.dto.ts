import { body } from 'express-validator';

export const createBookingSchema = [
  body('plateNumber')
    .notEmpty().withMessage('Biển số xe không được để trống')
    .isString().trim()
    .isLength({ min: 4 }).withMessage('Biển số xe không hợp lệ'),
  body('slotId')
    .optional()
    .isUUID().withMessage('Slot ID phải là UUID hợp lệ'),
  body('expectedArrival')
    .isISO8601().withMessage('Thời gian đến dự kiến phải là ngày hợp lệ'),
];

export const cancelBookingSchema = [
  body('bookingId')
    .isInt().withMessage('Booking ID phải là số nguyên hợp lệ'),
];