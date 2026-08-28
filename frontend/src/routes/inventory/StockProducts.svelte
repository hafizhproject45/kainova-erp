<script lang="ts">
  // MVP 3 Phase 3 — Sub-Module 1: Stok Produk. Current Stock Summary Panel (semua SKU aktif,
  // qty real-time & valuasi) + Stock Ledger / Kartu Stok historikal per-SKU (drill-down).
  import { onMount } from 'svelte';
  import { ArrowLeftOutline, EyeOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../../lib/api';
  import AppTable from '../../lib/components/AppTable.svelte';
  import AppInput from '../../lib/components/AppInput.svelte';
  import { formatRupiah } from '../../lib/utils/formatters';

  interface StockSummaryRow {
    id: string;
    sku: string;
    color: string;
    size: string;
    productName: string;
    uomName: string | null;
    totalStock: number;
    avgCost: string;
    totalValuation: number;
  }
  interface LedgerRow {
    date: string;
    type: string;
    reference: string;
    qtyIn: number;
    qtyOut: number;
    endingBalance: number;
    unitCost: number;
    totalValuation: number;
  }
  interface LedgerResponse {
    variant: { id: string; sku: string; productName: string; color: string; size: string };
    ledger: LedgerRow[];
  }

  let rows = $state<StockSummaryRow[]>([]);
  let loading = $state(false);
  let errorMessage = $state('');
  let searchQuery = $state('');

  let selectedVariant = $state<{ id: string; sku: string; productName: string; color: string; size: string } | null>(null);
  let ledgerRows = $state<LedgerRow[]>([]);
  let ledgerLoading = $state(false);

  const totalStockValuation = $derived(rows.reduce((sum, r) => sum + r.totalValuation, 0));

  const displayRows = $derived(
    rows.map((r) => ({ ...r, variantLabel: [r.color, r.size].filter(Boolean).join('/') || '-' })),
  );

  const filteredRows = $derived(
    searchQuery.trim()
      ? displayRows.filter((r) => `${r.productName} ${r.sku}`.toLowerCase().includes(searchQuery.trim().toLowerCase()))
      : displayRows,
  );

  async function loadSummary() {
    loading = true;
    errorMessage = '';
    try {
      // Strict Filtering (MVP 3 Phase 1) — hanya SKU aktif di Current Stock Summary.
      rows = await api.get<StockSummaryRow[]>('/inventory/stock-summary', { isActive: true });
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat ringkasan stok';
    } finally {
      loading = false;
    }
  }

  async function openLedger(row: StockSummaryRow) {
    ledgerLoading = true;
    errorMessage = '';
    try {
      const res = await api.get<LedgerResponse>('/inventory/stock-ledger', { variantId: row.id });
      selectedVariant = res.variant;
      ledgerRows = res.ledger;
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat kartu stok';
    } finally {
      ledgerLoading = false;
    }
  }

  function closeLedger() {
    selectedVariant = null;
    ledgerRows = [];
  }

  onMount(loadSummary);
</script>

{#if selectedVariant}
  <div class="mb-4 flex items-center gap-3">
    <button
      onclick={closeLedger}
      class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
    >
      <ArrowLeftOutline class="h-4 w-4" /> Kembali ke Ringkasan
    </button>
    <h1 class="text-lg font-semibold text-slate-900">
      Kartu Stok — {selectedVariant.productName}
      {#if selectedVariant.color || selectedVariant.size}
        ({[selectedVariant.color, selectedVariant.size].filter(Boolean).join('/')})
      {/if}
    </h1>
  </div>
  <p class="mb-4 font-mono text-xs text-slate-500">{selectedVariant.sku}</p>

  {#if errorMessage}<p class="mb-3 text-sm text-red-600">{errorMessage}</p>{/if}

  <div class="rounded-xl border border-slate-200 bg-white p-5">
    <AppTable
      loading={ledgerLoading}
      rows={ledgerRows.map((r) => ({ ...r, dateLabel: new Date(r.date).toLocaleString('id-ID') }))}
      emptyText="Belum ada pergerakan stok untuk SKU ini."
      columns={[
        { key: 'dateLabel', label: 'Tanggal/Waktu' },
        { key: 'type', label: 'Jenis Transaksi', format: 'badge' },
        { key: 'reference', label: 'Referensi' },
        { key: 'qtyIn', label: 'Qty Masuk', align: 'right', format: 'number' },
        { key: 'qtyOut', label: 'Qty Keluar', align: 'right', format: 'number' },
        { key: 'endingBalance', label: 'Saldo Akhir Qty', align: 'right', format: 'number' },
        { key: 'unitCost', label: 'HPP Unit', align: 'right', format: 'currency' },
        { key: 'totalValuation', label: 'Total Valuasi', align: 'right', format: 'currency' },
      ]}
    />
  </div>
{:else}
  <div class="mb-4 flex items-center justify-between">
    <h1 class="text-lg font-semibold text-slate-900">Stok Produk</h1>
    <p class="text-sm text-slate-500">
      Total Valuasi Aset: <span class="font-semibold text-slate-800">{formatRupiah(totalStockValuation)}</span>
    </p>
  </div>
  <p class="mb-6 text-sm text-slate-500">Current Stock Summary — klik ikon mata untuk membuka Kartu Stok (Stock Ledger) historikal per SKU.</p>

  <div class="rounded-xl border border-slate-200 bg-white p-5">
    <div class="mb-4 flex items-center gap-2">
      <AppInput placeholder="Cari produk/SKU..." bind:value={searchQuery} class="sm:max-w-xs" />
    </div>

    {#if errorMessage}<p class="mb-3 text-sm text-red-600">{errorMessage}</p>{/if}

    <AppTable
      {loading}
      rows={filteredRows}
      emptyText="Belum ada data stok."
      columns={[
        { key: 'productName', label: 'Produk' },
        { key: 'sku', label: 'SKU' },
        { key: 'variantLabel', label: 'Varian' },
        { key: 'uomName', label: 'UOM' },
        { key: 'totalStock', label: 'Stok Saat Ini', align: 'right', format: 'number' },
        { key: 'avgCost', label: 'HPP Rata-Rata', align: 'right', format: 'currency' },
        { key: 'totalValuation', label: 'Total Valuasi', align: 'right', format: 'currency' },
      ]}
    >
      {#snippet rowActions(row)}
        <button
          aria-label="Lihat Kartu Stok"
          onclick={() => openLedger(row as unknown as StockSummaryRow)}
          class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
        >
          <EyeOutline class="h-4 w-4" /> Kartu Stok
        </button>
      {/snippet}
    </AppTable>
  </div>
{/if}
