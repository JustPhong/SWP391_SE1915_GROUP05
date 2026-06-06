import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { registerSchema, loginSchema } from '../dtos/auth.dto';
import { validate } from '../middleware/error.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', registerSchema, validate, authController.register);
router.post('/login', loginSchema, validate, authController.login);
router.get('/me', authenticate, authController.me);

export default router;
