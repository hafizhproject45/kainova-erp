# PRODUCT_KNOWLEDGE.md - KaiNova ERP

## 1. Domain & Business Model

Sistem ERP ini dirancang untuk bisnis fashion (baju dan kerudung) dengan model operasional **Buying-Selling Murni** (pembelian barang jadi dari supplier) yang dijual secara **Multi-Channel** (Toko Offline/POS, Marketplace Shopee/Tokopedia/TikTok, dan Web/WA).

---

## 2. Advanced Matrix SKU System

Setiap produk tidak berdiri sendiri sebagai 1 item tunggal, melainkan diturunkan dari Parent Product menggunakan matriks kombinasi atribut:

`[Parent Model Code] - [Material] - [Color] - [Size]`

* **Parent Product:** Contoh: Gamis Abaya, Hijab Pashmina. Setiap Parent Product wajib terikat ke satu **Kategori Produk** (master data `categories`, bukan input teks bebas) — misal Baju, Kerudung, Aksesoris.
* **Atribut Variabel:**
  * **Model:** Kode desain/potongan.
  * **Material:** Voal, Ceruty, Cotton, Silk, Silk Premium.
  * **Warna:** Black, Navy, Rose Gold, Emerald, dll.
  * **Ukuran:** S, M, L, XL, XXL, All Size.
* **Contoh SKU Turunan:** `GMS-SLK-BLK-L` (Gamis - Silk - Black - L) atau `HJB-VOL-EMR-OS` (Hijab - Voal - Emerald - One Size).

---

## 3. Master Data (MVP)

Master data berikut wajib tersedia sebelum modul transaksi (Penjualan/Pembelian) dapat berjalan:

1. **Customer** — data pelanggan (nama, kontak, alamat). Bersifat opsional saat checkout POS (mendukung transaksi *walk-in*/tanpa nama pelanggan), tetapi wajib jika pelanggan meminta struk atas nama/invoice pajak.
2. **Supplier** — data vendor/pemasok barang, dipakai pada modul Pembelian.
3. **Pajak** — daftar jenis pajak yang berlaku (misal PPN 11%, PPh 0.5% untuk UMKM), masing-masing punya `rate` dan status aktif/nonaktif. Kasir memilih pajak mana yang berlaku saat checkout; nilainya bisa juga diset sebagai default di Settings.
4. **Diskon** — daftar diskon yang bisa dipakai kasir saat checkout, bertipe **Persentase** (%) atau **Nominal** (Rp tetap), dengan periode berlaku opsional (`valid_from` / `valid_until`). Diskon yang sama bisa diterapkan **per item produk** (misal produk tertentu lagi promo) maupun **atas keseluruhan transaksi** (misal diskon member) — keduanya bisa dipakai bersamaan dalam satu transaksi.
5. **Produk (Parent Product)** — data induk produk sebelum diturunkan ke varian SKU.
6. **Kategori Produk / SKU** — pengelompokan produk (Baju, Kerudung, Aksesoris, dll) dan daftar varian SKU hasil matriks (lihat Bagian 2).

---

## 4. Diskon & Pajak pada Transaksi Penjualan (POS)

* Saat checkout, kasir **dapat memilih**, semuanya opsional (tidak dipaksakan otomatis, karena tidak semua transaksi kena diskon/pajak):
  * **Diskon per item** — dipasang pada satu/lebih baris produk tertentu di keranjang (misal produk yang lagi promo).
  * **Diskon keseluruhan** — dipasang atas total transaksi (misal diskon member/kupon).
  * **PPN** — menambah tagihan yang dibayar customer.
  * **PPh** — mengurangi tagihan yang dibayar customer (dipotong langsung dari total, sesuai skema PPh yang ditanggung/dipotong penjual, misal PPh Final UMKM yang disetorkan dari omset).
* Urutan kalkulasi total transaksi:
  1. **Subtotal** = jumlah (`qty x price`) seluruh item di keranjang (sebelum diskon apa pun).
  2. **Diskon Per-Item** dihitung dan dikurangkan dari baris produk terkait (persentase dari `qty x price` baris tersebut, atau nominal tetap).
  3. **Diskon Keseluruhan** dihitung dari (Subtotal − total Diskon Per-Item), lalu dikurangkan → menghasilkan **DPP (Dasar Pengenaan Pajak)**.
  4. **PPN** dihitung dari DPP × rate PPN yang dipilih → **ditambahkan** ke total.
  5. **PPh** dihitung dari DPP × rate PPh yang dipilih → **dikurangkan** dari total.
  6. **Grand Total** = DPP + PPN − PPh.
* PPN dan PPh adalah dua slot pilihan yang **terpisah** (bukan satu dropdown pajak tunggal) karena arah efeknya berlawanan — kasir bisa pilih salah satu, keduanya sekaligus, atau tidak memilih pajak sama sekali.
* Nama diskon (per-item maupun keseluruhan), tipe, nilai, nama pajak PPN/PPh, dan rate yang dipakai **disalin (snapshot)** ke transaksi (`sales_orders` dan `sales_order_items`) pada saat checkout, supaya laporan historis tidak berubah walau master data diskon/pajak diedit atau dihapus di kemudian hari.

### Contoh Numerik

Item: 2 pcs @ Rp50.000 = Rp100.000, dengan diskon per-item 10% pada baris ini (−Rp10.000) → subtotal setelah diskon item = Rp90.000. Diskon keseluruhan 5% dari Rp90.000 (−Rp4.500) → DPP = Rp85.500. PPN 11% dari DPP (+Rp9.405). PPh 0.5% dari DPP (−Rp427,5). **Grand Total = 85.500 + 9.405 − 427,5 = Rp94.477,5.**

---

## 4A. Format Nomor Invoice / Struk

Setiap `sales_orders` yang berhasil checkout wajib punya `invoice_number` unik dengan format:

```
INV-{CHANNEL_CODE}-{YYYYMMDD}-{SEQ}
```

* `CHANNEL_CODE` — kode singkat channel penjualan, contoh: `POS` (toko fisik), `SHOPEE`, `TOKPED`, `TIKTOK`, `WA`.
* `YYYYMMDD` — tanggal transaksi (waktu lokal toko, bukan UTC).
* `SEQ` — nomor urut 4 digit (`0001`, `0002`, ...), **reset setiap hari, per channel**. Nomor urut ini sengaja dipisah per channel supaya urutan struk kasir toko fisik tetap rapi berurutan tanpa "diselang" nomor dari transaksi marketplace di hari yang sama.
* Contoh: transaksi ke-15 di toko fisik pada 27 Agustus 2026 → `INV-POS-20260827-0015`. Transaksi ke-3 dari Shopee di hari yang sama → `INV-SHOPEE-20260827-0003`.
* Nomor urut dijamin tidak bentrok meski ada beberapa kasir checkout bersamaan (lihat mekanisme *counter* atomik di `DESIGN.md` §2.4).

---

## 5. Dynamic Costing Engine (HPP / Cost of Goods Sold)

Sistem mendukung dua metode kalkulasi HPP yang dapat dipilih secara fleksibel melalui **Web Settings**:

### A. First-In, First-Out (FIFO)

* Stok dilacak per batch penerimaan (*goods receipt*).
* Saat transaksi penjualan terjadi, stok yang dikurangi adalah stok dari batch paling awal masuk.
* HPP dicatat presisi sesuai modal pembelian pada batch tersebut.

### B. Moving Average

* HPP diperbarui setiap kali ada penerimaan barang baru dengan rumus:
  $$\text{HPP Baru} = \frac{(\text{Stok Lama} \times \text{HPP Lama}) + (\text{Stok Baru} \times \text{Harga Beli Baru})}{\text{Total Stok Baru}}$$

---

## 6. Adjustment Stok (Stock Opname & Saldo Awal)

Modul ini menangani dua skenario yang **bukan** transaksi jual/beli:

* **Saldo Awal (Opening Balance):** saat KaiNova pertama kali digunakan, stok fisik existing gudang perlu dimasukkan ke sistem tanpa melalui alur Purchase Order. Setiap item saldo awal membuat satu `inventory_batch` baru dengan `unitCost` sesuai HPP terakhir yang diketahui (atau input manual).
* **Stock Opname (Koreksi Berkala):** membandingkan stok tercatat di sistem (`systemQty`) dengan stok hasil hitung fisik di gudang/toko (`actualQty`). Selisihnya (`differenceQty`) diposting sebagai adjustment:
  * Selisih **lebih** (`actualQty > systemQty`) → menambah batch stok baru.
  * Selisih **kurang** (`actualQty < systemQty`) → mengurangi stok dari batch tertua (mengikuti logika FIFO) dan dicatat sebagai *shrinkage*/susut.
* Setiap adjustment wajib punya `reason` (contoh: "Stock Opname Q1 2026", "Barang Rusak", "Input Saldo Awal Migrasi Sistem") untuk audit trail, dan status `DRAFT` → `POSTED` (adjustment baru memengaruhi stok setelah di-posting, mencegah perubahan tidak sengaja).

---

## 7. Analytics & Inventory Velocity Rules

### A. Re-Order Point (ROP) Alerts

Notifikasi otomatis dikirimkan ke Admin jika stok berada di bawah batas kritis:
$$\text{ROP} = (\text{Penjualan Rata-rata Harian} \times \text{Lead Time Supplier dalam Hari}) + \text{Safety Stock}$$

### B. Slow-Moving & Dead Stock Engine

Pergerakan barang dikategorikan berdasarkan parameter *Threshold Settings* di Admin Panel:

* **Fast-Moving:** Stok habis/terjual $\ge 80\%$ dalam kurun waktu $\le 14$ hari.
* **Regular-Moving:** Penjualan stabil sesuai proyeksi (habis dalam 15–44 hari).
* **Slow-Moving:** Penjualan di bawah target dalam kurun waktu $> 45$ hari.
* **Dead Stock:** Tidak ada transaksi penjualan sama sekali selama $> 90$ hari sejak barang masuk gudang.

*Tindakan Otomatis ERP:* Menyajikan data rekomendasi promo (bundle discount, clearance sale) untuk melepas dead stock menjadi cash flow — memanfaatkan master data **Diskon** yang sama dengan yang dipakai di POS.

---

## 8. Multi-Channel Stock Management

* **Single Warehouse (Keputusan MVP):** Sistem ini didesain untuk **satu lokasi stok fisik** (satu gudang/toko Popyshop). Tidak ada konsep multi-lokasi/multi-cabang pada MVP — semua `inventory_batches` merepresentasikan stok di lokasi tunggal tersebut. Dukungan multi-warehouse (stok per cabang, transfer antar-lokasi) adalah *enhancement* di luar scope MVP dan butuh perubahan skema (`warehouse_id` di `inventory_batches`, `sales_orders`, `purchase_orders`, dst.) jika dibutuhkan di masa depan.
* **Central Stock Pool:** Satu basis data stok terpusat (dari lokasi tunggal di atas) yang melayani transaksi POS toko fisik dan pesanan marketplace/online — "multi-channel" di sini berarti *channel penjualan* (POS, Shopee, Tokopedia, dll.), bukan multi-lokasi fisik.
* **Safety Stock Locking:** Fitur alokasi stok sementara untuk promo khusus (misal: Harbolnas/Ramadhan) agar tidak terjadi *overselling* lintas channel.

---

## 9. Laporan (Reports)

Semua laporan berikut wajib bisa **difilter** (rentang tanggal, kategori produk, channel penjualan, customer/supplier tertentu), **diprint** langsung dari browser, dan **diexport** ke PDF & Excel:

1. **Laporan Penjualan** — per transaksi, per produk/SKU, per channel, per kasir.
2. **Laporan Pembelian** — per PO, per supplier, per produk/SKU.
3. **Laporan Stok** — kartu stok per SKU (mutasi masuk/keluar/adjustment), stok saat ini per gudang.
4. **Laporan Adjustment Stok** — riwayat opname & saldo awal beserta alasan dan selisihnya.
5. **Laporan Laba Rugi** — omset, HPP, diskon, pajak, laba kotor per periode.
