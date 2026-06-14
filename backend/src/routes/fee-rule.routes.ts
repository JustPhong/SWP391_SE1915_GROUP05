import { Router } from 'express';
import { feeRuleController } from '../controllers/fee-rule.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/',       requirePermission('fee_rule.manage'), feeRuleController.list);
router.patch('/:id', requirePermission('fee_rule.manage'), feeRuleController.updateAmount);

export default router;
