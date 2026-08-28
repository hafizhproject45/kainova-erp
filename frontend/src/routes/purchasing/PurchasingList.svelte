<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { PlusOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../../lib/api';
  import AppTable from '../../lib/components/AppTable.svelte';
  import AppButton from '../../lib/components/AppButton.svelte';

  interface PurchaseOrderRow {
    id: string;
    poNumber: string;
    supplierName: string;
    totalAmount: number;
    status: string;
    createdAt: string;
  }

  let rows = $state<PurchaseOrderRow[]>([]);
  let loading = $state(false);
  let errorMessage = $state('');

  async function loadRows() {
    loading = true;
    errorMessage = '';
    try {
      rows = await api.get<PurchaseOrderRow[]>('/purchase-orders');
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat data Purchase Order';
    } finally {
      loading = false;
    }
  }

  onMount(loadRows);

  async function receivePO(row: PurchaseOrderRow) {
    if (!confirm(`Tandai "${row.poNumber}" sebagai diterima? Stok akan bertambah otomatis.`)) return;
    errorMessage = '';
    try {
      await api.post(`/purchase-orders/${row.id}/receive`);
      await loadRows();
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal menerima barang';
    }
  }

  const displayRows = $derived(
    rows.map((r) => ({ ...r, createdAtLabel: new Date(r.createdAt).toLocaleDateString('id-ID') })),
  );
</script>

<div class="mb-4 flex items-center justify-between">
  <h1 class="text-lg font-semibold text-slate-900">Pembelian</h1>
  <AppButton onclick={() => push('/purchasing/create')}>
    <PlusOutline class="me-1.5 h-4 w-4" /> Buat Purchase Order
  </AppButton>
</div>

<div class="rounded-xl border border-slate-200 bg-white p-5">
  {#if errorMessage}<p class="mb-3 text-sm text-red-600">{errorMessage}</p>{/if}

  <AppTable
    {loading}
    rows={displayRows}
    emptyText="Belum ada Purchase Order."
    columns={[
      { key: 'poNumber', label: 'No. PO' },
      { key: 'supplierName', label: 'Supplier' },
      { key: 'totalAmount', label: 'Total', align: 'right', format: 'currency' },
      { key: 'status', label: 'Status', format: 'badge' },
      { key: 'createdAtLabel', label: 'Tanggal' },
    ]}
  >
    {#snippet rowActions(row)}
      {#if row.status !== 'RECEIVED'}
        <button
          onclick={() => receivePO(row as unknown as PurchaseOrderRow)}
          class="text-xs font-medium text-primary-600 hover:underline"
        >
          Terima Barang
        </button>
      {:else}
        <span class="text-xs text-slate-400">—</span>
      {/if}
    {/snippet}
  </AppTable>
</div>
