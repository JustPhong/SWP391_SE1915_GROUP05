import { Router } from 'express';
import { validate } from '../middleware/error.middleware';
import { forgotPasswordController } from '../controllers/forgot-password.controller';
import { forgotPasswordSchema, resetPasswordSchema } from '../dtos/forgot-password.dto';

const router = Router();

router.post('/forgot-password', forgotPasswordSchema, validate, forgotPasswordController.forgotPassword);
router.post('/reset-password', resetPasswordSchema, validate, forgotPasswordController.resetPassword);

export default router;

