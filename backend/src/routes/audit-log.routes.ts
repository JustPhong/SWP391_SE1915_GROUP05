import { Router } from 'express';
import { auditLogController } from '../controllers/audit-log.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', requirePermission('audit_log.view'), auditLogController.list);

export default router;
   