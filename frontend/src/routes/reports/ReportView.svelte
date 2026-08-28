<script lang="ts">
  // MVP 3 Phase 4 — Dedicated Reporting Sub-Modules: pengganti dropdown-select laporan
  // tunggal (Reports.svelte lama) dengan 6 route dedicated di Accordion Sidebar, semuanya
  // dirender lewat satu komponen generik ini (mirip pola MasterDataList per-tab).
  import { get } from 'svelte/store';
  import { FileExportOutline, FilePdfOutline, PrinterOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../../lib/api';
  import { authState } from '../../lib/stores/auth';
  import AppSelect from '../../lib/components/AppSelect.svelte';
  import AppButton from '../../lib/components/AppButton.svelte';
  import AppTable, { type AppTableColumn } from '../../lib/components/AppTable.svelte';

  let { params } = $props<{ params?: { slug?: string } }>();

  type FilterKind = 'channel' | 'supplier' | 'category';
  interface ReportConfig {
    label: string;
    apiPath: string;
    filters: FilterKind[];
    roles: string[];
  }

  const REPORT_CONFIG: Record<string, ReportConfig> = {
    sales: { label: 'Penjualan & Produk Terlaris', apiPath: '/reports/sales', filters: ['channel', 'category'], roles: ['OWNER'] },
    purchases: { label: 'Pembelian per Supplier', apiPath: '/reports/purchases', filters: ['supplier'], roles: ['OWNER'] },
    'inventory-valuation': {
      label: 'Stok & Valuasi Inventaris',
      apiPath: '/reports/stock',
      filters: ['category'],
      roles: ['OWNER', 'GUDANG'],
    },
    'stock-adjustments': { label: 'Adjustment Stok', apiPath: '/reports/stock-adjustments', filters: [], roles: ['OWNER', 'GUDANG'] },
    'profit-and-loss': { label: 'Laba Rugi (Profit & Loss)', apiPath: '/reports/profit-loss', filters: [], roles: ['OWNER'] },
    'payment-reconciliation': {
      label: 'Rekonsiliasi Pembayaran',
      apiPath: '/reports/payment-reconciliation',
      filters: ['channel'],
      roles: ['OWNER'],
    },
  };

  const CHANNEL_OPTIONS = [
    { value: 'POS', name: 'POS (Toko)' },
    { value: 'ONLINE', name: 'Online' },
  ];

  // Label & format kolom Indonesia — union dari seluruh laporan backend (lihat
  // backend/src/modules/reports/index.ts), dipakai supaya tabel di sini konsisten
  // dengan header yang sama persis dipakai file export PDF/Excel.
  const MONEY_KEYS = new Set([
    'subtotal',
    'itemDiscountTotal',
    'discountAmount',
    'discountTotal',
    'dpp',
    'ppnAmount',
    'pphAmount',
    'grandTotal',
    'totalCost',
    'costOfGoods',
    'grossProfit',
    'avgCost',
    'totalValuation',
    'revenue',
    'margin',
    'totalAmount',
  ]);
  const QTY_KEYS = new Set([
    'totalQty',
    'totalStock',
    'totalReceived',
    'totalSold',
    'totalItems',
    'totalDifferenceQty',
    'agingDays',
    'transactionCount',
  ]);
  const DATE_KEYS = new Set(['date', 'createdAt', 'receivedAt', 'postedAt', 'lastMovementAt']);
  // Kolom internal yang dipakai untuk kalkulasi (agingDays) tapi tidak perlu ditampilkan mentah.
  const HIDDEN_KEYS = new Set(['lastMovementAt']);
  const BADGE_KEYS = new Set(['status']);
  const LABELS: Record<string, string> = {
    invoiceNumber: 'No. Invoice',
    date: 'Tanggal',
    channel: 'Channel',
    customerName: 'Customer',
    subtotal: 'Subtotal',
    itemDiscountTotal: 'Diskon Item',
    discountAmount: 'Diskon Keseluruhan',
    discountTotal: 'Total Diskon',
    dpp: 'DPP',
    ppnAmount: 'PPN',
    pphAmount: 'PPh',
    grandTotal: 'Grand Total',
    supplierName: 'Supplier',
    status: 'Status',
    createdAt: 'Dibuat',
    receivedAt: 'Diterima',
    postedAt: 'Diposting',
    totalQty: 'Total Qty',
    totalCost: 'Total Biaya',
    sku: 'SKU',
    productName: 'Produk',
    totalStock: 'Stok Saat Ini',
    totalReceived: 'Total Masuk',
    totalSold: 'Total Terjual',
    type: 'Tipe',
    reason: 'Alasan',
    totalItems: 'Jumlah Item',
    totalDifferenceQty: 'Total Selisih Qty',
    costOfGoods: 'HPP',
    grossProfit: 'Laba Kotor',
    avgCost: 'HPP Rata-Rata',
    totalValuation: 'Total Valuasi',
    agingDays: 'Umur Mengendap (hari)',
    revenue: 'Omset',
    margin: 'Margin',
    paymentMethod: 'Metode Bayar',
    transactionCount: 'Jumlah Transaksi',
    totalAmount: 'Total Nominal',
  };

  function columnsFromRow(row: Record<string, unknown>): AppTableColumn[] {
    return Object.keys(row)
      .filter((key) => !HIDDEN_KEYS.has(key))
      .map((key) => ({
      key,
      label: LABELS[key] ?? key,
      align: MONEY_KEYS.has(key) || QTY_KEYS.has(key) ? 'right' : 'left',
      format: MONEY_KEYS.has(key) ? 'currency' : QTY_KEYS.has(key) ? 'number' : BADGE_KEYS.has(key) ? 'badge' : 'text',
    }));
  }

  function displayRow(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = DATE_KEYS.has(key) && value ? new Date(String(value)).toLocaleDateString('id-ID') : value;
    }
    return out;
  }

  function defaultDate(daysAgo: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  }

  const slug = $derived(params?.slug ?? 'sales');
  const config = $derived(REPORT_CONFIG[slug] ?? REPORT_CONFIG.sales!);

  let from = $state(defaultDate(30));
  let to = $state(defaultDate(0));
  let channel = $state('');
  let supplierId = $state('');
  let categoryId = $state('');
  let loading = $state(false);
  let errorMessage = $state('');
  let result = $state<{ rows: Record<string, unknown>[]; totals: Record<string, unknown> } | null>(null);
  let exporting = $state(false);

  // Panel kedua khusus report 'sales' — Top Products (Qty, Omset, HPP, Margin).
  let topProducts = $state<Record<string, unknown>[]>([]);
  let topProductsLoading = $state(false);

  let suppliers = $state<Array<{ id: string; name: string }>>([]);
  let categories = $state<Array<{ id: string; name: string }>>([]);

  async function loadFilterOptions() {
    if (config.filters.includes('supplier') && suppliers.length === 0) {
      suppliers = await api.get<Array<{ id: string; name: string }>>('/suppliers', { isActive: true });
    }
    if (config.filters.includes('category') && categories.length === 0) {
      categories = await api.get<Array<{ id: string; name: string }>>('/categories', { isActive: true });
    }
  }

  function buildFilterParams(): Record<string, string | undefined> {
    return {
      from: from || undefined,
      to: to || undefined,
      channel: config.filters.includes('channel') && channel ? channel : undefined,
      supplier_id: config.filters.includes('supplier') && supplierId ? supplierId : undefined,
      category_id: config.filters.includes('category') && categoryId ? categoryId : undefined,
    };
  }

  async function loadReport() {
    loading = true;
    errorMessage = '';
    try {
      await loadFilterOptions();
      result = await api.get(config.apiPath, buildFilterParams());
      if (slug === 'sales') {
        topProductsLoading = true;
        const topProductsResult = await api.get<{ rows: Record<string, unknown>[] }>('/reports/sales/top-products', {
          from: from || undefined,
          to: to || undefined,
        });
        topProducts = topProductsResult.rows;
      } else {
        topProducts = [];
      }
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat laporan';
    } finally {
      loading = false;
      topProductsLoading = false;
    }
  }

  // Autoload — data langsung tampil saat halaman/sub-menu dibuka dengan filter default
  // 30 hari terakhir, tanpa harus menekan tombol Tampilkan dulu.
  $effect(() => {
    slug;
    channel = '';
    supplierId = '';
    categoryId = '';
    result = null;
    loadReport();
  });

  function printReport() {
    window.print();
  }

  async function exportReport(format: 'pdf' | 'xlsx') {
    exporting = true;
    errorMessage = '';
    try {
      const filters = buildFilterParams();
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
      params.set('format', format);

      const token = get(authState).token;
      const res = await fetch(`/v1${config.apiPath}?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Gagal export laporan');

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `laporan.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      errorMessage = `Gagal export ke ${format.toUpperCase()}`;
    } finally {
      exporting = false;
    }
  }
</script>

<h1 class="mb-6 text-lg font-semibold text-slate-900">Laporan — {config.label}</h1>

<div class="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5 print:hidden">
  <div>
    <label for="from" class="mb-1 block text-sm font-medium text-slate-700">
      Dari Tanggal <span class="text-red-600">*</span>
    </label>
    <input id="from" type="date" bind:value={from} class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
  </div>
  <div>
    <label for="to" class="mb-1 block text-sm font-medium text-slate-700">
      Sampai Tanggal <span class="text-red-600">*</span>
    </label>
    <input id="to" type="date" bind:value={to} class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
  </div>
  {#if config.filters.includes('channel')}
    <div class="w-40">
      <AppSelect label="Channel" name="channel" placeholder="Semua" items={CHANNEL_OPTIONS} bind:value={channel} />
    </div>
  {/if}
  {#if config.filters.includes('supplier')}
    <div class="w-48">
      <AppSelect
        label="Supplier"
        name="supplierId"
        placeholder="Semua Supplier"
        items={suppliers.map((s) => ({ value: s.id, name: s.name }))}
        bind:value={supplierId}
      />
    </div>
  {/if}
  {#if config.filters.includes('category')}
    <div class="w-48">
      <AppSelect
        label="Kategori"
        name="categoryId"
        placeholder="Semua Kategori"
        items={categories.map((c) => ({ value: c.id, name: c.name }))}
        bind:value={categoryId}
      />
    </div>
  {/if}
  <AppButton onclick={loadReport} loading={loading}>Tampilkan</AppButton>
  {#if result}
    <AppButton variant="outline" onclick={printReport}>
      <PrinterOutline class="me-1.5 h-4 w-4" /> Print
    </AppButton>
    <AppButton variant="outline" loading={exporting} onclick={() => exportReport('pdf')}>
      <FilePdfOutline class="me-1.5 h-4 w-4" /> Export PDF
    </AppButton>
    <AppButton variant="outline" loading={exporting} onclick={() => exportReport('xlsx')}>
      <FileExportOutline class="me-1.5 h-4 w-4" /> Export Excel
    </AppButton>
  {/if}
</div>

{#if errorMessage}<p class="mb-4 text-sm text-red-600">{errorMessage}</p>{/if}

{#if result}
  <div class="rounded-xl border border-slate-200 bg-white p-5 print:border-0 print:p-0">
    <AppTable
      {loading}
      rows={result.rows.map(displayRow)}
      columns={result.rows.length > 0 ? columnsFromRow(result.rows[0]!) : []}
      totals={Object.keys(result.totals).length > 0 ? result.totals : undefined}
      pageSize={20}
      emptyText="Tidak ada data untuk filter yang dipilih."
    />
  </div>

  {#if slug === 'sales'}
    <div class="mt-6 rounded-xl border border-slate-200 bg-white p-5 print:border-0 print:p-0">
      <h2 class="mb-3 text-sm font-semibold text-slate-900">Produk Terlaris (berdasarkan Qty Terjual)</h2>
      <AppTable
        loading={topProductsLoading}
        rows={topProducts}
        columns={[
          { key: 'sku', label: 'SKU' },
          { key: 'productName', label: 'Produk' },
          { key: 'totalQty', label: 'Qty Terjual', align: 'right', format: 'number' },
          { key: 'revenue', label: 'Omset', align: 'right', format: 'currency' },
          { key: 'costOfGoods', label: 'HPP', align: 'right', format: 'currency' },
          { key: 'margin', label: 'Margin', align: 'right', format: 'currency' },
        ]}
        pageSize={10}
        emptyText="Belum ada penjualan pada rentang tanggal ini."
      />
    </div>
  {/if}
{:else if loading}
  <p class="text-sm text-slate-500">Memuat...</p>
{/if}

<style>
  @media print {
    :global(nav),
    :global(header) {
      display: none !important;
    }
  }
</style>
