// Konfigurasi terpusat 8 Master Data (MVP 3 Phase 1 menambahkan tab Varian & Toggle
// is_active standar): dipakai bareng oleh MasterDataList.svelte & MasterDataForm.svelte
// supaya routing dedicated (List/Create/Edit) tetap konsisten tanpa duplikasi metadata per modul.
import type { AppTableColumn } from './components/AppTable.svelte';

export type TabKey =
  | 'categories'
  | 'products'
  | 'variants'
  | 'suppliers'
  | 'customers'
  | 'taxes'
  | 'discounts'
  | 'uoms';

export const MASTER_DATA_TABS: { key: TabKey; label: string; apiPath: string }[] = [
  { key: 'categories', label: 'Kategori', apiPath: '/categories' },
  { key: 'products', label: 'Produk & SKU', apiPath: '/products' },
  { key: 'variants', label: 'Varian', apiPath: '/product-variants' },
  { key: 'suppliers', label: 'Supplier', apiPath: '/suppliers' },
  { key: 'customers', label: 'Customer', apiPath: '/customers' },
  { key: 'taxes', label: 'Pajak', apiPath: '/taxes' },
  { key: 'discounts', label: 'Diskon', apiPath: '/discounts' },
  { key: 'uoms', label: 'UOM (Satuan)', apiPath: '/uoms' },
];

export function tabConfig(key: TabKey) {
  return MASTER_DATA_TABS.find((t) => t.key === key) ?? MASTER_DATA_TABS[0]!;
}

// Status ditampilkan sebagai badge display-only di tabel index — perubahan status
// hanya dilakukan lewat form Add/Edit Master Data (AppToggle), bukan langsung dari tabel.
const statusColumn: AppTableColumn = { key: 'statusLabel', label: 'Status', format: 'badge' };

export function columnsFor(tab: TabKey): AppTableColumn[] {
  switch (tab) {
    case 'categories':
      return [{ key: 'name', label: 'Nama' }, statusColumn];
    case 'uoms':
      return [
        { key: 'code', label: 'Kode' },
        { key: 'name', label: 'Nama' },
        { key: 'description', label: 'Deskripsi' },
        statusColumn,
      ];
    case 'products':
      return [
        { key: 'name', label: 'Nama Produk' },
        { key: 'categoryName', label: 'Kategori' },
        { key: 'uomName', label: 'UOM' },
        { key: 'supplierName', label: 'Default Supplier' },
        statusColumn,
      ];
    case 'variants':
      return [
        { key: 'sku', label: 'SKU' },
        { key: 'productName', label: 'Produk' },
        { key: 'color', label: 'Warna' },
        { key: 'size', label: 'Ukuran' },
        { key: 'price', label: 'Harga', align: 'right', format: 'currency' },
        { key: 'totalStock', label: 'Stok', align: 'right', format: 'number' },
        statusColumn,
      ];
    case 'suppliers':
    case 'customers':
      return [
        { key: 'name', label: 'Nama' },
        { key: 'phone', label: 'Telepon' },
        { key: 'email', label: 'Email' },
        { key: 'address', label: 'Alamat' },
        statusColumn,
      ];
    case 'taxes':
      return [
        { key: 'name', label: 'Nama' },
        { key: 'type', label: 'Tipe' },
        { key: 'rate', label: 'Rate (%)', align: 'right', format: 'number' },
        statusColumn,
      ];
    case 'discounts':
      return [
        { key: 'name', label: 'Nama' },
        { key: 'type', label: 'Tipe' },
        { key: 'value', label: 'Nilai', align: 'right', format: 'number' },
        statusColumn,
      ];
  }
}
