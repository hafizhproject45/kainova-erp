import { Elysia, t } from 'elysia';
import { and, eq, gte, isNull, lt } from 'drizzle-orm';
import { db } from '../../config/database';
import { productVariants, salesOrderItems, salesOrders } from '../../db/schema';
import { authPlugin } from '../auth';
import { ok } from '../../utils/http';

const ROP_LOOKBACK_DAYS = 30;

export const dashboardRoutes = new Elysia({ prefix: '/dashboard' }).use(authPlugin).get(
  '/summary',
  async ({ query }) => {
    const date = query.date ? new Date(query.date) : new Date();
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const todayCond = and(gte(salesOrders.createdAt, startOfDay), lt(salesOrders.createdAt, endOfDay));

    const todayOrders = await db
      .select({ dpp: salesOrders.dpp, grandTotal: salesOrders.grandTotal, id: salesOrders.id })
      .from(salesOrders)
      .where(todayCond);

    const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    const todayDpp = todayOrders.reduce((sum, o) => sum + Number(o.dpp), 0);

    // Laba kotor hari ini = DPP (omset setelah diskon, sebelum pajak) - HPP hari ini.
    let todayCostOfGoods = 0;
    if (todayOrders.length > 0) {
      const items = await db
        .select({ costOfGoods: salesOrderItems.costOfGoods })
        .from(salesOrderItems)
        .innerJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
        .where(todayCond);
      todayCostOfGoods = items.reduce((sum, i) => sum + Number(i.costOfGoods), 0);
    }
    const grossProfitToday = todayDpp - todayCostOfGoods;

    // Re-Order Point (PRODUCT_KNOWLEDGE.md §7A):
    // ROP = (rata-rata penjualan harian, lookback 30 hari terakhir x lead_time_days) + safety_stock.
    const lookbackStart = new Date();
    lookbackStart.setDate(lookbackStart.getDate() - ROP_LOOKBACK_DAYS);

    const soldRows = await db
      .select({ variantId: salesOrderItems.variantId, qty: salesOrderItems.qty })
      .from(salesOrderItems)
      .innerJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
      .where(gte(salesOrders.createdAt, lookbackStart));

    const soldByVariant = new Map<string, number>();
    for (const row of soldRows) {
      soldByVariant.set(row.variantId, (soldByVariant.get(row.variantId) ?? 0) + row.qty);
    }

    const variants = await db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        totalStock: productVariants.totalStock,
        leadTimeDays: productVariants.leadTimeDays,
        safetyStock: productVariants.safetyStock,
      })
      .from(productVariants)
      .where(isNull(productVariants.deletedAt));

    const lowStockAlerts = variants
      .map((v) => {
        const totalSold = soldByVariant.get(v.id) ?? 0;
        const avgDailySales = totalSold / ROP_LOOKBACK_DAYS;
        const rop = Math.round((avgDailySales * v.leadTimeDays + v.safetyStock) * 100) / 100;
        return { sku: v.sku, totalStock: v.totalStock, rop };
      })
      .filter((v) => v.totalStock <= v.rop);

    return ok({
      todayRevenue,
      todayTransactions: todayOrders.length,
      grossProfitToday,
      lowStockAlerts,
    });
  },
  { query: t.Object({ date: t.Optional(t.String()) }), requireRole: ['OWNER'] },
);
