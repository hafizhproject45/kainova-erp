<script lang="ts">
  import { onMount } from 'svelte';
  import { link } from 'svelte-spa-router';
  import { ArrowLeftOutline, PrinterOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../lib/api';
  import AppTable from '../lib/components/AppTable.svelte';

  interface SalesOrderRow {
    id: string;
    invoiceNumber: string;
    customerId: string | null;
    customerName: string | null;
    paymentMethod: string;
    dpp: number;
    ppnAmount: number;
    pphAmount: number;
    grandTotal: number;
    createdAt: string;
  }

  const paymentLabel: Record<string, string> = {
    CASH: 'Tunai',
    QRIS: 'QRIS',
    DEBIT: 'Kartu Debit',
    CREDIT: 'Kartu Kredit',
  };

  let rows = $state<SalesOrderRow[]>([]);
  let loading = $state(false);
  let errorMessage = $state('');

  async function loadRows() {
    loading = true;
    errorMessage = '';
    try {
      rows = await api.get<SalesOrderRow[]>('/sales/orders');
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat riwayat transaksi';
    } finally {
      loading = false;
    }
  }

  onMount(loadRows);

  const displayRows = $derived(
    rows.map((r) => ({
      ...r,
      customerLabel: r.customerName ?? 'Walk-in',
      paymentLabel: paymentLabel[r.paymentMethod] ?? r.paymentMethod,
      createdAtLabel: new Date(r.createdAt).toLocaleString('id-ID'),
    })),
  );
</script>

<div class="mb-4 flex items-center gap-3">
  <a
    href="/pos"
    use:link
    class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
  >
    <ArrowLeftOutline class="h-4 w-4" /> Kembali ke POS
  </a>
  <h1 class="text-lg font-semibold text-slate-900">Riwayat Transaksi Penjualan</h1>
</div>

<div class="rounded-xl border border-slate-200 bg-white p-5">
  {#if errorMessage}<p class="mb-3 text-sm text-red-600">{errorMessage}</p>{/if}

  <AppTable
    {loading}
    rows={displayRows}
    emptyText="Belum ada transaksi penjualan."
    columns={[
      { key: 'invoiceNumber', label: 'No. Invoice' },
      { key: 'customerLabel', label: 'Customer' },
      { key: 'paymentLabel', label: 'Pembayaran' },
      { key: 'dpp', label: 'DPP', align: 'right', format: 'currency' },
      { key: 'ppnAmount', label: 'PPN', align: 'right', format: 'currency' },
      { key: 'pphAmount', label: 'PPh', align: 'right', format: 'currency' },
      { key: 'grandTotal', label: 'Grand Total', align: 'right', format: 'currency' },
      { key: 'createdAtLabel', label: 'Waktu' },
    ]}
  >
    {#snippet rowActions(row)}
      <a
        href={`#/receipt/${row.id}`}
        target="_blank"
        aria-label="Cetak Struk"
        class="inline-flex items-center text-primary-600 hover:underline"
      >
        <PrinterOutline class="h-4 w-4" />
      </a>
    {/snippet}
  </AppTable>
</div>
