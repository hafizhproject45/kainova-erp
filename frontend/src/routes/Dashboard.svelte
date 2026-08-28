<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiClientError } from '../lib/api';
  import { formatNumber, formatRupiah } from '../lib/utils/formatters';
  import AppTable from '../lib/components/AppTable.svelte';

  interface DashboardSummary {
    todayRevenue: number;
    todayTransactions: number;
    grossProfitToday: number;
    lowStockAlerts: Array<{ sku: string; totalStock: number; rop: number }>;
    revenueTrend: Array<{ date: string; revenue: number }>;
    topSellingProducts: Array<{ sku: string; productName: string; qtySold: number }>;
  }

  let summary = $state<DashboardSummary | null>(null);
  let errorMessage = $state('');
  let loading = $state(true);

  const maxTrendRevenue = $derived(Math.max(1, ...(summary?.revenueTrend.map((t) => t.revenue) ?? [1])));

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
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
  </div>

  <div class="mt-6 rounded-xl border border-slate-200 bg-white p-5">
    <h2 class="mb-4 text-sm font-semibold text-slate-800">Tren Omset 7 Hari Terakhir</h2>
    {#if summary.revenueTrend.every((t) => t.revenue === 0)}
      <p class="text-sm text-slate-500">Belum ada transaksi dalam 7 hari terakhir.</p>
    {:else}
      <div class="flex gap-2 sm:gap-4" style="height: 160px">
        {#each summary.revenueTrend as t (t.date)}
          <div class="flex flex-1 flex-col items-center gap-1" title={`${shortDate(t.date)}: ${formatRupiah(t.revenue)}`}>
            <div class="flex w-full flex-1 items-end">
              <div
                class="w-full rounded-t bg-primary-500 transition-all"
                style="height: {Math.max(2, (t.revenue / maxTrendRevenue) * 100)}%"
              ></div>
            </div>
            <span class="text-[10px] text-slate-500 sm:text-xs">{shortDate(t.date)}</span>
          </div>
        {/each}
      </div>
    {/if}
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
