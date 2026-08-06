import { Router } from 'express';
import { monthlyPackageController } from '../controllers/monthlyPackage.controller';
import { setAutoRenewSchema } from '../dtos/monthly-package.dto';
import { validate } from '../middleware/error.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/plans', monthlyPackageController.getPlans);

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
router.get('/quotas', monthlyPackageController.getQuotas);
router.get('/quotas/floor/:floorId', monthlyPackageController.getFloorQuotas);

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

router.post('/reconcile-session', monthlyPackageController.reconcileSession);

router.post(
  '/checkout-session',
  monthlyPackageController.createCheckoutSession
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
router.post('/:packageId/abandon-payment', monthlyPackageController.abandonPayment);
router.post('/:packageId/access-pin/ensure', monthlyPackageController.ensureAccessPin);

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

/**
 * @swagger
 * /monthly-packages/{packageId}/cancel:
 *   post:
 *     summary: Cancel/terminate an active monthly package subscription
 *     tags: [Monthly Package]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the monthly package to cancel
 *     responses:
 *       '200':
 *         description: Package cancelled successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Package not found
 */
router.post('/:packageId/cancel', monthlyPackageController.cancelPackage);

export default router;

