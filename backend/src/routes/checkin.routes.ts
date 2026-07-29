import { Router } from 'express';
import { checkinController } from '../controllers/checkin.controller';
import { slotController } from '../controllers/slot.controller';
import { submitCheckinSchema } from '../dtos/checkin.dto';
import { validate } from '../middleware/error.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { uploadCheckinImage } from '../middleware/upload.checkin.middleware';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /checkin/lookup/{plate}:
 *   get:
 *     summary: Look up a vehicle by license plate
 *     tags: [Check-in]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: plate
 *         required: true
 *         schema:
 *           type: string
 *         description: The license plate to look up
 *     responses:
 *       '200':
 *         description: Vehicle or session info found
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '404':
 *         description: No vehicle found for this license plate
 */
router.get('/lookup/:plate', checkinController.lookup);
/**
 * @swagger
 * /checkin/stats:
 *   get:
 *     summary: Get check-in statistics for the current shift
 *     tags: [Check-in]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Check-in statistics for the current shift
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 */
router.get('/stats', checkinController.stats);

/**
 * @swagger
 * /checkin:
 *   post:
 *     summary: Submit a vehicle check-in
 *     tags: [Check-in]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plate
 *               - vehicleType
 *               - customerType
 *               - slotCode
 *             properties:
 *               plate:
 *                 type: string
 *                 description: License plate of the vehicle
 *                 example: "30A-123.45"
 *               vehicleType:
 *                 type: string
 *                 enum: [CAR, MOTORBIKE]
 *                 description: Type of vehicle
 *               customerType:
 *                 type: string
 *                 enum: [monthly, casual]
 *                 description: Customer type (monthly subscriber or casual)
 *               slotCode:
 *                 type: string
 *                 description: Code of the assigned parking slot
 *                 example: "G-01"
 *               isMonthly:
 *                 type: boolean
 *                 description: Whether the customer is a monthly subscriber
 *     responses:
 *       '201':
 *         description: Check-in created successfully
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '403':
 *         description: Forbidden — missing checkin.create permission
 */
// GET /api/checkin/suggest?vehicleType=CAR&zone=CASUAL&top=3
router.get('/suggest', checkinController.suggest);
const parseMultipartCheckin = (req: any, _res: any, next: any) => {
  if (req.body.floorId !== undefined && req.body.floorId !== '') {
    req.body.floorId = Number(req.body.floorId);
  }
  if (req.body.isMonthly !== undefined) {
    req.body.isMonthly = req.body.isMonthly === 'true' || req.body.isMonthly === true;
  }
  next();
};

router.post(
  '/',
  uploadCheckinImage.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'rearImage', maxCount: 1 }
  ]),
  parseMultipartCheckin,
  submitCheckinSchema,
  validate,
  requirePermission('checkin.create'),
  checkinController.submit
);

export default router;
