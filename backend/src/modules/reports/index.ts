import { Elysia, t } from 'elysia';
import { and, asc, eq, gte, inArray, lte, sql, type SQLWrapper } from 'drizzle-orm';
import { db } from '../../config/database';
import {
  customers,
  inventoryBatches,
  productVariants,
  products,
  purchaseOrderItems,
  purchaseOrders,
  salesOrderItems,
  salesOrders,
  stockAdjustmentItems,
  stockAdjustments,
  suppliers,
} from '../../db/schema';
import { authPlugin } from '../auth';
import { ok } from '../../utils/http';
import {
  EXCEL_CONTENT_TYPE,
  PDF_CONTENT_TYPE,
  fileResponse,
  renderExcelBuffer,
  renderPdfBuffer,
  type ReportColumn,
} from '../../utils/report-export';

/**
 * Laporan (lihat DEVELOPMENT_ROADMAP_MVP_1.md Phase 4 & API_SPECIFICATION.md §7).
 * Mendukung `?format=json` (default, JSON envelope) maupun `?format=pdf|xlsx` (file binary).
 */

/** Kembalikan JSON envelope biasa, atau file PDF/Excel kalau `format` diminta. */
async function respondReport<T extends Record<string, unknown>>(
  format: 'json' | 'pdf' | 'xlsx' | undefined,
  filenameBase: string,
  title: string,
  columns: ReportColumn<T>[],
  rows: T[],
  totals: Partial<Record<keyof T, unknown>>,
  filters: unknown,
): Promise<unknown> {
  if (format === 'xlsx') {
    const buffer = await renderExcelBuffer(title, columns, rows, totals);
    return fileResponse(buffer, EXCEL_CONTENT_TYPE, `${filenameBase}.xlsx`);
  }
  if (format === 'pdf') {
    const buffer = await renderPdfBuffer(title, columns, rows, totals);
    return fileResponse(buffer, PDF_CONTENT_TYPE, `${filenameBase}.pdf`);
  }
  return ok({ filters, rows, totals });
}
const reportQuery = t.Object({
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  category_id: t.Optional(t.String()),
  channel: t.Optional(t.String()),
  customer_id: t.Optional(t.String()),
  supplier_id: t.Optional(t.String()),
  invoice_number: t.Optional(t.String()),
  format: t.Optional(t.Union([t.Literal('json'), t.Literal('pdf'), t.Literal('xlsx')])),
});

function dateRange(column: SQLWrapper, from?: string, to?: string) {
  const conditions = [];
  if (from) conditions.push(gte(column, new Date(from)));
  if (to) conditions.push(lte(column, new Date(`${to}T23:59:59.999Z`)));
  return conditions;
}

/** Sales order IDs yang punya minimal satu item dari kategori tertentu. */
async function salesOrderIdsInCategory(categoryId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ id: salesOrderItems.salesOrderId })
    .from(salesOrderItems)
    .innerJoin(productVariants, eq(productVariants.id, salesOrderItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(products.categoryId, categoryId));
  return rows.map((r) => r.id);
}

export const reportsRoutes = new Elysia({ prefix: '/reports' })
  .use(authPlugin)
  .get(
    '/sales',
    async ({ query }) => {
      const conditions = [
        ...dateRange(salesOrders.createdAt, query.from, query.to),
        query.channel ? eq(salesOrders.channel, query.channel) : undefined,
        query.customer_id ? eq(salesOrders.customerId, query.customer_id) : undefined,
        query.invoice_number ? eq(salesOrders.invoiceNumber, query.invoice_number) : undefined,
      ].filter(Boolean);

      if (query.category_id) {
        const ids = await salesOrderIdsInCategory(query.category_id);
        conditions.push(ids.length > 0 ? inArray(salesOrders.id, ids) : sql`false`);
      }

      const rows = await db
        .select({
          invoiceNumber: salesOrders.invoiceNumber,
          date: salesOrders.createdAt,
          channel: salesOrders.channel,
          customerName: customers.name,
          subtotal: salesOrders.subtotal,
          itemDiscountTotal: salesOrders.itemDiscountTotal,
          discountAmount: salesOrders.discountAmount,
          dpp: salesOrders.dpp,
          ppnAmount: salesOrders.ppnAmount,
          pphAmount: salesOrders.pphAmount,
          grandTotal: salesOrders.grandTotal,
        })
        .from(salesOrders)
        .leftJoin(customers, eq(customers.id, salesOrders.customerId))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(salesOrders.createdAt));

      const totals = rows.reduce(
        (acc, row) => ({
          subtotal: acc.subtotal + Number(row.subtotal),
          itemDiscountTotal: acc.itemDiscountTotal + Number(row.itemDiscountTotal),
          discountAmount: acc.discountAmount + Number(row.discountAmount),
          dpp: acc.dpp + Number(row.dpp),
          ppnAmount: acc.ppnAmount + Number(row.ppnAmount),
          pphAmount: acc.pphAmount + Number(row.pphAmount),
          grandTotal: acc.grandTotal + Number(row.grandTotal),
        }),
        { subtotal: 0, itemDiscountTotal: 0, discountAmount: 0, dpp: 0, ppnAmount: 0, pphAmount: 0, grandTotal: 0 },
      );

      const columns: ReportColumn<(typeof rows)[number]>[] = [
        { key: 'invoiceNumber', header: 'No. Invoice' },
        { key: 'date', header: 'Tanggal' },
        { key: 'channel', header: 'Channel' },
        { key: 'customerName', header: 'Customer' },
        { key: 'subtotal', header: 'Subtotal' },
        { key: 'itemDiscountTotal', header: 'Diskon Item' },
        { key: 'discountAmount', header: 'Diskon Keseluruhan' },
        { key: 'dpp', header: 'DPP' },
        { key: 'ppnAmount', header: 'PPN' },
        { key: 'pphAmount', header: 'PPh' },
        { key: 'grandTotal', header: 'Grand Total' },
      ];
      return respondReport(query.format, 'laporan-penjualan', 'Laporan Penjualan', columns, rows, totals, query);
    },
    { query: reportQuery, requireRole: ['OWNER'] },
  )
  .get(
    '/purchases',
    async ({ query }) => {
      const conditions = [
        ...dateRange(purchaseOrders.createdAt, query.from, query.to),
        query.supplier_id ? eq(purchaseOrders.supplierId, query.supplier_id) : undefined,
      ].filter(Boolean);

      const rows = await db
        .select({
          id: purchaseOrders.id,
          supplierName: suppliers.name,
          status: purchaseOrders.status,
          createdAt: purchaseOrders.createdAt,
          receivedAt: purchaseOrders.receivedAt,
          totalQty: sql<number>`coalesce(sum(${purchaseOrderItems.qty}), 0)`,
          totalCost: sql<number>`coalesce(sum(${purchaseOrderItems.qty} * ${purchaseOrderItems.unitCost}), 0)`,
        })
        .from(purchaseOrders)
        .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
        .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .groupBy(purchaseOrders.id, suppliers.name)
        .orderBy(asc(purchaseOrders.createdAt));

      const totals = rows.reduce(
        (acc, row) => ({
          totalQty: acc.totalQty + Number(row.totalQty),
          totalCost: acc.totalCost + Number(row.totalCost),
        }),
        { totalQty: 0, totalCost: 0 },
      );

      const columns: ReportColumn<(typeof rows)[number]>[] = [
        { key: 'supplierName', header: 'Supplier' },
        { key: 'status', header: 'Status' },
        { key: 'createdAt', header: 'Tanggal PO' },
        { key: 'receivedAt', header: 'Tanggal Diterima' },
        { key: 'totalQty', header: 'Total Qty' },
        { key: 'totalCost', header: 'Total Biaya' },
      ];
      return respondReport(query.format, 'laporan-pembelian', 'Laporan Pembelian', columns, rows, totals, query);
    },
    { query: reportQuery, requireRole: ['OWNER'] },
  )
  .get(
    '/stock',
    async ({ query }) => {
      const conditions = [query.category_id ? eq(products.categoryId, query.category_id) : undefined].filter(Boolean);

      // Mutasi masuk (dari inventory_batches) & keluar (dari sales_order_items), difilter tanggal jika ada.
      const batchDateConds = dateRange(inventoryBatches.receivedAt, query.from, query.to);
      const soldDateConds = dateRange(salesOrders.createdAt, query.from, query.to);

      const rows = await db
        .select({
          sku: productVariants.sku,
          productName: products.name,
          totalStock: productVariants.totalStock,
          totalReceived: sql<number>`coalesce((select sum(${inventoryBatches.initialQty}) from ${inventoryBatches}
            where ${inventoryBatches.variantId} = ${productVariants.id}
            ${batchDateConds.length ? sql`and ${and(...batchDateConds)}` : sql``}), 0)`,
          totalSold: sql<number>`coalesce((select sum(${salesOrderItems.qty}) from ${salesOrderItems}
            inner join ${salesOrders} on ${salesOrders.id} = ${salesOrderItems.salesOrderId}
            where ${salesOrderItems.variantId} = ${productVariants.id}
            ${soldDateConds.length ? sql`and ${and(...soldDateConds)}` : sql``}), 0)`,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(productVariants.sku));

      const totals = rows.reduce(
        (acc, row) => ({
          totalStock: acc.totalStock + Number(row.totalStock),
          totalReceived: acc.totalReceived + Number(row.totalReceived),
          totalSold: acc.totalSold + Number(row.totalSold),
        }),
        { totalStock: 0, totalReceived: 0, totalSold: 0 },
      );

      const columns: ReportColumn<(typeof rows)[number]>[] = [
        { key: 'sku', header: 'SKU' },
        { key: 'productName', header: 'Produk' },
        { key: 'totalStock', header: 'Stok Saat Ini' },
        { key: 'totalReceived', header: 'Total Masuk' },
        { key: 'totalSold', header: 'Total Terjual' },
      ];
      return respondReport(query.format, 'laporan-stok', 'Laporan Stok', columns, rows, totals, query);
    },
    { query: reportQuery, requireRole: ['OWNER', 'GUDANG'] },
  )
  .get(
    '/stock-adjustments',
    async ({ query }) => {
      const conditions = dateRange(stockAdjustments.createdAt, query.from, query.to);

      const rows = await db
        .select({
          id: stockAdjustments.id,
          type: stockAdjustments.type,
          reason: stockAdjustments.reason,
          status: stockAdjustments.status,
          createdAt: stockAdjustments.createdAt,
          postedAt: stockAdjustments.postedAt,
          totalItems: sql<number>`coalesce(count(${stockAdjustmentItems.id}), 0)`,
          totalDifferenceQty: sql<number>`coalesce(sum(${stockAdjustmentItems.differenceQty}), 0)`,
        })
        .from(stockAdjustments)
        .leftJoin(stockAdjustmentItems, eq(stockAdjustmentItems.adjustmentId, stockAdjustments.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .groupBy(stockAdjustments.id)
        .orderBy(asc(stockAdjustments.createdAt));

      const totals = rows.reduce(
        (acc, row) => ({
          totalItems: acc.totalItems + Number(row.totalItems),
          totalDifferenceQty: acc.totalDifferenceQty + Number(row.totalDifferenceQty),
        }),
        { totalItems: 0, totalDifferenceQty: 0 },
      );

      const columns: ReportColumn<(typeof rows)[number]>[] = [
        { key: 'type', header: 'Tipe' },
        { key: 'reason', header: 'Alasan' },
        { key: 'status', header: 'Status' },
        { key: 'createdAt', header: 'Dibuat' },
        { key: 'postedAt', header: 'Diposting' },
        { key: 'totalItems', header: 'Jumlah Item' },
        { key: 'totalDifferenceQty', header: 'Total Selisih Qty' },
      ];
      return respondReport(
        query.format,
        'laporan-adjustment-stok',
        'Laporan Adjustment Stok',
        columns,
        rows,
        totals,
        query,
      );
    },
    { query: reportQuery, requireRole: ['OWNER', 'GUDANG'] },
  )
  .get(
    '/profit-loss',
    async ({ query }) => {
      const conditions = dateRange(salesOrders.createdAt, query.from, query.to);

      // Query A: agregat header per hari (subtotal, diskon, DPP, PPN, PPh, grand total) — dari sales_orders langsung,
      // TIDAK di-join ke sales_order_items supaya tidak fan-out/double-count.
      const headerRows = await db
        .select({
          date: sql<string>`date(${salesOrders.createdAt})`,
          subtotal: sql<number>`coalesce(sum(${salesOrders.subtotal}), 0)`,
          discountTotal: sql<number>`coalesce(sum(${salesOrders.itemDiscountTotal} + ${salesOrders.discountAmount}), 0)`,
          dpp: sql<number>`coalesce(sum(${salesOrders.dpp}), 0)`,
          ppnAmount: sql<number>`coalesce(sum(${salesOrders.ppnAmount}), 0)`,
          pphAmount: sql<number>`coalesce(sum(${salesOrders.pphAmount}), 0)`,
          grandTotal: sql<number>`coalesce(sum(${salesOrders.grandTotal}), 0)`,
        })
        .from(salesOrders)
        .where(conditions.length ? and(...conditions) : undefined)
        .groupBy(sql`date(${salesOrders.createdAt})`)
        .orderBy(sql`date(${salesOrders.createdAt})`);

      // Query B: HPP per hari — dihitung terpisah dari sales_order_items (level baris berbeda dari header),
      // digabung dengan Query A di JS berdasarkan tanggal.
      const costRows = await db
        .select({
          date: sql<string>`date(${salesOrders.createdAt})`,
          costOfGoods: sql<number>`coalesce(sum(${salesOrderItems.costOfGoods}), 0)`,
        })
        .from(salesOrderItems)
        .innerJoin(salesOrders, eq(salesOrders.id, salesOrderItems.salesOrderId))
        .where(conditions.length ? and(...conditions) : undefined)
        .groupBy(sql`date(${salesOrders.createdAt})`);

      const costByDate = new Map(costRows.map((r) => [r.date, Number(r.costOfGoods)]));

      const rows = headerRows.map((row) => {
        const costOfGoods = costByDate.get(row.date) ?? 0;
        return { ...row, costOfGoods, grossProfit: Number(row.dpp) - costOfGoods };
      });

      const totals = rows.reduce(
        (acc, row) => ({
          subtotal: acc.subtotal + Number(row.subtotal),
          discountTotal: acc.discountTotal + Number(row.discountTotal),
          dpp: acc.dpp + Number(row.dpp),
          costOfGoods: acc.costOfGoods + row.costOfGoods,
          grossProfit: acc.grossProfit + row.grossProfit,
          ppnAmount: acc.ppnAmount + Number(row.ppnAmount),
          pphAmount: acc.pphAmount + Number(row.pphAmount),
          grandTotal: acc.grandTotal + Number(row.grandTotal),
        }),
        { subtotal: 0, discountTotal: 0, dpp: 0, costOfGoods: 0, grossProfit: 0, ppnAmount: 0, pphAmount: 0, grandTotal: 0 },
      );

      const columns: ReportColumn<(typeof rows)[number]>[] = [
        { key: 'date', header: 'Tanggal' },
        { key: 'subtotal', header: 'Subtotal' },
        { key: 'discountTotal', header: 'Total Diskon' },
        { key: 'dpp', header: 'DPP' },
        { key: 'costOfGoods', header: 'HPP' },
        { key: 'grossProfit', header: 'Laba Kotor' },
        { key: 'ppnAmount', header: 'PPN' },
        { key: 'pphAmount', header: 'PPh' },
        { key: 'grandTotal', header: 'Grand Total' },
      ];
      return respondReport(query.format, 'laporan-laba-rugi', 'Laporan Laba Rugi', columns, rows, totals, query);
    },
    { query: reportQuery, requireRole: ['OWNER'] },
  );
