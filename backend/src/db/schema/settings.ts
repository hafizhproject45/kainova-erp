import { integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const systemSettings = pgTable('system_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  costingMethod: varchar('costing_method', { length: 20 }).default('FIFO').notNull(), // 'FIFO' | 'AVERAGE'
  defaultPpnTaxId: uuid('default_ppn_tax_id'),
  defaultPphTaxId: uuid('default_pph_tax_id'),
  slowMovingThresholdDays: integer('slow_moving_threshold_days').default(45).notNull(),
  deadStockThresholdDays: integer('dead_stock_threshold_days').default(90).notNull(),
  businessName: varchar('business_name', { length: 255 }).default('Popyshop').notNull(),
  receiptFooterNote: varchar('receipt_footer_note', { length: 255 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
