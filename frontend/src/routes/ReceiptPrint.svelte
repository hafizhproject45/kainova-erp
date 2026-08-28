<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiClientError } from '../lib/api';

  let { params } = $props<{ params: { id: string } }>();

  interface ReceiptItem {
    id: string;
    qty: number;
    price: string;
    lineSubtotal: string;
    discountName: string | null;
    discountAmount: string;
    lineTotal: string;
    sku: string | null;
    color: string | null;
    size: string | null;
    productName: string | null;
  }
  interface ReceiptData {
    salesOrder: {
      invoiceNumber: string;
      channel: string;
      paymentMethod: string;
      subtotal: string;
      itemDiscountTotal: string;
      discountName: string | null;
      discountAmount: string;
      dpp: string;
      ppnName: string | null;
      ppnAmount: string;
      pphName: string | null;
      pphAmount: string;
      grandTotal: string;
      createdAt: string;
    };
    items: ReceiptItem[];
    customerName: string | null;
    businessName: string;
    footerNote: string | null;
  }

  let data = $state<ReceiptData | null>(null);
  let loading = $state(true);
  let errorMessage = $state('');

  function formatRupiah(value: string | number): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
      Number(value),
    );
  }

  onMount(async () => {
    try {
      data = await api.get<ReceiptData>(`/sales/${params.id}/receipt`);
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat struk';
    } finally {
      loading = false;
    }
  });

  function printReceipt() {
    window.print();
  }
</script>

<div class="mb-4 flex items-center gap-3 print:hidden">
  <h1 class="text-lg font-semibold text-slate-900">Struk Transaksi</h1>
  {#if data}
    <button onclick={printReceipt} class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
      Print Struk
    </button>
  {/if}
</div>

{#if loading}
  <p class="text-sm text-slate-500">Memuat...</p>
{:else if errorMessage}
  <p class="text-sm text-red-600">{errorMessage}</p>
{:else if data}
  <div class="mx-auto max-w-xs rounded-xl border border-slate-200 bg-white p-5 font-mono text-xs text-slate-800 print:max-w-none print:border-0 print:p-0">
    <div class="text-center">
      <p class="text-sm font-bold">{data.businessName}</p>
      <p class="mt-1">{new Date(data.salesOrder.createdAt).toLocaleString('id-ID')}</p>
      <p>{data.salesOrder.invoiceNumber}</p>
      {#if data.customerName}<p>Customer: {data.customerName}</p>{/if}
    </div>

    <div class="my-2 border-t border-dashed border-slate-400"></div>

    {#each data.items as item (item.id)}
      <div class="mb-1.5">
        <div class="flex justify-between">
          <span>{item.productName ?? item.sku ?? '-'}</span>
        </div>
        <div class="flex justify-between text-slate-500">
          <span>{item.sku} {item.color ? `(${item.color}${item.size ? `/${item.size}` : ''})` : ''}</span>
        </div>
        <div class="flex justify-between">
          <span>{item.qty} x {formatRupiah(item.price)}</span>
          <span>{formatRupiah(item.lineTotal)}</span>
        </div>
        {#if Number(item.discountAmount) > 0}
          <div class="flex justify-between text-slate-500">
            <span>{item.discountName ?? 'Diskon'}</span>
            <span>−{formatRupiah(item.discountAmount)}</span>
          </div>
        {/if}
      </div>
    {/each}

    <div class="my-2 border-t border-dashed border-slate-400"></div>

    <div class="space-y-0.5">
      <div class="flex justify-between"><span>Subtotal</span><span>{formatRupiah(data.salesOrder.subtotal)}</span></div>
      {#if Number(data.salesOrder.itemDiscountTotal) > 0}
        <div class="flex justify-between"><span>Diskon Item</span><span>−{formatRupiah(data.salesOrder.itemDiscountTotal)}</span></div>
      {/if}
      {#if Number(data.salesOrder.discountAmount) > 0}
        <div class="flex justify-between">
          <span>{data.salesOrder.discountName ?? 'Diskon'}</span><span>−{formatRupiah(data.salesOrder.discountAmount)}</span>
        </div>
      {/if}
      <div class="flex justify-between"><span>DPP</span><span>{formatRupiah(data.salesOrder.dpp)}</span></div>
      {#if Number(data.salesOrder.ppnAmount) > 0}
        <div class="flex justify-between">
          <span>{data.salesOrder.ppnName ?? 'PPN'}</span><span>+{formatRupiah(data.salesOrder.ppnAmount)}</span>
        </div>
      {/if}
      {#if Number(data.salesOrder.pphAmount) > 0}
        <div class="flex justify-between">
          <span>{data.salesOrder.pphName ?? 'PPh'}</span><span>−{formatRupiah(data.salesOrder.pphAmount)}</span>
        </div>
      {/if}
      <div class="my-1 border-t border-dashed border-slate-400"></div>
      <div class="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{formatRupiah(data.salesOrder.grandTotal)}</span></div>
      <div class="flex justify-between text-slate-500"><span>Bayar</span><span>{data.salesOrder.paymentMethod}</span></div>
    </div>

    {#if data.footerNote}
      <div class="mt-3 text-center text-slate-500">{data.footerNote}</div>
    {/if}
  </div>
{/if}
