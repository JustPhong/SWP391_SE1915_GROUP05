import { body } from 'express-validator';

export const registerSchema = [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role')
    .isIn(['ADMIN', 'MANAGER', 'STAFF', 'DRIVER'])
    .withMessage('Role must be ADMIN, MANAGER, STAFF, or DRIVER'),
];

export const loginSchema = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];
