import { integer, numeric, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { customers, productVariants } from './master-data';

// ---------------------------------------------------------------------------
// Sales Orders (POS / Multi-Channel) — snapshot diskon per-item, diskon
// keseluruhan, PPN (menambah), dan PPh (mengurangi).
// ---------------------------------------------------------------------------

export const salesOrders = pgTable('sales_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceNumber: varchar('invoice_number', { length: 40 }).notNull().unique(),
  channel: varchar('channel', { length: 50 }).notNull(),
  customerId: uuid('customer_id').references(() => customers.id),
  paymentMethod: varchar('payment_method', { length: 30 }).notNull(),

  subtotal: numeric('subtotal', { precision: 14, scale: 2 }).notNull(),
  itemDiscountTotal: numeric('item_discount_total', { precision: 14, scale: 2 }).default('0').notNull(),

  discountId: uuid('discount_id'),
  discountName: varchar('discount_name', { length: 100 }),
  discountType: varchar('discount_type', { length: 20 }),
  discountValue: numeric('discount_value', { precision: 12, scale: 2 }),
  discountAmount: numeric('discount_amount', { precision: 14, scale: 2 }).default('0').notNull(),

  dpp: numeric('dpp', { precision: 14, scale: 2 }).notNull(),

  ppnTaxId: uuid('ppn_tax_id'),
  ppnName: varchar('ppn_name', { length: 100 }),
  ppnRate: numeric('ppn_rate', { precision: 5, scale: 2 }),
  ppnAmount: numeric('ppn_amount', { precision: 14, scale: 2 }).default('0').notNull(),

  pphTaxId: uuid('pph_tax_id'),
  pphName: varchar('pph_name', { length: 100 }),
  pphRate: numeric('pph_rate', { precision: 5, scale: 2 }),
  pphAmount: numeric('pph_amount', { precision: 14, scale: 2 }).default('0').notNull(),

  grandTotal: numeric('grand_total', { precision: 14, scale: 2 }).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const salesOrderItems = pgTable('sales_order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  salesOrderId: uuid('sales_order_id').references(() => salesOrders.id).notNull(),
  variantId: uuid('variant_id').references(() => productVariants.id).notNull(),
  qty: integer('qty').notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  lineSubtotal: numeric('line_subtotal', { precision: 14, scale: 2 }).notNull(),

  discountId: uuid('discount_id'),
  discountName: varchar('discount_name', { length: 100 }),
  discountType: varchar('discount_type', { length: 20 }),
  discountValue: numeric('discount_value', { precision: 12, scale: 2 }),
  discountAmount: numeric('discount_amount', { precision: 14, scale: 2 }).default('0').notNull(),

  lineTotal: numeric('line_total', { precision: 14, scale: 2 }).notNull(),
  costOfGoods: numeric('cost_of_goods', { precision: 12, scale: 2 }).notNull(),
});

// ---------------------------------------------------------------------------
// Invoice Counters (atomic per channel + tanggal)
// ---------------------------------------------------------------------------

export const invoiceCounters = pgTable(
  'invoice_counters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    channelCode: varchar('channel_code', { length: 20 }).notNull(),
    periodKey: varchar('period_key', { length: 8 }).notNull(), // 'YYYYMMDD'
    lastSequence: integer('last_sequence').default(0).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    channelPeriodUnique: unique().on(table.channelCode, table.periodKey),
  }),
);
