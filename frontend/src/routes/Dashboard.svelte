<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiClientError } from '../lib/api';

  interface DashboardSummary {
    todayRevenue: number;
    todayTransactions: number;
    grossProfitToday: number;
    lowStockAlerts: Array<{ sku: string; totalStock: number }>;
    revenueTrend: Array<{ date: string; revenue: number }>;
  }

  let summary = $state<DashboardSummary | null>(null);
  let errorMessage = $state('');
  let loading = $state(true);

  function formatRupiah(value: number): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
      value,
    );
  }

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
      <p class="mt-2 text-2xl font-semibold text-slate-900">{summary.todayTransactions}</p>
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
                class="w-full rounded-t bg-indigo-500 transition-all"
                style="height: {Math.max(2, (t.revenue / maxTrendRevenue) * 100)}%"
              ></div>
            </div>
            <span class="text-[10px] text-slate-500 sm:text-xs">{shortDate(t.date)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="mt-6 rounded-xl border border-slate-200 bg-white p-5">
    <h2 class="mb-3 text-sm font-semibold text-slate-800">Stok Kritis</h2>
    {#if summary.lowStockAlerts.length === 0}
      <p class="text-sm text-slate-500">Tidak ada stok kritis saat ini.</p>
    {:else}
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-left text-slate-500">
            <th class="pb-2 font-medium">SKU</th>
            <th class="pb-2 font-medium">Stok Tersisa</th>
          </tr>
        </thead>
        <tbody>
          {#each summary.lowStockAlerts as alert (alert.sku)}
            <tr class="border-b border-slate-100">
              <td class="py-2 font-mono text-xs">{alert.sku}</td>
              <td class="py-2 text-red-600">{alert.totalStock}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
{/if}
