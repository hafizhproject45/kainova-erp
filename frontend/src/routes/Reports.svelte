<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { FileExportOutline, FilePdfOutline, PrinterOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../lib/api';
  import { authState } from '../lib/stores/auth';
  import AppSelect from '../lib/components/AppSelect.svelte';
  import AppButton from '../lib/components/AppButton.svelte';
  import AppTable, { type AppTableColumn } from '../lib/components/AppTable.svelte';

  const reportTypes = [
    { path: '/reports/sales', name: 'Penjualan' },
    { path: '/reports/purchases', name: 'Pembelian' },
    { path: '/reports/stock', name: 'Stok' },
    { path: '/reports/stock-adjustments', name: 'Adjustment Stok' },
    { path: '/reports/profit-loss', name: 'Laba Rugi' },
  ];

  // Label & format kolom Indonesia — union dari seluruh 5 laporan backend
  // (lihat backend/src/modules/reports/index.ts), dipakai supaya tabel di sini
  // konsisten dengan header yang sama persis dipakai file export PDF/Excel.
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
  ]);
  const QTY_KEYS = new Set(['totalQty', 'totalStock', 'totalReceived', 'totalSold', 'totalItems', 'totalDifferenceQty']);
  const DATE_KEYS = new Set(['date', 'createdAt', 'receivedAt', 'postedAt']);
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
  };

  function columnsFromRow(row: Record<string, unknown>): AppTableColumn[] {
    return Object.keys(row).map((key) => ({
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

  let selectedReport = $state(reportTypes[0]!.path);
  let from = $state(defaultDate(30));
  let to = $state(defaultDate(0));
  let loading = $state(false);
  let errorMessage = $state('');
  let result = $state<{ rows: Record<string, unknown>[]; totals: Record<string, unknown> } | null>(null);
  let exporting = $state(false);

  async function loadReport() {
    loading = true;
    errorMessage = '';
    try {
      result = await api.get(selectedReport, { from: from || undefined, to: to || undefined });
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat laporan';
    } finally {
      loading = false;
    }
  }

  // Autoload (DEVELOPMENT_ROADMAP_MVP_2.md Phase 4): data langsung tampil saat halaman dibuka
  // dengan filter default 30 hari terakhir, tanpa harus menekan tombol Tampilkan dulu.
  onMount(loadReport);

  function printReport() {
    window.print();
  }

  async function exportReport(format: 'pdf' | 'xlsx') {
    exporting = true;
    errorMessage = '';
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('format', format);

      const token = get(authState).token;
      const res = await fetch(`/v1${selectedReport}?${params.toString()}`, {
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

<h1 class="mb-6 text-lg font-semibold text-slate-900">Laporan</h1>

<div class="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5 print:hidden">
  <div class="w-48">
    <AppSelect
      label="Jenis Laporan"
      name="reportType"
      required
      items={reportTypes.map((r) => ({ value: r.path, name: r.name }))}
      bind:value={selectedReport}
    />
  </div>
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
