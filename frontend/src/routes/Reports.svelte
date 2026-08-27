<script lang="ts">
  import { api, ApiClientError } from '../lib/api';

  const reportTypes = [
    { path: '/reports/sales', label: 'Penjualan' },
    { path: '/reports/purchases', label: 'Pembelian' },
    { path: '/reports/stock', label: 'Stok' },
    { path: '/reports/stock-adjustments', label: 'Adjustment Stok' },
    { path: '/reports/profit-loss', label: 'Laba Rugi' },
  ];

  let selectedReport = $state(reportTypes[0]!.path);
  let from = $state('');
  let to = $state('');
  let loading = $state(false);
  let errorMessage = $state('');
  let result = $state<{ rows: Record<string, unknown>[]; totals: Record<string, unknown> } | null>(null);

  async function loadReport() {
    loading = true;
    errorMessage = '';
    result = null;
    try {
      result = await api.get(selectedReport, { from: from || undefined, to: to || undefined });
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat laporan';
    } finally {
      loading = false;
    }
  }

  function printReport() {
    window.print();
  }
</script>

<h1 class="mb-6 text-lg font-semibold text-slate-900">Laporan</h1>

<div class="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5 print:hidden">
  <div>
    <label for="report-type" class="mb-1 block text-xs font-medium text-slate-600">Jenis Laporan</label>
    <select id="report-type" bind:value={selectedReport} class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
      {#each reportTypes as report (report.path)}
        <option value={report.path}>{report.label}</option>
      {/each}
    </select>
  </div>
  <div>
    <label for="from" class="mb-1 block text-xs font-medium text-slate-600">Dari Tanggal</label>
    <input id="from" type="date" bind:value={from} class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
  </div>
  <div>
    <label for="to" class="mb-1 block text-xs font-medium text-slate-600">Sampai Tanggal</label>
    <input id="to" type="date" bind:value={to} class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
  </div>
  <button onclick={loadReport} class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
    Tampilkan
  </button>
  {#if result}
    <button onclick={printReport} class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
      Print
    </button>
    <button disabled title="TODO: backend belum implementasi export PDF" class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-400">
      Export PDF
    </button>
    <button disabled title="TODO: backend belum implementasi export Excel" class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-400">
      Export Excel
    </button>
  {/if}
</div>

{#if loading}
  <p class="text-sm text-slate-500">Memuat...</p>
{:else if errorMessage}
  <p class="text-sm text-red-600">{errorMessage}</p>
{:else if result}
  <div class="rounded-xl border border-slate-200 bg-white p-5">
    {#if result.rows.length === 0}
      <p class="text-sm text-amber-600">
        Belum ada data — endpoint laporan ini masih placeholder di backend (lihat DEVELOPMENT_ROADMAP.md Phase 4).
      </p>
    {:else}
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-left text-slate-500">
            {#each Object.keys(result.rows[0] ?? {}) as col (col)}
              <th class="pb-2 pr-4 font-medium">{col}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each result.rows as row, i (i)}
            <tr class="border-b border-slate-100">
              {#each Object.values(row) as val, j (j)}
                <td class="py-2 pr-4">{String(val)}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
{/if}
