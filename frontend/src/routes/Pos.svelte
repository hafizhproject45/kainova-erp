<script lang="ts">
  import { onMount } from 'svelte';
  import { Modal } from 'flowbite-svelte';
  import {
    BarcodeOutline,
    CircleMinusOutline,
    CirclePlusOutline,
    PrinterOutline,
    ReceiptSolid,
    SearchOutline,
    TrashBinOutline,
  } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../lib/api';
  import AppSelect from '../lib/components/AppSelect.svelte';
  import AppButton from '../lib/components/AppButton.svelte';
  import { formatRupiah } from '../lib/utils/formatters';

  interface Product {
    id: string;
    name: string;
    uomId: string | null;
  }
  interface Uom {
    id: string;
    name: string;
  }
  interface Customer {
    id: string;
    name: string;
  }
  interface Variant {
    id: string;
    sku: string;
    color: string;
    size: string;
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
    productName: string;
    uom: string;
    price: number;
    qty: number;
  }
  interface CheckoutResult {
    id: string;
    invoiceNumber: string;
    subtotal: number;
    itemDiscountTotal: number;
    discountAmount: number;
    dpp: number;
    ppnAmount: number;
    pphAmount: number;
    grandTotal: number;
  }

  const PAYMENT_METHODS = [
    { value: 'CASH', name: 'Tunai' },
    { value: 'QRIS', name: 'QRIS' },
    { value: 'DEBIT', name: 'Kartu Debit' },
    { value: 'CREDIT', name: 'Kartu Kredit' },
  ];

  let products = $state<Product[]>([]);
  let uoms = $state<Uom[]>([]);
  let customers = $state<Customer[]>([]);
  let options = $state<CheckoutOptions | null>(null);

  const uomNameById = $derived(new Map(uoms.map((u) => [u.id, u.name])));

  // --- Product card grid + variant picker ---
  let productSearch = $state('');
  let selectedProductId = $state('');
  let variants = $state<Variant[]>([]);
  let variantsLoading = $state(false);

  const filteredProducts = $derived(
    productSearch.trim()
      ? products.filter((p) => p.name.toLowerCase().includes(productSearch.trim().toLowerCase()))
      : products,
  );

  async function selectProduct(product: Product) {
    selectedProductId = selectedProductId === product.id ? '' : product.id;
    variants = [];
    if (!selectedProductId) return;
    variantsLoading = true;
    try {
      variants = await api.get<Variant[]>(`/products/${product.id}/variants`);
    } finally {
      variantsLoading = false;
    }
  }

  // --- Scan barcode (SKU) ---
  let barcodeInput = $state('');
  let barcodeError = $state('');

  async function handleBarcodeScan(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    const sku = barcodeInput.trim();
    if (!sku) return;
    barcodeError = '';
    try {
      const variant = await api.get<Variant & { sku: string; productName: string }>(
        `/product-variants/by-sku/${encodeURIComponent(sku)}`,
      );
      addToCart({
        variantId: variant.id,
        sku: variant.sku,
        productName: variant.productName ?? '',
        uom: '',
        price: Number(variant.price),
      });
      barcodeInput = '';
    } catch (err) {
      barcodeError = err instanceof ApiClientError ? err.message : `SKU "${sku}" tidak ditemukan`;
    }
  }

  // --- Cart ---
  let cart = $state<CartItem[]>([]);

  function addToCart(item: { variantId: string; sku: string; productName: string; uom: string; price: number }) {
    const existing = cart.find((c) => c.variantId === item.variantId);
    if (existing) {
      existing.qty += 1;
    } else {
      cart = [...cart, { ...item, qty: 1 }];
    }
  }

  function addVariantToCart(variant: Variant) {
    const product = products.find((p) => p.id === selectedProductId);
    const uom = product?.uomId ? (uomNameById.get(product.uomId) ?? '') : '';
    addToCart({
      variantId: variant.id,
      sku: variant.sku,
      productName: product?.name ?? '',
      uom,
      price: Number(variant.price),
    });
  }

  function incQty(item: CartItem) {
    item.qty += 1;
  }
  function decQty(item: CartItem) {
    if (item.qty > 1) item.qty -= 1;
    else removeFromCart(item);
  }
  function removeFromCart(item: CartItem) {
    cart = cart.filter((c) => c.variantId !== item.variantId);
  }

  const cartSubtotal = $derived(cart.reduce((sum, item) => sum + item.qty * item.price, 0));

  // --- Checkout ---
  let customerId = $state('');
  let orderDiscountId = $state('');
  let ppnTaxId = $state('');
  let pphTaxId = $state('');
  let paymentMethod = $state('CASH');

  let errorMessage = $state('');
  let result = $state<CheckoutResult | null>(null);
  let showReceiptModal = $state(false);
  let submitting = $state(false);

  // Kalkulasi real-time (preview) — nilai final tetap dihitung ulang & divalidasi di backend saat checkout.
  const previewDiscount = $derived(options?.discounts.find((d) => d.id === orderDiscountId));
  const previewDiscountAmount = $derived(
    previewDiscount
      ? previewDiscount.type === 'PERCENTAGE'
        ? (cartSubtotal * Number(previewDiscount.value)) / 100
        : Number(previewDiscount.value)
      : 0,
  );
  const previewDpp = $derived(Math.max(0, cartSubtotal - previewDiscountAmount));
  const previewPpn = $derived(options?.ppnOptions.find((t) => t.id === ppnTaxId));
  const previewPpnAmount = $derived(previewPpn ? (previewDpp * Number(previewPpn.rate)) / 100 : 0);
  const previewPph = $derived(options?.pphOptions.find((t) => t.id === pphTaxId));
  const previewPphAmount = $derived(previewPph ? (previewDpp * Number(previewPph.rate)) / 100 : 0);
  const previewGrandTotal = $derived(previewDpp + previewPpnAmount - previewPphAmount);

  onMount(async () => {
    try {
      [products, uoms, customers, options] = await Promise.all([
        api.get<Product[]>('/products'),
        api.get<Uom[]>('/uoms'),
        api.get<Customer[]>('/customers'),
        api.get<CheckoutOptions>('/sales/checkout-options'),
      ]);
      ppnTaxId = options.defaultPpnTaxId ?? '';
      pphTaxId = options.defaultPphTaxId ?? '';
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat data POS';
    }
  });

  async function handleCheckout() {
    if (cart.length === 0) return;
    errorMessage = '';
    submitting = true;
    try {
      result = await api.post<CheckoutResult>('/sales/checkout', {
        channel: 'POS_POPYSHOP_STORE_1',
        paymentMethod,
        customerId: customerId || undefined,
        items: cart.map((item) => ({ variantId: item.variantId, qty: item.qty, price: item.price })),
        discountId: orderDiscountId || undefined,
        ppnTaxId: ppnTaxId || undefined,
        pphTaxId: pphTaxId || undefined,
      });
      cart = [];
      orderDiscountId = '';
      showReceiptModal = true;
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Checkout gagal';
    } finally {
      submitting = false;
    }
  }

  function newTransaction() {
    result = null;
    showReceiptModal = false;
  }

  function printReceipt() {
    if (result) window.open(`#/receipt/${result.id}`, '_blank');
  }
</script>

<h1 class="mb-6 text-lg font-semibold text-slate-900">Penjualan (POS)</h1>

<div class="mb-6 rounded-xl border border-slate-200 bg-white p-4">
  <div class="relative">
    <BarcodeOutline class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
    <input
      type="text"
      bind:value={barcodeInput}
      onkeydown={handleBarcodeScan}
      placeholder="Scan atau ketik SKU lalu tekan Enter..."
      class="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
    />
  </div>
  {#if barcodeError}<p class="mt-2 text-sm text-red-600">{barcodeError}</p>{/if}
</div>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
  <!-- Card grid produk -->
  <div class="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
    <div class="relative mb-4">
      <SearchOutline class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        bind:value={productSearch}
        placeholder="Cari produk..."
        class="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
      />
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {#each filteredProducts as product (product.id)}
        <button
          onclick={() => selectProduct(product)}
          class="rounded-lg border p-3 text-left transition {selectedProductId === product.id
            ? 'border-primary-500 bg-primary-50'
            : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'}"
        >
          <p class="text-sm font-medium text-slate-800">{product.name}</p>
          {#if product.uomId}
            <p class="mt-1 text-xs text-slate-500">{uomNameById.get(product.uomId) ?? ''}</p>
          {/if}
        </button>
      {/each}
      {#if filteredProducts.length === 0}
        <p class="col-span-full py-6 text-center text-sm text-slate-500">Produk tidak ditemukan.</p>
      {/if}
    </div>

    {#if selectedProductId}
      <div class="mt-4 border-t border-slate-200 pt-4">
        <p class="mb-2 text-xs font-medium uppercase text-slate-500">Pilih SKU</p>
        {#if variantsLoading}
          <p class="text-sm text-slate-500">Memuat varian...</p>
        {:else if variants.length === 0}
          <p class="text-sm text-slate-500">Produk ini belum punya varian SKU.</p>
        {:else}
          <div class="flex flex-wrap gap-2">
            {#each variants as variant (variant.id)}
              <button
                onclick={() => addVariantToCart(variant)}
                disabled={variant.totalStock <= 0}
                class="rounded-lg border border-slate-300 px-3 py-2 text-left text-xs hover:border-primary-500 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span class="block font-mono font-medium text-slate-700">{variant.sku}</span>
                <span class="block text-slate-500">{formatRupiah(Number(variant.price))} · stok {variant.totalStock}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Keranjang & checkout -->
  <div class="rounded-xl border border-slate-200 bg-white p-4">
    <h2 class="mb-3 text-sm font-semibold text-slate-800">Keranjang</h2>

    {#if cart.length === 0}
      <p class="text-sm text-slate-500">Keranjang kosong. Klik produk atau scan barcode.</p>
    {:else}
      <div class="mb-4 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs text-slate-500">
              <th class="pb-2 font-medium">Item</th>
              <th class="pb-2 text-center font-medium">Qty</th>
              <th class="pb-2 text-right font-medium">Subtotal</th>
              <th class="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {#each cart as item (item.variantId)}
              <tr class="border-b border-slate-100 align-top">
                <td class="py-2">
                  <p class="font-mono text-xs font-medium text-slate-700">{item.sku}</p>
                  <p class="text-xs text-slate-500">{formatRupiah(item.price)}{item.uom ? ` / ${item.uom}` : ''}</p>
                </td>
                <td class="py-2">
                  <div class="flex items-center justify-center gap-1.5">
                    <button onclick={() => decQty(item)} aria-label="Kurangi" class="text-slate-500 hover:text-slate-700">
                      <CircleMinusOutline class="h-4 w-4" />
                    </button>
                    <span class="w-5 text-center">{item.qty}</span>
                    <button onclick={() => incQty(item)} aria-label="Tambah" class="text-slate-500 hover:text-slate-700">
                      <CirclePlusOutline class="h-4 w-4" />
                    </button>
                  </div>
                </td>
                <td class="py-2 text-right">{formatRupiah(item.qty * item.price)}</td>
                <td class="py-2 text-right">
                  <button onclick={() => removeFromCart(item)} aria-label="Hapus" class="text-red-600">
                    <TrashBinOutline class="h-4 w-4" />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    {#if options}
      <div class="space-y-3 border-t border-slate-200 pt-3">
        <AppSelect
          label="Customer"
          name="customerId"
          placeholder="Tanpa customer (walk-in)"
          items={customers.map((c) => ({ value: c.id, name: c.name }))}
          bind:value={customerId}
        />
        <AppSelect
          label="Diskon Keseluruhan"
          name="orderDiscountId"
          placeholder="Tanpa diskon"
          items={options.discounts.map((d) => ({ value: d.id, name: d.name }))}
          bind:value={orderDiscountId}
        />
        <div class="grid grid-cols-2 gap-3">
          <AppSelect
            label="PPN"
            name="ppnTaxId"
            placeholder="Tanpa PPN"
            items={options.ppnOptions.map((t) => ({ value: t.id, name: t.name }))}
            bind:value={ppnTaxId}
          />
          <AppSelect
            label="PPh"
            name="pphTaxId"
            placeholder="Tanpa PPh"
            items={options.pphOptions.map((t) => ({ value: t.id, name: t.name }))}
            bind:value={pphTaxId}
          />
        </div>
        <AppSelect label="Metode Pembayaran" name="paymentMethod" items={PAYMENT_METHODS} bind:value={paymentMethod} />
      </div>
    {/if}

    {#if cart.length > 0}
      <dl class="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm">
        <div class="flex justify-between"><dt class="text-slate-500">Subtotal</dt><dd>{formatRupiah(cartSubtotal)}</dd></div>
        {#if previewDiscountAmount > 0}
          <div class="flex justify-between"><dt class="text-slate-500">Diskon</dt><dd>−{formatRupiah(previewDiscountAmount)}</dd></div>
        {/if}
        <div class="flex justify-between"><dt class="text-slate-500">DPP</dt><dd>{formatRupiah(previewDpp)}</dd></div>
        {#if previewPpnAmount > 0}
          <div class="flex justify-between"><dt class="text-slate-500">PPN</dt><dd>+{formatRupiah(previewPpnAmount)}</dd></div>
        {/if}
        {#if previewPphAmount > 0}
          <div class="flex justify-between"><dt class="text-slate-500">PPh</dt><dd>−{formatRupiah(previewPphAmount)}</dd></div>
        {/if}
        <div class="flex justify-between border-t border-slate-200 pt-1.5 text-base font-semibold text-slate-900">
          <dt>Grand Total</dt><dd>{formatRupiah(previewGrandTotal)}</dd>
        </div>
      </dl>
    {/if}

    {#if errorMessage}<p class="mt-3 text-sm text-red-600">{errorMessage}</p>{/if}

    <AppButton onclick={handleCheckout} disabled={cart.length === 0} loading={submitting} class="mt-4 w-full">
      <ReceiptSolid class="me-1.5 h-4 w-4" /> {submitting ? 'Memproses...' : 'Checkout'}
    </AppButton>
  </div>
</div>

<Modal title="Transaksi Berhasil" bind:open={showReceiptModal} size="sm" onclose={newTransaction}>
  {#if result}
    <div class="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <p class="font-mono text-lg font-semibold text-slate-900">{result.invoiceNumber}</p>
      <dl class="mt-3 space-y-1 text-sm">
        <div class="flex justify-between"><dt class="text-slate-500">Subtotal</dt><dd>{formatRupiah(result.subtotal)}</dd></div>
        {#if result.itemDiscountTotal > 0}
          <div class="flex justify-between"><dt class="text-slate-500">Diskon Item</dt><dd>−{formatRupiah(result.itemDiscountTotal)}</dd></div>
        {/if}
        {#if result.discountAmount > 0}
          <div class="flex justify-between"><dt class="text-slate-500">Diskon Keseluruhan</dt><dd>−{formatRupiah(result.discountAmount)}</dd></div>
        {/if}
        <div class="flex justify-between border-t border-emerald-200 pt-1"><dt class="text-slate-500">DPP</dt><dd>{formatRupiah(result.dpp)}</dd></div>
        {#if result.ppnAmount > 0}
          <div class="flex justify-between"><dt class="text-slate-500">PPN</dt><dd>+{formatRupiah(result.ppnAmount)}</dd></div>
        {/if}
        {#if result.pphAmount > 0}
          <div class="flex justify-between"><dt class="text-slate-500">PPh</dt><dd>−{formatRupiah(result.pphAmount)}</dd></div>
        {/if}
        <div class="flex justify-between border-t border-emerald-200 pt-1 text-base font-semibold">
          <dt>Grand Total</dt><dd>{formatRupiah(result.grandTotal)}</dd>
        </div>
      </dl>
    </div>
  {/if}
  {#snippet footer()}
    <AppButton variant="outline" onclick={printReceipt}>
      <PrinterOutline class="me-1.5 h-4 w-4" /> Cetak Struk
    </AppButton>
    <AppButton onclick={newTransaction}>Transaksi Baru</AppButton>
  {/snippet}
</Modal>
