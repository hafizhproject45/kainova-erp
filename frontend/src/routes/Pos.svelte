<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiClientError } from '../lib/api';

  interface Product {
    id: string;
    name: string;
  }
  interface Variant {
    id: string;
    sku: string;
    price: string;
    totalStock: number;
  }
  interface Discount {
    id: string;
    name: string;
    type: 'PERCENTAGE' | 'NOMINAL';
    value: string;
  }
  interface TaxOption {
    id: string;
    name: string;
    rate: string;
  }
  interface CheckoutOptions {
    discounts: Discount[];
    ppnOptions: TaxOption[];
    pphOptions: TaxOption[];
    defaultPpnTaxId: string | null;
    defaultPphTaxId: string | null;
  }
  interface CartItem {
    variantId: string;
    sku: string;
    price: number;
    qty: number;
    discountId: string;
  }
  interface CheckoutResult {
    invoiceNumber: string;
    subtotal: number;
    itemDiscountTotal: number;
    discountAmount: number;
    dpp: number;
    ppnAmount: number;
    pphAmount: number;
    grandTotal: number;
  }

  let products = $state<Product[]>([]);
  let variants = $state<Variant[]>([]);
  let selectedProductId = $state('');
  let selectedVariantId = $state('');
  let qty = $state(1);
  let itemDiscountId = $state('');

  let cart = $state<CartItem[]>([]);
  let options = $state<CheckoutOptions | null>(null);
  let orderDiscountId = $state('');
  let ppnTaxId = $state('');
  let pphTaxId = $state('');
  let paymentMethod = $state('CASH');

  let errorMessage = $state('');
  let result = $state<CheckoutResult | null>(null);
  let submitting = $state(false);

  function formatRupiah(value: number): string {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
      value,
    );
  }

  onMount(async () => {
    try {
      products = await api.get<Product[]>('/products');
      options = await api.get<CheckoutOptions>('/sales/checkout-options');
      ppnTaxId = options.defaultPpnTaxId ?? '';
      pphTaxId = options.defaultPphTaxId ?? '';
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat data POS';
    }
  });

  async function onProductChange() {
    selectedVariantId = '';
    variants = [];
    if (!selectedProductId) return;
    variants = await api.get<Variant[]>(`/products/${selectedProductId}/variants`);
  }

  function addToCart() {
    const variant = variants.find((v) => v.id === selectedVariantId);
    if (!variant) return;
    cart = [
      ...cart,
      { variantId: variant.id, sku: variant.sku, price: Number(variant.price), qty, discountId: itemDiscountId },
    ];
    selectedVariantId = '';
    qty = 1;
    itemDiscountId = '';
  }

  function removeFromCart(index: number) {
    cart = cart.filter((_, i) => i !== index);
  }

  const cartSubtotal = $derived(cart.reduce((sum, item) => sum + item.qty * item.price, 0));

  async function handleCheckout() {
    if (cart.length === 0) return;
    errorMessage = '';
    submitting = true;
    try {
      result = await api.post<CheckoutResult>('/sales/checkout', {
        channel: 'POS_POPYSHOP_STORE_1',
        paymentMethod,
        items: cart.map((item) => ({
          variantId: item.variantId,
          qty: item.qty,
          price: item.price,
          discountId: item.discountId || undefined,
        })),
        discountId: orderDiscountId || undefined,
        ppnTaxId: ppnTaxId || undefined,
        pphTaxId: pphTaxId || undefined,
      });
      cart = [];
      orderDiscountId = '';
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Checkout gagal';
    } finally {
      submitting = false;
    }
  }

  function newTransaction() {
    result = null;
  }
</script>

<h1 class="mb-6 text-lg font-semibold text-slate-900">Penjualan (POS)</h1>

{#if result}
  <div class="mx-auto max-w-md rounded-xl border border-emerald-200 bg-emerald-50 p-6">
    <p class="text-sm font-medium text-emerald-700">Transaksi berhasil!</p>
    <p class="mt-1 font-mono text-lg font-semibold text-slate-900">{result.invoiceNumber}</p>
    <dl class="mt-4 space-y-1 text-sm">
      <div class="flex justify-between"><dt class="text-slate-500">Subtotal</dt><dd>{formatRupiah(result.subtotal)}</dd></div>
      <div class="flex justify-between"><dt class="text-slate-500">Diskon Item</dt><dd>−{formatRupiah(result.itemDiscountTotal)}</dd></div>
      <div class="flex justify-between"><dt class="text-slate-500">Diskon Keseluruhan</dt><dd>−{formatRupiah(result.discountAmount)}</dd></div>
      <div class="flex justify-between border-t border-emerald-200 pt-1"><dt class="text-slate-500">DPP</dt><dd>{formatRupiah(result.dpp)}</dd></div>
      <div class="flex justify-between"><dt class="text-slate-500">PPN</dt><dd>+{formatRupiah(result.ppnAmount)}</dd></div>
      <div class="flex justify-between"><dt class="text-slate-500">PPh</dt><dd>−{formatRupiah(result.pphAmount)}</dd></div>
      <div class="flex justify-between border-t border-emerald-200 pt-1 text-base font-semibold">
        <dt>Grand Total</dt><dd>{formatRupiah(result.grandTotal)}</dd>
      </div>
    </dl>
    <button onclick={newTransaction} class="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700">
      Transaksi Baru
    </button>
  </div>
{:else}
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="mb-3 text-sm font-semibold text-slate-800">Tambah Item</h2>
      <div class="space-y-3">
        <select bind:value={selectedProductId} onchange={onProductChange} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Pilih Produk</option>
          {#each products as product (product.id)}
            <option value={product.id}>{product.name}</option>
          {/each}
        </select>

        {#if variants.length > 0}
          <select bind:value={selectedVariantId} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Pilih SKU</option>
            {#each variants as variant (variant.id)}
              <option value={variant.id}>{variant.sku} — {formatRupiah(Number(variant.price))} (stok: {variant.totalStock})</option>
            {/each}
          </select>
        {/if}

        <input type="number" min="1" bind:value={qty} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Qty" />

        {#if options}
          <select bind:value={itemDiscountId} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Tanpa diskon item</option>
            {#each options.discounts as discount (discount.id)}
              <option value={discount.id}>{discount.name}</option>
            {/each}
          </select>
        {/if}

        <button
          onclick={addToCart}
          disabled={!selectedVariantId}
          class="w-full rounded-lg bg-slate-800 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          + Tambah ke Keranjang
        </button>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <h2 class="mb-3 text-sm font-semibold text-slate-800">Keranjang</h2>
      {#if cart.length === 0}
        <p class="text-sm text-slate-500">Keranjang kosong.</p>
      {:else}
        <table class="mb-4 w-full text-sm">
          <tbody>
            {#each cart as item, i (i)}
              <tr class="border-b border-slate-100">
                <td class="py-2 font-mono text-xs">{item.sku}</td>
                <td class="py-2">{item.qty}x</td>
                <td class="py-2 text-right">{formatRupiah(item.qty * item.price)}</td>
                <td class="py-2 text-right">
                  <button onclick={() => removeFromCart(i)} class="text-xs text-red-600 hover:underline">Hapus</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="mb-4 text-right text-sm font-medium">Subtotal: {formatRupiah(cartSubtotal)}</p>
      {/if}

      {#if options}
        <div class="space-y-2 border-t border-slate-200 pt-3">
          <select bind:value={orderDiscountId} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Tanpa diskon keseluruhan</option>
            {#each options.discounts as discount (discount.id)}
              <option value={discount.id}>{discount.name}</option>
            {/each}
          </select>
          <select bind:value={ppnTaxId} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Tanpa PPN</option>
            {#each options.ppnOptions as tax (tax.id)}
              <option value={tax.id}>{tax.name}</option>
            {/each}
          </select>
          <select bind:value={pphTaxId} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Tanpa PPh</option>
            {#each options.pphOptions as tax (tax.id)}
              <option value={tax.id}>{tax.name}</option>
            {/each}
          </select>
          <select bind:value={paymentMethod} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="CASH">Tunai</option>
            <option value="QRIS">QRIS</option>
            <option value="DEBIT">Kartu Debit</option>
            <option value="CREDIT">Kartu Kredit</option>
          </select>
        </div>
      {/if}

      {#if errorMessage}<p class="mt-3 text-sm text-red-600">{errorMessage}</p>{/if}

      <button
        onclick={handleCheckout}
        disabled={cart.length === 0 || submitting}
        class="mt-4 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {submitting ? 'Memproses...' : 'Checkout'}
      </button>
    </div>
  </div>
{/if}
