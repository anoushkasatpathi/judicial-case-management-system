import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';
import { httpRequestDurationSeconds, httpRequestsTotal, metricsRegistry } from './observability.js';

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development' });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    response.on('finish', () => {
      const route = request.route?.path ?? request.originalUrl ?? 'unknown';
      const labels = { method: request.method, route, status_code: String(response.statusCode) };
      httpRequestsTotal.inc(labels);
      httpRequestDurationSeconds.observe(labels, Number(process.hrtime.bigint() - start) / 1e9);
    });
    next();
  });
  app.use('/metrics', (_request: Request, response: Response) => {
    void metricsRegistry.metrics().then((body) => { response.setHeader('Content-Type', metricsRegistry.contentType); response.end(body); });
  });
  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app.getHttpAdapter().getInstance());
  }
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
