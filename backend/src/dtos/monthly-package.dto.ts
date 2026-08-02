import { body } from 'express-validator';

export const paymentSchema = [
  body('paymentMethod')
    .isIn(['CASH', 'CARD', 'EWALLET'])
    .withMessage('Payment method must be CASH, CARD, or EWALLET'),
];
   

export const setAutoRenewSchema = [
  body('enabled')
    .isBoolean()
    .withMessage('enabled must be a boolean'),
];
