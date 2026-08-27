import { Elysia, t } from 'elysia';
import { and, gte, lt, lte, sql } from 'drizzle-orm';
import { db } from '../../config/database';
import { productVariants, salesOrders } from '../../db/schema';
import { authPlugin } from '../auth';
import { ok } from '../../utils/http';

export const dashboardRoutes = new Elysia({ prefix: '/dashboard' }).use(authPlugin).get(
  '/summary',
  async ({ query }) => {
    const date = query.date ? new Date(query.date) : new Date();
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const [summary] = await db
      .select({
        todayRevenue: sql<number>`coalesce(sum(${salesOrders.grandTotal}), 0)`,
        todayTransactions: sql<number>`count(*)`,
      })
      .from(salesOrders)
      .where(and(gte(salesOrders.createdAt, startOfDay), lt(salesOrders.createdAt, endOfDay)));

    // TODO: hitung grossProfitToday dari (grandTotal - total cost_of_goods per item),
    // dan lowStockAlerts dari rumus ROP (PRODUCT_KNOWLEDGE.md §7A) — di sini baru contoh
    // ambang stok rendah sederhana (<=5) sebagai placeholder.
    const lowStockAlerts = await db
      .select({ sku: productVariants.sku, totalStock: productVariants.totalStock })
      .from(productVariants)
      .where(lte(productVariants.totalStock, 5));

    return ok({
      todayRevenue: Number(summary?.todayRevenue ?? 0),
      todayTransactions: Number(summary?.todayTransactions ?? 0),
      grossProfitToday: 0, // TODO
      lowStockAlerts,
    });
  },
  { query: t.Object({ date: t.Optional(t.String()) }), requireRole: ['OWNER'] },
);
