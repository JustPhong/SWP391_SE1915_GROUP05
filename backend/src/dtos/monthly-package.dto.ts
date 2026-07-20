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
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('expiryDate')
    .isISO8601()
    .withMessage('Expiry date must be a valid ISO 8601 date'),
  body('price')
    .isFloat({ gt: 0 })
    .withMessage('Price must be a positive number'),
  body('planId')
    .optional()
    .isIn(['1m', '3m', '1y'])
    .withMessage('Plan ID must be 1m, 3m, or 1y'),
].concat(paymentSchema);

export const setAutoRenewSchema = [
  body('enabled')
    .isBoolean()
    .withMessage('enabled must be a boolean'),
];
