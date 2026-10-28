import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
export function createApp(options: { origin: string; databaseReady: () => boolean }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: options.origin }));
  app.use(express.json({ limit: '256kb' }));
  app.get('/api/v1/health/live', (_req, res) => { res.json({ status: 'ok', service: 'nexforge-crm' }); });
  app.get('/api/v1/health/ready', (_req, res) => {
    const ready = options.databaseReady();
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'unavailable' });
  });
  // Closed until real authentication is delivered. Never trust x-tenant-id.
  app.use('/api/v1', (_req, res) => { res.status(401).json({ code: 'AUTHENTICATION_REQUIRED' }); });
  app.use((_req, res) => { res.status(404).json({ code: 'NOT_FOUND' }); });
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 500;
    res.status(status).json({ code: status === 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST' });
  });
  return app;
}