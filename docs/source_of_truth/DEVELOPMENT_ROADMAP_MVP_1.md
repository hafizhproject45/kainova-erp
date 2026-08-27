# DEVELOPMENT_ROADMAP_MVP_1.md - KaiNova ERP

> **Legend status:** `[x]` Selesai & teruji · `[~]` Sebagian/berjalan tapi belum lengkap · `[ ]` Belum dikerjakan.
> Update terakhir: 2026-08-27, setelah backend Phase 1–3 + frontend 7 modul selesai di-scaffold dan diverifikasi end-to-end (login → master data → PO → terima barang → checkout POS dgn diskon & pajak). Lihat `README.md` untuk cara menjalankan.

## Phase 1: Core Foundation & Master Data (Sprint 1)

Goal: Membangun fondasi sistem KaiNova, autentikasi, RBAC, Settings dasar, dan seluruh Master Data yang dibutuhkan modul transaksi berikutnya.

* [x] Setup repositori Bun + ElysiaJS + Drizzle ORM + PostgreSQL. *(`backend/`, terverifikasi jalan)*
* [x] Implementasi skema database dasar & RBAC middleware (OWNER, GUDANG, KASIR). *(JWT + role guard di `authPlugin`)*
* [x] Modul Settings: costing method (FIFO/Average), profil bisnis, threshold slow/dead stock, pajak default. *(CRUD backend + halaman Settings frontend; toggle AVERAGE ada di UI tapi logic-nya belum jalan — lihat Phase 2)*
* [x] Modul Master Data: Kategori, Parent Product & Matrix Variant SKU Generator. *(backend + frontend, generator SKU masih versi sederhana — `TODO` di kode)*
* [x] Modul Master Data: Customer, Supplier. *(backend + frontend)*
* [x] Modul Master Data: Pajak (PPN/PPh) & Diskon (persentase/nominal). *(backend + frontend)*
* [~] Svelte UI: halaman CRUD Master Data (tabel + search + filter) untuk seluruh entitas di atas. *(Create + List + Edit + Delete sudah jalan untuk Kategori, Supplier, Customer, Pajak, Diskon, dan sekarang juga Produk (`PUT`/`DELETE /products/:id`, cascade soft-delete ke varian) & Varian SKU (`PUT`/`DELETE /product-variants/:id`, panel "Lihat SKU" expand per baris produk di tab Produk & SKU) — backend diverifikasi end-to-end lewat `curl` (update, delete varian tunggal, delete produk cascade ke sisa varian, variant/product yang sudah dihapus tidak lagi muncul di listing). `product_variants` sekarang punya kolom `deleted_at` (migration `0002_optimal_vivisector.sql`, sudah diterapkan) dan query ROP alert di dashboard sudah difilter supaya varian terhapus tidak ikut muncul. `typecheck`/`svelte-check` bersih. Belum ada search/filter tabel di semua tab — itu masih sisa pekerjaan.)*

## Phase 2: Pembelian & Adjustment Stok (Sprint 2)

Goal: Menyelesaikan alur pengadaan barang dari supplier serta modul adjustment stok untuk stock opname dan input saldo awal saat KaiNova pertama kali digunakan.

* [x] Modul Pembelian: Purchase Order ke Supplier & Penerimaan Barang (Goods Receipt) → mengisi `inventory_batches`. *(backend + frontend, teruji end-to-end; dibungkus `db.transaction()`; bug `total_stock` yang sebelumnya overwrite alih-alih increment sudah diperbaiki jadi increment)*
* [x] Modul Adjustment Stok: form Saldo Awal (Opening Balance) untuk migrasi stok existing ke sistem. *(backend + frontend)*
* [x] Modul Adjustment Stok: form Stock Opname (input qty fisik → sistem hitung selisih otomatis) dengan alur `DRAFT` → `POSTED`. *(backend + frontend, teruji; posting dibungkus `db.transaction()`; bug `total_stock` yang sebelumnya tidak pernah disinkronkan saat posting sudah diperbaiki)*
* [x] Dynamic Costing Engine: Implementasi Batching FIFO Tracker & Moving Average pada penerimaan barang dan posting adjustment. *(FIFO & AVERAGE keduanya jalan & teruji — termasuk verifikasi bahwa checkout benar memakai `avg_cost` weighted-average, bukan diam-diam fallback ke harga batch FIFO pertama, saat `costing_method = AVERAGE`. Batch tetap dipotong FIFO untuk ledger `remaining_qty` di kedua mode; yang beda cuma sumber HPP-nya.)*
* [x] Svelte UI: Interface Gudang untuk PO, Penerimaan Barang, dan Stock Opname.

## Phase 3: Penjualan / POS Engine dengan Diskon & Pajak (Sprint 3)

Goal: Menyelesaikan modul transaksi kasir Popyshop lengkap dengan pilihan diskon dan pajak (PPN/PPh) saat checkout.

* [x] API Checkout POS: kalkulasi Subtotal → Diskon Per-Item → Diskon Keseluruhan → DPP → PPN (+) / PPh (−) → Grand Total. *(teruji end-to-end lewat browser, hasil kalkulasi terverifikasi manual sesuai `PRODUCT_KNOWLEDGE.md` §4; seluruh alur dibungkus `db.transaction()` — rollback sudah diverifikasi: kalau item ke-2 di keranjang gagal karena stok kurang, potongan stok item ke-1 yang sudah sempat jalan ikut di-rollback, bukan korup permanen)*
* [x] Snapshot nama/tipe/rate diskon & pajak ke `sales_orders`/`sales_order_items` agar histori transaksi tidak berubah jika master data diedit.
* [x] Invoice numbering atomik per channel+tanggal (`INV-{CHANNEL}-{YYYYMMDD}-{SEQ}`), teruji. *(item tambahan di luar draft roadmap awal, sudah selesai)*
* [x] Pencatatan channel penjualan (POS toko fisik / marketplace) sebagai tag di `sales_orders.channel` — bukan integrasi API real ke Shopee/Tokopedia/TikTok (di luar scope MVP).
* [x] Pemotongan stok real-time sesuai mode costing aktif (FIFO/Average) dari Settings. *(kedua mode jalan & teruji)*
* [~] Svelte UI: Interface Kasir POS (Cart Management, pilih Customer opsional, pilih Diskon & Pajak dari dropdown master data). *(sudah jalan & teruji end-to-end; **belum ada scan barcode** dan **belum ada cetak struk/print receipt** — endpoint `/sales/:id/receipt` backend juga masih placeholder data mentah, belum format HTML/PDF siap cetak)*

## Phase 4: Dashboard & Laporan (Sprint 4)

Goal: Menyajikan dashboard ringkasan harian dan laporan bisnis KaiNova yang bisa difilter, diprint, dan diexport.

* [x] Modul Dashboard: omset & transaksi hari ini, laba kotor, alert stok kritis (ROP). *(laba kotor = DPP hari ini − HPP hari ini, teruji cocok dengan Laporan Laba Rugi; alert stok kritis sekarang pakai rumus ROP asli `PRODUCT_KNOWLEDGE.md` §7A — butuh 2 kolom baru di `product_variants`: `lead_time_days` (default 7) & `safety_stock` (default 0), migration sudah dibuat & diterapkan.)*
* [x] Modul Laporan: Penjualan, Pembelian, Stok, Adjustment Stok, Laba Rugi — masing-masing dengan filter tanggal/kategori/channel/customer/supplier. *(query nyata sudah jalan & teruji dengan data asli — termasuk filter `invoice_number`, `category_id`, `from`/`to` — untuk kelima laporan; Laba Rugi menghitung `gross_profit = dpp - cost_of_goods` per hari. Sempat ketemu & diperbaiki bug: correlated subquery HPP di dalam `GROUP BY` mengambil baris yang salah karena ambigu di PostgreSQL — sekarang dipisah jadi 2 query lalu digabung di JS.)*
* [x] Export Laporan ke PDF & Excel, serta tampilan siap-print (print-friendly view) di browser. *(Print via `window.print()`. Export PDF (`pdfkit`) & Excel (`exceljs`) sudah jalan untuk kelima laporan — diverifikasi file asli terdownload dengan `Content-Type`/`Content-Disposition` benar, isi tabel & totals cocok dengan data JSON. Frontend: tombol Export mengambil file via `fetch` + Bearer token lalu trigger download blob.)*
* [x] Modul Inventory Velocity (Fast-Moving, Slow-Moving >45 Hari, Dead Stock >90 Hari) & Re-order Point (ROP) Alert. *(diverifikasi dgn data nyata; **catatan penting**: klasifikasi dihitung dari agregat lifetime per SKU — total diterima vs total terjual sejak SKU dibuat — bukan pelacakan per-batch FIFO presisi. Cukup untuk kategorisasi Fast/Slow/Dead-Moving MVP; pelacakan per-batch bisa jadi enhancement lanjutan kalau dibutuhkan presisi lebih detail.)*
* [~] Svelte UI: Dashboard Executive Analytics (Mobile & Desktop Responsive) + halaman Laporan dengan tombol Print/Export. *(layout dasar sudah responsif via Tailwind, tapi belum ditest eksplisit di viewport tablet/mobile; visualisasi KPI masih tabel/angka polos, belum ada chart)*

## Belum Ada di Roadmap Awal (Ditemukan Selama Development)

* [ ] Integration test otomatis — **belum ada test sama sekali** (unit maupun integration). Semua verifikasi sejauh ini manual lewat `curl`/browser.
* [x] `db.transaction()` di alur `checkout`, `purchase-orders/:id/receive`, dan `stock-adjustments/:id/post` — selesai & diverifikasi manual (termasuk skenario rollback: keranjang 2 item, item ke-2 gagal karena stok kurang → potongan stok item ke-1 ikut dibatalkan).
* [x] Fix bug: `onError` handler backend sempat menelan error validasi Elysia jadi generic 500 — sudah diperbaiki agar mengembalikan 422 dengan pesan jelas.
* [x] Fix bug: `product_variants.total_stock` di `purchase-orders/:id/receive` sebelumnya **overwrite** (`= qty`) alih-alih **increment** (`+= qty`) — kalau ada PO kedua untuk variant yang sama, stok lama akan tertimpa. Sudah diperbaiki.
* [x] Fix bug: `product_variants.total_stock` **tidak pernah disinkronkan** saat posting `stock-adjustments` — dashboard/POS akan menampilkan stok basi setelah stock opname. Sudah diperbaiki (increment/decrement sesuai `differenceQty`).

## Definition of Done (DoD)

1. [ ] Seluruh kode backend teruji melalui integration test pada skenario pemotongan stok FIFO/Average, termasuk dari jalur Pembelian, Penjualan, maupun Adjustment Stok. *(belum — belum ada test otomatis sama sekali)*
2. [~] Tidak ada selisih perhitungan antara jumlah HPP transaksi dengan stok batch yang tersisa. *(logic FIFO sudah benar & diverifikasi manual, termasuk skenario rollback saat checkout multi-item gagal di tengah jalan; belum ada test otomatis yang menjamin ini terus benar seiring perubahan kode ke depan)*
3. [~] Kalkulasi diskon & pajak di checkout POS teruji untuk kombinasi: tanpa diskon/pajak sama sekali; hanya diskon per-item; hanya diskon keseluruhan; diskon per-item + keseluruhan bersamaan; hanya PPN; hanya PPh; serta PPN dan PPh bersamaan. *(baru 1 kombinasi — diskon item + keseluruhan + PPN + PPh sekaligus — yang diverifikasi manual end-to-end; kombinasi lain belum ditest eksplisit)*
4. [x] Adjustment stok (opname & saldo awal) tidak bisa mengubah stok tanpa melalui status `POSTED`, dan setiap adjustment tercatat dengan `reason` yang jelas untuk audit trail.
5. [x] Semua laporan bisa difilter, ditampilkan dalam format print-friendly, dan diexport ke PDF & Excel tanpa selisih angka terhadap data mentah. *(filter, print, export PDF & Excel semua sudah jalan & teruji dengan angka yang cocok terhadap data mentah)*
6. [~] Tampilan UI Svelte responsif diakses via perangkat tablet/laptop toko fisik Popyshop maupun mobile browser. *(dibangun dengan Tailwind/flex-grid yang pada dasarnya responsif, tapi belum divalidasi eksplisit di device/viewport tablet & mobile)*
