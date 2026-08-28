import { Elysia, t } from 'elysia';
import { and, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '../../config/database';
import {
  categories,
  productVariants,
  products,
  purchaseOrderItems,
  purchaseOrders,
  salesOrderItems,
  salesOrders,
} from '../../db/schema';
import { authPlugin } from '../auth';
import { ok } from '../../utils/http';

const ROP_LOOKBACK_DAYS = 30;
const TREND_DAYS = 7;

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

    // Top 5 Produk Terlaris (lookback 30 hari, sama dengan basis kalkulasi ROP di atas).
    const topVariantIds = [...soldByVariant.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([variantId]) => variantId);
    const topVariantRows =
      topVariantIds.length > 0
        ? await db
            .select({ id: productVariants.id, sku: productVariants.sku, productId: productVariants.productId })
            .from(productVariants)
            .where(inArray(productVariants.id, topVariantIds))
        : [];
    const productIds = [...new Set(topVariantRows.map((v) => v.productId))];
    const productRows =
      productIds.length > 0 ? await db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, productIds)) : [];
    const productNameById = new Map(productRows.map((p) => [p.id, p.name]));
    const topSellingProducts = topVariantIds.map((variantId) => {
      const variant = topVariantRows.find((v) => v.id === variantId);
      return {
        sku: variant?.sku ?? '-',
        productName: variant ? (productNameById.get(variant.productId) ?? '-') : '-',
        qtySold: soldByVariant.get(variantId) ?? 0,
      };
    });

    // Tren omset 7 hari terakhir (termasuk hari ini) untuk chart di dashboard.
    const trendStart = new Date(startOfDay);
    trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));
    const trendOrders = await db
      .select({ createdAt: salesOrders.createdAt, grandTotal: salesOrders.grandTotal })
      .from(salesOrders)
      .where(and(gte(salesOrders.createdAt, trendStart), lt(salesOrders.createdAt, endOfDay)));

    const revenueByDate = new Map<string, number>();
    for (const row of trendOrders) {
      const key = row.createdAt.toISOString().slice(0, 10);
      revenueByDate.set(key, (revenueByDate.get(key) ?? 0) + Number(row.grandTotal));
    }
    const revenueTrend: Array<{ date: string; revenue: number }> = [];
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const d = new Date(startOfDay);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      revenueTrend.push({ date: key, revenue: revenueByDate.get(key) ?? 0 });
    }

    // MVP 3 Phase 1: Interactive Visual Dashboard — breakdown untuk Pie/Donut Chart
    // (30 hari terakhir, basis lookback sama dengan Top Selling Products di atas).
    const salesItemRows = await db
      .select({
        productId: productVariants.productId,
        lineTotal: salesOrderItems.lineTotal,
      })
      .from(salesOrderItems)
      .innerJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
      .innerJoin(productVariants, eq(productVariants.id, salesOrderItems.variantId))
      .where(gte(salesOrders.createdAt, lookbackStart));

    const categoryIdByProductId = new Map(
      (await db.select({ id: products.id, categoryId: products.categoryId }).from(products)).map((p) => [
        p.id,
        p.categoryId,
      ]),
    );
    const categoryNameById = new Map(
      (await db.select({ id: categories.id, name: categories.name }).from(categories)).map((c) => [c.id, c.name]),
    );
    const revenueByCategory = new Map<string, number>();
    for (const row of salesItemRows) {
      const categoryId = categoryIdByProductId.get(row.productId);
      const label = categoryId ? (categoryNameById.get(categoryId) ?? 'Lainnya') : 'Lainnya';
      revenueByCategory.set(label, (revenueByCategory.get(label) ?? 0) + Number(row.lineTotal));
    }
    const salesByCategory = [...revenueByCategory.entries()]
      .map(([categoryName, revenue]) => ({ categoryName, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    const paymentRows = await db
      .select({ paymentMethod: salesOrders.paymentMethod, grandTotal: salesOrders.grandTotal })
      .from(salesOrders)
      .where(gte(salesOrders.createdAt, lookbackStart));
    const revenueByPaymentMethod = new Map<string, number>();
    for (const row of paymentRows) {
      revenueByPaymentMethod.set(
        row.paymentMethod,
        (revenueByPaymentMethod.get(row.paymentMethod) ?? 0) + Number(row.grandTotal),
      );
    }
    const salesByPaymentMethod = [...revenueByPaymentMethod.entries()]
      .map(([method, revenue]) => ({ method, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // KPI "Total PO Pengeluaran" — total belanja pembelian bulan berjalan (qty x unit_cost).
    const monthStart = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
    const poItemRows = await db
      .select({ qty: purchaseOrderItems.qty, unitCost: purchaseOrderItems.unitCost })
      .from(purchaseOrderItems)
      .innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderItems.purchaseOrderId))
      .where(gte(purchaseOrders.createdAt, monthStart));
    const totalPurchasingSpendThisMonth = poItemRows.reduce((sum, r) => sum + r.qty * Number(r.unitCost), 0);

    return ok({
      todayRevenue,
      todayTransactions: todayOrders.length,
      grossProfitToday,
      totalPurchasingSpendThisMonth,
      lowStockAlerts,
      revenueTrend,
      topSellingProducts,
      salesByCategory,
      salesByPaymentMethod,
    });
  },
  { query: t.Object({ date: t.Optional(t.String()) }), requireRole: ['OWNER'] },
);
