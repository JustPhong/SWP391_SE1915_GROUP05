import express from 'express';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { swaggerSpec } from './config/swagger';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { startNoShowCleanupJob } from './jobs/noShowCleanup.job';
import { monthlyPackageController } from './controllers/monthlyPackage.controller';
import { paymentController } from './controllers/payment.controller';
import { warmUpOcrWorker } from './services/ocr.service';

const app = express();

app.use(cors());

app.post(
  '/api/payments/stripe/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.handleStripeWebhook
);

app.post(
  '/api/monthly-packages/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.handleStripeWebhook
);

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[Server] Running on http://localhost:${config.port}`);
  console.log(`[Health] http://localhost:${config.port}/api/health`);
  console.log(`[Swagger] http://localhost:${config.port}/api-docs`);
  startNoShowCleanupJob();
  warmUpOcrWorker();
});

export default app;