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
  body('brand')
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Brand must be at most 60 characters'),
  body('model')
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Model must be at most 60 characters'),
  body('color')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Color must be at most 30 characters'),
  body('year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() })
    .withMessage('Year must be a valid year'),
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
  body('brand')
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Brand must be at most 60 characters'),
  body('model')
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Model must be at most 60 characters'),
  body('color')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Color must be at most 30 characters'),
  body('year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() })
    .withMessage('Year must be a valid year'),
];
