# API_SPECIFICATION.md - KaiNova ERP

## Base URL

```bash
https://api.kainova.local/v1
```

## Response Envelope & Naming Convention

Semua endpoint mengikuti format standar pada `TECH_KNOWLEDGE.md` Bagian 5: `{ success, message, data, errors }`.

**Seluruh key JSON (request body, query param, response body) menggunakan `snake_case`.** Ini murni konvensi di boundary API — properti internal Drizzle/TypeScript tetap `camelCase` (lihat `TECH_KNOWLEDGE.md` §3); konversi dilakukan di layer controller/serializer.

---

## 1. Authentication & RBAC

### POST `/auth/login`

* Request:

``` json
{
  "username": "kasir_popyshop",
  "password": "secretpassword"
}
```

* Response (200 OK):

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": { "id": "uuid", "name": "Budi", "role": "KASIR" }
  }
}
```

---

## 2. Master Data

Semua endpoint master data di bawah mendukung Role `OWNER` untuk create/update/delete, dan Role `OWNER`/`GUDANG`/`KASIR` untuk read (dipakai dropdown di POS/Pembelian). Semua list endpoint mendukung query `?search=&page=&limit=`.

### 2.1 Kategori Produk

* `GET /categories` — list kategori.
* `POST /categories` — `{ "name": "Kerudung" }`
* `PUT /categories/:id` / `DELETE /categories/:id` (soft delete via `deleted_at`).

### 2.2 Produk & Matrix SKU

#### POST `/products/matrix` (Create Parent Product + Matrix Variant SKU)

* Headers: Authorization: Bearer `<token>` (Role: OWNER)
* Request:

``` json
{
  "name": "Hijab Voal Square Popyshop",
  "category_id": "uuid-category-kerudung",
  "material": "Voal Premium",
  "colors": ["Black", "Navy", "Maroon"],
  "sizes": ["OS"],
  "base_price": 49000
}
```

* Response (201 Created): Mengembalikan list SKU yang berhasil dibuat otomatis.

* `GET /products` — list parent product + filter `?category_id=`.
* `GET /products/:id/variants` — list SKU turunan.
* `PUT /product-variants/:id` — update harga/nama variant.

### 2.3 Supplier

* `GET /suppliers`
* `POST /suppliers` — `{ "name": "CV Kain Sejahtera", "phone": "0812xxxx", "email": "", "address": "" }`
* `PUT /suppliers/:id` / `DELETE /suppliers/:id`

### 2.4 Customer

* `GET /customers`
* `POST /customers` — `{ "name": "Ibu Sari", "phone": "0812xxxx", "email": "", "address": "" }`
* `PUT /customers/:id` / `DELETE /customers/:id`

### 2.5 Pajak

* `GET /taxes?is_active=true`
* `POST /taxes` — `{ "name": "PPN 11%", "type": "PPN", "rate": 11.00 }`
* `PUT /taxes/:id` — termasuk toggle `is_active`.
* `DELETE /taxes/:id`

### 2.6 Diskon

* `GET /discounts?is_active=true`
* `POST /discounts` — `{ "name": "Diskon Member", "type": "PERCENTAGE", "value": 10, "valid_from": "2026-01-01", "valid_until": null }`
* `PUT /discounts/:id` / `DELETE /discounts/:id`

---

## 3. Pembelian (Purchasing)

### POST `/purchase-orders` (Buat PO ke Supplier)

* Headers: Authorization: Bearer `<token>` (Role: OWNER, GUDANG)
* Request:

``` json
{
  "supplier_id": "uuid-supplier",
  "items": [
    { "variant_id": "uuid-variant-1", "qty": 50, "unit_cost": 25000 }
  ]
}
```

* Response (201 Created): PO berstatus `PENDING`, belum menambah stok.

### POST `/purchase-orders/:id/receive` (Penerimaan Barang / Goods Receipt)

* Headers: Authorization: Bearer `<token>` (Role: OWNER, GUDANG)
* Behavior: Mengisi `inventory_batches` baru (`source_type: 'PURCHASE'`) dan memperbarui `avg_cost` (jika mode AVERAGE) serta `total_stock` pada SKU target. PO berubah status jadi `RECEIVED` (atau `PARTIAL` jika qty diterima belum penuh).

### GET `/purchase-orders`

* Query: `?supplier_id=&status=&from=&to=`

---

## 4. Adjustment Stok

### POST `/stock-adjustments` (Buat Draft Adjustment)

* Headers: Authorization: Bearer `<token>` (Role: OWNER, GUDANG)
* Request:

``` json
{
  "type": "OPNAME",
  "reason": "Stock Opname Toko Q1 2026",
  "items": [
    { "variant_id": "uuid-variant-1", "system_qty": 40, "actual_qty": 37, "notes": "3 pcs rusak" },
    { "variant_id": "uuid-variant-2", "system_qty": 10, "actual_qty": 15, "unit_cost": 25000 }
  ]
}
```

* Response (201 Created): Adjustment tersimpan dengan status `DRAFT`, belum mempengaruhi stok.
* Catatan: untuk `type: "OPENING_BALANCE"`, `system_qty` selalu `0` (belum ada stok tercatat sebelumnya).

### POST `/stock-adjustments/:id/post` (Posting ke Stok)

* Headers: Authorization: Bearer `<token>` (Role: OWNER)
* Behavior: Menghitung `difference_qty` tiap item. Selisih positif membuat `inventory_batch` baru (`source_type: 'ADJUSTMENT'`); selisih negatif memotong `remaining_qty` dari batch tertua (FIFO). Status berubah jadi `POSTED` dan tidak bisa diedit lagi.

### GET `/stock-adjustments`

* Query: `?type=&status=&from=&to=`

---

## 5. Sales & POS Transaction

### GET `/sales/checkout-options`

* Response: daftar diskon aktif (dipakai baik untuk per-item maupun keseluruhan — UI yang memutuskan konteksnya) dan pajak aktif dipecah per jenis (`ppn_options` / `pph_options`) untuk ditampilkan sebagai dropdown pilihan kasir, plus default dari `system_settings`.

``` json
{
  "success": true,
  "data": {
    "discounts": [ { "id": "uuid-disc-1", "name": "Diskon Member", "type": "PERCENTAGE", "value": 10 } ],
    "ppn_options": [ { "id": "uuid-tax-ppn-1", "name": "PPN 11%", "rate": 11.00 } ],
    "pph_options": [ { "id": "uuid-tax-pph-1", "name": "PPh Final UMKM 0.5%", "rate": 0.50 } ],
    "default_ppn_tax_id": "uuid-tax-ppn-1",
    "default_pph_tax_id": null
  }
}
```

### POST `/sales/checkout`

* Headers: Authorization: Bearer `<token>` (Role: OWNER, KASIR)
* Request:

``` json
{
  "channel": "POS_POPYSHOP_STORE_1",
  "customer_id": null,
  "payment_method": "QRIS",
  "items": [
    { "variant_id": "uuid-variant-1", "qty": 2, "price": 49000, "discount_id": "uuid-disc-promo-item" },
    { "variant_id": "uuid-variant-2", "qty": 1, "price": 75000, "discount_id": null }
  ],
  "discount_id": "uuid-disc-member",
  "ppn_tax_id": "uuid-tax-ppn-1",
  "pph_tax_id": "uuid-tax-pph-1"
}
```

* Semua field diskon (`items[].discount_id`, `discount_id`) dan pajak (`ppn_tax_id`, `pph_tax_id`) bersifat opsional/boleh `null` — kasir bebas kombinasikan sesuai transaksi.
* Behavior:
  1. Validasi stok tersedia untuk seluruh item.
  2. Untuk tiap item: hitung `line_subtotal = qty x price`, lalu `discount_amount` per-item dari `items[].discount_id` (jika ada) → `line_total`.
  3. Hitung `subtotal = Σ line_subtotal` dan `item_discount_total = Σ discount_amount per item`.
  4. Hitung `discount_amount` (Diskon Keseluruhan) dari `discount_id` header (jika dikirim) atas `subtotal - item_discount_total`.
  5. `dpp = subtotal - item_discount_total - discount_amount`.
  6. Jika `ppn_tax_id` dikirim: `ppn_amount = dpp x ppn_rate` → **ditambahkan**. Jika `pph_tax_id` dikirim: `pph_amount = dpp x pph_rate` → **dikurangkan**.
  7. `grand_total = dpp + ppn_amount - pph_amount`.
  8. Simpan `sales_orders` & `sales_order_items` beserta snapshot nama/tipe/rate diskon dan PPN/PPh yang dipakai (lihat `DESIGN.md` §2.4).
  9. Mengurangi stok secara real-time, memotong batch FIFO/Average, serta mencatat HPP transaksi per item.
* Response (201 Created):

``` json
{
  "success": true,
  "data": {
    "id": "uuid-sales-order",
    "invoice_number": "INV-POS-20260827-0015",
    "subtotal": 173000,
    "item_discount_total": 9800,
    "discount_amount": 8151,
    "dpp": 155049,
    "ppn_amount": 17055.39,
    "pph_amount": 775.25,
    "grand_total": 171329.14,
    "receipt_url": "/sales/uuid-sales-order/receipt"
  }
}
```

* Format & aturan generate `invoice_number`: lihat `PRODUCT_KNOWLEDGE.md` §4A dan `DESIGN.md` §2.5.

### GET `/sales/:id/receipt`

* Behavior: Mengembalikan data struk siap-print (HTML/PDF) sesuai `business_name` & `receipt_footer_note` dari Settings.

---

## 6. Dashboard

### GET `/dashboard/summary`

* Query: `?date=2026-08-27` (default: hari ini)
* Response:

``` json
{
  "success": true,
  "data": {
    "today_revenue": 4500000,
    "today_transactions": 32,
    "gross_profit_today": 1200000,
    "low_stock_alerts": [
      { "sku": "GMS-SLK-BLK-L", "total_stock": 3, "rop": 8 }
    ]
  }
}
```

---

## 7. Laporan (Reports)

Semua endpoint laporan mendukung query filter yang sama: `?from=&to=&category_id=&channel=&customer_id=&supplier_id=&invoice_number=&format=json|pdf|xlsx`. Ketika `format=pdf` atau `format=xlsx`, response berupa file binary (`Content-Disposition: attachment`) alih-alih JSON.

* `GET /reports/sales` — laporan penjualan (per transaksi/produk/channel/kasir).
* `GET /reports/purchases` — laporan pembelian (per PO/supplier/produk).
* `GET /reports/stock` — kartu stok per SKU (mutasi masuk/keluar/adjustment).
* `GET /reports/stock-adjustments` — riwayat opname & saldo awal.
* `GET /reports/profit-loss` — laba rugi (omset, HPP, diskon, pajak, laba kotor) per periode.

Contoh response (`format=json`) untuk `/reports/sales`:

``` json
{
  "success": true,
  "data": {
    "filters": { "from": "2026-08-01", "to": "2026-08-27" },
    "rows": [
      { "invoice_number": "INV-POS-20260827-0015", "date": "2026-08-27", "sku": "HJB-VOL-BLK-OS", "qty": 5, "subtotal": 245000, "discount_amount": 24500, "ppn_amount": 24255, "pph_amount": 1102.5, "grand_total": 243652.5 }
    ],
    "totals": { "subtotal": 245000, "discount_amount": 24500, "ppn_amount": 24255, "pph_amount": 1102.5, "grand_total": 243652.5 }
  }
}
```

---

## 8. Settings

### GET `/settings`

* Response: seluruh isi `system_settings` (costing method, default tax, threshold, profil bisnis) dalam snake_case.

### PUT `/settings`

* Headers: Authorization: Bearer `<token>` (Role: OWNER)
* Request:

``` json
{
  "costing_method": "FIFO",
  "default_ppn_tax_id": "uuid-tax-ppn-1",
  "default_pph_tax_id": null,
  "slow_moving_threshold_days": 45,
  "dead_stock_threshold_days": 90,
  "business_name": "Popyshop",
  "receipt_footer_note": "Terima kasih sudah belanja di Popyshop!"
}
```

---

## 9. Analytics & Inventory Velocity

### GET `/analytics/inventory-velocity`

* Query Parameters: `?slow_threshold_days=45&dead_threshold_days=90`
* Response (200 OK):

``` json
{
  "success": true,
  "data": {
    "fast_moving": [
      { "sku": "HJB-VOL-BLK-OS", "sold_qty": 120, "turnover_days": 8 }
    ],
    "slow_moving": [
      { "sku": "GMS-SLK-MRN-XXL", "stock_qty": 15, "last_sold_at": "2026-06-10T00:00:00Z", "idle_days": 52 }
    ],
    "dead_stock": [
      { "sku": "GMS-SLK-ROSE-S", "stock_qty": 30, "last_sold_at": null, "idle_days": 110 }
    ]
  }
}
```
