<script lang="ts">
  // MVP 3 Phase 2 — Document Viewer & Print Templates: tampilan terpisah + cetak dokumen resmi
  // PR (tanpa harga, Step 1) dan PO (dengan harga, Step 2+) — pola sama seperti ReceiptPrint.svelte.
  import { onMount } from 'svelte';
  import { push, router } from 'svelte-spa-router';
  import { PrinterOutline, ArrowLeftOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../../lib/api';
  import { formatRupiah } from '../../lib/utils/formatters';

  let { params } = $props<{ params: { id: string } }>();

  const docType = $derived(new URLSearchParams(router.querystring ?? '').get('type') === 'po' ? 'po' : 'pr');

  interface Item {
    id: string;
    qty: number;
    unitCost: string | null;
    sku: string;
    color: string;
    size: string;
    productName: string;
    uomName: string | null;
  }
  interface PODetail {
    id: string;
    prNumber: string;
    poNumber: string | null;
    supplierName: string;
    requestedByName: string;
    approvedByName: string | null;
    status: string;
    notes: string | null;
    createdAt: string;
    approvedAt: string | null;
    items: Item[];
  }

  let po = $state<PODetail | null>(null);
  let loading = $state(true);
  let errorMessage = $state('');

  onMount(async () => {
    try {
      po = await api.get<PODetail>(`/purchase-orders/${params.id}`);
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat dokumen';
    } finally {
      loading = false;
    }
  });

  function variantLabel(item: Item) {
    return [item.color, item.size].filter(Boolean).join('/');
  }

  const total = $derived((po?.items ?? []).reduce((sum, i) => sum + i.qty * Number(i.unitCost ?? 0), 0));
</script>

<div class="mb-4 flex items-center gap-3 print:hidden">
  <button
    onclick={() => push(`/purchasing/${params.id}`)}
    class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
  >
    <ArrowLeftOutline class="h-4 w-4" /> Kembali
  </button>
  <h1 class="text-lg font-semibold text-slate-900">Dokumen {docType === 'po' ? 'PO' : 'PR'}</h1>
  {#if po}
    <button
      onclick={() => window.print()}
      class="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
    >
      <PrinterOutline class="h-4 w-4" /> Print
    </button>
  {/if}
</div>

{#if loading}
  <p class="text-sm text-slate-500">Memuat...</p>
{:else if errorMessage}
  <p class="text-sm text-red-600">{errorMessage}</p>
{:else if po}
  <div class="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-800 print:max-w-none print:border-0">
    <div class="mb-6 flex items-start justify-between border-b border-slate-200 pb-4">
      <div>
        <p class="text-lg font-bold">{docType === 'po' ? 'PURCHASE ORDER' : 'PURCHASE REQUISITION'}</p>
        <p class="text-slate-500">{docType === 'po' ? po.poNumber : po.prNumber}</p>
      </div>
      <div class="text-right text-xs text-slate-500">
        <p>Tanggal Pengajuan: {new Date(po.createdAt).toLocaleDateString('id-ID')}</p>
        {#if docType === 'po' && po.approvedAt}
          <p>Tanggal Disetujui: {new Date(po.approvedAt).toLocaleDateString('id-ID')}</p>
        {/if}
      </div>
    </div>

    <div class="mb-6 grid grid-cols-2 gap-4 text-xs">
      <div>
        <p class="text-slate-500">Supplier</p>
        <p class="font-medium text-slate-800">{po.supplierName}</p>
      </div>
      <div>
        <p class="text-slate-500">Diajukan oleh</p>
        <p class="font-medium text-slate-800">{po.requestedByName}</p>
      </div>
      {#if docType === 'po'}
        <div>
          <p class="text-slate-500">Disetujui oleh</p>
          <p class="font-medium text-slate-800">{po.approvedByName ?? '-'}</p>
        </div>
      {/if}
      {#if po.notes}
        <div>
          <p class="text-slate-500">Catatan</p>
          <p class="font-medium text-slate-800">{po.notes}</p>
        </div>
      {/if}
    </div>

    <table class="w-full border-collapse text-xs">
      <thead>
        <tr class="border-y border-slate-300 text-left uppercase text-slate-500">
          <th class="py-2">Produk / Varian</th>
          <th class="py-2 text-right">Qty</th>
          {#if docType === 'po'}
            <th class="py-2 text-right">Harga/pcs</th>
            <th class="py-2 text-right">Subtotal</th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each po.items as item (item.id)}
          <tr class="border-b border-slate-100">
            <td class="py-2">
              {item.productName} {variantLabel(item) ? `(${variantLabel(item)})` : ''}
              <span class="text-slate-400">— {item.sku}</span>
            </td>
            <td class="py-2 text-right">{item.qty} {item.uomName ?? ''}</td>
            {#if docType === 'po'}
              <td class="py-2 text-right">{formatRupiah(Number(item.unitCost ?? 0))}</td>
              <td class="py-2 text-right">{formatRupiah(item.qty * Number(item.unitCost ?? 0))}</td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>

    {#if docType === 'po'}
      <p class="mt-4 text-right text-sm font-bold">TOTAL: {formatRupiah(total)}</p>
    {/if}

    <div class="mt-12 grid grid-cols-2 gap-8 text-center text-xs">
      <div>
        <p class="mb-16">Diajukan oleh,</p>
        <p class="border-t border-slate-400 pt-1 font-medium">{po.requestedByName}</p>
      </div>
      <div>
        <p class="mb-16">{docType === 'po' ? 'Disetujui oleh,' : 'Mengetahui,'}</p>
        <p class="border-t border-slate-400 pt-1 font-medium">{po.approvedByName ?? '________________'}</p>
      </div>
    </div>
  </div>
{/if}
