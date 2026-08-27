# TECH_KNOWLEDGE.md - KaiNova ERP

## 1. Tech Stack Overview

* **Frontend:** Svelte (SPA / Web Responsive)
* **Backend Runtime:** Bun
* **Web Framework:** ElysiaJS
* **ORM:** Drizzle ORM
* **Database:** PostgreSQL
* **API Protocol:** RESTful JSON API

---

## 2. Architecture & Code Structure (Modular Monolith)

Repositori KaiNova ERP adalah satu repo (monorepo sederhana, bukan workspaces) berisi dua folder top-level terpisah: `backend/` dan `frontend/`, masing-masing dengan `package.json` sendiri dan dijalankan sebagai proses independen (lihat `README.md` untuk cara menjalankan keduanya).

```text
kainova/
├── backend/            # Bun + ElysiaJS + Drizzle ORM + PostgreSQL
├── frontend/           # Vite + Svelte 5 + Tailwind CSS (SPA)
└── docs/
    └── source_of_truth/
```

Struktur `backend/` mengadopsi pola Clean Architecture yang termodularisasi:

```text
backend/
├── src/
│   ├── config/             # Environment, Database, & Costing Engine Settings
│   ├── db/
│   │   ├── schema/         # Drizzle Schema Definitions
│   │   ├── migrations/     # SQL Migration Files
│   │   └── seed.ts         # Seed data awal (user OWNER + default settings)
│   ├── modules/
│   │   ├── auth/               # JWT & RBAC Middleware
│   │   ├── master-data/        # Customer, Supplier, Tax, Discount, Category
│   │   ├── products/           # Parent Product, Variants, & SKU Matrix
│   │   ├── purchasing/         # Purchase Order & Goods Receipt
│   │   ├── inventory/          # Inventory Batches, Stock Adjustment, FIFO/Average Logics
│   │   ├── sales/              # POS Checkout, Multi-Channel Orders, Receipt
│   │   ├── dashboard/          # Ringkasan KPI harian
│   │   ├── reports/            # Laporan (filter, print, export PDF/Excel)
│   │   ├── settings/           # System Settings (costing method, pajak default, dst.)
│   │   └── analytics/          # Slow-Moving, Fast-Moving, Inventory Velocity
│   ├── utils/              # Helper, Logger, Error Handling
│   └── index.ts            # Elysia App Entrypoint
├── drizzle.config.ts
├── package.json
└── .env.example
```

Struktur `frontend/` (SPA Svelte, mengonsumsi REST API `backend/` lewat proxy `/v1/*` saat development):

```text
frontend/
├── src/
│   ├── lib/
│   │   ├── api.ts          # HTTP client + konversi camelCase<->snake_case
│   │   ├── stores/auth.ts  # State login (token & user), persist ke localStorage
│   │   └── Layout.svelte   # Sidebar navigasi & topbar
│   ├── routes/             # 1 file per modul (Dashboard, MasterData, Pos,
│   │                       # Purchasing, StockAdjustment, Reports, Settings, Login)
│   ├── App.svelte          # Router (svelte-spa-router) + auth guard
│   └── main.ts             # Entrypoint
├── vite.config.ts
└── package.json
```

## 3. Database Conventions & Drizzle Setup

* Naming Convention: snake_case untuk tabel dan kolom database, camelCase untuk properti Drizzle & JavaScript/TypeScript internal (service/repository layer).
* **Naming Convention API Boundary:** Seluruh payload JSON yang keluar-masuk lewat REST API (request body, query param, response body) menggunakan **snake_case**, terlepas dari properti internal yang camelCase. Konversi dilakukan di lapisan controller/serializer Elysia (misal via `t.Transform` pada schema Elysia, atau helper `toSnakeCase`/`toCamelCase` generik di `utils/`) — bukan dengan mengganti nama properti Drizzle/TypeScript itu sendiri. Lihat `API_SPECIFICATION.md` untuk contoh payload snake_case.
* Primary Key: UUID v4 (gen_random_uuid()).
* Timestamps: Selalu sertakan created_at dan updated_at (dengan UTC timezone).
* Soft Deletes: Gunakan kolom deleted_at (timestamp, nullable) daripada menghapus baris secara fisik dari database.

## 4. Costing Engine Implementation Rules

* Konfigurasi metode costing disimpan pada tabel system_settings (costing_method: 'FIFO' | 'AVERAGE').
* Pada mode FIFO, setiap penerimaan produk (Purchase Order) **maupun** setiap adjustment stok dengan selisih positif (Stock Opname/Saldo Awal) membuat record baru di tabel inventory_batches. Penjualan dan adjustment dengan selisih negatif akan memotong saldo remaining_quantity pada batch tertua terlebih dahulu.
* Pada mode AVERAGE, kolom avg_cost pada product_variants diperbarui otomatis menggunakan transaksi database (atomic transaction) setiap kali penerimaan barang atau adjustment stok positif diposting.
* Adjustment stok wajib berstatus `POSTED` sebelum memengaruhi `inventory_batches` — status `DRAFT` tidak mengubah stok sama sekali (lihat `PRODUCT_KNOWLEDGE.md` §6).

## 5. Error Handling & API Response Standard

Semua response API harus mengembalikan format konsisten:

```json
{
  "success": true,
  "message": "Deskripsi respon",
  "data": {},
  "errors": null
}
```

HTTP Status Codes:

* 200 OK / 201 Created: Berhasil.
* 400 Bad Request: Validation failure.
* 401 Unauthorized: Token invalid / expired.
* 403 Forbidden: RBAC role tidak memiliki hak akses.
* 422 Unprocessable Entity: Business logic error (misal: stok tidak * mencukupi).
* 500 Internal Server Error: Server/Database error.
