import { Router } from 'express';
import { chatbotController } from '../controllers/chatbot.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('MANAGER', 'ADMIN'));

router.post('/ask', chatbotController.ask);
router.post('/chat', chatbotController.ask);

export default router;
