import { Router } from 'express';
import { feeRuleController } from '../controllers/fee-rule.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/',                requirePermission('fee_rule.manage'), feeRuleController.list);
router.post('/',               requirePermission('fee_rule.manage'), feeRuleController.create);
router.patch('/:id',           requirePermission('fee_rule.manage'), feeRuleController.updateAmount);
router.put('/:id',             requirePermission('fee_rule.manage'), feeRuleController.update);
router.patch('/:id/active',    requirePermission('fee_rule.manage'), feeRuleController.toggleActive);
router.delete('/:id',          requirePermission('fee_rule.manage'), feeRuleController.remove);
   
export default router;