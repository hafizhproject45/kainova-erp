# KaiNova ERP

ERP untuk bisnis fashion Popyshop (Baju & Kerudung) — Buying-Selling multi-channel (POS toko fisik, Shopee/Tokopedia/TikTok, WA/Web).

Dokumen desain lengkap ada di [`docs/source_of_truth/`](docs/source_of_truth/):
`CONTEXT.md`, `PRODUCT_KNOWLEDGE.md`, `DESIGN.md`, `API_SPECIFICATION.md`, `TECH_KNOWLEDGE.md`, `DEVELOPMENT_ROADMAP.md`.

## Tech Stack

Bun + ElysiaJS + Drizzle ORM + PostgreSQL. Lihat `docs/source_of_truth/TECH_KNOWLEDGE.md` untuk konvensi lengkap.

## Setup Lokal

1. **Install dependencies**

   ```bash
   bun install
   ```

2. **Siapkan PostgreSQL** (contoh pakai database lokal):

   ```bash
   createdb kainova_erp
   ```

3. **Copy environment variables**

   ```bash
   cp .env.example .env
   ```

   Sesuaikan `DATABASE_URL` dan ganti `JWT_SECRET` dengan string acak.

4. **Push schema ke database** (untuk development; pakai `db:generate` + `db:migrate` untuk migration file yang tervisi):

   ```bash
   bun run db:push
   ```

5. **Seed data awal** (1 user OWNER + default settings):

   ```bash
   bun run db:seed
   ```

   Login pertama: `username: owner`, `password: popyshop123` — **ganti setelah login pertama**.

6. **Jalankan server dev**

   ```bash
   bun run dev
   ```

   API berjalan di `http://localhost:3000`, base path `/v1` (mengikuti `API_SPECIFICATION.md`). Dokumentasi Swagger otomatis di `http://localhost:3000/docs`. Health check: `GET /health`.

## Struktur Folder

Lihat `docs/source_of_truth/TECH_KNOWLEDGE.md` §2. Ringkasnya:

```text
src/
├── config/       # env & drizzle client
├── db/
│   ├── schema/   # Drizzle table definitions (master-data, operations, sales, settings, users)
│   ├── migrations/
│   └── seed.ts
├── modules/      # 1 folder per domain modul (auth, master-data, products, purchasing,
│                 # inventory, sales, dashboard, reports, settings, analytics)
├── utils/        # response envelope, snake_case<->camelCase, error classes
└── index.ts      # entrypoint Elysia
```

## Status Implementasi (boilerplate awal)

Sudah jalan penuh (CRUD nyata ke database):

- Auth (`/auth/login`) + RBAC middleware (`OWNER`/`GUDANG`/`KASIR`)
- Master Data: Kategori, Produk & Matrix SKU, Supplier, Customer, Pajak, Diskon
- Pembelian: buat PO & penerimaan barang (FIFO batch dasar)
- Adjustment Stok: draft → post (opname & saldo awal), potong FIFO utk selisih minus
- Penjualan/POS: checkout dgn diskon per-item + keseluruhan, PPN (menambah) & PPh (mengurangi), generate `invoice_number` atomik, potong stok FIFO
- Settings (single-row `system_settings`)

Masih **stub/TODO** (ditandai komentar `TODO` di kode, dikerjakan sesuai `DEVELOPMENT_ROADMAP.md` Phase 3–4):

- Dashboard: `grossProfitToday` & ROP alert yang presisi
- Laporan (`/reports/*`): query filter nyata + export PDF/Excel
- Analytics: Inventory Velocity Engine (fast/slow/dead stock)
- Mode costing AVERAGE (baru FIFO yang diimplementasikan)
- Transaksi database (`db.transaction()`) yang membungkus checkout/receive/post agar atomik penuh

## Git & GitHub

**Belum di-init di sesi ini** — silakan jalankan `git init`, buat repo GitHub, dan push secara manual sesuai preferensi Anda. `.gitignore` sudah disiapkan (`node_modules/`, `.env`, `dist/`, dll.).
