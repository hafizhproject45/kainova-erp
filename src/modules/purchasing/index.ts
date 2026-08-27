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
      const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, params.id)).limit(1);
      if (!po) throw new NotFoundError('Purchase Order tidak ditemukan');

      const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id));

      // TODO: bungkus dalam db.transaction() — insert inventory_batches, update qty_received,
      // dan (mode AVERAGE) rekalkulasi avg_cost + total_stock di product_variants
      // sesuai TECH_KNOWLEDGE.md §4 & DESIGN.md §3.
      for (const item of items) {
        await db.insert(inventoryBatches).values({
          variantId: item.variantId,
          initialQty: item.qty,
          remainingQty: item.qty,
          unitCost: item.unitCost,
          sourceType: 'PURCHASE',
          sourceId: po.id,
        });
        await db.update(purchaseOrderItems).set({ qtyReceived: item.qty }).where(eq(purchaseOrderItems.id, item.id));
        await db
          .update(productVariants)
          .set({ totalStock: item.qty })
          .where(eq(productVariants.id, item.variantId)); // TODO: increment, bukan overwrite
      }

      const [updatedPo] = await db
        .update(purchaseOrders)
        .set({ status: 'RECEIVED', receivedAt: new Date() })
        .where(eq(purchaseOrders.id, po.id))
        .returning();

      return ok(updatedPo, 'Barang berhasil diterima');
    },
    { requireRole: ['OWNER', 'GUDANG'] },
  );
