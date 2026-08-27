import { Elysia } from 'elysia';
import cors from '@elysiajs/cors';
import swagger from '@elysiajs/swagger';
import { env } from './config/env';
import { ApiError, fail } from './utils/http';
import { authRoutes } from './modules/auth';
import { masterDataRoutes } from './modules/master-data';
import { productsRoutes } from './modules/products';
import { purchasingRoutes } from './modules/purchasing';
import { inventoryRoutes } from './modules/inventory';
import { salesRoutes } from './modules/sales';
import { dashboardRoutes } from './modules/dashboard';
import { reportsRoutes } from './modules/reports';
import { settingsRoutes } from './modules/settings';
import { analyticsRoutes } from './modules/analytics';

const app = new Elysia()
  .use(cors())
  .use(swagger({ path: '/docs' }))
  .onError(({ error, set }) => {
    if (error instanceof ApiError) {
      set.status = error.status;
      return fail(error.message, error.errors);
    }
    console.error(error);
    set.status = 500;
    return fail('Server/Database error');
  })
  .get('/health', () => ({ success: true, message: 'KaiNova ERP API is running', data: null, errors: null }))
  .group('/v1', (v1) =>
    v1
      .use(authRoutes)
      .use(masterDataRoutes)
      .use(productsRoutes)
      .use(purchasingRoutes)
      .use(inventoryRoutes)
      .use(salesRoutes)
      .use(dashboardRoutes)
      .use(reportsRoutes)
      .use(settingsRoutes)
      .use(analyticsRoutes),
  )
  .listen(env.port);

console.log(`🚀 KaiNova ERP API running at http://localhost:${env.port} (docs: /docs)`);

export type App = typeof app;
