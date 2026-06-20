import { body, param } from 'express-validator';

export const checkInSchema = [
  body('plateNumber')
    .trim()
    .notEmpty()
    .withMessage('Plate number is required'),
  body('slotId')
    .optional()
    .isUUID()
    .withMessage('Slot ID must be a valid UUID'),
  body('isMonthly')
    .optional()
    .isBoolean()
    .withMessage('isMonthly must be a boolean'),
];   

export const checkOutSchema = [
  body('paymentMethod')
    .isIn(['CASH', 'CARD', 'EWALLET'])
    .withMessage('Payment method must be CASH, CARD, or EWALLET'),
];

export const validatePlateNumber = [
  param('plateNumber')
    .trim()
    .notEmpty()
    .withMessage('Plate number is required'),
];
