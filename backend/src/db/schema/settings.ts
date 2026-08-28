import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// MVP 3 Phase 4 — Enterprise System Settings: Company Profile, Inventory Policy,
// Role & Permission Matrix, Receipt & Auto-Numbering Templates. Semua field baru
// nullable/berdefault supaya kompatibel dengan baris single-row yang sudah ada.
export const systemSettings = pgTable('system_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  costingMethod: varchar('costing_method', { length: 20 }).default('FIFO').notNull(), // 'FIFO' | 'AVERAGE'
  defaultPpnTaxId: uuid('default_ppn_tax_id'),
  defaultPphTaxId: uuid('default_pph_tax_id'),
  slowMovingThresholdDays: integer('slow_moving_threshold_days').default(45).notNull(),
  deadStockThresholdDays: integer('dead_stock_threshold_days').default(90).notNull(),
  businessName: varchar('business_name', { length: 255 }).default('Popyshop').notNull(),
  receiptFooterNote: varchar('receipt_footer_note', { length: 255 }),
  // Company Profile
  businessAddress: text('business_address'),
  businessNpwp: varchar('business_npwp', { length: 50 }),
  businessPhone: varchar('business_phone', { length: 30 }),
  // Inventory Policy
  allowNegativeStock: boolean('allow_negative_stock').default(false).notNull(),
  lowStockThreshold: integer('low_stock_threshold').default(5).notNull(),
  // Receipt & Auto-Numbering Templates
  receiptPaperSize: varchar('receipt_paper_size', { length: 10 }).default('58mm').notNull(), // '58mm' | '80mm'
  prNumberFormat: varchar('pr_number_format', { length: 60 }).default('PR/{YYYY}/{MM}/{SEQ}').notNull(),
  poNumberFormat: varchar('po_number_format', { length: 60 }).default('PO/{YYYY}/{MM}/{SEQ}').notNull(),
  invoiceNumberFormat: varchar('invoice_number_format', { length: 60 }).default('INV/{YYYY}/{MM}/{SEQ}').notNull(),
  // Role & Permission Matrix — { [actionKey]: { OWNER: boolean, GUDANG: boolean, KASIR: boolean } }
  rolePermissions: jsonb('role_permissions').$type<Record<string, Record<string, boolean>>>(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
