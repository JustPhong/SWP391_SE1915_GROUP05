import { Router } from 'express';
import { vehicleController } from '../controllers/vehicle.controller';
import { vehicleSchema } from '../dtos/vehicle.dto';
import { validate } from '../middleware/error.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', vehicleSchema, validate, vehicleController.create);
router.get('/my', vehicleController.getMyVehicles);
router.get('/:plateNumber', vehicleController.getByPlate);
router.patch('/:id', vehicleController.update);
router.delete('/:id', vehicleController.remove);

export default router;
