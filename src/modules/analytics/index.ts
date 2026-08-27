import { Elysia, t } from 'elysia';
import { authPlugin } from '../auth';
import { ok } from '../../utils/http';

/**
 * Stub Phase 4 — lihat PRODUCT_KNOWLEDGE.md §7 & API_SPECIFICATION.md §9.
 * TODO: hitung fastMoving/slowMoving/deadStock dari sales_order_items vs
 * received_at inventory_batches, dibandingkan terhadap
 * system_settings.slowMovingThresholdDays / deadStockThresholdDays.
 */
export const analyticsRoutes = new Elysia({ prefix: '/analytics' }).use(authPlugin).get(
  '/inventory-velocity',
  async ({ query }) =>
    ok(
      { fastMoving: [], slowMoving: [], deadStock: [], thresholds: query },
      'TODO: implementasikan Inventory Velocity Engine',
    ),
  {
    query: t.Object({
      slow_threshold_days: t.Optional(t.Numeric()),
      dead_threshold_days: t.Optional(t.Numeric()),
    }),
    requireRole: ['OWNER'],
  },
);
