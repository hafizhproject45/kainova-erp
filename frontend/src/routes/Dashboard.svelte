<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiClientError } from '../lib/api';
  import { formatNumber, formatRupiah } from '../lib/utils/formatters';
  import AppTable from '../lib/components/AppTable.svelte';
  import LineChart from '../lib/components/LineChart.svelte';
  import DonutChart from '../lib/components/DonutChart.svelte';

  interface DashboardSummary {
    todayRevenue: number;
    todayTransactions: number;
    grossProfitToday: number;
    totalPurchasingSpendThisMonth: number;
    lowStockAlerts: Array<{ sku: string; totalStock: number; rop: number }>;
    revenueTrend: Array<{ date: string; revenue: number }>;
    topSellingProducts: Array<{ sku: string; productName: string; qtySold: number }>;
    salesByCategory: Array<{ categoryName: string; revenue: number }>;
    salesByPaymentMethod: Array<{ method: string; revenue: number }>;
  }

  let summary = $state<DashboardSummary | null>(null);
  let errorMessage = $state('');
  let loading = $state(true);

  const trendPoints = $derived(
    (summary?.revenueTrend ?? []).map((t) => ({ label: shortDate(t.date), value: t.revenue })),
  );
  const categorySegments = $derived(
    (summary?.salesByCategory ?? []).map((c) => ({ label: c.categoryName, value: c.revenue })),
  );
  const paymentSegments = $derived(
    (summary?.salesByPaymentMethod ?? []).map((p) => ({ label: p.method, value: p.revenue })),
  );

  function shortDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  }

  onMount(async () => {
    try {
      summary = await api.get<DashboardSummary>('/dashboard/summary');
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat dashboard';
    } finally {
      loading = false;
    }
  });
</script>

<h1 class="mb-6 text-lg font-semibold text-slate-900">Dashboard</h1>

{#if loading}
  <p class="text-sm text-slate-500">Memuat...</p>
{:else if errorMessage}
  <p class="text-sm text-red-600">{errorMessage}</p>
{:else if summary}
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <p class="text-xs font-medium text-slate-500">Omset Hari Ini</p>
      <p class="mt-2 text-2xl font-semibold text-slate-900">{formatRupiah(summary.todayRevenue)}</p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <p class="text-xs font-medium text-slate-500">Transaksi Hari Ini</p>
      <p class="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(summary.todayTransactions)}</p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <p class="text-xs font-medium text-slate-500">Laba Kotor Hari Ini</p>
      <p class="mt-2 text-2xl font-semibold text-slate-900">{formatRupiah(summary.grossProfitToday)}</p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <p class="text-xs font-medium text-slate-500">Total PO Bulan Ini</p>
      <p class="mt-2 text-2xl font-semibold text-slate-900">{formatRupiah(summary.totalPurchasingSpendThisMonth)}</p>
    </div>
  </div>

  <div class="mt-6 rounded-xl border border-slate-200 bg-white p-5">
    <h2 class="mb-4 text-sm font-semibold text-slate-800">Tren Omset 7 Hari Terakhir</h2>
    {#if summary.revenueTrend.every((t) => t.revenue === 0)}
      <p class="text-sm text-slate-500">Belum ada transaksi dalam 7 hari terakhir.</p>
    {:else}
      <LineChart points={trendPoints} />
    {/if}
  </div>

  <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="mb-3 text-sm font-semibold text-slate-800">Penjualan per Kategori (30 Hari)</h2>
      <DonutChart segments={categorySegments} />
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="mb-3 text-sm font-semibold text-slate-800">Penjualan per Kanal Pembayaran (30 Hari)</h2>
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
      <h2 class="mb-3 text-sm font-semibold text-slate-800">Top 5 Produk Terlaris (30 Hari)</h2>
      <AppTable
        rows={summary.topSellingProducts}
        emptyText="Belum ada penjualan dalam 30 hari terakhir."
        columns={[
          { key: 'productName', label: 'Produk' },
          { key: 'sku', label: 'SKU' },
          { key: 'qtySold', label: 'Qty Terjual', align: 'right', format: 'number' },
        ]}
      />
    </div>
  </div>
{/if}
