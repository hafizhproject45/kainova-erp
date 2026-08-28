// Konfigurasi terpusat 7 Master Data (Phase 2 MVP 2): dipakai bareng oleh
// MasterDataList.svelte & MasterDataForm.svelte supaya routing dedicated
// (List/Create/Edit) tetap konsisten tanpa duplikasi metadata per modul.
import type { AppTableColumn } from './components/AppTable.svelte';

export type TabKey = 'categories' | 'products' | 'suppliers' | 'customers' | 'taxes' | 'discounts' | 'uoms';

export const MASTER_DATA_TABS: { key: TabKey; label: string; apiPath: string }[] = [
  { key: 'categories', label: 'Kategori', apiPath: '/categories' },
  { key: 'products', label: 'Produk & SKU', apiPath: '/products' },
  { key: 'suppliers', label: 'Supplier', apiPath: '/suppliers' },
  { key: 'customers', label: 'Customer', apiPath: '/customers' },
  { key: 'taxes', label: 'Pajak', apiPath: '/taxes' },
  { key: 'discounts', label: 'Diskon', apiPath: '/discounts' },
  { key: 'uoms', label: 'UOM (Satuan)', apiPath: '/uoms' },
];

export function tabConfig(key: TabKey) {
  return MASTER_DATA_TABS.find((t) => t.key === key) ?? MASTER_DATA_TABS[0]!;
}

export function columnsFor(tab: TabKey): AppTableColumn[] {
  switch (tab) {
    case 'categories':
      return [{ key: 'name', label: 'Nama' }];
    case 'uoms':
      return [
        { key: 'code', label: 'Kode' },
        { key: 'name', label: 'Nama' },
        { key: 'description', label: 'Deskripsi' },
      ];
    case 'products':
      return [
        { key: 'name', label: 'Nama Produk' },
        { key: 'categoryName', label: 'Kategori' },
        { key: 'uomName', label: 'UOM' },
      ];
    case 'suppliers':
    case 'customers':
      return [
        { key: 'name', label: 'Nama' },
        { key: 'phone', label: 'Telepon' },
        { key: 'email', label: 'Email' },
        { key: 'address', label: 'Alamat' },
      ];
    case 'taxes':
      return [
        { key: 'name', label: 'Nama' },
        { key: 'type', label: 'Tipe' },
        { key: 'rate', label: 'Rate (%)', align: 'right', format: 'number' },
        { key: 'statusLabel', label: 'Status', format: 'badge' },
      ];
    case 'discounts':
      return [
        { key: 'name', label: 'Nama' },
        { key: 'type', label: 'Tipe' },
        { key: 'value', label: 'Nilai', align: 'right', format: 'number' },
        { key: 'statusLabel', label: 'Status', format: 'badge' },
      ];
  }
}
