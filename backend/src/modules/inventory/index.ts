import { Elysia, t } from 'elysia';
import { and, asc, eq, gt, gte, lte } from 'drizzle-orm';
import { db } from '../../config/database';
import { inventoryBatches, stockAdjustmentItems, stockAdjustments } from '../../db/schema';
import { authPlugin, type AuthPayload } from '../auth';
import { ok, NotFoundError, BusinessRuleError } from '../../utils/http';

export const inventoryRoutes = new Elysia({ prefix: '/stock-adjustments' })
  .use(authPlugin)
  .get(
    '',
    async ({ query }) => {
      const conditions = [
        query.type ? eq(stockAdjustments.type, query.type as never) : undefined,
        query.status ? eq(stockAdjustments.status, query.status as never) : undefined,
        query.from ? gte(stockAdjustments.createdAt, new Date(query.from)) : undefined,
        query.to ? lte(stockAdjustments.createdAt, new Date(query.to)) : undefined,
      ].filter(Boolean);
      return ok(
        await db
          .select()
          .from(stockAdjustments)
          .where(conditions.length ? and(...conditions) : undefined),
      );
    },
    {
      query: t.Object({
        type: t.Optional(t.String()),
        status: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
      }),
      requireRole: ['OWNER', 'GUDANG'],
    },
  )
  .post(
    '',
    async ({ body, user }) => {
      const [adjustment] = await db
        .insert(stockAdjustments)
        .values({ type: body.type, reason: body.reason, createdBy: (user as AuthPayload).id })
        .returning();

      const items = await db
        .insert(stockAdjustmentItems)
        .values(
          body.items.map((item) => ({
            adjustmentId: adjustment!.id,
            variantId: item.variant_id,
            systemQty: item.system_qty,
            actualQty: item.actual_qty,
            differenceQty: item.actual_qty - item.system_qty,
            unitCost: item.unit_cost !== undefined ? String(item.unit_cost) : null,
            notes: item.notes,
          })),
        )
        .returning();

      return ok({ ...adjustment, items }, 'Adjustment stok tersimpan sebagai draft');
    },
    {
      body: t.Object({
        type: t.Union([t.Literal('OPENING_BALANCE'), t.Literal('OPNAME'), t.Literal('CORRECTION')]),
        reason: t.String(),
        items: t.Array(
          t.Object({
            variant_id: t.String(),
            system_qty: t.Number(),
            actual_qty: t.Number(),
            unit_cost: t.Optional(t.Number()),
            notes: t.Optional(t.String()),
          }),
        ),
      }),
      requireRole: ['OWNER', 'GUDANG'],
    },
  )
  .post(
    '/:id/post',
    async ({ params }) => {
      const [adjustment] = await db.select().from(stockAdjustments).where(eq(stockAdjustments.id, params.id)).limit(1);
      if (!adjustment) throw new NotFoundError('Adjustment stok tidak ditemukan');
      if (adjustment.status === 'POSTED') throw new BusinessRuleError('Adjustment sudah diposting sebelumnya');

      const items = await db.select().from(stockAdjustmentItems).where(eq(stockAdjustmentItems.adjustmentId, adjustment.id));

      // TODO: bungkus dalam db.transaction().
      for (const item of items) {
        if (item.differenceQty > 0) {
          // Selisih lebih → batch baru (lihat PRODUCT_KNOWLEDGE.md §6).
          await db.insert(inventoryBatches).values({
            variantId: item.variantId,
            initialQty: item.differenceQty,
            remainingQty: item.differenceQty,
            unitCost: item.unitCost ?? '0',
            sourceType: 'ADJUSTMENT',
            sourceId: adjustment.id,
          });
        } else if (item.differenceQty < 0) {
          // Selisih kurang → potong FIFO dari batch tertua yang masih ada remaining_qty.
          let qtyToDeduct = Math.abs(item.differenceQty);
          const batches = await db
            .select()
            .from(inventoryBatches)
            .where(and(eq(inventoryBatches.variantId, item.variantId), gt(inventoryBatches.remainingQty, 0)))
            .orderBy(asc(inventoryBatches.receivedAt));

          for (const batch of batches) {
            if (qtyToDeduct <= 0) break;
            const deduct = Math.min(batch.remainingQty, qtyToDeduct);
            await db
              .update(inventoryBatches)
              .set({ remainingQty: batch.remainingQty - deduct })
              .where(eq(inventoryBatches.id, batch.id));
            qtyToDeduct -= deduct;
          }
        }
      }

      const [posted] = await db
        .update(stockAdjustments)
        .set({ status: 'POSTED', postedAt: new Date() })
        .where(eq(stockAdjustments.id, adjustment.id))
        .returning();

      return ok(posted, 'Adjustment stok berhasil diposting');
    },
    { requireRole: ['OWNER'] },
  );
