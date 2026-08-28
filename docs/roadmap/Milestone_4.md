# DEVELOPMENT_ROADMAP_MVP_4.md - KaiNova ERP

> **Legend status:** `[x]` Selesai & teruji · `[~]` Sebagian/berjalan tapi belum lengkap · `[ ]` Belum dikerjakan.
> Target Rilis: Q4 2026 — Spesifikasi MVP 4: Dedicated User & Access Management Module, Dynamic Static QRIS Management, POS Offline-First Engine, Smart Stock Reorder Point (ROP), System Polish & Bug Fixes (Flowbite UI Component Standard, WIB Timezone Normalization, & Sorting Order).

---

## 💡 Fokus Utama MVP 4

MVP 4 berfokus pada **Dedicated User & Access Management Module, Dynamic Static QRIS Management, POS Offline-First Architecture, Executive Predictive Analytics, & System Polish (UI/UX Refinement & Timezone Fixes)**:

* **Dedicated User & Access Management Module:** Modul dedicated untuk tata kelola pengguna, peran (Role), dan matriks izin akses (Permission) secara terpusat dengan 3 sub-modul utama: **User**, **Role**, dan **Permission**.
* **Static QRIS Upload & Management:** Modul konfigurasi di *Settings* untuk mengunggah gambar/QRIS statis toko (misal: QRIS BCA/Mandiri/ShopeePay) beserta informasi nomor rekening/NMID, yang nantinya ditampilkan di layar checkout POS saat pelanggan memilih metode pembayaran QRIS.
* **POS Offline-First Engine:** Arsitektur PWA berbasis *Service Worker* dan *IndexedDB* untuk memastikan kasir dapat melakukan pencarian produk, input keranjang, hingga pencetakan struk transaksi secara lokal tanpa koneksi internet, serta sinkronisasi latar belakang otomatis (*Auto-Sync Engine*) saat jaringan pulih.
* **Smart Stock Reorder Point (ROP) & Executive Predictive Analytics:** Dasbor analisis eksekutif yang secara otomatis menghitung *Reorder Point* (titik pemesanan ulang stok) berdasarkan tren *Average Daily Sales* (ADS) dan *Lead Time* supplier, serta memberikan alert dini sebelum barang habis.
* **System Refinement & Core Fixes:** Standardisasi komponen UI modal/dialog (*Alert, Modal Confirm, Toast*) menggunakan **Flowbite Svelte**, perbaikan urutan daftar data (*Sorting Order*: data baru/diedit wajib di paling atas), serta koreksi penanganan **Timezone WIB (Asia/Jakarta / UTC+7)** secara menyeluruh di backend dan frontend.

---

## Phase 1: Dedicated User & Access Management Module (`/access-management/*`)

Goal: Menyediakan kontrol hak akses granular bertingkat (*Role-Based Access Control*) untuk mengamankan fitur dan data sistem di seluruh modul KaiNova ERP.

* [ ] **Accordion Sub-Menu Sidebar Navigasi Dedicated (`/access-management/*`):**
  * 👤 `/access-management/users` (**User Management**)
  * 🛡️ `/access-management/roles` (**Role Management**)
  * 🔑 `/access-management/permissions` (**Permission Management**)
* [ ] **Sub-Module 1: User Management (`/access-management/users`):**
  * [ ] Management data pengguna (Nama, Email/Username, Temporary Password Generator, dan Assign Role).
  * [ ] Control status keaktifan user (`is_active` toggle switch) & Reset Password Direct.
  * [ ] Guard Protection: Mencegah user non-Owner untuk mengubah/menonaktifkan akun miliknya sendiri atau akun berskala *Owner*.
* [ ] **Sub-Module 2: Role Management (`/access-management/roles`):**
  * [ ] Custom & Preset Role List (*Owner, Manager, Kasir, Gudang*).
  * [ ] **Role Permission Matrix Builder**: Form pemetaan *checkbox permission tree* yang dikelompokkan berdasarkan Module Group (*Master Data, POS, Procurement, Inventory, Reporting, System Settings*).
  * [ ] Quick Select Tools (*Select All*, *Deselect All*, per-Module Group toggle).
* [ ] **Sub-Module 3: Permission Management (`/access-management/permissions`):**
  * [ ] Master Data Katalog Izin Akses/Aksi (`action_key`, `module_group`, `description`).
  * [ ] Filter & pencarian list permisi per modul sistem (misal: `products.create`, `po.approve`, `inventory.adjust`, `reports.sales.view`).
  * [ ] Integrasi Backend Middleware Authorization (JWT Claim / Role-Permission Check) & Svelte Frontend Reactive Guard (Hiding/Disabling UI element berdasarkan permission user).

---

## Phase 2: Dynamic Static QRIS Management (`/settings/payment-methods`)

Goal: Menyediakan pengolahan media gambar QRIS statis di modul Settings agar dapat dikonfigurasi langsung oleh Owner/Admin dan ditampilkan saat transaksi checkout kasir.

* [ ] **QRIS Upload & Configuration Panel (`/settings/payment-methods`):**
  * [ ] Form upload gambar QRIS statis (dukungan format JPG/PNG/WebP, preview image, dan penyesuaian ukuran).
  * [ ] Input detail identitas merchant (Nama Merchant, NMID, Nomor Rekening, dan Instruksi Pembayaran).
  * [ ] Toggle status aktif/non-aktif metode pembayaran QRIS statis.
* [ ] **Integration with POS Checkout Modal:**
  * [ ] Tampilan pop-up QRIS statis di modal pembayaran POS ketika memilih metode bayar QRIS.
  * [ ] Tombol konfirmasi status bayar manual oleh Kasir ("Sudah Diterima / Diverifikasi").

---

## Phase 3: POS Offline-First Architecture & Local Sync Engine (`/pos`)

Goal: Memastikan transaksi kasir tetap berjalan tanpa kendala saat jaringan internet mati atau lambat.

* [ ] **Offline Storage & Service Worker Integration:**
  * [ ] Implementasi **Service Worker** & **IndexedDB** di browser untuk caching data Master Produk, Varian, Harga, dan Master Customer secara lokal.
  * [ ] **Local Transaction Queue:** Menyimpan transaksi yang terjadi dalam kondisi offline ke dalam antrean lokal IndexedDB beserta nomor struk sementara.
* [ ] **Auto-Sync Background Engine:**
  * [ ] Pengecekan status koneksi (*Online/Offline Indicator Badge*) secara real-time di UI POS.
  * [ ] Auto-sync otomatis saat koneksi terhubung kembali untuk mengirimkan data antrean transaksi ke backend (`POST /pos/sync-offline-transactions`).
  * [ ] Penanganan konflik data stok/transaksi offline dengan log rekonsiliasi.

---

## Phase 4: Smart Stock Reorder Point (ROP) & Executive Predictive Analytics

Goal: Memberikan alert dan proyeksi kecukupan stok berbasis data historis transaksi untuk membantu perencanaan pengadaan barang.

* [ ] **Smart Inventory Reorder Point (ROP) Engine (`/inventory/reorder-alerts`):**
  * [ ] Algoritma kalkulasi ROP otomatis: $ROP = (Average\ Daily\ Sales \times Lead\ Time) + Safety\ Stock$.
  * [ ] Panel Notifikasi Alert Stok Kritis (memeringatkan produk mana saja yang perlu segera dibuatkan pengajuan PR/PO ke supplier).
* [ ] **Executive Analytics Dashboard (`/reports/executive-analytics`):**
  * [ ] Grafik tren omset, margin keuntungan kotor, dan proyeksi pergerakan stok (*Fast-Moving* vs *Slow-Moving*).
  * [ ] Analisis jam sibuk transaksi (*Peak Transaction Hours*) untuk penataan vard/shift kerja kasir.

---

## Phase 5: System Refinement, UI Component Standardization & Timezone Fixes

Goal: Memperbaiki bug timezone, menyelaraskan komponen dialog UI dengan standar Flowbite Svelte, serta menyempurnakan urutan data pada seluruh modul.

* [ ] **Standardisasi Alert, Toast & Confirmation Modal (Flowbite Svelte):**
  * [ ] Mengganti seluruh `window.alert()`, `window.confirm()`, dan toast notification bawaan/sederhana dengan komponen **Flowbite Svelte Modal** & **Toast** (`AppConfirmModal.svelte`, `AppAlertToast.svelte`).
  * [ ] Konsistensi variasi warna/varian UI: *Danger/Red* (Hapus/Error), *Warning/Yellow* (Konfirmasi/Batal), *Success/Green* (Berhasil disimpan/update), dan *Info/Blue* (Petunjuk/Detail).
* [ ] **Sorting Order Optimization (Default Newest First):**
  * [ ] Mengubah query default backend di seluruh modul (Master Data, Procurement, POS, Inventory, & User Management) menjadi `ORDER BY updated_at DESC` / `created_at DESC`.
  * [ ] Memastikan data yang baru ditambahkan atau baru saja diedit langsung berada di **baris paling atas** tabel UI frontend tanpa perlu reload manual.
* [ ] **Timezone Normalization to WIB (`Asia/Jakarta` / UTC+7):**
  * [ ] backend: Konfigurasi default timezone database PostgreSQL & parser waktu Go REST API menggunakan lokasi `Asia/Jakarta` (`TIMESTAMPTZ` handling).
  * [ ] frontend: Standardisasi helper formatter tanggal/jam (`formatDateTime`, `formatDate`) menggunakan locale `id-ID` dengan timezone terikat `Asia/Jakarta` agar seluruh timestamp transaksi, log stok, dan laporan menyajikan waktu WIB yang konsisten.

---

## Definition of Done (DoD) - MVP 4

1. [ ] **Dedicated User & Access Management:** Sistem memiliki modul utama navigasi tersendiri (`/access-management`) yang mengelola User, Role (dengan Matrix Checklist), dan Catalog Permission yang terintegrasi penuh dengan Middleware backend dan UI Guard frontend.
2. [ ] **Static QRIS Upload:** Owner dapat mengunggah gambar QRIS statis di modul Settings dan QRIS tersebut muncul dengan jelas pada layar checkout POS.
3. [ ] **POS Offline Resilience:** Kasir dapat memproses transaksi dan mencetak struk saat koneksi internet terputus, dan data transaksi offline berhasil disinkronkan ke server secara otomatis saat online kembali.
4. [ ] **Smart Reorder Alert:** Sistem secara otomatis memprediksi tanggal persediaan barang akan habis berdasarkan tren penjualan harian dan memberikan notifikasi pemesanan ulang.
5. [ ] **UI Component & Bug Free:** Seluruh dialog alert/konfirmasi menggunakan komponen Flowbite Svelte, urutan data selalu menampilkan record terbaru di paling atas (`ORDER BY updated_at DESC`), dan stamp waktu di seluruh sistem secara konsisten menggunakan WIB (`Asia/Jakarta`).
