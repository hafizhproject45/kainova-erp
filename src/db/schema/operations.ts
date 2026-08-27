import { integer, numeric, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { productVariants, suppliers } from './master-data';
import { users } from './users';

// ---------------------------------------------------------------------------
// Pembelian (Purchasing)
// ---------------------------------------------------------------------------

export const purchaseOrderStatusEnum = pgEnum('purchase_order_status', ['PENDING', 'PARTIAL', 'RECEIVED', 'CANCELLED']);

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  supplierId: uuid('supplier_id').references(() => suppliers.id).notNull(),
  status: purchaseOrderStatusEnum('status').default('PENDING').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  receivedAt: timestamp('received_at'),
});

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id).notNull(),
  variantId: uuid('variant_id').references(() => productVariants.id).notNull(),
  qty: integer('qty').notNull(),
  qtyReceived: integer('qty_received').default(0).notNull(),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
});

// ---------------------------------------------------------------------------
// Inventory Batches (FIFO tracking)
// ---------------------------------------------------------------------------

export const inventoryBatches = pgTable('inventory_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  variantId: uuid('variant_id').references(() => productVariants.id).notNull(),
  initialQty: integer('initial_qty').notNull(),
  remainingQty: integer('remaining_qty').notNull(),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
  sourceType: varchar('source_type', { length: 30 }).notNull(), // 'PURCHASE' | 'ADJUSTMENT'
  sourceId: uuid('source_id'),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Stock Adjustment (Stock Opname & Saldo Awal)
// ---------------------------------------------------------------------------

export const adjustmentTypeEnum = pgEnum('adjustment_type', ['OPENING_BALANCE', 'OPNAME', 'CORRECTION']);
export const adjustmentStatusEnum = pgEnum('adjustment_status', ['DRAFT', 'POSTED']);

export const stockAdjustments = pgTable('stock_adjustments', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: adjustmentTypeEnum('type').notNull(),
  reason: text('reason').notNull(),
  status: adjustmentStatusEnum('status').default('DRAFT').notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  postedAt: timestamp('posted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stockAdjustmentItems = pgTable('stock_adjustment_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  adjustmentId: uuid('adjustment_id').references(() => stockAdjustments.id).notNull(),
  variantId: uuid('variant_id').references(() => productVariants.id).notNull(),
  systemQty: integer('system_qty').notNull(),
  actualQty: integer('actual_qty').notNull(),
  differenceQty: integer('difference_qty').notNull(),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }),
  notes: text('notes'),
});
