import { Router } from 'express';
import { vehicleController } from '../controllers/vehicle.controller';
import { vehicleSchema } from '../dtos/vehicle.dto';
import { validate } from '../middleware/error.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/lookup/:plateNumber', vehicleController.getByPlate);

// Các API bên dưới mới yêu cầu đăng nhập
router.use(authenticate);

router.post('/', vehicleSchema, validate, vehicleController.create);
router.get('/my', vehicleController.getMyVehicles);
router.get('/:id/detail', vehicleController.getDetail);
router.get('/:plateNumber', vehicleController.getByPlate);
router.patch('/:id', vehicleController.update);
router.delete('/:id', vehicleController.remove);
   
export default router;
