<script lang="ts">
  // MVP 3 Phase 2: List Pembelian dengan Vertical Kebab Action Menu, ringkasan item multi-baris,
  // dan status lifecycle PR-to-PO (DRAFT_PR -> PO_ISSUED -> PARTIALLY_RECEIVED/RECEIVED -> COMPLETED).
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { EyeOutline, PlusOutline, TrashBinOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../../lib/api';
  import AppTable from '../../lib/components/AppTable.svelte';
  import AppButton from '../../lib/components/AppButton.svelte';
  import AppKebabMenu from '../../lib/components/AppKebabMenu.svelte';

  interface PurchaseOrderRow {
    id: string;
    prNumber: string;
    poNumber: string | null;
    supplierName: string;
    itemsSummary: string;
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
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat data Pembelian';
    } finally {
      loading = false;
    }
  }

  onMount(loadRows);

  async function cancelPO(row: PurchaseOrderRow, close: () => void) {
    close();
    if (!confirm(`Batalkan "${row.prNumber}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    errorMessage = '';
    try {
      await api.delete(`/purchase-orders/${row.id}`);
      await loadRows();
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal membatalkan Pembelian';
    }
  }

  const displayRows = $derived(
    rows.map((r) => ({
      ...r,
      poNumberLabel: r.poNumber ?? '-',
      createdAtLabel: new Date(r.createdAt).toLocaleDateString('id-ID'),
    })),
  );
</script>

<div class="mb-4 flex items-center justify-between">
  <h1 class="text-lg font-semibold text-slate-900">Pembelian</h1>
  <AppButton onclick={() => push('/purchasing/create')}>
    <PlusOutline class="me-1.5 h-4 w-4" /> Buat Pengajuan (PR)
  </AppButton>
</div>

<div class="rounded-xl border border-slate-200 bg-white p-5">
  {#if errorMessage}<p class="mb-3 text-sm text-red-600">{errorMessage}</p>{/if}

  <AppTable
    {loading}
    rows={displayRows}
    emptyText="Belum ada pengajuan pembelian."
    columns={[
      { key: 'prNumber', label: 'No. PR' },
      { key: 'poNumberLabel', label: 'No. PO' },
      { key: 'supplierName', label: 'Supplier' },
      { key: 'itemsSummary', label: 'Item', format: 'multiline' },
      { key: 'totalAmount', label: 'Total', align: 'right', format: 'currency' },
      { key: 'status', label: 'Status', format: 'badge' },
      { key: 'createdAtLabel', label: 'Tanggal' },
    ]}
  >
    {#snippet rowActions(row)}
      <AppKebabMenu>
        {#snippet children({ close })}
          <li>
            <button
              onclick={() => {
                close();
                push(`/purchasing/${row.id}`);
              }}
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
            >
              <EyeOutline class="h-4 w-4" /> Detail
            </button>
          </li>
          {#if row.status === 'DRAFT_PR' || row.status === 'PO_ISSUED'}
            <li>
              <button
                onclick={() => cancelPO(row as unknown as PurchaseOrderRow, close)}
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50"
              >
                <TrashBinOutline class="h-4 w-4" /> Hapus
              </button>
            </li>
          {/if}
        {/snippet}
      </AppKebabMenu>
    {/snippet}
  </AppTable>
</div>
