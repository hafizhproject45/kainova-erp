import { Elysia, t } from 'elysia';
import { and, asc, eq, gt, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { db } from '../../config/database';
import {
  inventoryBatches,
  productVariants,
  products,
  salesOrderItems,
  salesOrders,
  stockAdjustmentItems,
  stockAdjustments,
  uoms,
} from '../../db/schema';
import { authPlugin, type AuthPayload } from '../auth';
import { ok, NotFoundError, BusinessRuleError, ValidationError } from '../../utils/http';

// MVP 3 Phase 3: Restrukturisasi Modul Inventory — 2 sub-module dedicated:
// Stok Produk (Current Stock Summary + Stock Ledger historikal) & Adjustment Stok.

// ---------------------------------------------------------------------------
// Sub-Module 1: Stok Produk (Current Stock Summary & Stock Ledger)
// ---------------------------------------------------------------------------

const stockRoutes = new Elysia()
  .use(authPlugin)
  .get(
    '/inventory/stock-summary',
    async ({ query }) => {
      // Current Stock Summary Panel — daftar SKU (default hanya aktif, Strict Filtering
      // MVP 3 Phase 1), kuantitas stok real-time & total nominal valuasi (HPP rata-rata).
      const conditions = [isNull(productVariants.deletedAt)];
      if (query.is_active !== undefined) conditions.push(eq(productVariants.isActive, query.is_active === 'true'));

      const rows = await db
        .select({
          id: productVariants.id,
          sku: productVariants.sku,
          color: productVariants.color,
          size: productVariants.size,
          totalStock: productVariants.totalStock,
          avgCost: productVariants.avgCost,
          isActive: productVariants.isActive,
          productName: products.name,
          uomName: uoms.name,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .leftJoin(uoms, eq(uoms.id, products.uomId))
        .where(and(...conditions));

      return ok(
        rows.map((r) => ({
          ...r,
          totalValuation: r.totalStock * Number(r.avgCost),
        })),
      );
    },
    { query: t.Object({ is_active: t.Optional(t.String()) }), requireRole: ['OWNER', 'GUDANG'] },
  )
  .get(
    '/inventory/stock-ledger',
    async ({ query }) => {
      // Stock Ledger (Kartu Stok Historikal) — audit trail kronologis satu SKU, digabung
      // dari 3 sumber transaksi yang sudah final (Pembelian diterima, Penjualan, Adjustment
      // POSTED), diurut waktu, lalu dihitung Saldo Akhir Qty berjalan (running balance).
      if (!query.variant_id) throw new ValidationError('variant_id wajib diisi untuk menampilkan Kartu Stok');

      const [variant] = await db
        .select({
          id: productVariants.id,
          sku: productVariants.sku,
          color: productVariants.color,
          size: productVariants.size,
          productName: products.name,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(eq(productVariants.id, query.variant_id))
        .limit(1);
      if (!variant) throw new NotFoundError('Varian SKU tidak ditemukan');

      const fromDate = query.from ? new Date(query.from) : undefined;
      const toDate = query.to ? new Date(query.to) : undefined;
      const inRange = (d: Date) => (!fromDate || d >= fromDate) && (!toDate || d <= toDate);

      type Movement = {
        at: Date;
        type: 'PEMBELIAN' | 'PENJUALAN' | 'ADJUSTMENT';
        reference: string;
        qtyIn: number;
        qtyOut: number;
        unitCost: number;
      };
      const movements: Movement[] = [];

      const purchaseRows = await db
        .select({
          qty: inventoryBatches.initialQty,
          unitCost: inventoryBatches.unitCost,
          receivedAt: inventoryBatches.receivedAt,
          sourceId: inventoryBatches.sourceId,
        })
        .from(inventoryBatches)
        .where(and(eq(inventoryBatches.variantId, variant.id), eq(inventoryBatches.sourceType, 'PURCHASE')));
      for (const row of purchaseRows) {
        movements.push({
          at: row.receivedAt,
          type: 'PEMBELIAN',
          reference: row.sourceId ? `PO-${row.sourceId.slice(0, 8).toUpperCase()}` : '-',
          qtyIn: row.qty,
          qtyOut: 0,
          unitCost: Number(row.unitCost),
        });
      }

      const saleRows = await db
        .select({
          qty: salesOrderItems.qty,
          costOfGoods: salesOrderItems.costOfGoods,
          createdAt: salesOrders.createdAt,
          invoiceNumber: salesOrders.invoiceNumber,
        })
        .from(salesOrderItems)
        .innerJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
        .where(eq(salesOrderItems.variantId, variant.id));
      for (const row of saleRows) {
        movements.push({
          at: row.createdAt,
          type: 'PENJUALAN',
          reference: row.invoiceNumber,
          qtyIn: 0,
          qtyOut: row.qty,
          unitCost: row.qty > 0 ? Number(row.costOfGoods) / row.qty : 0,
        });
      }

      const adjustmentRows = await db
        .select({
          differenceQty: stockAdjustmentItems.differenceQty,
          unitCost: stockAdjustmentItems.unitCost,
          adjustmentId: stockAdjustmentItems.adjustmentId,
          postedAt: stockAdjustments.postedAt,
        })
        .from(stockAdjustmentItems)
        .innerJoin(stockAdjustments, eq(stockAdjustments.id, stockAdjustmentItems.adjustmentId))
        .where(and(eq(stockAdjustmentItems.variantId, variant.id), eq(stockAdjustments.status, 'POSTED')));
      for (const row of adjustmentRows) {
        if (!row.postedAt || row.differenceQty === 0) continue;
        movements.push({
          at: row.postedAt,
          type: 'ADJUSTMENT',
          reference: `ADJ-${row.adjustmentId.slice(0, 8).toUpperCase()}`,
          qtyIn: row.differenceQty > 0 ? row.differenceQty : 0,
          qtyOut: row.differenceQty < 0 ? Math.abs(row.differenceQty) : 0,
          unitCost: Number(row.unitCost ?? 0),
        });
      }

      movements.sort((a, b) => a.at.getTime() - b.at.getTime());

      // Saldo Akhir Qty dihitung berjalan dari histori PENUH (tidak dipotong filter tanggal)
      // supaya angkanya tetap akurat meski user mempersempit rentang tampilan.
      let runningBalance = 0;
      const ledger = movements.map((m) => {
        runningBalance += m.qtyIn - m.qtyOut;
        return {
          date: m.at.toISOString(),
          type: m.type,
          reference: m.reference,
          qtyIn: m.qtyIn,
          qtyOut: m.qtyOut,
          endingBalance: runningBalance,
          unitCost: m.unitCost,
          totalValuation: (m.qtyIn || m.qtyOut) * m.unitCost,
        };
      });

      const filtered = fromDate || toDate ? ledger.filter((row) => inRange(new Date(row.date))) : ledger;

      return ok({
        variant: {
          id: variant.id,
          sku: variant.sku,
          productName: variant.productName,
          color: variant.color,
          size: variant.size,
        },
        ledger: filtered,
      });
    },
    {
      query: t.Object({ variant_id: t.Optional(t.String()), from: t.Optional(t.String()), to: t.Optional(t.String()) }),
      requireRole: ['OWNER', 'GUDANG'],
    },
  );

// ---------------------------------------------------------------------------
// Sub-Module 2: Adjustment Stok (Stock Opname & Saldo Awal)
// ---------------------------------------------------------------------------

const stockAdjustmentsRoutes = new Elysia({ prefix: '/inventory/stock-adjustments' })
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
      // posting di-rollback — tidak boleh ada adjustment "setengah POSTED". Begitu POSTED,
      // baris ini otomatis muncul di Stock Ledger (dibaca langsung dari tabel ini, bukan
      // tabel ledger terpisah) — memenuhi syarat "integrasi otomatis" MVP 3 Phase 3.
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

export const inventoryRoutes = new Elysia().use(stockRoutes).use(stockAdjustmentsRoutes);
