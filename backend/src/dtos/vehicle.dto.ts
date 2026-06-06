import { body } from 'express-validator';

export const vehicleSchema = [
  body('plateNumber')
    .trim()
    .notEmpty()
    .withMessage('Plate number is required'),
  body('type')
    .isIn(['MOTORBIKE', 'CAR'])
    .withMessage('Vehicle type must be MOTORBIKE or CAR'),
  body('isMonthly')
    .optional()
    .isBoolean()
    .withMessage('isMonthly must be a boolean'),
];

export const vehicleUpdateSchema = [
  body('plateNumber')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Plate number cannot be empty'),
  body('type')
    .optional()
    .isIn(['MOTORBIKE', 'CAR'])
    .withMessage('Vehicle type must be MOTORBIKE or CAR'),
];
