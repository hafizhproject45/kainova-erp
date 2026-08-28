import { Elysia, t } from 'elysia';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../../config/database';
import {
  inventoryBatches,
  productVariants,
  products,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
  uoms,
  users,
} from '../../db/schema';
import { authPlugin, type AuthPayload } from '../auth';
import { ok, BusinessRuleError, NotFoundError, ValidationError } from '../../utils/http';

// MVP 3 Phase 2: Enterprise Procurement Flow (PR to PO) — 4-step lifecycle:
// DRAFT_PR (Pengajuan) -> PO_ISSUED (Persetujuan & Penerbitan PO) ->
// PARTIALLY_RECEIVED/RECEIVED (Penerimaan Barang, bisa bertahap) -> COMPLETED (Selesai, dikunci).
// CANCELLED hanya boleh terjadi sebelum ada barang diterima (DRAFT_PR/PO_ISSUED).

function prNumber(id: string) {
  return `PR-${id.slice(0, 8).toUpperCase()}`;
}
function poNumber(id: string) {
  return `PO-${id.slice(0, 8).toUpperCase()}`;
}

type ItemDetail = {
  id: string;
  purchaseOrderId: string;
  variantId: string;
  qty: number;
  qtyReceived: number;
  unitCost: string | null;
  sku: string;
  color: string;
  size: string;
  productName: string;
  uomName: string | null;
};

async function loadItemsDetail(purchaseOrderIds: string[]): Promise<ItemDetail[]> {
  if (purchaseOrderIds.length === 0) return [];
  return db
    .select({
      id: purchaseOrderItems.id,
      purchaseOrderId: purchaseOrderItems.purchaseOrderId,
      variantId: purchaseOrderItems.variantId,
      qty: purchaseOrderItems.qty,
      qtyReceived: purchaseOrderItems.qtyReceived,
      unitCost: purchaseOrderItems.unitCost,
      sku: productVariants.sku,
      color: productVariants.color,
      size: productVariants.size,
      productName: products.name,
      uomName: uoms.name,
    })
    .from(purchaseOrderItems)
    .innerJoin(productVariants, eq(productVariants.id, purchaseOrderItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(uoms, eq(uoms.id, products.uomId))
    .where(inArray(purchaseOrderItems.purchaseOrderId, purchaseOrderIds));
}

// Format ringkasan item per baris tabel List (MVP 3 Phase 2): "- [Nama Produk/Varian] ([Qty] [UOM])".
function formatItemLine(item: { productName: string; color: string; size: string; qty: number; uomName: string | null }) {
  const variantLabel = [item.color, item.size].filter(Boolean).join('/');
  return `- ${item.productName}${variantLabel ? ` (${variantLabel})` : ''} (${item.qty} ${item.uomName ?? 'unit'})`;
}

const itemsBody = t.Array(t.Object({ variant_id: t.String(), qty: t.Number() }));

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
      if (rows.length === 0) return ok([]);

      const poIds = rows.map((r) => r.id);
      const supplierIds = [...new Set(rows.map((r) => r.supplierId))];
      const userIds = [...new Set(rows.flatMap((r) => [r.requestedBy, r.approvedBy]).filter((x): x is string => Boolean(x)))];
      const [supplierRows, userRows, itemRows] = await Promise.all([
        db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(inArray(suppliers.id, supplierIds)),
        userIds.length > 0
          ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds))
          : Promise.resolve([]),
        loadItemsDetail(poIds),
      ]);
      const supplierNameById = new Map(supplierRows.map((s) => [s.id, s.name]));
      const userNameById = new Map(userRows.map((u) => [u.id, u.name]));

      const itemsByPo = new Map<string, typeof itemRows>();
      for (const item of itemRows) {
        const list = itemsByPo.get(item.purchaseOrderId as string) ?? [];
        list.push(item);
        itemsByPo.set(item.purchaseOrderId as string, list);
      }

      return ok(
        rows.map((r) => {
          const items = (itemsByPo.get(r.id) ?? []) as Array<{
            productName: string;
            color: string;
            size: string;
            qty: number;
            uomName: string | null;
            unitCost: string | null;
          }>;
          const totalAmount = items.reduce((sum, i) => sum + i.qty * Number(i.unitCost ?? 0), 0);
          return {
            ...r,
            prNumber: prNumber(r.id),
            poNumber: r.approvedAt ? poNumber(r.id) : null,
            supplierName: supplierNameById.get(r.supplierId) ?? '-',
            requestedByName: userNameById.get(r.requestedBy) ?? '-',
            approvedByName: r.approvedBy ? (userNameById.get(r.approvedBy) ?? '-') : null,
            totalAmount,
            itemsSummary: items.map(formatItemLine).join('\n'),
          };
        }),
      );
    },
    {
      query: t.Object({
        supplier_id: t.Optional(t.String()),
        status: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
      }),
      requireRole: ['OWNER', 'GUDANG', 'KASIR'],
    },
  )
  .get(
    '/:id',
    async ({ params }) => {
      const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, params.id)).limit(1);
      if (!po) throw new NotFoundError('Purchase Order tidak ditemukan');
      const items = await loadItemsDetail([po.id]);
      const [supplier] = await db.select({ name: suppliers.name }).from(suppliers).where(eq(suppliers.id, po.supplierId)).limit(1);
      const involvedUserIds = [po.requestedBy, po.approvedBy].filter((x): x is string => Boolean(x));
      const userRows =
        involvedUserIds.length > 0
          ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, involvedUserIds))
          : [];
      const userNameById = new Map(userRows.map((u) => [u.id, u.name]));

      return ok({
        ...po,
        prNumber: prNumber(po.id),
        poNumber: po.approvedAt ? poNumber(po.id) : null,
        supplierName: supplier?.name ?? '-',
        requestedByName: userNameById.get(po.requestedBy) ?? '-',
        approvedByName: po.approvedBy ? (userNameById.get(po.approvedBy) ?? '-') : null,
        items,
      });
    },
    { requireRole: ['OWNER', 'GUDANG', 'KASIR'] },
  )
  .post(
    '',
    async ({ body, user }) => {
      // Step 1: Pengajuan (PR) — Staf/Kasir/Gudang, TANPA harga pasti (unit_cost diisi Owner di Step 2).
      if (body.items.length === 0) throw new ValidationError('Item pengajuan wajib diisi minimal 1');
      const [po] = await db
        .insert(purchaseOrders)
        .values({ supplierId: body.supplier_id, notes: body.notes, requestedBy: (user as AuthPayload).id })
        .returning();
      const items = await db
        .insert(purchaseOrderItems)
        .values(body.items.map((item) => ({ purchaseOrderId: po!.id, variantId: item.variant_id, qty: item.qty })))
        .returning();
      return ok({ ...po, items }, 'Pengajuan (PR) berhasil dibuat');
    },
    {
      body: t.Object({ supplier_id: t.String(), notes: t.Optional(t.String()), items: itemsBody }),
      requireRole: ['OWNER', 'GUDANG', 'KASIR'],
    },
  )
  .put(
    '/:id',
    async ({ params, body }) => {
      // Contextual Edit — "Edit Pengajuan": hanya boleh selagi masih Step 1 (DRAFT_PR).
      return await db.transaction(async (tx) => {
        const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, params.id)).limit(1);
        if (!po) throw new NotFoundError('Purchase Order tidak ditemukan');
        if (po.status !== 'DRAFT_PR') throw new BusinessRuleError('Pengajuan hanya bisa diedit selagi masih berstatus DRAFT_PR');
        if (body.items.length === 0) throw new ValidationError('Item pengajuan wajib diisi minimal 1');

        const [updated] = await tx
          .update(purchaseOrders)
          .set({ supplierId: body.supplier_id, notes: body.notes })
          .where(eq(purchaseOrders.id, po.id))
          .returning();

        await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id));
        const items = await tx
          .insert(purchaseOrderItems)
          .values(body.items.map((item) => ({ purchaseOrderId: po.id, variantId: item.variant_id, qty: item.qty })))
          .returning();

        return ok({ ...updated, items }, 'Pengajuan (PR) berhasil diperbarui');
      });
    },
    {
      body: t.Object({ supplier_id: t.String(), notes: t.Optional(t.String()), items: itemsBody }),
      requireRole: ['OWNER', 'GUDANG', 'KASIR'],
    },
  )
  .post(
    '/:id/approve',
    async ({ params, body, user }) => {
      // Step 2: Persetujuan & Penerbitan PO — Owner mengisi harga beli kesepakatan per item.
      return await db.transaction(async (tx) => {
        const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, params.id)).limit(1);
        if (!po) throw new NotFoundError('Purchase Order tidak ditemukan');
        if (po.status !== 'DRAFT_PR') throw new BusinessRuleError('Hanya pengajuan berstatus DRAFT_PR yang bisa disetujui');

        const existingItems = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id));
        const existingIds = new Set(existingItems.map((i) => i.id));
        for (const item of body.items) {
          if (!existingIds.has(item.item_id)) throw new ValidationError(`Item ${item.item_id} bukan bagian dari PR ini`);
          await tx.update(purchaseOrderItems).set({ unitCost: String(item.unit_cost) }).where(eq(purchaseOrderItems.id, item.item_id));
        }
        // Semua item wajib punya harga sebelum PO resmi diterbitkan.
        const missingPrice = existingItems.some((i) => !body.items.some((b) => b.item_id === i.id));
        if (missingPrice) throw new ValidationError('Seluruh item wajib diisi harga beli sebelum PO diterbitkan');

        const [updated] = await tx
          .update(purchaseOrders)
          .set({ status: 'PO_ISSUED', approvedBy: (user as AuthPayload).id, approvedAt: new Date() })
          .where(eq(purchaseOrders.id, po.id))
          .returning();
        return ok(updated, 'PO resmi berhasil diterbitkan');
      });
    },
    {
      body: t.Object({ items: t.Array(t.Object({ item_id: t.String(), unit_cost: t.Number() })) }),
      requireRole: ['OWNER'],
    },
  )
  .post(
    '/:id/receive',
    async ({ params, body }) => {
      // Step 3: Penerimaan Barang — bisa bertahap (Partial Receipt); qty di body = qty yang
      // diterima PADA SESI INI (bukan total kumulatif), supaya form penerimaan selalu mulai dari nol.
      return await db.transaction(async (tx) => {
        const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, params.id)).limit(1);
        if (!po) throw new NotFoundError('Purchase Order tidak ditemukan');
        if (po.status !== 'PO_ISSUED' && po.status !== 'PARTIALLY_RECEIVED') {
          throw new BusinessRuleError('Penerimaan barang hanya berlaku untuk PO berstatus PO_ISSUED / PARTIALLY_RECEIVED');
        }

        const items = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id));
        const itemById = new Map(items.map((i) => [i.id, i]));

        for (const receipt of body.items) {
          const item = itemById.get(receipt.item_id);
          if (!item) throw new ValidationError(`Item ${receipt.item_id} bukan bagian dari PO ini`);
          if (receipt.qty_received <= 0) continue;
          const remaining = item.qty - item.qtyReceived;
          const qtyThisReceipt = Math.min(receipt.qty_received, remaining);
          if (qtyThisReceipt <= 0) continue;

          await tx.insert(inventoryBatches).values({
            variantId: item.variantId,
            initialQty: qtyThisReceipt,
            remainingQty: qtyThisReceipt,
            unitCost: item.unitCost ?? '0',
            sourceType: 'PURCHASE',
            sourceId: po.id,
          });
          await tx
            .update(purchaseOrderItems)
            .set({ qtyReceived: item.qtyReceived + qtyThisReceipt })
            .where(eq(purchaseOrderItems.id, item.id));

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
          const receivedUnitCost = Number(item.unitCost ?? 0);
          const newTotalStock = oldStock + qtyThisReceipt;
          const newAvgCost = newTotalStock > 0 ? (oldStock * oldAvgCost + qtyThisReceipt * receivedUnitCost) / newTotalStock : 0;

          await tx
            .update(productVariants)
            .set({ totalStock: newTotalStock, avgCost: String(newAvgCost) })
            .where(eq(productVariants.id, item.variantId));
        }

        const refreshedItems = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id));
        const fullyReceived = refreshedItems.every((i) => i.qtyReceived >= i.qty);
        const nextStatus = fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

        const [updated] = await tx
          .update(purchaseOrders)
          .set({ status: nextStatus, receivedAt: fullyReceived ? new Date() : po.receivedAt })
          .where(eq(purchaseOrders.id, po.id))
          .returning();
        return ok(updated, fullyReceived ? 'Barang diterima lengkap' : 'Sebagian barang berhasil diterima');
      });
    },
    {
      body: t.Object({ items: t.Array(t.Object({ item_id: t.String(), qty_received: t.Number() })) }),
      requireRole: ['OWNER', 'GUDANG'],
    },
  )
  .post(
    '/:id/complete',
    async ({ params }) => {
      // Step 4: Selesai — kunci transaksi secara permanen setelah barang diterima lengkap.
      const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, params.id)).limit(1);
      if (!po) throw new NotFoundError('Purchase Order tidak ditemukan');
      if (po.status !== 'RECEIVED') throw new BusinessRuleError('Hanya PO dengan barang diterima lengkap (RECEIVED) yang bisa diselesaikan');
      const [updated] = await db
        .update(purchaseOrders)
        .set({ status: 'COMPLETED', completedAt: new Date() })
        .where(eq(purchaseOrders.id, po.id))
        .returning();
      return ok(updated, 'Purchase Order berhasil diselesaikan & dikunci');
    },
    { requireRole: ['OWNER'] },
  )
  .delete(
    '/:id',
    async ({ params }) => {
      const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, params.id)).limit(1);
      if (!po) throw new NotFoundError('Purchase Order tidak ditemukan');
      if (po.status !== 'DRAFT_PR' && po.status !== 'PO_ISSUED') {
        throw new BusinessRuleError('PO yang sudah ada penerimaan barang tidak bisa dibatalkan');
      }
      const [updated] = await db
        .update(purchaseOrders)
        .set({ status: 'CANCELLED' })
        .where(eq(purchaseOrders.id, po.id))
        .returning();
      return ok(updated, 'Purchase Order berhasil dibatalkan');
    },
    { requireRole: ['OWNER'] },
  );
