import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { registerSchema, loginSchema } from '../dtos/auth.dto';
import { validate } from '../middleware/error.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { uploadAvatar } from '../middleware/upload.middleware';

const router = Router();

router.post('/register', registerSchema, validate, authController.register);
router.post('/login', loginSchema, validate, authController.login);
router.get('/me', authenticate, authController.me);
router.patch('/profile', authenticate, authController.updateProfile);
router.patch('/password', authenticate, authController.changePassword);
router.post('/avatar', authenticate, uploadAvatar.single('avatar'), authController.uploadAvatar);
router.delete('/avatar', authenticate, authController.removeAvatar);
router.delete('/profile', authenticate, authController.deleteAccount);

export default router;
   