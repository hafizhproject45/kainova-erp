import { Elysia, t } from 'elysia';
import { and, asc, desc, eq, gt, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../config/database';
import {
  customers,
  discounts,
  inventoryBatches,
  invoiceCounters,
  productVariants,
  products,
  salesOrderItems,
  salesOrders,
  systemSettings,
  taxes,
} from '../../db/schema';
import { authPlugin } from '../auth';
import { ok, BusinessRuleError, NotFoundError } from '../../utils/http';

/** Tipe eksekutor query: bisa `db` langsung atau `tx` di dalam `db.transaction()`. */
type Executor = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Kode channel singkat untuk invoice_number (lihat PRODUCT_KNOWLEDGE.md §4A). */
function channelCode(channel: string): string {
  if (channel.startsWith('POS')) return 'POS';
  if (channel.includes('SHOPEE')) return 'SHOPEE';
  if (channel.includes('TOKPED') || channel.includes('TOKOPEDIA')) return 'TOKPED';
  if (channel.includes('TIKTOK')) return 'TIKTOK';
  return 'WA';
}

/** Generate invoice_number secara atomik via upsert-and-increment (DESIGN.md §2.5). */
async function generateInvoiceNumber(tx: Executor, channel: string): Promise<string> {
  const code = channelCode(channel);
  const periodKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const [counter] = await tx
    .insert(invoiceCounters)
    .values({ channelCode: code, periodKey, lastSequence: 1 })
    .onConflictDoUpdate({
      target: [invoiceCounters.channelCode, invoiceCounters.periodKey],
      set: { lastSequence: sql`${invoiceCounters.lastSequence} + 1`, updatedAt: new Date() },
    })
    .returning();

  return `INV-${code}-${periodKey}-${String(counter!.lastSequence).padStart(4, '0')}`;
}

function calcDiscount(type: 'PERCENTAGE' | 'NOMINAL', value: number, base: number): number {
  return type === 'PERCENTAGE' ? (base * value) / 100 : value;
}

export const salesRoutes = new Elysia({ prefix: '/sales' })
  .use(authPlugin)
  .get(
    '/orders',
    async ({ query }) => {
      // Riwayat transaksi penjualan (Phase 3 MVP 2) — dipakai tabel List di /pos/history & Laporan Penjualan.
      const conditions = [
        query.from ? gte(salesOrders.createdAt, new Date(query.from)) : undefined,
        query.to ? lte(salesOrders.createdAt, new Date(query.to)) : undefined,
        query.payment_method ? eq(salesOrders.paymentMethod, query.payment_method) : undefined,
      ].filter(Boolean);

      const rows = await db
        .select({
          id: salesOrders.id,
          invoiceNumber: salesOrders.invoiceNumber,
          channel: salesOrders.channel,
          customerId: salesOrders.customerId,
          paymentMethod: salesOrders.paymentMethod,
          dpp: salesOrders.dpp,
          ppnAmount: salesOrders.ppnAmount,
          pphAmount: salesOrders.pphAmount,
          grandTotal: salesOrders.grandTotal,
          createdAt: salesOrders.createdAt,
          customerName: customers.name,
        })
        .from(salesOrders)
        .leftJoin(customers, eq(customers.id, salesOrders.customerId))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(salesOrders.createdAt));

      return ok(rows);
    },
    {
      query: t.Object({
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        payment_method: t.Optional(t.String()),
      }),
      requireRole: ['OWNER', 'KASIR'],
    },
  )
  .get(
    '/checkout-options',
    async () => {
      const [settings] = await db.select().from(systemSettings).limit(1);
      const activeDiscounts = await db.select().from(discounts).where(eq(discounts.isActive, true));
      const ppnOptions = await db.select().from(taxes).where(and(eq(taxes.type, 'PPN'), eq(taxes.isActive, true)));
      const pphOptions = await db.select().from(taxes).where(and(eq(taxes.type, 'PPH'), eq(taxes.isActive, true)));

      return ok({
        discounts: activeDiscounts,
        ppnOptions,
        pphOptions,
        defaultPpnTaxId: settings?.defaultPpnTaxId ?? null,
        defaultPphTaxId: settings?.defaultPphTaxId ?? null,
      });
    },
    { requireRole: ['OWNER', 'KASIR'] },
  )
  .post(
    '/checkout',
    async ({ body }) => {
      // Seluruh transaksi checkout (baca harga, potong stok FIFO, generate invoice
      // number, tulis sales_orders/items) dibungkus satu db.transaction() — kalau
      // ada error di tengah (mis. stok kurang di item ke-3), semua write di-rollback,
      // termasuk pemotongan stok item ke-1 & ke-2 yang sudah sempat jalan.
      return await db.transaction(async (tx) => {
      // 1. Hitung per-item: lineSubtotal, discountAmount (per-item), lineTotal.
      let subtotal = 0;
      let itemDiscountTotal = 0;
      const preparedItems: Array<{
        variantId: string;
        qty: number;
        price: number;
        lineSubtotal: number;
        discount?: typeof discounts.$inferSelect | null;
        discountAmount: number;
        lineTotal: number;
      }> = [];

      for (const item of body.items) {
        const lineSubtotal = item.qty * item.price;
        subtotal += lineSubtotal;

        let discount: typeof discounts.$inferSelect | null = null;
        let discountAmount = 0;
        if (item.discount_id) {
          const rows = await tx.select().from(discounts).where(eq(discounts.id, item.discount_id)).limit(1);
          discount = rows[0] ?? null;
          if (discount) discountAmount = calcDiscount(discount.type, Number(discount.value), lineSubtotal);
        }
        itemDiscountTotal += discountAmount;

        preparedItems.push({
          variantId: item.variant_id,
          qty: item.qty,
          price: item.price,
          lineSubtotal,
          discount,
          discountAmount,
          lineTotal: lineSubtotal - discountAmount,
        });
      }

      // 2. Diskon keseluruhan atas (subtotal - itemDiscountTotal).
      let orderDiscount: typeof discounts.$inferSelect | null = null;
      let discountAmount = 0;
      if (body.discount_id) {
        const rows = await tx.select().from(discounts).where(eq(discounts.id, body.discount_id)).limit(1);
        orderDiscount = rows[0] ?? null;
        if (orderDiscount) {
          discountAmount = calcDiscount(orderDiscount.type, Number(orderDiscount.value), subtotal - itemDiscountTotal);
        }
      }

      const dpp = subtotal - itemDiscountTotal - discountAmount;

      // 3. PPN (menambah) & PPh (mengurangi) — lihat PRODUCT_KNOWLEDGE.md §4.
      let ppn: typeof taxes.$inferSelect | null = null;
      let ppnAmount = 0;
      if (body.ppn_tax_id) {
        const rows = await tx.select().from(taxes).where(eq(taxes.id, body.ppn_tax_id)).limit(1);
        ppn = rows[0] ?? null;
        if (ppn) ppnAmount = (dpp * Number(ppn.rate)) / 100;
      }

      let pph: typeof taxes.$inferSelect | null = null;
      let pphAmount = 0;
      if (body.pph_tax_id) {
        const rows = await tx.select().from(taxes).where(eq(taxes.id, body.pph_tax_id)).limit(1);
        pph = rows[0] ?? null;
        if (pph) pphAmount = (dpp * Number(pph.rate)) / 100;
      }

      const grandTotal = dpp + ppnAmount - pphAmount;

      // 4. Validasi & potong stok. HPP dihitung sesuai system_settings.costingMethod:
      //    FIFO → dari harga tiap batch yang dipotong; AVERAGE → dari avg_cost variant
      //    (batch tetap dipotong FIFO untuk menjaga ledger remaining_qty, hanya *biaya*-nya beda sumber).
      const [settingsRow] = await tx.select({ costingMethod: systemSettings.costingMethod }).from(systemSettings).limit(1);
      const costingMethod = settingsRow?.costingMethod ?? 'FIFO';

      let totalCostOfGoods = 0;
      const costOfGoodsByVariant: Record<string, number> = {};
      for (const item of preparedItems) {
        let qtyToDeduct = item.qty;
        let itemCost = 0;
        const batches = await tx
          .select()
          .from(inventoryBatches)
          .where(and(eq(inventoryBatches.variantId, item.variantId), gt(inventoryBatches.remainingQty, 0)))
          .orderBy(asc(inventoryBatches.receivedAt));

        const totalAvailable = batches.reduce((sum, b) => sum + b.remainingQty, 0);
        if (totalAvailable < item.qty) {
          throw new BusinessRuleError(`Stok tidak mencukupi untuk variant ${item.variantId}`);
        }

        let avgCostForItem = 0;
        if (costingMethod === 'AVERAGE') {
          const [variant] = await tx
            .select({ avgCost: productVariants.avgCost })
            .from(productVariants)
            .where(eq(productVariants.id, item.variantId))
            .limit(1);
          avgCostForItem = Number(variant?.avgCost ?? 0);
        }

        for (const batch of batches) {
          if (qtyToDeduct <= 0) break;
          const deduct = Math.min(batch.remainingQty, qtyToDeduct);
          itemCost += deduct * (costingMethod === 'AVERAGE' ? avgCostForItem : Number(batch.unitCost));
          await tx
            .update(inventoryBatches)
            .set({ remainingQty: batch.remainingQty - deduct })
            .where(eq(inventoryBatches.id, batch.id));
          qtyToDeduct -= deduct;
        }

        costOfGoodsByVariant[item.variantId] = itemCost;
        totalCostOfGoods += itemCost;

        await tx
          .update(productVariants)
          .set({ totalStock: sql`${productVariants.totalStock} - ${item.qty}` })
          .where(eq(productVariants.id, item.variantId));
      }

      // 5. Generate invoice_number & simpan sales_orders + sales_order_items.
      const invoiceNumber = await generateInvoiceNumber(tx, body.channel);

      const [salesOrder] = await tx
        .insert(salesOrders)
        .values({
          invoiceNumber,
          channel: body.channel,
          customerId: body.customer_id ?? null,
          paymentMethod: body.payment_method,
          subtotal: String(subtotal),
          itemDiscountTotal: String(itemDiscountTotal),
          discountId: orderDiscount?.id,
          discountName: orderDiscount?.name,
          discountType: orderDiscount?.type,
          discountValue: orderDiscount?.value,
          discountAmount: String(discountAmount),
          dpp: String(dpp),
          ppnTaxId: ppn?.id,
          ppnName: ppn?.name,
          ppnRate: ppn?.rate,
          ppnAmount: String(ppnAmount),
          pphTaxId: pph?.id,
          pphName: pph?.name,
          pphRate: pph?.rate,
          pphAmount: String(pphAmount),
          grandTotal: String(grandTotal),
        })
        .returning();

      await tx.insert(salesOrderItems).values(
        preparedItems.map((item) => ({
          salesOrderId: salesOrder!.id,
          variantId: item.variantId,
          qty: item.qty,
          price: String(item.price),
          lineSubtotal: String(item.lineSubtotal),
          discountId: item.discount?.id,
          discountName: item.discount?.name,
          discountType: item.discount?.type,
          discountValue: item.discount?.value,
          discountAmount: String(item.discountAmount),
          lineTotal: String(item.lineTotal),
          costOfGoods: String(costOfGoodsByVariant[item.variantId] ?? 0),
        })),
      );

      return ok(
        {
          id: salesOrder!.id,
          invoiceNumber,
          subtotal,
          itemDiscountTotal,
          discountAmount,
          dpp,
          ppnAmount,
          pphAmount,
          grandTotal,
          receiptUrl: `/sales/${salesOrder!.id}/receipt`,
        },
        'Transaksi berhasil',
      );
      });
    },
    {
      body: t.Object({
        channel: t.String(),
        customer_id: t.Optional(t.Union([t.String(), t.Null()])),
        payment_method: t.String(),
        items: t.Array(
          t.Object({
            variant_id: t.String(),
            qty: t.Number(),
            price: t.Number(),
            discount_id: t.Optional(t.Union([t.String(), t.Null()])),
          }),
        ),
        discount_id: t.Optional(t.Union([t.String(), t.Null()])),
        ppn_tax_id: t.Optional(t.Union([t.String(), t.Null()])),
        pph_tax_id: t.Optional(t.Union([t.String(), t.Null()])),
      }),
      requireRole: ['OWNER', 'KASIR'],
    },
  )
  .get(
    '/:id/receipt',
    async ({ params }) => {
      const [salesOrder] = await db.select().from(salesOrders).where(eq(salesOrders.id, params.id)).limit(1);
      if (!salesOrder) throw new NotFoundError('Transaksi tidak ditemukan');

      const itemRows = await db
        .select({
          id: salesOrderItems.id,
          qty: salesOrderItems.qty,
          price: salesOrderItems.price,
          lineSubtotal: salesOrderItems.lineSubtotal,
          discountName: salesOrderItems.discountName,
          discountAmount: salesOrderItems.discountAmount,
          lineTotal: salesOrderItems.lineTotal,
          sku: productVariants.sku,
          color: productVariants.color,
          size: productVariants.size,
          productName: products.name,
        })
        .from(salesOrderItems)
        .leftJoin(productVariants, eq(productVariants.id, salesOrderItems.variantId))
        .leftJoin(products, eq(products.id, productVariants.productId))
        .where(eq(salesOrderItems.salesOrderId, salesOrder.id));

      let customerName: string | null = null;
      if (salesOrder.customerId) {
        const [customer] = await db.select({ name: customers.name }).from(customers).where(eq(customers.id, salesOrder.customerId)).limit(1);
        customerName = customer?.name ?? null;
      }

      const [settings] = await db.select().from(systemSettings).limit(1);

      return ok({
        salesOrder,
        items: itemRows,
        customerName,
        businessName: settings?.businessName ?? 'KaiNova ERP',
        footerNote: settings?.receiptFooterNote ?? null,
      });
    },
    { requireRole: ['OWNER', 'KASIR'] },
  );
