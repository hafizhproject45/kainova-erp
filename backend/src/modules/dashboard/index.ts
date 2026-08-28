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
import { ValidationError } from '../../utils/http';

const ROP_LOOKBACK_DAYS = 30;
const MAX_DAILY_BUCKETS = 31; // di atas ini, trend dibucket per-bulan (mis. rentang custom > 1 bulan, atau period=year).

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
// 'YYYY-MM-DD' harus dibaca sebagai tanggal kalender LOKAL, bukan UTC —
// `new Date('YYYY-MM-DD')` bawaan JS mem-parse sebagai UTC midnight, yang bisa
// bergeser satu hari begitu dibaca ulang via getter LOKAL (arah geser tergantung offset TZ server).
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}
// Key 'YYYY-MM-DD' dari komponen tanggal LOKAL — TIDAK boleh pakai toISOString() di sini:
// itu mengonversi ke UTC dulu, yang di timezone beroffset positif (mis. WIB/UTC+7) membuat
// midnight lokal jatuh ke tanggal UTC SEBELUMNYA (mundur satu hari dari yang dimaksud).
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Resolusi rentang tanggal [rangeStart, rangeEnd) dari filter period (Dashboard Filtering:
// today/month/year/custom) — dipakai konsisten untuk seluruh KPI & breakdown periodik.
function resolveRange(query: { period?: string; date_from?: string; date_to?: string }) {
  const now = new Date();
  const period = query.period ?? 'today';

  if (period === 'custom') {
    if (!query.date_from || !query.date_to) {
      throw new ValidationError('date_from & date_to wajib diisi untuk period=custom');
    }
    const from = parseLocalDate(query.date_from);
    const to = addDays(parseLocalDate(query.date_to), 1);
    if (from >= to) throw new ValidationError('date_from harus sebelum date_to');
    return { rangeStart: from, rangeEnd: to, period: 'custom' as const };
  }
  if (period === 'month') {
    return { rangeStart: startOfMonth(now), rangeEnd: addDays(startOfDay(now), 1), period: 'month' as const };
  }
  if (period === 'year') {
    return { rangeStart: startOfYear(now), rangeEnd: addDays(startOfDay(now), 1), period: 'year' as const };
  }
  return { rangeStart: startOfDay(now), rangeEnd: addDays(startOfDay(now), 1), period: 'today' as const };
}

export const dashboardRoutes = new Elysia({ prefix: '/dashboard' }).use(authPlugin).get(
  '/summary',
  async ({ query }) => {
    const { rangeStart, rangeEnd, period } = resolveRange(query);
    const rangeCond = and(gte(salesOrders.createdAt, rangeStart), lt(salesOrders.createdAt, rangeEnd));

    const periodOrders = await db
      .select({ dpp: salesOrders.dpp, grandTotal: salesOrders.grandTotal, id: salesOrders.id })
      .from(salesOrders)
      .where(rangeCond);

    const periodRevenue = periodOrders.reduce((sum, o) => sum + Number(o.grandTotal), 0);
    const periodDpp = periodOrders.reduce((sum, o) => sum + Number(o.dpp), 0);

    // Laba kotor periode = DPP (omset setelah diskon, sebelum pajak) - HPP periode berjalan.
    let periodCostOfGoods = 0;
    if (periodOrders.length > 0) {
      const items = await db
        .select({ costOfGoods: salesOrderItems.costOfGoods })
        .from(salesOrderItems)
        .innerJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
        .where(rangeCond);
      periodCostOfGoods = items.reduce((sum, i) => sum + Number(i.costOfGoods), 0);
    }
    const grossProfitPeriod = periodDpp - periodCostOfGoods;

    // Re-Order Point (PRODUCT_KNOWLEDGE.md §7A) — alert stok minimum selalu berbasis kondisi
    // TERKINI (rolling 30 hari terakhir), tidak ikut berubah mengikuti filter period Dashboard.
    const lookbackStart = new Date();
    lookbackStart.setDate(lookbackStart.getDate() - ROP_LOOKBACK_DAYS);

    const ropSoldRows = await db
      .select({ variantId: salesOrderItems.variantId, qty: salesOrderItems.qty })
      .from(salesOrderItems)
      .innerJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
      .where(gte(salesOrders.createdAt, lookbackStart));

    const ropSoldByVariant = new Map<string, number>();
    for (const row of ropSoldRows) {
      ropSoldByVariant.set(row.variantId, (ropSoldByVariant.get(row.variantId) ?? 0) + row.qty);
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
        const totalSold = ropSoldByVariant.get(v.id) ?? 0;
        const avgDailySales = totalSold / ROP_LOOKBACK_DAYS;
        const rop = Math.round((avgDailySales * v.leadTimeDays + v.safetyStock) * 100) / 100;
        return { sku: v.sku, totalStock: v.totalStock, rop };
      })
      .filter((v) => v.totalStock <= v.rop);

    // Top 5 Produk Terlaris — mengikuti rentang filter period Dashboard.
    const periodSoldRows = await db
      .select({ variantId: salesOrderItems.variantId, qty: salesOrderItems.qty })
      .from(salesOrderItems)
      .innerJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
      .where(rangeCond);
    const periodSoldByVariant = new Map<string, number>();
    for (const row of periodSoldRows) {
      periodSoldByVariant.set(row.variantId, (periodSoldByVariant.get(row.variantId) ?? 0) + row.qty);
    }

    const topVariantIds = [...periodSoldByVariant.entries()]
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
      productIds.length > 0
        ? await db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, productIds))
        : [];
    const productNameById = new Map(productRows.map((p) => [p.id, p.name]));
    const topSellingProducts = topVariantIds.map((variantId) => {
      const variant = topVariantRows.find((v) => v.id === variantId);
      return {
        sku: variant?.sku ?? '-',
        productName: variant ? (productNameById.get(variant.productId) ?? '-') : '-',
        qtySold: periodSoldByVariant.get(variantId) ?? 0,
      };
    });

    // Tren omset — bucket adaptif mengikuti rentang filter: per-jam untuk "today",
    // per-hari untuk rentang <= 31 hari, per-bulan untuk rentang lebih panjang (mis. period=year).
    const trendOrders = await db
      .select({ createdAt: salesOrders.createdAt, grandTotal: salesOrders.grandTotal })
      .from(salesOrders)
      .where(rangeCond);

    const revenueTrend: Array<{ date: string; revenue: number }> = [];
    if (period === 'today') {
      const revenueByHour = new Array(24).fill(0);
      for (const row of trendOrders) revenueByHour[row.createdAt.getHours()] += Number(row.grandTotal);
      for (let h = 0; h < 24; h++) revenueTrend.push({ date: `${String(h).padStart(2, '0')}:00`, revenue: revenueByHour[h] });
    } else {
      const spanDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000);
      if (spanDays <= MAX_DAILY_BUCKETS) {
        const revenueByDate = new Map<string, number>();
        for (const row of trendOrders) {
          const key = localDateKey(row.createdAt);
          revenueByDate.set(key, (revenueByDate.get(key) ?? 0) + Number(row.grandTotal));
        }
        for (let i = 0; i < spanDays; i++) {
          const key = localDateKey(addDays(rangeStart, i));
          revenueTrend.push({ date: key, revenue: revenueByDate.get(key) ?? 0 });
        }
      } else {
        const revenueByMonth = new Map<string, number>();
        for (const row of trendOrders) {
          const key = `${row.createdAt.getFullYear()}-${String(row.createdAt.getMonth() + 1).padStart(2, '0')}`;
          revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + Number(row.grandTotal));
        }
        const cursor = startOfMonth(rangeStart);
        while (cursor < rangeEnd) {
          const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
          revenueTrend.push({ date: key, revenue: revenueByMonth.get(key) ?? 0 });
          cursor.setMonth(cursor.getMonth() + 1);
        }
      }
    }

    // Pie/Donut breakdown — mengikuti rentang filter period Dashboard yang sama.
    const salesItemRows = await db
      .select({
        productId: productVariants.productId,
        lineTotal: salesOrderItems.lineTotal,
      })
      .from(salesOrderItems)
      .innerJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
      .innerJoin(productVariants, eq(productVariants.id, salesOrderItems.variantId))
      .where(rangeCond);

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
      .where(rangeCond);
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

    // KPI "Total PO" — total belanja pembelian pada rentang filter period yang sama (qty x unit_cost).
    const poItemRows = await db
      .select({ qty: purchaseOrderItems.qty, unitCost: purchaseOrderItems.unitCost })
      .from(purchaseOrderItems)
      .innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderItems.purchaseOrderId))
      .where(and(gte(purchaseOrders.createdAt, rangeStart), lt(purchaseOrders.createdAt, rangeEnd)));
    const totalPurchasingSpend = poItemRows.reduce((sum, r) => sum + r.qty * Number(r.unitCost), 0);

    return ok({
      period,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      periodRevenue,
      periodTransactions: periodOrders.length,
      grossProfitPeriod,
      totalPurchasingSpend,
      lowStockAlerts,
      revenueTrend,
      topSellingProducts,
      salesByCategory,
      salesByPaymentMethod,
    });
  },
  {
    query: t.Object({
      period: t.Optional(t.Union([t.Literal('today'), t.Literal('month'), t.Literal('year'), t.Literal('custom')])),
      date_from: t.Optional(t.String()),
      date_to: t.Optional(t.String()),
    }),
    requireRole: ['OWNER'],
  },
);
