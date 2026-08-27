import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '../../config/database';
import { inventoryBatches, productVariants, salesOrderItems, salesOrders, systemSettings } from '../../db/schema';
import { authPlugin } from '../auth';
import { ok } from '../../utils/http';

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Inventory Velocity Engine — PRODUCT_KNOWLEDGE.md §7B.
 *
 * Catatan implementasi: ini agregat *lifetime per SKU* (total diterima vs total
 * terjual sejak SKU dibuat), BUKAN pelacakan per-batch FIFO yang presisi (mis.
 * "80% dari batch tertentu terjual dalam 14 hari sejak batch itu masuk"). Untuk
 * MVP ini cukup merepresentasikan kategori Fast/Slow/Dead-Moving dengan baik;
 * pelacakan per-batch bisa jadi enhancement lanjutan kalau dibutuhkan presisi lebih.
 */
export const analyticsRoutes = new Elysia({ prefix: '/analytics' }).use(authPlugin).get(
  '/inventory-velocity',
  async ({ query }) => {
    const [settings] = await db.select().from(systemSettings).limit(1);
    const slowThresholdDays = query.slow_threshold_days ?? settings?.slowMovingThresholdDays ?? 45;
    const deadThresholdDays = query.dead_threshold_days ?? settings?.deadStockThresholdDays ?? 90;

    const variants = await db
      .select({ id: productVariants.id, sku: productVariants.sku, totalStock: productVariants.totalStock, createdAt: productVariants.createdAt })
      .from(productVariants);

    const batchRows = await db
      .select({ variantId: inventoryBatches.variantId, initialQty: inventoryBatches.initialQty, receivedAt: inventoryBatches.receivedAt })
      .from(inventoryBatches);

    const soldRows = await db
      .select({ variantId: salesOrderItems.variantId, qty: salesOrderItems.qty, soldAt: salesOrders.createdAt })
      .from(salesOrderItems)
      .innerJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId));

    const receivedByVariant = new Map<string, { totalReceived: number; firstReceivedAt: Date }>();
    for (const b of batchRows) {
      const entry = receivedByVariant.get(b.variantId) ?? { totalReceived: 0, firstReceivedAt: b.receivedAt };
      entry.totalReceived += b.initialQty;
      if (b.receivedAt < entry.firstReceivedAt) entry.firstReceivedAt = b.receivedAt;
      receivedByVariant.set(b.variantId, entry);
    }

    const soldByVariant = new Map<string, { totalSold: number; lastSoldAt: Date }>();
    for (const s of soldRows) {
      const entry = soldByVariant.get(s.variantId) ?? { totalSold: 0, lastSoldAt: s.soldAt };
      entry.totalSold += s.qty;
      if (s.soldAt > entry.lastSoldAt) entry.lastSoldAt = s.soldAt;
      soldByVariant.set(s.variantId, entry);
    }

    const now = new Date();
    const fastMoving: Array<{ sku: string; soldQty: number; turnoverDays: number }> = [];
    const slowMoving: Array<{ sku: string; stockQty: number; lastSoldAt: string | null; idleDays: number }> = [];
    const deadStock: Array<{ sku: string; stockQty: number; lastSoldAt: string | null; idleDays: number }> = [];

    for (const v of variants) {
      const received = receivedByVariant.get(v.id);
      const sold = soldByVariant.get(v.id);
      const totalReceived = received?.totalReceived ?? 0;
      const totalSold = sold?.totalSold ?? 0;
      const firstReceivedAt = received?.firstReceivedAt ?? v.createdAt;
      const lastSoldAt = sold?.lastSoldAt ?? null;

      const ageDays = daysBetween(now, firstReceivedAt);
      const idleDays = lastSoldAt ? daysBetween(now, lastSoldAt) : ageDays;
      const sellThroughRate = totalReceived > 0 ? totalSold / totalReceived : 0;

      if (totalSold === 0 && ageDays > deadThresholdDays) {
        deadStock.push({ sku: v.sku, stockQty: v.totalStock, lastSoldAt: null, idleDays });
      } else if (sellThroughRate >= 0.8 && ageDays <= 14) {
        fastMoving.push({ sku: v.sku, soldQty: totalSold, turnoverDays: ageDays });
      } else if (idleDays > slowThresholdDays) {
        slowMoving.push({ sku: v.sku, stockQty: v.totalStock, lastSoldAt: lastSoldAt ? lastSoldAt.toISOString() : null, idleDays });
      }
    }

    return ok({ fastMoving, slowMoving, deadStock, thresholds: { slowThresholdDays, deadThresholdDays } });
  },
  {
    query: t.Object({
      slow_threshold_days: t.Optional(t.Numeric()),
      dead_threshold_days: t.Optional(t.Numeric()),
    }),
    requireRole: ['OWNER'],
  },
);
