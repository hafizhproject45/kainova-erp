<script lang="ts">
  import { onMount } from 'svelte';
  import { PrinterOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../lib/api';
  import { formatNumber, formatRupiah } from '../lib/utils/formatters';
  import AppTable from '../lib/components/AppTable.svelte';
  import AppButton from '../lib/components/AppButton.svelte';
  import AppInput from '../lib/components/AppInput.svelte';
  import LineChart from '../lib/components/LineChart.svelte';
  import DonutChart from '../lib/components/DonutChart.svelte';

  type Period = 'today' | 'month' | 'year' | 'custom';

  interface DashboardSummary {
    period: Period;
    rangeStart: string;
    rangeEnd: string;
    periodRevenue: number;
    periodTransactions: number;
    grossProfitPeriod: number;
    totalPurchasingSpend: number;
    lowStockAlerts: Array<{ sku: string; totalStock: number; rop: number }>;
    revenueTrend: Array<{ date: string; revenue: number }>;
    topSellingProducts: Array<{ sku: string; productName: string; qtySold: number }>;
    salesByCategory: Array<{ categoryName: string; revenue: number }>;
    salesByPaymentMethod: Array<{ method: string; revenue: number }>;
  }

  const PERIOD_OPTIONS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'month', label: 'Bulan Ini' },
    { key: 'year', label: 'Tahun Ini' },
    { key: 'custom', label: 'Custom' },
  ];

  function todayIso(): string {
    // Ambil komponen tanggal LOKAL, bukan toISOString() (yang mengonversi ke UTC dan bisa
    // mundur satu hari di timezone ber-offset negatif) — harus konsisten dgn parseLocalDate backend.
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  let period = $state<Period>('today');
  let customFrom = $state(todayIso());
  let customTo = $state(todayIso());

  let summary = $state<DashboardSummary | null>(null);
  let errorMessage = $state('');
  let loading = $state(true);

  const periodLabel = $derived(
    period === 'custom'
      ? `${customFrom} s/d ${customTo}`
      : (PERIOD_OPTIONS.find((p) => p.key === period)?.label ?? ''),
  );

  // Label sumbu-X Line Chart menyesuaikan granularitas bucket dari backend:
  // "HH:00" untuk today, "YYYY-MM-DD" untuk harian, "YYYY-MM" untuk bulanan (period=year/custom panjang).
  function trendLabel(raw: string): string {
    if (/^\d{2}:00$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return new Date(raw + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    }
    if (/^\d{4}-\d{2}$/.test(raw)) {
      const [y, m] = raw.split('-').map(Number);
      return new Date(y!, m! - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
    }
    return raw;
  }

  const trendPoints = $derived(
    (summary?.revenueTrend ?? []).map((t) => ({ label: trendLabel(t.date), value: t.revenue })),
  );
  const categorySegments = $derived(
    (summary?.salesByCategory ?? []).map((c) => ({ label: c.categoryName, value: c.revenue })),
  );
  const paymentSegments = $derived(
    (summary?.salesByPaymentMethod ?? []).map((p) => ({ label: p.method, value: p.revenue })),
  );

  async function loadSummary() {
    loading = true;
    errorMessage = '';
    try {
      summary = await api.get<DashboardSummary>(
        '/dashboard/summary',
        period === 'custom' ? { period, dateFrom: customFrom, dateTo: customTo } : { period },
      );
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat dashboard';
    } finally {
      loading = false;
    }
  }

  function selectPeriod(next: Period) {
    period = next;
    if (next !== 'custom') loadSummary();
  }

  function applyCustomRange() {
    if (!customFrom || !customTo || customFrom > customTo) {
      errorMessage = 'Rentang tanggal custom tidak valid.';
      return;
    }
    loadSummary();
  }

  function exportPdf() {
    // Export PDF (Dashboard Filtering) — pakai dialog print browser (Save as PDF),
    // konsisten dengan pola cetak struk (ReceiptPrint.svelte). Sidebar/header/filter
    // otomatis tersembunyi lewat class print:hidden di Layout.svelte & di bawah.
    window.print();
  }

  onMount(loadSummary);
</script>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
  <h1 class="text-lg font-semibold text-slate-900">Dashboard</h1>

  <div class="flex flex-wrap items-center gap-2">
    <div class="flex items-center rounded-lg border border-slate-300 bg-white p-1">
      {#each PERIOD_OPTIONS as opt (opt.key)}
        <button
          type="button"
          onclick={() => selectPeriod(opt.key)}
          class="rounded-md px-4 py-2 text-sm font-medium transition {period === opt.key
            ? 'bg-primary-600 text-white'
            : 'text-slate-600 hover:bg-slate-100'}"
        >
          {opt.label}
        </button>
      {/each}
    </div>

    {#if period === 'custom'}
      <AppInput type="date" name="dateFrom" bind:value={customFrom} class="w-[150px]" />
      <span class="text-xs text-slate-400">s/d</span>
      <AppInput type="date" name="dateTo" bind:value={customTo} class="w-[150px]" />
      <AppButton variant="outline" onclick={applyCustomRange}>Terapkan</AppButton>
    {/if}

    <AppButton variant="outline" onclick={exportPdf}>
      <PrinterOutline class="me-1.5 h-4 w-4" /> Export PDF
    </AppButton>
  </div>
</div>

<div class="mb-4 hidden print:block">
  <h1 class="text-lg font-semibold text-slate-900">Dashboard KaiNova ERP</h1>
  <p class="text-xs text-slate-500">
    Periode: {periodLabel} · Dicetak {new Date().toLocaleString('id-ID')}
  </p>
</div>

{#if loading}
  <p class="text-sm text-slate-500">Memuat...</p>
{:else if errorMessage}
  <p class="text-sm text-red-600">{errorMessage}</p>
{:else if summary}
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <p class="text-xs font-medium text-slate-500">Omset ({periodLabel})</p>
      <p class="mt-2 text-2xl font-semibold text-slate-900">{formatRupiah(summary.periodRevenue)}</p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <p class="text-xs font-medium text-slate-500">Transaksi ({periodLabel})</p>
      <p class="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(summary.periodTransactions)}</p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <p class="text-xs font-medium text-slate-500">Laba Kotor ({periodLabel})</p>
      <p class="mt-2 text-2xl font-semibold text-slate-900">{formatRupiah(summary.grossProfitPeriod)}</p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <p class="text-xs font-medium text-slate-500">Total PO ({periodLabel})</p>
      <p class="mt-2 text-2xl font-semibold text-slate-900">{formatRupiah(summary.totalPurchasingSpend)}</p>
    </div>
  </div>

  <div class="mt-6 rounded-xl border border-slate-200 bg-white p-5">
    <h2 class="mb-4 text-sm font-semibold text-slate-800">Tren Omset — {periodLabel}</h2>
    {#if summary.revenueTrend.every((t) => t.revenue === 0)}
      <p class="text-sm text-slate-500">Belum ada transaksi pada periode ini.</p>
    {:else}
      <LineChart points={trendPoints} />
    {/if}
  </div>

  <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="mb-3 text-sm font-semibold text-slate-800">Penjualan per Kategori — {periodLabel}</h2>
      <DonutChart segments={categorySegments} />
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="mb-3 text-sm font-semibold text-slate-800">Penjualan per Kanal Pembayaran — {periodLabel}</h2>
      <DonutChart segments={paymentSegments} />
    </div>
  </div>

  <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="mb-3 text-sm font-semibold text-slate-800">Stok Kritis (ROP Alert)</h2>
      <AppTable
        rows={summary.lowStockAlerts.map((a) => ({ ...a, statusLabel: 'ROP_ALERT' }))}
        emptyText="Tidak ada stok kritis saat ini."
        columns={[
          { key: 'sku', label: 'SKU' },
          { key: 'totalStock', label: 'Stok Tersisa', align: 'right', format: 'number' },
          { key: 'rop', label: 'Re-Order Point', align: 'right', format: 'number' },
          { key: 'statusLabel', label: 'Status', format: 'badge' },
        ]}
      />
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="mb-3 text-sm font-semibold text-slate-800">Top 5 Produk Terlaris — {periodLabel}</h2>
      <AppTable
        rows={summary.topSellingProducts}
        emptyText="Belum ada penjualan pada periode ini."
        columns={[
          { key: 'productName', label: 'Produk' },
          { key: 'sku', label: 'SKU' },
          { key: 'qtySold', label: 'Qty Terjual', align: 'right', format: 'number' },
        ]}
      />
    </div>
  </div>
{/if}
