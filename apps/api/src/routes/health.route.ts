import { success, type ApiResponse, type HealthStatus } from '@codereviewai/shared';
import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  const body: ApiResponse<HealthStatus> = success({
    status: 'ok',
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
  });

  res.status(200).json(body);
});
