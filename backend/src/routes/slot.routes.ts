import { Router } from 'express';
import { slotController } from '../controllers/slot.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /slots/available:
 *   get:
 *     summary: Get available parking slots
 *     description: Returns a list of all currently available (unoccupied) parking slots.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of available slots
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '500':
 *         description: Internal server error
 */
router.get('/available', slotController.getAvailable);

/**
 * @swagger
 * /slots/all:
 *   get:
 *     summary: Get all parking slots
 *     description: Returns a list of every parking slot with their current status.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of all slots
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '500':
 *         description: Internal server error
 */
router.get('/all', slotController.getAll);

/**
 * @swagger
 * /slots/{id}/status:
 *   patch:
 *     summary: Update slot status
 *     description: Staff, Manager, or Admin manually updates the status of a specific parking slot.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the parking slot
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [AVAILABLE, OCCUPIED, DISABLED]
 *                 description: The new status for the slot
 *     responses:
 *       '200':
 *         description: Slot status updated successfully
 *       '400':
 *         description: Bad request — invalid status value
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '403':
 *         description: Forbidden — insufficient role (requires STAFF, MANAGER, or ADMIN)
 *       '404':
 *         description: Slot not found
 *       '500':
 *         description: Internal server error
 */
router.patch('/:id/status', authenticate, authorize('STAFF', 'MANAGER', 'ADMIN'), slotController.updateStatus);

export default router;   