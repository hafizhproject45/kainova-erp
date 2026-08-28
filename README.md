# KaiNova ERP

ERP untuk bisnis fashion Popyshop (Baju & Kerudung) — Buying-Selling multi-channel (POS toko fisik, Shopee/Tokopedia/TikTok, WA/Web).

Dokumen desain lengkap ada di [`docs/source_of_truth/`](docs/source_of_truth/):
`CONTEXT.md`, `PRODUCT_KNOWLEDGE.md`, `DESIGN.md`, `API_SPECIFICATION.md`, `TECH_KNOWLEDGE.md`, `DEVELOPMENT_ROADMAP.md`.

## Tech Stack

* **Backend:** Bun + ElysiaJS + Drizzle ORM + PostgreSQL — lihat [`backend/`](backend/).
* **Frontend:** Vite + Svelte 5 + TypeScript + Tailwind CSS — lihat [`frontend/`](frontend/).

Konvensi lengkap ada di `docs/source_of_truth/TECH_KNOWLEDGE.md`.

## Struktur Repo

```text
kainova/
├── backend/          # API Bun + ElysiaJS + Drizzle ORM + PostgreSQL
├── frontend/         # SPA Vite + Svelte 5 + Tailwind CSS
└── docs/
    └── source_of_truth/   # Dokumen spesifikasi (CONTEXT, PRODUCT_KNOWLEDGE, DESIGN, API_SPECIFICATION, TECH_KNOWLEDGE, DEVELOPMENT_ROADMAP)
```

## Setup Lokal

### 1. Backend

```bash
cd backend
bun install
```

Siapkan PostgreSQL (contoh database lokal):

```bash
createdb kainova_erp
```

Copy environment variables:

```bash
cp .env.example .env
```

Sesuaikan `DATABASE_URL` dan ganti `JWT_SECRET` dengan string acak.

Jalankan migration & seed data awal:

```bash
bun run db:migrate   # bikin semua tabel dari migration file yang tervisi
bun run db:seed      # 1 user OWNER + default settings
```

Login pertama: `username: owner`, `password: popyshop123` — **ganti setelah login pertama**.

Jalankan server dev:

```bash
bun run dev
```

API berjalan di `http://localhost:3000`, base path `/v1` (mengikuti `API_SPECIFICATION.md`). Dokumentasi Swagger otomatis di `http://localhost:3000/docs`. Health check: `GET /health`.

> Alternatif untuk development cepat tanpa migration file: `bun run db:push` (langsung sync schema ke DB, interaktif — butuh TTY).

### 2. Frontend

Di terminal terpisah (backend harus sudah jalan di port 3000):

```bash
cd frontend
bun install
bun run dev
```

Buka `http://localhost:5173` di browser. Request ke `/v1/*` otomatis di-proxy ke backend (lihat `frontend/vite.config.ts`).

## Status Implementasi

**Backend** — sudah jalan penuh (CRUD nyata ke database):

- Auth (`/auth/login`) + RBAC middleware (`OWNER`/`GUDANG`/`KASIR`)
- Master Data: Kategori, Produk & Matrix SKU, Supplier, Customer, Pajak, Diskon
- Pembelian: buat PO & penerimaan barang (FIFO batch dasar)
- Adjustment Stok: draft → post (opname & saldo awal), potong FIFO utk selisih minus
- Penjualan/POS: checkout dgn diskon per-item + keseluruhan, PPN (menambah) & PPh (mengurangi), generate `invoice_number` atomik, potong stok FIFO
- Settings (single-row `system_settings`)

Masih **stub/TODO** di backend (ditandai komentar `TODO` di kode, dikerjakan sesuai `DEVELOPMENT_ROADMAP.md` Phase 3–4):

- Dashboard: `grossProfitToday` & ROP alert yang presisi
- Laporan (`/reports/*`): query filter nyata + export PDF/Excel
- Analytics: Inventory Velocity Engine (fast/slow/dead stock)
- Mode costing AVERAGE (baru FIFO yang diimplementasikan)
- Transaksi database (`db.transaction()`) yang membungkus checkout/receive/post agar atomik penuh

**Frontend** — semua 7 modul punya halaman fungsional yang terhubung ke backend (Dashboard, Master Data, Penjualan/POS, Pembelian, Adjustment Stok, Laporan, Settings). Sudah diverifikasi end-to-end: login → checkout POS dgn diskon & pajak → stok berkurang FIFO. Laporan masih menampilkan placeholder karena endpoint `/reports/*` backend belum final.

## Repositori

Repo: `github.com/hafizhproject45/kainova-erp` (dikelola manual oleh pemilik proyek — git init, commit, dan push dilakukan di luar sesi AI).
