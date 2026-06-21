import { Router } from 'express';
import { permissionController } from '../controllers/permission.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/',  permissionController.getAll);
router.patch('/', permissionController.toggle);

export default router;
   