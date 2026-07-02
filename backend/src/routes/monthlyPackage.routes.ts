import { Router } from 'express';
import { monthlyPackageController } from '../controllers/monthlyPackage.controller';
import { createMonthlyPackageSchema, setAutoRenewSchema } from '../dtos/monthly-package.dto';
import { validate } from '../middleware/error.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
   
router.use(authenticate);

/**
 * @swagger
 * /monthly-packages/active:
 *   get:
 *     summary: List active monthly packages available for purchase
 *     tags: [Monthly Package]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of active monthly packages
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 */
router.get('/active', monthlyPackageController.getActivePackages);

/**
 * @swagger
 * /monthly-packages/mine:
 *   get:
 *     summary: Get the current user's monthly packages
 *     tags: [Monthly Package]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Current user's monthly packages
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 */
router.get('/mine', monthlyPackageController.getMyPackages);

/**
 * @swagger
 * /monthly-packages/vehicle/{vehicleId}:
 *   get:
 *     summary: Get monthly packages for a vehicle
 *     tags: [Monthly Package]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the vehicle
 *     responses:
 *       '200':
 *         description: Monthly packages for the vehicle
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '404':
 *         description: No packages found for this vehicle
 */
router.get('/vehicle/:vehicleId', monthlyPackageController.getByVehicle);

/**
 * @swagger
 * /monthly-packages:
 *   post:
 *     summary: Purchase a monthly package
 *     tags: [Monthly Package]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - vehicleId
 *               - startDate
 *               - expiryDate
 *               - price
 *               - paymentMethod
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: The user purchasing the package
 *               vehicleId:
 *                 type: string
 *                 format: uuid
 *                 description: The vehicle to associate with the package
 *               slotId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional dedicated slot for the package
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Package start date (ISO 8601)
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *                 description: Package expiry date (ISO 8601)
 *               price:
 *                 type: number
 *                 description: Package price (must be a positive number)
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, CARD, EWALLET]
 *                 description: Payment method used
 *     responses:
 *       '201':
 *         description: Monthly package purchased successfully
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized — missing or invalid JWT
 *       '403':
 *         description: Forbidden — missing package.buy permission
 */
router.post(
  '/',
  createMonthlyPackageSchema,
  validate,
  monthlyPackageController.create
);

/**
 * @swagger
 * /monthly-packages/{packageId}/renew:
 *   post:
 *     summary: Renew an existing monthly package
 *     tags: [Monthly Package]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the monthly package
 *     responses:
 *       '200':
 *         description: Package renewed successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Package not found
 */
router.post('/:packageId/renew', monthlyPackageController.renewPackage);

/**
 * @swagger
 * /monthly-packages/{packageId}/auto-renew:
 *   patch:
 *     summary: Enable or disable auto-renew for a monthly package
 *     tags: [Monthly Package]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the monthly package
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *     responses:
 *       '200':
 *         description: Auto-renew updated successfully
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Package not found
 */
router.patch('/:packageId/auto-renew', setAutoRenewSchema, validate, monthlyPackageController.setAutoRenew);

export default router;
