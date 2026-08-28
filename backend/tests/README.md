# Integration Tests

Ditulis dengan `bun:test`, memukul server Elysia **asli** lewat HTTP (`fetch`),
bukan memanggil handler langsung — jadi mengetes exact path yang dipakai user
sungguhan (auth, validasi Elysia, `db.transaction()`, dst).

## Setup (sekali saja)

1. Buat database test terpisah dari dev, supaya data test tidak numpuk/mengotori
   data dev, dan supaya tidak bentrok kalau server dev sedang jalan:

   ```bash
   createdb kainova_erp_test
   # atau: psql -c "CREATE DATABASE kainova_erp_test;"
   ```

2. Copy env template dan terapkan migration + seed ke database test:

   ```bash
   cp .env.test.example .env.test
   DATABASE_URL=postgres://kainova:kainova@localhost:5432/kainova_erp_test bun run db:migrate
   DATABASE_URL=postgres://kainova:kainova@localhost:5432/kainova_erp_test bun run db:seed
   ```

   `db:seed` membuat user `owner` / `popyshop123` yang dipakai `loginOwner()` di
   `helpers.ts`.

## Menjalankan

```bash
bun run test
```

Ini boot server asli di port terpisah (`PORT=3099` dari `.env.test`, beda dari
dev `3000`) dan database terpisah (`kainova_erp_test`), jadi **aman dijalankan
bahkan saat server dev sedang jalan**.

`tests/helpers.ts` punya guard runtime yang menolak jalan kalau `DATABASE_URL`
tidak mengandung `_test` — mencegah salah pencet dan tanpa sengaja menulis ke
database dev.

## Cakupan saat ini

- `checkout.test.ts` — DoD #3: 8 kombinasi diskon/pajak checkout POS (tanpa
  apa-apa; diskon item saja; diskon keseluruhan saja; keduanya; PPN saja; PPh
  saja; PPN+PPh; dan semua sekaligus), tiap kombinasi diverifikasi angka
  Subtotal → Diskon Item → Diskon Keseluruhan → DPP → PPN/PPh → Grand Total.
- `costing.test.ts` — DoD #1 & #2:
  - FIFO: batch tertua dipotong duluan, HPP dari harga tiap batch yang dipotong.
  - Average: HPP dari `avg_cost` weighted-average (bukan diam-diam fallback ke
    harga batch FIFO pertama), batch tetap dipotong FIFO untuk ledger
    `remaining_qty`.
  - Rollback: checkout 2 item, item ke-2 gagal karena stok kurang → potongan
    stok item ke-1 yang sudah sempat jalan ikut dibatalkan (bukan korup
    permanen).
- `adjustments.test.ts` — DoD #1 (jalur Adjustment Stok) & #4 (stok tidak
  berubah tanpa status `POSTED`): Stock Opname surplus (batch baru + rehitung
  `avg_cost`) dan defisit (potong FIFO dari batch tertua, `avg_cost` tetap),
  serta double-post ditolak.

## Yang belum dites otomatis

- Modul Pembelian/Adjustment di luar jalur costing (misal validasi role, list
  filter).
- Reports/export (masih diverifikasi manual, lihat roadmap).
- Frontend (Svelte) — tidak ada test otomatis, verifikasi manual lewat browser.
