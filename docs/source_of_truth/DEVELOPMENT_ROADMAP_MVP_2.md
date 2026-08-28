# DEVELOPMENT_ROADMAP_MVP_2.md - KaiNova ERP

> **Legend status:** `[x]` Selesai & teruji · `[~]` Sebagian/berjalan tapi belum lengkap · `[ ]` Belum dikerjakan.
> Update terakhir: 2026-08-28 — Revisi MVP 2: Integrasi Master Data UOM, Autoload Report Data, Dedicated Add/Edit Pages, Full Data Table View, & Formatting Utilities.

---

## 💡 Fokus Utama MVP 2

MVP 2 berfokus pada **Transformasi Visual, Standarisasi Navigation/Routing, Formatting Engine, & UI Table Layout** menggunakan **Flowbite Svelte** dan **Lucide Icons** / **Flowbite Icons**:

* **7 Master Data (Termasuk UOM):** Penambahan Master Data Unit of Measure (UOM - misal: *Pcs*, *Pack*, *Lusin*, *Meter*) yang dapat dipilih saat membuat/mengedit Produk Parent & SKU Variant.
* **Autoload Report Data:** Seluruh modul laporan secara otomatis menampilkan data *default* (misal: filter bulan berjalan / 30 hari terakhir) saat halaman dibuka tanpa mewajibkan pengguna menekan tombol *Search* / *Filter* terlebih dahulu.
* **Frontend Number Formatting Utilities:** Menghadirkan fungsi terpusat (`src/lib/utils/formatters.ts`) untuk pembatas ribuan (ribuan delimiter: `1.000.000`) pada seluruh angka nominal harga, HPP, pajak, diskon, dan qty di semua komponen & tabel.
* **Dedicated Add & Edit Pages:** Memisah halaman Form Tambah dan Form Edit Master Data ke route khusus (bukan pop-up/modal atau form di halaman yang sama).
* **Full Data Table Standard:** Mengubah seluruh penyajian data *list/array* di 7 modul utama menjadi format **Tabel Interaktif Flowbite** (lengkap dengan pagination, sorting, dan aksi).
* **Design System & Input Validation:** Skema warna disesuaikan (Primary, Secondary, Tertiary), indikator **bintang merah `*`** untuk field wajib, dan responsivitas layout tablet/mobile.

---

## Phase 1: Core UI System, Formatting Utils & Route Architecture (Sprint 1)

Goal: Mengintegrasikan Flowbite Svelte, membuat modul utilitas *formatting* ribuan/mata uang, mengatur skema warna Popyshop, merancang arsitektur routing (halaman terpisah Add/Edit), dan membuat *Standardized Table Component*.

* [x] **Setup & Config Flowbite Svelte:**
  * [x] Install `flowbite-svelte`, `flowbite`, dan package icon terkait (`flowbite-svelte-icons` / `lucide-svelte`).
  * [x] Konfigurasi Tailwind v4 (`@source`, `@theme`) untuk mendukung plugin Flowbite dan skema warna disesuaikan (proyek ini pakai Tailwind v4 CSS-based config, bukan `tailwind.config.cjs`).
* [x] **Frontend Number & Currency Formatting Utilities (`src/lib/utils/formatters.ts`):**
  * [x] Function `formatRupiah(amount: number | string)` ➔ Mengubah angka menjadi format mata uang Rupiah konsisten (`Rp 150.000`).
  * [x] Function `formatNumber(value: number | string)` ➔ Mengubah angka biasa/qty menjadi format dengan delimiter ribuan (`1.500`).
  * [x] Helper input parser `parseNumber(formattedValue: string)` ➔ Mengubah string ber-delimiter kembali menjadi number murni saat dikirim ke backend.
* [x] **Design Tokens & Palette Customization:**
  * [x] **Primary Color:** Emerald / Deep Teal (identitas KaiNova ERP & kesan bersih/profesional).
  * [x] **Secondary Color:** Warm Rose / Coral (brand fashion Popyshop).
  * [x] **Tertiary Color:** Amber / Gold (penanda aksen, alert, status khusus, dan highlight).
* [x] **Base UI Component Library (Reusable Wrappers):**
  * [x] `<AppButton>`: Tombol Flowbite dengan varian `primary`, `secondary`, `outline`, `danger`, bawaan icon + indikator loading.
  * [x] `<AppInput>`: Wrapper input teks/angka Flowbite dengan prop `required` (menampilkan **bintang merah `*`** pada label), helper error text, serta integrasi pemformatan ribuan *on-the-fly* untuk input nominal.
  * [x] `<AppSelect>`: Dropdown Flowbite dengan penanda `required` (`*`) dan fitur pencarian.
  * [x] `<AppTable>`: Standardized Table Wrapper berbasis Flowbite `Table` yang mendukung *striped rows*, *hover effects*, *sticky header*, *pagination*, dan *action column*.
  * [x] `<AppBadge>`: Badge status konsisten (`POSTED`, `DRAFT`, `FAST_MOVING`, `DEAD_STOCK`) untuk diletakkan di dalam sel tabel.
  * [x] `<AppCard>`: Container card untuk form pembungkus di halaman dedicated Add/Edit.

---

## Phase 2: Separate Master Data Pages (Termasuk UOM) & Full Table Views (Sprint 2)

Goal: Menambahkan Master Data UOM, mengubah arsitektur Master Data menjadi Dedicated Page Routing (halaman List, Add, dan Edit terpisah) serta menyajikan seluruh Master Data dalam bentuk Data Table.

* [x] **Database & Backend Master Data UOM:**
  * [x] Tambah tabel `uoms` (`id`, `code`, `name`, `description`, `created_at`, `updated_at`, `deleted_at`).
  * [x] Relasikan `uom_id` pada tabel `products` (berlaku untuk seluruh varian SKU di bawah produk parent).
  * [x] Implementasi Endpoint CRUD UOM — path aktual `/v1/uoms` (bukan `/master/uoms`), mengikuti konvensi endpoint master data lain yang sudah ada (`/v1/categories`, `/v1/suppliers`, dst — tidak ada prefix `/master`).
* [x] **Navigation & Separate Page Routing:**
  * [x] Routing dedicated List/Create/Edit untuk 7 Master Data via `svelte-spa-router` (bukan SvelteKit): `/master-data/:tab`, `/master-data/:tab/create`, `/master-data/:tab/:id/edit`. Ditenagai 2 komponen generik data-driven (`MasterDataList.svelte`, `MasterDataForm.svelte` + `masterDataConfig.ts`) alih-alih 21 file terpisah — URL & konsep List/Add/Edit tetap terpisah sesuai tujuan roadmap, kode tetap DRY.
* [x] **Form Dedicated Page Standardization:**
  * [x] Layout form Add/Edit dedicated dengan tombol *Back/Kembali* ⬅️, header jelas, dan tombol *Save/Update* 💾 (`AppCard` + `AppButton`).
  * [x] Form Produk wajib memiliki **Dropdown Select UOM** (searchable) dari Master Data UOM dengan penanda **bintang merah `*`**.
  * [x] Semua field input yang *required* pada form Add/Edit diberi tanda **bintang merah `*`** (`AppInput`/`AppSelect` prop `required`).
  * [x] Penggunaan `formatNumber`/`formatRupiah` (via `AppInput numeric`) pada input harga dasar produk, rate pajak, dan nilai diskon.
* [x] **Master Data Full Table Implementation:**
  * [x] Semua tab Master Data (termasuk UOM) disajikan penuh menggunakan `<AppTable>` (striped, hover, sticky header, pagination bawaan).
  * [x] Kolom harga & stok di tabel diformat `formatRupiah`/`formatNumber` rata kanan (varian SKU produk).
  * [x] Kolom Aksi Tabel dilengkapi icon ✏️ (redirect ke Edit) & 🗑️ (hapus) — konfirmasi masih pakai `window.confirm()` native, belum modal Flowbite dedicated; cukup untuk MVP tapi bisa di-upgrade nanti.
  * [x] Search bar di header tabel semua tab + filter dropdown Kategori khusus tab Produk.

---

## Phase 3: All Modules Table Standardization & POS Interactive UI (Sprint 3)

Goal: Menerapkan skema Data Tabel dan pemformatan angka di modul Pembelian, Adjustment Stok, dan Penjualan, serta memoles antarmuka POS Kasir.

* [x] **Table Standardization Across All Modules:**
  * [x] **Modul Pembelian:** Tabel Daftar Purchase Order (No. PO — sintetis dari id karena tidak ada kolom sequence khusus, Supplier, Total [Rp], Status Badge, Aksi Terima Barang). Aksi "Detail" belum ada (belum ada endpoint `GET /purchase-orders/:id`).
  * [x] **Modul Adjustment Stok:** Tabel Daftar Stock Opname & Saldo Awal (Kode — sintetis dari id, Alasan, Total Item, Status DRAFT/POSTED badge, Aksi Post). Aksi "Detail" belum ada (belum ada endpoint `GET /stock-adjustments/:id`).
  * [x] **Modul Penjualan:** Tabel Riwayat Transaksi Penjualan / Sales Orders (Invoice No, Customer, Payment Method, DPP [Rp], PPN [Rp], PPh [Rp], Grand Total [Rp], Aksi Print Struk) di halaman baru `/pos/history`, diakses via tombol "Riwayat Transaksi" di header POS.
* [x] **POS / Kasir Interactive Redesign:**
  * [x] Visual Card Grid untuk item produk (klik card → chip SKU per varian) + Tabel Ringkasan Keranjang Belanja di panel kanan dengan qty stepper (Harga & Subtotal diformat `formatRupiah`, mencantumkan Satuan UOM per baris).
  * [x] Dropdown Customer, Diskon, & Pajak (PPN/PPh) berbasis `AppSelect`. Tidak ada field wajib di panel ini (semua opsional saat checkout), jadi tidak ada bintang merah `*` — sesuai aturan `AppSelect`/`AppInput` (bintang hanya muncul kalau `required`).
  * [x] Display kalkulasi real-time Subtotal, Diskon, DPP, PPN, PPh, dan Grand Total ber-delimiter ribuan (dihitung ulang & divalidasi lagi oleh backend saat checkout).
  * [x] Fitur Scan Barcode (input focus handler, dari MVP 1) — sudah di-restyle dengan ikon barcode.
  * [x] Modal Preview Struk Pembayaran (Flowbite `Modal`) muncul setelah checkout sukses, tombol "Cetak Struk" membuka `/receipt/:id` (halaman print-ready `window.print()` yang sudah ada) di tab baru — bukan `window.print()` langsung di dalam modal.
* [x] **Separate Pages for Transaction Forms:**
  * [x] Pembuatan PO berada di halaman dedicated: `/purchasing/create`.
  * [x] Pembuatan Stock Adjustment berada di halaman dedicated: `/inventory/adjustments/create`.

---

## Phase 4: Dynamic Dashboard & Interactive Reporting Tables (Sprint 4)

Goal: Mengubah Dashboard menjadi kaya visualisasi grafik dan angka terformat, serta memastikan seluruh Laporan otomatis memuat data saat pertama kali dibuka dan dapat difilter/diexport secara interaktif.

* [ ] **Executive Dashboard Enhancements:**
  * [ ] Visualisasi Chart Tren Omset & Laba Kotor Harian/Bulanan dengan tooltip angka terformat `formatRupiah`.
  * [ ] Widget KPI Card (Omset Hari Ini, Laba Kotor, Total Transaksi) menggunakan font besar ber-delimiter ribuan (`Rp 12.500.000`).
  * [ ] **Tabel ROP Alert & Top 5 Selling Products:** Seluruh angka Qty dan Nominal diformat rapi dengan `formatNumber` / `formatRupiah`.
* [ ] **Reporting Tables & Autoload Data Implementation:**
  * [ ] **Autoload Data on Mounting:** Memasang pemanggilan API data laporan secara otomatis pada siklus *lifecycle* `onMount()` / Svelte `load()` function menggunakan tanggal *default* (misal: `startDate` = 1 bulan yang lalu s/d `endDate` = hari ini). Data langsung dirender ke tabel tanpa harus menekan tombol *Search*.
  * [ ] Seluruh halaman Laporan (Penjualan, Pembelian, Stok, Adjustment, Laba Rugi) disajikan dalam format **Flowbite Data Table** ber-delimiter ribuan dengan alignment *numeric right-aligned*.
  * [ ] Header filter laporan disesuaikan (Datepicker Flowbite + Dropdown Filter) di mana tombol *Apply/Filter* digunakan untuk memperbarui data yang *sudah tampil*.
  * [ ] Penandaan field filter wajib dengan bintang merah `*`.
  * [ ] Layout *Print-Friendly View* (`@media print`) yang menyembunyikan navigasi sidebar/navbar.
  * [ ] Tombol Export PDF & Excel dengan icon menarik dan indikator *loading/downloading*.

---

## Definition of Done (DoD) - MVP 2

1. [ ] **Master Data UOM Integration:** Master Data UOM (Unit of Measure) tersedia penuh dan terintegrasi secara wajib (required `*`) pada form pembuatan/pengeditan Produk.
2. [ ] **Autoload Report Data:** Saat user membuka halaman Laporan (Penjualan, Pembelian, Stok, Adjustment, Laba Rugi), data tabel **otomatis langsung muncul** menggunakan filter *range default* tanpa perlu menekan tombol *Search* terlebih dahulu.
3. [ ] **Consistent Number Formatting:** Seluruh angka nominal uang (Harga, HPP, DPP, PPN, PPh, Subtotal, Grand Total) disajikan dengan format mata uang Rupiah (`Rp 100.000`), dan seluruh angka kuantitas/stok disajikan dengan delimiter ribuan (`1.000`) di seluruh komponen UI, tabel, form, dan dashboard.
4. [ ] **Dedicated Add & Edit Pages:** Proses Tambah dan Edit data 7 Master Data (Customer, Supplier, Pajak, Diskon, UOM, Kategori, Produk) dilakukan di **halaman terpisah (route khusus)**, bukan di modal/inline form pada halaman list.
5. [ ] **Full Table Layout:** Semua penyajian daftar/list data di **seluruh 7 modul** (Master Data, POS History, PO, Stock Adjustment, Laporan, Dashboard Alerts) menggunakan komponen **Data Table Flowbite** yang rapi.
6. [ ] **Required Field Indicator:** Seluruh *input field* yang wajib diisi pada form Add/Edit otomatis menampilkan tanda **bintang merah `*`** pada labelnya.
7. [ ] **Rich Iconography:** Penggunaan Icon (Lucide/Flowbite Icons) diterapkan secara konsisten pada Navigasi Sidebar, Action Table Buttons (Edit ✏️, Delete 🗑️, View 👁️), Form Navigation (Back ⬅️, Save 💾), dan Dashboard Widgets.
8. [ ] **Color Palette Integration:** Skema warna Primary (Emerald/Teal), Secondary (Rose/Coral), dan Tertiary (Amber/Gold) terintegrasi dengan harmonis di seluruh UI.
9. [ ] **Responsive & Dynamic Dashboard:** Dashboard dilengkapi dengan Grafik (Chart) serta layout yang responsif saat diakses dari **Tablet Kasir POS** maupun **Mobile Browser**.
