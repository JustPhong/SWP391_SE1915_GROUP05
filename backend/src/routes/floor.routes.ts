import { Router } from 'express';
import {
  getAllFloors,
  getSlotsByFloor,
  getSlotsByFloorAndStatus,
  createFloor,
  updateFloor,
  deleteFloor,
} from '../controllers/floor.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
    
router.use(authenticate);

router.get('/', getAllFloors);
router.get('/:floorCode', getSlotsByFloor);
router.get('/:floorCode/slots', getSlotsByFloorAndStatus);
router.post('/', authorize('ADMIN', 'MANAGER'), createFloor);
router.put('/:id', authorize('ADMIN', 'MANAGER'), updateFloor);
router.delete('/:id', authorize('ADMIN'), deleteFloor);

export default router;