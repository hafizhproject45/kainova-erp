import { Elysia, t } from 'elysia';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../config/database';
import { inventoryBatches, productVariants, purchaseOrderItems, purchaseOrders } from '../../db/schema';
import { authPlugin } from '../auth';
import { ok, NotFoundError } from '../../utils/http';

export const purchasingRoutes = new Elysia({ prefix: '/purchase-orders' })
  .use(authPlugin)
  .get(
    '',
    async ({ query }) => {
      const conditions = [
        query.supplier_id ? eq(purchaseOrders.supplierId, query.supplier_id) : undefined,
        query.status ? eq(purchaseOrders.status, query.status as never) : undefined,
        query.from ? gte(purchaseOrders.createdAt, new Date(query.from)) : undefined,
        query.to ? lte(purchaseOrders.createdAt, new Date(query.to)) : undefined,
      ].filter(Boolean);
      const rows = await db
        .select()
        .from(purchaseOrders)
        .where(conditions.length ? and(...conditions) : undefined);
      return ok(rows);
    },
    {
      query: t.Object({
        supplier_id: t.Optional(t.String()),
        status: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
      }),
      requireRole: ['OWNER', 'GUDANG'],
    },
  )
  .post(
    '',
    async ({ body }) => {
      const [po] = await db.insert(purchaseOrders).values({ supplierId: body.supplier_id }).returning();
      const items = await db
        .insert(purchaseOrderItems)
        .values(
          body.items.map((item) => ({
            purchaseOrderId: po!.id,
            variantId: item.variant_id,
            qty: item.qty,
            unitCost: String(item.unit_cost),
          })),
        )
        .returning();
      return ok({ ...po, items }, 'Purchase Order berhasil dibuat');
    },
    {
      body: t.Object({
        supplier_id: t.String(),
        items: t.Array(t.Object({ variant_id: t.String(), qty: t.Number(), unit_cost: t.Number() })),
      }),
      requireRole: ['OWNER', 'GUDANG'],
    },
  )
  .post(
    '/:id/receive',
    async ({ params }) => {
      // Seluruh langkah dibungkus satu transaksi: kalau ada error di tengah jalan
      // (mis. salah satu insert batch gagal), semua perubahan di-rollback —
      // PO tidak boleh berstatus RECEIVED sebagian dengan sebagian batch hilang.
      return await db.transaction(async (tx) => {
        const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, params.id)).limit(1);
        if (!po) throw new NotFoundError('Purchase Order tidak ditemukan');

        const items = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id));

        for (const item of items) {
          await tx.insert(inventoryBatches).values({
            variantId: item.variantId,
            initialQty: item.qty,
            remainingQty: item.qty,
            unitCost: item.unitCost,
            sourceType: 'PURCHASE',
            sourceId: po.id,
          });
          await tx.update(purchaseOrderItems).set({ qtyReceived: item.qty }).where(eq(purchaseOrderItems.id, item.id));

          // avg_cost selalu di-maintain (dipakai kalau costing_method = AVERAGE) —
          // rumus Moving Average: (StokLama x HPP Lama + StokBaru x HargaBeli Baru) / TotalStokBaru
          // (TECH_KNOWLEDGE.md §4 & PRODUCT_KNOWLEDGE.md §5B).
          const [variant] = await tx
            .select({ totalStock: productVariants.totalStock, avgCost: productVariants.avgCost })
            .from(productVariants)
            .where(eq(productVariants.id, item.variantId))
            .limit(1);
          const oldStock = variant?.totalStock ?? 0;
          const oldAvgCost = Number(variant?.avgCost ?? 0);
          const receivedUnitCost = Number(item.unitCost);
          const newTotalStock = oldStock + item.qty;
          const newAvgCost = newTotalStock > 0 ? (oldStock * oldAvgCost + item.qty * receivedUnitCost) / newTotalStock : 0;

          await tx
            .update(productVariants)
            .set({ totalStock: newTotalStock, avgCost: String(newAvgCost) })
            .where(eq(productVariants.id, item.variantId));
        }

        const [updatedPo] = await tx
          .update(purchaseOrders)
          .set({ status: 'RECEIVED', receivedAt: new Date() })
          .where(eq(purchaseOrders.id, po.id))
          .returning();

        return ok(updatedPo, 'Barang berhasil diterima');
      });
    },
    { requireRole: ['OWNER', 'GUDANG'] },
  );
