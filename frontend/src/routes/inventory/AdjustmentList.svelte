<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { PlusOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../../lib/api';
  import AppTable from '../../lib/components/AppTable.svelte';
  import AppButton from '../../lib/components/AppButton.svelte';

  interface AdjustmentRow {
    id: string;
    adjustmentCode: string;
    type: string;
    reason: string;
    totalItems: number;
    status: string;
    createdAt: string;
  }

  let rows = $state<AdjustmentRow[]>([]);
  let loading = $state(false);
  let errorMessage = $state('');

  async function loadRows() {
    loading = true;
    errorMessage = '';
    try {
      rows = await api.get<AdjustmentRow[]>('/stock-adjustments');
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat data adjustment';
    } finally {
      loading = false;
    }
  }

  onMount(loadRows);

  async function postAdjustment(row: AdjustmentRow) {
    if (!confirm(`Posting "${row.adjustmentCode}"? Stok akan disesuaikan otomatis dan tidak bisa dibatalkan.`)) return;
    errorMessage = '';
    try {
      await api.post(`/stock-adjustments/${row.id}/post`);
      await loadRows();
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal posting adjustment';
    }
  }

  const displayRows = $derived(
    rows.map((r) => ({ ...r, createdAtLabel: new Date(r.createdAt).toLocaleDateString('id-ID') })),
  );
</script>

<div class="mb-4 flex items-center justify-between">
  <h1 class="text-lg font-semibold text-slate-900">Adjustment Stok</h1>
  <AppButton onclick={() => push('/inventory/adjustments/create')}>
    <PlusOutline class="me-1.5 h-4 w-4" /> Buat Adjustment
  </AppButton>
</div>
<p class="mb-6 text-sm text-slate-500">Untuk stock opname (koreksi selisih fisik) maupun input saldo awal saat KaiNova baru digunakan.</p>

<div class="rounded-xl border border-slate-200 bg-white p-5">
  {#if errorMessage}<p class="mb-3 text-sm text-red-600">{errorMessage}</p>{/if}

  <AppTable
    {loading}
    rows={displayRows}
    emptyText="Belum ada adjustment."
    columns={[
      { key: 'adjustmentCode', label: 'Kode' },
      { key: 'reason', label: 'Alasan' },
      { key: 'totalItems', label: 'Total Item', align: 'right', format: 'number' },
      { key: 'status', label: 'Status', format: 'badge' },
      { key: 'createdAtLabel', label: 'Tanggal' },
    ]}
  >
    {#snippet rowActions(row)}
      {#if row.status === 'DRAFT'}
        <button
          onclick={() => postAdjustment(row as unknown as AdjustmentRow)}
          class="text-xs font-medium text-primary-600 hover:underline"
        >
          Post
        </button>
      {:else}
        <span class="text-xs text-slate-400">—</span>
      {/if}
    {/snippet}
  </AppTable>
</div>
