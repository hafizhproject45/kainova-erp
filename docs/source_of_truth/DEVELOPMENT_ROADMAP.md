# DEVELOPMENT_ROADMAP.md - KaiNova ERP

## Phase 1: Core Foundation & Master Data (Sprint 1)

Goal: Membangun fondasi sistem KaiNova, autentikasi, RBAC, Settings dasar, dan seluruh Master Data yang dibutuhkan modul transaksi berikutnya.

* [ ] Setup repositori Bun + ElysiaJS + Drizzle ORM + PostgreSQL.
* [ ] Implementasi skema database dasar & RBAC middleware (OWNER, GUDANG, KASIR).
* [ ] Modul Settings: costing method (FIFO/Average), profil bisnis, threshold slow/dead stock, pajak default.
* [ ] Modul Master Data: Kategori, Parent Product & Matrix Variant SKU Generator.
* [ ] Modul Master Data: Customer, Supplier.
* [ ] Modul Master Data: Pajak (PPN/PPh) & Diskon (persentase/nominal).
* [ ] Svelte UI: halaman CRUD Master Data (tabel + search + filter) untuk seluruh entitas di atas.

## Phase 2: Pembelian & Adjustment Stok (Sprint 2)

Goal: Menyelesaikan alur pengadaan barang dari supplier serta modul adjustment stok untuk stock opname dan input saldo awal saat KaiNova pertama kali digunakan.

* [ ] Modul Pembelian: Purchase Order ke Supplier & Penerimaan Barang (Goods Receipt) → mengisi `inventory_batches`.
* [ ] Modul Adjustment Stok: form Saldo Awal (Opening Balance) untuk migrasi stok existing ke sistem.
* [ ] Modul Adjustment Stok: form Stock Opname (input qty fisik → sistem hitung selisih otomatis) dengan alur `DRAFT` → `POSTED`.
* [ ] Dynamic Costing Engine: Implementasi Batching FIFO Tracker & Moving Average pada penerimaan barang dan posting adjustment.
* [ ] Svelte UI: Interface Gudang untuk PO, Penerimaan Barang, dan Stock Opname.

## Phase 3: Penjualan / POS Engine dengan Diskon & Pajak (Sprint 3)

Goal: Menyelesaikan modul transaksi kasir Popyshop lengkap dengan pilihan diskon dan pajak (PPN/PPh) saat checkout.

* [ ] API Checkout POS: kalkulasi Subtotal → Diskon (opsional, dipilih kasir) → DPP → Pajak (opsional, dipilih kasir) → Grand Total.
* [ ] Snapshot nama/tipe/rate diskon & pajak ke `sales_orders` agar histori transaksi tidak berubah jika master data diedit.
* [ ] Integrasi Multi-Channel Sales Recording (POS toko fisik & channel online).
* [ ] Pemotongan stok real-time sesuai mode costing aktif (FIFO/Average) dari Settings.
* [ ] Svelte UI: Interface Kasir POS (Scan Barcode, Cart Management, pilih Customer opsional, pilih Diskon & Pajak dari dropdown master data, Print Receipt).

## Phase 4: Dashboard & Laporan (Sprint 4)

Goal: Menyajikan dashboard ringkasan harian dan laporan bisnis KaiNova yang bisa difilter, diprint, dan diexport.

* [ ] Modul Dashboard: omset & transaksi hari ini, laba kotor, alert stok kritis (ROP).
* [ ] Modul Laporan: Penjualan, Pembelian, Stok, Adjustment Stok, Laba Rugi — masing-masing dengan filter tanggal/kategori/channel/customer/supplier.
* [ ] Export Laporan ke PDF & Excel, serta tampilan siap-print (print-friendly view) di browser.
* [ ] Modul Inventory Velocity (Fast-Moving, Slow-Moving >45 Hari, Dead Stock >90 Hari) & Re-order Point (ROP) Alert.
* [ ] Svelte UI: Dashboard Executive Analytics (Mobile & Desktop Responsive) + halaman Laporan dengan tombol Print/Export.

## Definition of Done (DoD)

1. Seluruh kode backend teruji melalui integration test pada skenario pemotongan stok FIFO/Average, termasuk dari jalur Pembelian, Penjualan, maupun Adjustment Stok.
2. Tidak ada selisih perhitungan antara jumlah HPP transaksi dengan stok batch yang tersisa.
3. Kalkulasi diskon & pajak di checkout POS teruji untuk kombinasi: tanpa diskon/pajak sama sekali; hanya diskon per-item; hanya diskon keseluruhan; diskon per-item + keseluruhan bersamaan; hanya PPN; hanya PPh; serta PPN dan PPh bersamaan — dengan PPN selalu menambah dan PPh selalu mengurangi `grandTotal`.
4. Adjustment stok (opname & saldo awal) tidak bisa mengubah stok tanpa melalui status `POSTED`, dan setiap adjustment tercatat dengan `reason` yang jelas untuk audit trail.
5. Semua laporan bisa difilter, ditampilkan dalam format print-friendly, dan diexport ke PDF & Excel tanpa selisih angka terhadap data mentah.
6. Tampilan UI Svelte responsif diakses via perangkat tablet/laptop toko fisik Popyshop maupun mobile browser.
