import { body } from 'express-validator';

export const paymentSchema = [
  body('paymentMethod')
    .isIn(['CASH', 'CARD', 'EWALLET'])
    .withMessage('Payment method must be CASH, CARD, or EWALLET'),
];
   
export const createMonthlyPackageSchema = [
  body('userId')
    .isUUID()
    .withMessage('User ID must be a valid UUID'),
  body('vehicleId')
    .isUUID()
    .withMessage('Vehicle ID must be a valid UUID'),
  body('slotId')
    .optional()
    .isUUID()
    .withMessage('Slot ID must be a valid UUID'),
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('expiryDate')
    .isISO8601()
    .withMessage('Expiry date must be a valid ISO 8601 date'),
  body('price')
    .isFloat({ gt: 0 })
    .withMessage('Price must be a positive number'),
].concat(paymentSchema);
