import { Router } from 'express';
import { floorController } from '../controllers/floor.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', floorController.getAllFloors);
router.get('/:floorCode/slots', floorController.getSlotsByFloor);

export default router;
