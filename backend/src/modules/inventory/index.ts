import { Elysia, t } from 'elysia';
import { and, asc, eq, gt, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../../config/database';
import { inventoryBatches, productVariants, stockAdjustmentItems, stockAdjustments } from '../../db/schema';
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
      const rows = await db
        .select()
        .from(stockAdjustments)
        .where(conditions.length ? and(...conditions) : undefined);
      if (rows.length === 0) return ok([]);

      // Perkaya untuk tabel List (Adjustment Code, Total Items) — dihitung di app level,
      // konsisten dengan pola yang sama di modul Pembelian.
      const adjustmentIds = rows.map((r) => r.id);
      const itemRows = await db
        .select({ adjustmentId: stockAdjustmentItems.adjustmentId })
        .from(stockAdjustmentItems)
        .where(inArray(stockAdjustmentItems.adjustmentId, adjustmentIds));
      const countByAdjustment = new Map<string, number>();
      for (const item of itemRows) {
        countByAdjustment.set(item.adjustmentId, (countByAdjustment.get(item.adjustmentId) ?? 0) + 1);
      }

      return ok(
        rows.map((r) => ({
          ...r,
          adjustmentCode: `ADJ-${r.id.slice(0, 8).toUpperCase()}`,
          totalItems: countByAdjustment.get(r.id) ?? 0,
        })),
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
      // Satu transaksi utuh: kalau ada batch/variant yang gagal di-update, seluruh
      // posting di-rollback — tidak boleh ada adjustment "setengah POSTED".
      return await db.transaction(async (tx) => {
        const [adjustment] = await tx.select().from(stockAdjustments).where(eq(stockAdjustments.id, params.id)).limit(1);
        if (!adjustment) throw new NotFoundError('Adjustment stok tidak ditemukan');
        if (adjustment.status === 'POSTED') throw new BusinessRuleError('Adjustment sudah diposting sebelumnya');

        const items = await tx.select().from(stockAdjustmentItems).where(eq(stockAdjustmentItems.adjustmentId, adjustment.id));

        for (const item of items) {
          const [variantBefore] = await tx
            .select({ totalStock: productVariants.totalStock, avgCost: productVariants.avgCost })
            .from(productVariants)
            .where(eq(productVariants.id, item.variantId))
            .limit(1);
          let newAvgCost: string | undefined;

          if (item.differenceQty > 0) {
            // Selisih lebih → batch baru (lihat PRODUCT_KNOWLEDGE.md §6).
            await tx.insert(inventoryBatches).values({
              variantId: item.variantId,
              initialQty: item.differenceQty,
              remainingQty: item.differenceQty,
              unitCost: item.unitCost ?? '0',
              sourceType: 'ADJUSTMENT',
              sourceId: adjustment.id,
            });

            // avg_cost dimaintain juga di sini (dipakai kalau costing_method = AVERAGE) —
            // rumus sama seperti penerimaan PO (PRODUCT_KNOWLEDGE.md §5B).
            const oldStock = variantBefore?.totalStock ?? 0;
            const oldAvgCost = Number(variantBefore?.avgCost ?? 0);
            const addedUnitCost = Number(item.unitCost ?? 0);
            const newTotalStock = oldStock + item.differenceQty;
            newAvgCost =
              newTotalStock > 0
                ? String((oldStock * oldAvgCost + item.differenceQty * addedUnitCost) / newTotalStock)
                : '0';
          } else if (item.differenceQty < 0) {
            // Selisih kurang → potong FIFO dari batch tertua yang masih ada remaining_qty.
            let qtyToDeduct = Math.abs(item.differenceQty);
            const batches = await tx
              .select()
              .from(inventoryBatches)
              .where(and(eq(inventoryBatches.variantId, item.variantId), gt(inventoryBatches.remainingQty, 0)))
              .orderBy(asc(inventoryBatches.receivedAt));

            for (const batch of batches) {
              if (qtyToDeduct <= 0) break;
              const deduct = Math.min(batch.remainingQty, qtyToDeduct);
              await tx
                .update(inventoryBatches)
                .set({ remainingQty: batch.remainingQty - deduct })
                .where(eq(inventoryBatches.id, batch.id));
              qtyToDeduct -= deduct;
            }
          }

          // Sinkronkan cache total_stock di product_variants (sebelumnya tidak pernah
          // diupdate saat posting adjustment — bug: dashboard/POS menampilkan stok lama).
          if (item.differenceQty !== 0) {
            await tx
              .update(productVariants)
              .set({
                totalStock: sql`${productVariants.totalStock} + ${item.differenceQty}`,
                ...(newAvgCost !== undefined ? { avgCost: newAvgCost } : {}),
              })
              .where(eq(productVariants.id, item.variantId));
          }
        }

        const [posted] = await tx
          .update(stockAdjustments)
          .set({ status: 'POSTED', postedAt: new Date() })
          .where(eq(stockAdjustments.id, adjustment.id))
          .returning();

        return ok(posted, 'Adjustment stok berhasil diposting');
      });
    },
    { requireRole: ['OWNER'] },
  );
