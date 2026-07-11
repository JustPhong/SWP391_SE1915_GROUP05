import { Router } from 'express';
import { adminUserController } from '../controllers/admin-user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'STAFF'));

router.get('/',       requirePermission('account.manage'), adminUserController.list);
router.post('/',      requirePermission('account.manage'), adminUserController.create);
router.patch('/:id', requirePermission('account.manage'), adminUserController.update);
router.patch('/:id/status',          requirePermission('account.manage'), adminUserController.toggleStatus);
router.post('/:id/reset-password',   requirePermission('account.manage'), adminUserController.resetPassword);
   
export default router;
