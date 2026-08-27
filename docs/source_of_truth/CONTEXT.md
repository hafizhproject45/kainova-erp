# CONTEXT.md - KaiNova ERP

## 1. Project & Business Overview

* **Nama Sistem:** KaiNova ERP
* **Pemilik / Merek Bisnis:** Popyshop
* **Domain Bisnis:** Fashion (Baju & Kerudung/Hijab)
* **Model Operasional:** Buying-Selling Murni (Membeli barang jadi dari supplier/vendor lalu menjualnya kembali).
* **Channel Penjualan:** Multi-Channel (Toko Offline via POS Kasir, Marketplace seperti Shopee/Tokopedia/TikTok Shop, dan WhatsApp/Web).
* **Tujuan Utama Sistem:** Mengelola operasional *end-to-end* mulai dari master data, pembelian ke supplier, penerimaan & adjustment stok, kasir POS (dengan diskon & pajak), pencatatan stok multi-channel, kalkulasi HPP otomatis, hingga menyajikan dashboard & laporan analytics *real-time* untuk pengambilan keputusan bisnis yang cepat (misal: penanganan *slow-moving/dead stock*).

---

## 2. Tech Stack & Architecture Baseline

* **Frontend:** Svelte (Single Page Application / SPA, Web Responsive untuk Desktop & Mobile Browser).
* **Backend Runtime:** Bun
* **Web Framework:** ElysiaJS
* **ORM:** Drizzle ORM
* **Database:** PostgreSQL
* **API Architecture:** RESTful JSON API
* **Architecture Pattern:** Modular Monolith (Clean Architecture) dengan pemisahan domain modul (`auth`, `master-data`, `purchasing`, `inventory`, `sales`, `reports`, `settings`, `analytics`).

---

## 3. MVP Module Scope

Modul yang wajib ada pada rilis MVP:

1. **Dashboard** — ringkasan omset, laba kotor, transaksi hari ini, stok kritis (ROP).
2. **Master Data** — Customer, Supplier, Pajak, Diskon, Produk, Kategori Produk/SKU.
3. **Penjualan (POS)** — transaksi kasir dengan pilihan diskon & pajak (PPN/PPh) per transaksi.
4. **Pembelian** — Purchase Order ke supplier & penerimaan barang (goods receipt).
5. **Adjustment Stok** — stock opname (koreksi selisih fisik vs sistem) dan input saldo awal stok saat aplikasi baru digunakan.
6. **Laporan** — laporan penjualan, pembelian, stok, laba rugi; bisa difilter (tanggal, kategori, channel, customer/supplier), diprint, dan diexport ke PDF & Excel.
7. **Settings** — profil bisnis, metode costing (FIFO/Average), pajak default, threshold slow/dead stock, template struk.

---

## 4. Key Business Rules & Core Features

1. **Advanced Matrix SKU Engine:**
   Penyusunan SKU otomatis berbasis matriks kombinasi atribut:
   `[Parent Model Code] - [Material] - [Color] - [Size]` (Contoh: `GMS-SLK-BLK-L` atau `HJB-VOL-EMR-OS`). Setiap produk terikat ke satu `category` (master data, bukan teks bebas).
2. **Dynamic Costing Engine (FIFO & Moving Average):**
   Metode perhitungan HPP (Cost of Goods Sold) bersifat *configurable* via Web Settings:
   * **FIFO Mode:** Pelacakan stok berbasis batch penerimaan (`inventory_batches`), memotong stok batch tertua lebih dulu.
   * **Moving Average Mode:** Rekalkulasi HPP rata-rata secara otomatis (*atomic transaction*) setiap ada transaksi barang masuk baru.
3. **Diskon & Pajak di POS:**
   Kasir dapat memilih diskon (dari master `discounts`, tipe persentase/nominal) secara manual, baik **per item produk** maupun **atas keseluruhan transaksi** (bisa dipakai bersamaan). Kasir juga dapat memilih **PPN** (menambah total) dan/atau **PPh** (mengurangi total) secara independen dari master `taxes`. Nilai rate yang dipakai di-*snapshot* ke `sales_orders`/`sales_order_items` pada saat transaksi terjadi, agar histori transaksi tidak berubah jika rate diskon/pajak diubah di kemudian hari.
4. **Adjustment Stok (Stock Opname & Saldo Awal):**
   Modul terpisah dari transaksi pembelian/penjualan untuk mengoreksi selisih stok fisik vs sistem, maupun untuk menginput saldo awal stok ketika sistem pertama kali digunakan. Setiap adjustment tercatat dengan alasan (`reason`) dan mempengaruhi `inventory_batches` seperti transaksi stok biasa (nambah/mengurangi batch), tanpa membuat transaksi penjualan/pembelian.
5. **Single Warehouse & Multi-Channel Stock:**
   MVP ini didesain untuk **satu lokasi stok fisik** (bukan multi-cabang/multi-gudang). Stok terpusat (*central stock pool*) di lokasi tunggal tersebut mengurangi stok *real-time* dari transaksi kasir POS toko fisik maupun pesanan online (multi-*channel* penjualan, bukan multi-lokasi), dilengkapi fitur *Safety Stock Locking*.
6. **Penomoran Invoice:**
   Setiap transaksi penjualan mendapat `invoice_number` unik format `INV-{CHANNEL_CODE}-{YYYYMMDD}-{SEQ}` (sequence reset harian per channel), digenerate atomik lewat tabel `invoice_counters` agar tidak bentrok saat checkout bersamaan.
7. **Analytics & Inventory Velocity:**
   * **Re-Order Point (ROP):** Alert otomatis saat stok mencapai ambang batas kritis pengadaan ulang.
   * **Slow-Moving Engine:** Kategorisasi otomatis barang *Fast-Moving* ($\le 14$ hari), *Slow-Moving* ($> 45$ hari), dan *Dead Stock* ($> 90$ hari tanpa transaksi) untuk memberikan rekomendasi promo/clearance sale.
8. **Role-Based Access Control (RBAC):**
   Pembagian akses pengguna menjadi 3 role utama: `OWNER` (Full Access & Analytics), `GUDANG` (Pembelian, Inbound & Stock Management), dan `KASIR` (POS Operations).

---

## 5. Documentation Structure in Repository

Proyek ini dikembangkan dengan pendekatan *Specification-Driven Development (SDD)* berpanduan pada dokumen berikut di root repositori:

1. `PRODUCT_KNOWLEDGE.md` – Aturan bisnis fashion, SKU matrix, diskon & pajak, logika velocity stok, & HPP.
2. `TECH_KNOWLEDGE.md` – Konvensi teknis Bun + Elysia + Drizzle + PostgreSQL & standar error handling.
3. `DESIGN.md` – ERD Database Schema Blueprint & alur data FIFO engine.
4. `API_SPECIFICATION.md` – Kontrak REST API & JSON payload endpoints.
5. `DEVELOPMENT_ROADMAP.md` – Tahapan Sprint MVP: Master Data → Pembelian & Adjustment Stok → Penjualan/POS → Dashboard & Laporan → Settings.

---

## 6. Instruction for AI Coding Agent

Apabila bertindak sebagai AI Coding Agent untuk proyek ini:

* Selalu patuhi skema database Drizzle dan struktur folder yang ditentukan pada `TECH_KNOWLEDGE.md` dan `DESIGN.md`.
* Gunakan konvensi `snake_case` untuk kolom database PostgreSQL dan `camelCase` pada TypeScript/Drizzle models.
* Pastikan logika pemotongan stok pada transaksi checkout POS memeriksa mode costing aktif (`FIFO` atau `AVERAGE`) dari `system_settings`.
* Pastikan diskon (per-item maupun keseluruhan) dan pajak (PPN/PPh) pada transaksi POS selalu di-*snapshot* nilainya (nama, tipe, rate/nominal) ke `sales_orders`/`sales_order_items`, bukan hanya menyimpan foreign key ke master data.
* Perhatikan arah efek pajak pada `grandTotal`: **PPN menambah**, **PPh mengurangi**. Jangan disatukan jadi satu kolom `taxAmount` — gunakan `ppnAmount` dan `pphAmount` terpisah.
* Adjustment stok tidak boleh ditulis lewat modul pembelian/penjualan — harus lewat modul `stock-adjustments` sendiri agar audit trail-nya jelas.
* Generate `invoice_number` wajib pakai mekanisme *upsert-and-increment* atomik pada `invoice_counters` (lihat `DESIGN.md` §2.5) di dalam transaksi database yang sama dengan penulisan `sales_orders` — jangan pakai `COUNT(*)` biasa karena rentan race condition saat beberapa kasir checkout bersamaan.
* Jangan menambahkan konsep multi-warehouse/multi-cabang (`warehouse_id`, dst.) pada MVP ini — sistem sengaja didesain single warehouse (lihat `PRODUCT_KNOWLEDGE.md` §8).
