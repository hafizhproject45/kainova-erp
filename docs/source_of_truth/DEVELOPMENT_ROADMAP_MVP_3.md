# DEVELOPMENT_ROADMAP_MVP_3.md - KaiNova ERP

> **Legend status:** `[x]` Selesai & teruji · `[~]` Sebagian/berjalan tapi belum lengkap · `[ ]` Belum dikerjakan.
> Update terakhir: 2026-08-28 — Spesifikasi MVP 3: Interactive Dashboard, Master Data Structure (Sidebar Sub-Menus, Varian Matrix, Relasi Supplier), Standardisasi Toggle is_active, Alur 4-Step Procurement (PR to PO) dengan Stepper & Edit Kontekstual, Module Inventory & Stock Ledger, Dedicated Reporting Sub-Modules, Variant Repeater Engine, serta Enterprise System Settings.

---

## 💡 Fokus Utama MVP 3

MVP 3 berfokus pada **Interactive Visual Dashboard, Pembaruan Struktur Navigation Master Data, Standardisasi Kontrol Keaktifan Data, Matrix Variant Engine, Procurement Enterprise Flow (PR to PO), Restrukturisasi Module Inventory & Stock Ledger, Dedicated Reporting Sub-Modules, & Enterprise System Administration**:

* **Interactive Visual Dashboard:** Peningkatan antarmuka Dashboard dengan grafik **Line Chart** (tren penjualan) dan **Pie/Donut Chart** (kategori/produk terlaris & metode pembayaran) yang interaktif (mendukung aksi *hover* & *tap* untuk detail angka nominal).
* **Restrukturisasi Navigation Master Data:** Mengubah daftar Master Data menjadi **Sub-Menu Sidebar Dedicated** (bukan berbasis tab/dropdown tunggal) serta menambahkan **Relasi Supplier** pada Master Data Produk/SKU.
* **Standardisasi Toggle `is_active` (8 Master Data):** Mengganti seluruh `Select Input` status aktif/non-aktif menjadi komponen **Toggle Switch** (Flowbite Svelte) yang mendukung *Inline Quick Toggle* pada tabel dan penerapan *Strict Filtering* (`is_active = true`) di seluruh modul transaksi.
* **Master Data Varian & Matrix Generator:** Penyederhanaan penamaan sub-menu menjadi **Varian** (`/master-data/variants`) yang dilengkapi dengan fitur *Matrix Generator & Bulk Fill* untuk penetapan kombinasi SKU, harga dasar, dan stok secara instan, serta komponen *Variant Options Repeater* pada penambahan produk.
* **Procurement Enterprise Flow (PR to PO):** Menerapkan alur 4-step pengadaan barang secara lengkap: **1. Pengajuan (PR)** ➔ **2. Persetujuan & Penerbitan PO (oleh Owner)** ➔ **3. Penerimaan Barang (Goods Receipt)** ➔ **4. Selesai (Completed)**, dilengkapi dengan *Horizontal Stepper*, *Vertical Kebab Action Menu*, dan *Contextual Edit*.
* **Restrukturisasi Modul Inventory:** Mengubah nama modul menjadi **Inventory** dengan 2 sub-module utama: **Stok Produk** (memuat *Current Stock Summary* dan *Stock Ledger / Kartu Stok*) serta **Adjustment Stok** (koreksi opname).
* **Dedicated Reporting Sub-Modules:** Mengubah *dropdown select* laporan menjadi **Accordion Sub-Menu Sidebar** dengan 6 laporan esensial (Penjualan & Produk Terlaris, Pembelian per Supplier, Stok & Valuasi Inventaris, Adjustment Stok, Laba Rugi, dan Rekonsiliasi Pembayaran Kasir).
* **Enterprise System Settings & Policy:** Menambahkan pengaturan profil perusahaan, kebijakan inventaris & metode costing HPP (FIFO / Moving Average), matriks hak akses (*Role & Permission Matrix*), kustomisasi struk POS, dan *Auto-Numbering Prefix* untuk seluruh dokumen transaksi.

---

## Phase 1: Interactive Dashboard, Master Data Structure, Global Toggle & Matrix Variant Engine

Goal: Meningkatkan visualisasi interaktif pada Dashboard, merestrukturisasi navigasi Master Data pada Sidebar, mengimplementasikan Toggle Switch `is_active` di seluruh 8 entity Master Data, memperbarui modul Varian dengan Matrix Generator, serta memastikan *Strict Filtering* berlaku pada modul transaksi.

* [x] **Interactive Visual Dashboard Enhancements (`/dashboard`):**
  * [x] Implementation komponen **Line Chart Interaktif**: Visualisasi tren omset penjualan (harian/bulanan) dengan *tooltip hover* / *tap* yang menampilkan detail nilai nominal terformat (`formatRupiah`) — `LineChart.svelte` (native SVG).
  * [x] Implementation komponen **Pie / Donut Chart Interaktif**: Visualisasi proporsi penjualan per Kategori Produk dan Kanal Pembayaran dengan indikator persentase & interaksi sentuh/hover — `DonutChart.svelte`, didukung `salesByCategory`/`salesByPaymentMethod` di `GET /dashboard/summary`.
  * [x] KPI Cards Real-Time: Widget ringkasan Total Penjualan, Laba Kotor, Total PO Bulan Ini, dan Alert Stok Minimum yang terhubung ke backend.
  * [x] **Dashboard Filtering** (`period=today|month|year|custom`): Segmented control Hari Ini/Bulan Ini/Tahun Ini/Custom (date range picker) di atas Dashboard — seluruh KPI Card, Line Chart, Donut Chart, Top 5 Produk, dan Total PO mengikuti satu rentang tanggal yang sama (`GET /dashboard/summary` resolve `[rangeStart, rangeEnd)`); Tren Omset otomatis bucket per-jam (today), per-hari (≤31 hari), atau per-bulan (rentang panjang/tahunan) sehingga chart tetap terbaca (lebar chart dialokasikan per-titik + scroll horizontal, bukan dipepatkan).
  * [x] **Export PDF**: Tombol *Export PDF* men-trigger `window.print()` (pola sama seperti `ReceiptPrint.svelte`) dengan print-only header (judul, periode, waktu cetak); sidebar/header/filter otomatis tersembunyi lewat `print:hidden` saat mencetak.
* [x] **Restrukturisasi Navigation Master Data (Sidebar Routes):**
  * [x] Pisahkan navigasi Master Data dari model tab tunggal menjadi **Accordion/Sub-Menu Dedicated** pada Sidebar:
    * `/master-data/categories` (Kategori)
    * `/master-data/products` (Produk & SKU)
    * `/master-data/variants` (Varian)
    * `/master-data/suppliers` (Supplier)
    * `/master-data/customers` (Customer)
    * `/master-data/taxes` (Pajak)
    * `/master-data/discounts` (Diskon)
    * `/master-data/uoms` (UOM)
  * [x] **Relasi Supplier pada Produk**: Penambahan field pilihan **Default Supplier** (`supplier_id`) pada form Master Data Produk/SKU untuk mempermudah alur pengadaan barang di modul Pembelian (auto-filter produk per supplier di form PO).
* [x] **Standardisasi Component Toggle `is_active`:**
  * [x] Hapus seluruh komponen `AppSelect` (`Aktif` / `Non-Aktif`) pada form Add/Edit Master Data dan ganti dengan **Toggle Switch** berbasis Flowbite Svelte (`AppToggle.svelte`).
  * [x] Kolom status di `<AppTable>` untuk 8 Master Data (*Kategori, Produk & SKU, Varian, Supplier, Customer, Pajak, Diskon, UOM*) ditampilkan sebagai badge **display-only** — perubahan status hanya lewat form Add/Edit (bukan Inline Quick Toggle di tabel, sesuai arahan revisi); `PATCH /:id/status` tetap tersedia di backend untuk kebutuhan API lain.
  * [x] Terapkan backend & frontend *Strict Filtering* (`WHERE is_active = true`) pada form POS, Pembelian, dan Adjustment Stok agar data non-aktif otomatis tersembunyikan dari transaksi baru (`?is_active=true` di seluruh GET terkait).
* [x] **Module Varian & Matrix Generator Engine (`/master-data/variants`):**
  * [x] Penyesuaian nama sub-menu dari "Master Varian" menjadi **Varian** dan URL route ke `/master-data/variants`, kini sebagai sub-menu dedicated Sidebar Accordion (bukan tab).
  * [x] Fitur **Matrix Generator**: Opsi membuat kombinasi varian otomatis (misal: Ukuran `S, M, L` × Warna `Merah, Hitam`) menjadi entitas SKU terpisah secara massal (`VariantMatrixForm.svelte` + `POST /products/:id/variants/matrix`).
  * [x] Fitur **Bulk Fill**: Form pengisian massal untuk harga beli, harga jual, dan stok awal pada seluruh SKU yang dihasilkan oleh Matrix Generator (baked-in di form generator; `POST /product-variants/bulk-fill` tersedia untuk revisi massal lanjutan).

---

## Phase 2: Enterprise Procurement Module (PR to PO Flow) & Interactive UI

Goal: Mengembangkan modul Pembelian tingkat *enterprise* dengan alur 4-step pengadaan (PR ➔ PO ➔ Penerimaan ➔ Selesai), *Stepper* visual, *Vertical Kebab Menu*, dan pencetakan dokumen PR/PO terpisah.

* [x] **Workflow Engine & Status Lifecycle Pembelian:**
  * [x] **Step 1: Pengajuan (PR / Purchase Requisition):** Staf/Kasir/Gudang membuat pengajuan kebutuhan barang (Supplier, Produk/SKU, Qty) tanpa harga pasti ➔ Menghasilkan Dokumen **PR** (`DRAFT_PR`).
  * [x] **Step 2: Persetujuan & Penerbitan PO (Approval & PO Issuance):** Owner meninjau PR, memasukkan harga beli kesepakatan per item, dan menyetujui ➔ Menghasilkan Dokumen **PO Resmi** (`PO_ISSUED`).
  * [x] **Step 3: Penerimaan Barang (Goods Receipt):** Staf Gudang/Owner mencatat fisik barang masuk (bisa bertahap) ➔ Memutakhirkan stok fisik & Moving Average cost ➔ Status (`PARTIALLY_RECEIVED` / `RECEIVED`).
  * [x] **Step 4: Selesai (Completed):** Owner mengunci PO yang sudah `RECEIVED` lengkap ➔ Transaksi dikunci secara permanen (`COMPLETED`).
* [x] **UI/UX Enhancement Modul Pembelian:**
  * [x] **Horizontal Stepper Component:** Indikator kemajuan step transaksi (*Pengajuan* ➔ *Penerbitan PO* ➔ *Penerimaan Barang* ➔ *Selesai*) di halaman Detail Pembelian (`HorizontalStepper.svelte`), termasuk state visual khusus untuk `CANCELLED`.
  * [x] **Vertical Kebab Action Menu (`DotsVerticalOutline`):** Dropdown pop-up self-contained (`AppKebabMenu.svelte`) pada tabel utama dengan ikon visual:
    * 👁️ **Detail**: Membuka halaman Detail Pembelian.
    * 🗑️ **Hapus**: Membatalkan record pengajuan/PO (hanya saat `DRAFT_PR`/`PO_ISSUED`, sebelum ada barang diterima).
  * [x] **Contextual Edit Actions:** Tombol **Edit Pengajuan** (aktif saat `DRAFT_PR`) di halaman Detail; form Penerimaan Barang di halaman yang sama otomatis berfungsi sebagai **Edit Penerimaan** berulang selama status `PO_ISSUED`/`PARTIALLY_RECEIVED`.
  * [x] **Item List Column Formatting:** Format penulisan ringkasan item terbeli pada satu kolom tabel: `- [Nama Produk/Varian] ([Qty] [UOM])` (kolom `multiline` baru di `AppTable.svelte`).
  * [x] **Document Viewer & Print Templates:** `PurchasingDocument.svelte` — tampilan terpisah + cetak (`window.print()`) untuk Dokumen PR (tanpa harga) dan Dokumen PO (dengan harga & tanda tangan), No. PO hanya muncul setelah benar-benar disetujui Owner.

---

## Phase 3: Inventory Restructuring, Stock Ledger & Costing Engine

Goal: Mengubah modul Adjustment Stok menjadi modul Inventory menyeluruh, menghadirkan Current Stock Summary, Stock Ledger historikal, serta kalkulasi costing HPP otomatis.

* [ ] **Restructuring Sidebar Navigation:**
  * [ ] Ubah nama modul utama Sidebar menjadi **Inventory** (`/inventory`).
  * [ ] Buat 2 sub-module dedicated: **Stok Produk** (`/inventory/stock-products`) dan **Adjustment Stok** (`/inventory/stock-adjustments`).
* [ ] **Sub-Module 1: Stok Produk & Stock Ledger (`/inventory/stock-products`):**
  * [ ] **Current Stock Summary Panel:** Menampilkan daftar SKU aktif, kuantitas stok saat ini (*real-time Qty*), dan total nominal valuasi aset barang.
  * [ ] **Stock Ledger Table (Kartu Stok Historikal):** Audit trail kronologis pergerakan barang memuat kolom Tanggal/Waktu, Nama SKU, Jenis Transaksi (*Penjualan, Pembelian, Adjustment, Retur*), Qty Masuk, Qty Keluar, Saldo Akhir Qty, HPP Unit, dan Total Nominal Valuasi.
* [ ] **Sub-Module 2: Adjustment Stok (`/inventory/stock-adjustments`):**
  * [ ] Form pencatatan penyesuaian stok opname (kerusakan, kehilangan, barang sampel) dengan verifikasi approval.
  * [ ] Integrasi otomatis pencatatan adjustment ke dalam *Stock Ledger* saat transaksi di-post/disetujui.

---

## Phase 4: Dedicated Reporting Sub-Modules, Product Variant Repeater & System Administration (Settings)

Goal: Mengubah modul Laporan menjadi Accordion Sub-Menu Sidebar dengan 6 laporan esensial, menambahkan komponen Variant Options Repeater pada Master Data Produk, serta membangun modul Settings menyeluruh untuk pengelolaan bisnis, kebijakan inventaris, dan hak akses.

* [ ] **Restrukturisasi Sidebar Sub-Module Laporan (`/reports/*`):**
  * [ ] Mengubah *dropdown select* jenis laporan menjadi **Accordion Sub-Menu Sidebar**.
  * [ ] 📊 **Laporan Penjualan & Produk Terlaris** (`/reports/sales`): Analytics omset, pergerakan barang (*fast-moving* vs *slow-moving*), dan margin produk.
  * [ ] 🛍️ **Laporan Pembelian per Supplier** (`/reports/purchases`): Rekapitulasi volume pengadaan, tren harga, dan riwayat PO per supplier.
  * [ ] 📦 **Laporan Stok & Valuasi Inventaris** (`/reports/inventory-valuation`): Valuasi aset barang (FIFO/Average) dan deteksi umur mengendap stok (*aging report*).
  * [ ] ⚖️ **Laporan Adjustment Stok** (`/reports/stock-adjustments`): Audit trail kerugian dan penyesuaian opname.
  * [ ] 💵 **Laporan Laba Rugi (Profit & Loss)** (`/reports/profit-and-loss`): Ringkasan finansial (`Revenue` - `HPP/COGS` - `Biaya Operasional` = `Net Profit`).
  * [ ] 💳 **Laporan Rekonsiliasi Pembayaran** (`/reports/payment-reconciliation`): Rekapitulasi transaksi berdasarkan kanal bayar (Tunai, QRIS, Transfer) untuk *settlement* kasir harian.
* [ ] **Product Variant Options Repeater Engine:**
  * [ ] **Variant Attribute Repeater Input**: Tambah komponen UI dinamis (*dynamic row repeater*) pada form Tambah/Edit Produk (`/master-data/products`) untuk mendefinisikan Opsi Varian (misal: Row 1: `Ukuran` ➔ `S, M, L`, Row 2: `Warna` ➔ `Merah, Hitam`).
  * [ ] **Seamless Matrix Feeding**: Data hasil inputan Repeater secara otomatis di-passing sebagai input mentah (*feed*) ke komponen **Matrix Generator** untuk membentuk kombinasi SKU.
* [ ] **Modul Settings & System Administration (`/settings/*`):**
  * [ ] **Company Profile Settings:** Identitas perusahaan, logo, alamat, NPWP, dan kontak untuk header dokumen & struk.
  * [ ] **Inventory Policy Settings:** Opsi metode costing HPP (**FIFO** / **Moving Average**), toggle izin stok minus, dan *threshold* notifikasi stok minimum.
  * [ ] **Role & Permission Matrix:** Pengaturan hak akses bertingkat (*Owner, Manager, Kasir, Gudang*) dengan kontrol granular per aksi modul (misal: Siapa yang boleh menyetujui PO atau melakukan Adjustment Stok).
  * [ ] **Receipt & Auto-Numbering Templates:** Kustomisasi struk POS (Thermal 58mm/80mm) dan format prefix penomoran dokumen otomatis (`PR/{YYYY}/{MM}/XXX`, `PO/{YYYY}/{MM}/XXX`, `INV/{YYYY}/{MM}/XXX`).

---

## Definition of Done (DoD) - MVP 3

1. [x] **Interactive Visual Dashboard:** Dashboard dilengkapi dengan Line Chart & Pie/Donut Chart interaktif yang responsif terhadap interaksi pengguna (*hover/tap*), filter periode (Hari Ini/Bulan Ini/Tahun Ini/Custom), dan Export PDF.
2. [x] **Master Data Structure & Relasi:** Navigasi Master Data diakses melalui Sub-Menu Sidebar Dedicated, dan form Produk/SKU terintegrasi dengan relasi *Default Supplier*.
3. [x] **Global Toggle Standard:** Komponen input `Select` status aktif/non-aktif pada 8 Master Data sepenuhnya diganti menggunakan Toggle Switch, serta *Strict Filtering* (`is_active = true`) berjalan konsisten di seluruh modul transaksi.
4. [x] **Matrix Variant Engine:** Sub-menu **Varian** dilengkapi dengan Matrix Generator dan Bulk Fill yang mampu men-generate kombinasi SKU secara instan.
5. [x] **Complete Procurement Lifecycle:** Alur pengadaan barang 4-step (PR ➔ PO ➔ Penerimaan ➔ Selesai) terimplementasi penuh dengan *Horizontal Stepper*, *Vertical Kebab Menu*, *Contextual Edit*, serta dokumen PR & PO resmi yang dapat dicetak secara terpisah.
6. [ ] **Inventory & Stock Ledger:** Modul Inventory memiliki sub-menu Stok Produk (dengan Current Stock Summary & Stock Ledger historikal) dan Adjustment Stok yang terintegrasi secara *real-time*.
7. [ ] **Dedicated Reporting Navigation:** Modul Laporan memiliki 6 sub-module dedicated pada Sidebar Accordion dengan filter, tabel terformat, dan fungsi *autoload data*.
8. [ ] **Variant Options Repeater:** Form Produk/SKU mendukung pengisian atribut varian menggunakan komponen *repeater* dinamis yang terhubung langsung ke *Matrix Generator*.
9. [ ] **Enterprise System Settings:** Pengaturan profil bisnis, metode costing HPP (FIFO/Average), batasan stok minus, *Role & Permission Matrix*, serta *Auto-Numbering Prefix* dapat dikonfigurasi sepenuhnya oleh Owner.
