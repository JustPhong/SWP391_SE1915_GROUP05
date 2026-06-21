import { Router } from 'express';
import { monthlyPackageController } from '../controllers/monthlyPackage.controller';
import { createMonthlyPackageSchema } from '../dtos/monthly-package.dto';
import { validate } from '../middleware/error.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();
   
router.use(authenticate);

router.get('/active', monthlyPackageController.getActivePackages);
router.get('/mine', monthlyPackageController.getMyPackages);
router.get('/vehicle/:vehicleId', monthlyPackageController.getByVehicle);
router.post(
  '/',
  requirePermission('package.buy'),
  createMonthlyPackageSchema,
  validate,
  monthlyPackageController.create
);

export default router;
