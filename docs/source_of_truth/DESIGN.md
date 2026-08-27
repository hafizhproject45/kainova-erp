# DESIGN.md - KaiNova ERP

## 1. ERD (Entity Relationship Diagram) Schema Blueprint

### Key Tables Overview

**Master Data**

1. `users`: Account & RBAC Roles (`OWNER`, `GUDANG`, `KASIR`).
2. `categories`: Kategori produk (Baju, Kerudung, Aksesoris).
3. `products`: Master data parent produk Popyshop (FK ke `categories`).
4. `product_variants`: SKU matriks (Color, Size, Material, Price, Average Cost).
5. `suppliers`: Data vendor/supplier barang.
6. `customers`: Data pelanggan (opsional per transaksi, walk-in diperbolehkan).
7. `taxes`: Master pajak (PPN, PPh) beserta rate masing-masing.
8. `discounts`: Master diskon (persentase/nominal) beserta periode berlaku.

**Pembelian & Inventory**

9. `purchase_orders`: Transaksi pembelian ke supplier.
10. `purchase_order_items`: Detail item PO & harga beli per batch.
11. `inventory_batches`: Pelacakan stok spesifik untuk perhitungan HPP FIFO (diisi dari PO, adjustment, maupun saldo awal).
12. `stock_adjustments`: Header adjustment stok (stock opname / saldo awal / koreksi).
13. `stock_adjustment_items`: Detail per SKU: qty sistem, qty fisik, selisih.

**Penjualan**

14. `sales_orders`: Transaksi penjualan (POS Popyshop / Online Channel), menyimpan `invoice_number` unik serta snapshot diskon & pajak yang dipakai.
15. `sales_order_items`: Detail barang yang terjual.
16. `invoice_counters`: Counter atomik per channel & tanggal untuk generate `invoice_number` yang aman dari race condition.

**Settings**

17. `system_settings`: Pengaturan global (Costing Method, Threshold Hari Slow-Moving, Pajak Default PPN/PPh, Profil Bisnis).

---

## 2. Core Database Schema (Drizzle Definition Guide)

### 2.1 Master Data

```typescript
// db/schema/categories.ts
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});
```

```typescript
// db/schema/products.ts
import { pgTable, uuid, varchar, numeric, timestamp, integer } from 'drizzle-orm/pg-core';
import { categories } from './categories';

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id).notNull(),
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
  leadTimeDays: integer('lead_time_days').default(7).notNull(),
  safetyStock: integer('safety_stock').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

```typescript
// db/schema/parties.ts (Customer & Supplier)
import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const suppliers = pgTable('suppliers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});
```

```typescript
// db/schema/taxes-discounts.ts
import { pgTable, uuid, varchar, numeric, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const taxTypeEnum = pgEnum('tax_type', ['PPN', 'PPH']);
export const discountTypeEnum = pgEnum('discount_type', ['PERCENTAGE', 'NOMINAL']);

export const taxes = pgTable('taxes', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(), // "PPN 11%", "PPh Final UMKM 0.5%"
  type: taxTypeEnum('type').notNull(),
  rate: numeric('rate', { precision: 5, scale: 2 }).notNull(), // persen, e.g. 11.00
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const discounts = pgTable('discounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(), // "Diskon Member 10%", "Promo Ramadhan"
  type: discountTypeEnum('type').notNull(),
  value: numeric('value', { precision: 12, scale: 2 }).notNull(), // persen ATAU nominal rupiah, tergantung `type`
  isActive: boolean('is_active').default(true).notNull(),
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 2.2 Pembelian (Purchasing)

```typescript
// db/schema/purchasing.ts
import { pgTable, uuid, integer, numeric, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { suppliers } from './parties';
import { productVariants } from './products';

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
  qtyReceived: integer('qty_received').default(0).notNull(), // untuk mendukung penerimaan bertahap (PARTIAL)
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
});
```

### 2.3 Inventory & Stock Adjustment

```typescript
// db/schema/inventory.ts
import { pgTable, uuid, integer, numeric, varchar, timestamp } from 'drizzle-orm/pg-core';
import { productVariants } from './products';

export const inventoryBatches = pgTable('inventory_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  variantId: uuid('variant_id').references(() => productVariants.id).notNull(),
  initialQty: integer('initial_qty').notNull(),
  remainingQty: integer('remaining_qty').notNull(),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
  sourceType: varchar('source_type', { length: 30 }).notNull(), // 'PURCHASE' | 'ADJUSTMENT'
  sourceId: uuid('source_id'), // FK ke purchase_orders.id ATAU stock_adjustments.id
  receivedAt: timestamp('received_at').defaultNow().notNull(),
});
```

```typescript
// db/schema/stock-adjustments.ts
import { pgTable, uuid, integer, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { productVariants } from './products';
import { users } from './users';
import { numeric } from 'drizzle-orm/pg-core';

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
  differenceQty: integer('difference_qty').notNull(), // actualQty - systemQty, dihitung di service layer
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }), // wajib diisi jika differenceQty > 0
  notes: text('notes'),
});
```

### 2.4 Sales (POS) with Discount & Tax Snapshot

```typescript
// db/schema/sales.ts
import { pgTable, uuid, integer, numeric, varchar, timestamp } from 'drizzle-orm/pg-core';
import { productVariants } from './products';
import { customers } from './parties';

export const salesOrders = pgTable('sales_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceNumber: varchar('invoice_number', { length: 40 }).notNull().unique(), // format: INV-{CHANNEL_CODE}-{YYYYMMDD}-{SEQ}, lihat PRODUCT_KNOWLEDGE.md §4A
  channel: varchar('channel', { length: 50 }).notNull(), // POS_POPYSHOP_STORE_1, SHOPEE, dst.
  customerId: uuid('customer_id').references(() => customers.id), // nullable = walk-in
  paymentMethod: varchar('payment_method', { length: 30 }).notNull(),

  subtotal: numeric('subtotal', { precision: 14, scale: 2 }).notNull(), // Σ qty x price, sebelum diskon apa pun
  itemDiscountTotal: numeric('item_discount_total', { precision: 14, scale: 2 }).default('0').notNull(), // agregat diskon per-item, utk laporan

  // Snapshot Diskon Keseluruhan dipilih kasir (nullable = tidak pakai)
  discountId: uuid('discount_id'),
  discountName: varchar('discount_name', { length: 100 }),
  discountType: varchar('discount_type', { length: 20 }), // 'PERCENTAGE' | 'NOMINAL'
  discountValue: numeric('discount_value', { precision: 12, scale: 2 }),
  discountAmount: numeric('discount_amount', { precision: 14, scale: 2 }).default('0').notNull(),

  dpp: numeric('dpp', { precision: 14, scale: 2 }).notNull(), // subtotal - itemDiscountTotal - discountAmount

  // Snapshot PPN dipilih kasir (nullable = tidak pakai) — MENAMBAH total
  ppnTaxId: uuid('ppn_tax_id'),
  ppnName: varchar('ppn_name', { length: 100 }),
  ppnRate: numeric('ppn_rate', { precision: 5, scale: 2 }),
  ppnAmount: numeric('ppn_amount', { precision: 14, scale: 2 }).default('0').notNull(),

  // Snapshot PPh dipilih kasir (nullable = tidak pakai) — MENGURANGI total
  pphTaxId: uuid('pph_tax_id'),
  pphName: varchar('pph_name', { length: 100 }),
  pphRate: numeric('pph_rate', { precision: 5, scale: 2 }),
  pphAmount: numeric('pph_amount', { precision: 14, scale: 2 }).default('0').notNull(),

  grandTotal: numeric('grand_total', { precision: 14, scale: 2 }).notNull(), // dpp + ppnAmount - pphAmount

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const salesOrderItems = pgTable('sales_order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  salesOrderId: uuid('sales_order_id').references(() => salesOrders.id).notNull(),
  variantId: uuid('variant_id').references(() => productVariants.id).notNull(),
  qty: integer('qty').notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  lineSubtotal: numeric('line_subtotal', { precision: 14, scale: 2 }).notNull(), // qty x price

  // Snapshot Diskon Per-Item dipilih kasir (nullable = tidak pakai)
  discountId: uuid('discount_id'),
  discountName: varchar('discount_name', { length: 100 }),
  discountType: varchar('discount_type', { length: 20 }), // 'PERCENTAGE' | 'NOMINAL'
  discountValue: numeric('discount_value', { precision: 12, scale: 2 }),
  discountAmount: numeric('discount_amount', { precision: 14, scale: 2 }).default('0').notNull(),

  lineTotal: numeric('line_total', { precision: 14, scale: 2 }).notNull(), // lineSubtotal - discountAmount
  costOfGoods: numeric('cost_of_goods', { precision: 12, scale: 2 }).notNull(), // HPP hasil FIFO/Average saat itu
});
```

> Catatan desain: `discountId`/`ppnTaxId`/`pphTaxId` (baik di header maupun per-item) sengaja **tidak** dibuat `NOT NULL` + FK strict yang men-cascade, karena setelah checkout, nilai yang sah secara hukum/akuntansi adalah kolom snapshot (`discountName`, `ppnRate`, `pphRate`, dst.), bukan data master yang bisa berubah. FK tetap dipasang tapi dengan `onDelete: 'set null'` agar histori transaksi tidak pernah hilang meski master diskon/pajak dihapus.
>
> PPN dan PPh sengaja dipisah jadi dua pasang kolom (bukan satu `taxId` generik) karena efeknya berlawanan arah pada `grandTotal`: PPN menambah, PPh mengurangi. Kasir bisa memilih salah satu, keduanya, atau tidak sama sekali.

### 2.5 Invoice Numbering (Atomic Counter)

```typescript
// db/schema/invoice-counters.ts
import { pgTable, uuid, varchar, integer, timestamp, unique } from 'drizzle-orm/pg-core';

export const invoiceCounters = pgTable('invoice_counters', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelCode: varchar('channel_code', { length: 20 }).notNull(), // 'POS', 'SHOPEE', dst.
  periodKey: varchar('period_key', { length: 8 }).notNull(), // 'YYYYMMDD', waktu lokal toko
  lastSequence: integer('last_sequence').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  channelPeriodUnique: unique().on(table.channelCode, table.periodKey),
}));
```

* Generate `invoice_number` di dalam **transaksi database yang sama** dengan penulisan `sales_orders`, memakai pola *upsert-and-increment* atomik agar aman dari race condition saat beberapa kasir checkout bersamaan:

```sql
INSERT INTO invoice_counters (channel_code, period_key, last_sequence)
VALUES ($channelCode, $periodKey, 1)
ON CONFLICT (channel_code, period_key)
DO UPDATE SET last_sequence = invoice_counters.last_sequence + 1, updated_at = now()
RETURNING last_sequence;
```

* Hasil `last_sequence` di-*pad* jadi 4 digit dan digabung: `INV-${channelCode}-${periodKey}-${String(lastSequence).padStart(4, '0')}`.

### 2.6 Settings

```typescript
// db/schema/settings.ts
import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';

export const systemSettings = pgTable('system_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  costingMethod: varchar('costing_method', { length: 20 }).default('FIFO').notNull(), // 'FIFO' | 'AVERAGE'
  defaultPpnTaxId: uuid('default_ppn_tax_id'), // opsional, auto-terpilih di POS (kasir tetap bisa ganti/kosongkan)
  defaultPphTaxId: uuid('default_pph_tax_id'), // opsional, auto-terpilih di POS (kasir tetap bisa ganti/kosongkan)
  slowMovingThresholdDays: integer('slow_moving_threshold_days').default(45).notNull(),
  deadStockThresholdDays: integer('dead_stock_threshold_days').default(90).notNull(),
  businessName: varchar('business_name', { length: 255 }).default('Popyshop').notNull(),
  receiptFooterNote: varchar('receipt_footer_note', { length: 255 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

---

## 3. FIFO Engine Data Flow

```plaintext
[Transaksi Penjualan POS / Online]  ──┐   [Stock Adjustment (Opname/Saldo Awal), status: POSTED]
                                       │                         │
                                       ▼                         ▼
                             [Cek System Settings]     [differenceQty > 0 → new batch]
                                       │                [differenceQty < 0 → potong FIFO]
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
                [FIFO Mode]                       [AVERAGE Mode]
                    │                                   │
                    │                                   └─► Ambil `avg_cost` dari `product_variants`
                    ▼
        [Loop `inventory_batches` ORDER BY `received_at` ASC]
                    │
                    ├─► Kurangi `remaining_qty` dari batch tertua
                    ├─► Hitung HPP = Qty x `unit_cost` batch tersebut
                    └─► Lanjut ke batch berikutnya jika Qty belum tercukupi
```

## 4. POS Checkout Calculation Flow

```plaintext
[Per item: qty x price = lineSubtotal]
              │
   Kasir pilih Diskon Per-Item? ──No──┐
              │Yes                    │
              ▼                       │
   [lineTotal = lineSubtotal          │
       - itemDiscountAmount]          │
              │                       │
              ▼                       ▼
        [Subtotal = Σ lineSubtotal seluruh item]
        [itemDiscountTotal = Σ itemDiscountAmount]
              │
   Kasir pilih Diskon Keseluruhan? ──No──┐
              │Yes                       │
              ▼                          │
   [discountAmount = f(Subtotal          │
       - itemDiscountTotal)]             │
              │                          │
              ▼                          ▼
   [DPP = Subtotal - itemDiscountTotal - discountAmount]
              │
   Kasir pilih PPN? ──No──┐         Kasir pilih PPh? ──No──┐
              │Yes         │                   │Yes         │
              ▼            │                   ▼            │
   [ppnAmount = DPP        │        [pphAmount = DPP        │
       x ppnRate]          │            x pphRate]          │
   (MENAMBAH total)        │        (MENGURANGI total)      │
              │            │                   │             │
              ▼            ▼                   ▼             ▼
        [Grand Total = DPP + ppnAmount - pphAmount]
              │
              ▼
   [Simpan snapshot diskon (per-item & keseluruhan) serta
    PPN/PPh ke sales_order_items & sales_orders]
```

## 5. User Interface Architecture (Svelte SPA)

Layout terbagi menjadi beberapa area utama berdasar Role Access & Modul:

* **Kasir View / Penjualan (Touch & Scan Friendly):** Pencarian cepat SKU, scan barcode, keranjang, pilih diskon & pajak dari dropdown master data, kalkulasi total otomatis, pembayaran, dan cetak struk Popyshop.
* **Gudang View / Pembelian & Adjustment Stok (Density Data):** Form Purchase Order ke supplier, penerimaan barang (goods receipt), form stock opname (input qty fisik per SKU → sistem hitung selisih otomatis), form input saldo awal saat setup awal aplikasi, cetak label barcode.
* **Master Data View:** CRUD untuk Customer, Supplier, Pajak, Diskon, Produk, dan Kategori/SKU — dengan tabel yang bisa dicari & difilter.
* **Owner Dashboard View (Analytics Heavy):** Visualisasi KPI (Laba Rugi, Fast/Slow-Moving Grid, Real-Time Cashflow, stok kritis ROP).
* **Laporan View:** Tabel laporan dengan filter (tanggal, kategori, channel, customer/supplier), tombol Print, Export PDF, dan Export Excel di setiap laporan.
* **Settings View:** Toggle Costing Method (FIFO/Average), pajak default, threshold slow/dead stock, profil bisnis & template struk.
