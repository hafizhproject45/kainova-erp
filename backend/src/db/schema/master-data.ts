import { boolean, integer, numeric, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// ---------------------------------------------------------------------------
// Unit of Measure (UOM) — mis. Pcs, Pack, Lusin, Meter
// ---------------------------------------------------------------------------

export const uoms = pgTable('uoms', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// ---------------------------------------------------------------------------
// Products & Matrix SKU
// ---------------------------------------------------------------------------

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id).notNull(),
  // UOM di-set pada produk parent & berlaku untuk seluruh varian SKU di bawahnya
  // (lihat DEVELOPMENT_ROADMAP_MVP_2.md Phase 2 — dropdown UOM wajib di form Produk).
  uomId: uuid('uom_id').references(() => uoms.id),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const productVariants = pgTable('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  material: varchar('material', { length: 100 }),
  color: varchar('color', { length: 100 }).notNull(),
  size: varchar('size', { length: 50 }).notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  avgCost: numeric('avg_cost', { precision: 12, scale: 2 }).default('0').notNull(),
  totalStock: integer('total_stock').default(0).notNull(),
  // Dipakai untuk kalkulasi ROP (Re-Order Point) — PRODUCT_KNOWLEDGE.md §7A.
  // Default 7 hari lead time & 0 safety stock; idealnya diisi per-produk lewat Master Data.
  leadTimeDays: integer('lead_time_days').default(7).notNull(),
  safetyStock: integer('safety_stock').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// ---------------------------------------------------------------------------
// Customer & Supplier
// ---------------------------------------------------------------------------

export const suppliers = pgTable('suppliers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// ---------------------------------------------------------------------------
// Taxes (PPN/PPh) & Discounts
// ---------------------------------------------------------------------------

export const taxTypeEnum = pgEnum('tax_type', ['PPN', 'PPH']);
export const discountTypeEnum = pgEnum('discount_type', ['PERCENTAGE', 'NOMINAL']);

export const taxes = pgTable('taxes', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: taxTypeEnum('type').notNull(),
  rate: numeric('rate', { precision: 5, scale: 2 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const discounts = pgTable('discounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: discountTypeEnum('type').notNull(),
  value: numeric('value', { precision: 12, scale: 2 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
