<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiClientError } from '../lib/api';

  interface Supplier {
    id: string;
    name: string;
  }
  interface Product {
    id: string;
    name: string;
  }
  interface Variant {
    id: string;
    sku: string;
  }
  interface POItem {
    variantId: string;
    sku: string;
    qty: number;
    unitCost: number;
  }
  interface PurchaseOrder {
    id: string;
    supplierId: string;
    status: string;
    createdAt: string;
  }

  let suppliers = $state<Supplier[]>([]);
  let products = $state<Product[]>([]);
  let variants = $state<Variant[]>([]);
  let purchaseOrders = $state<PurchaseOrder[]>([]);

  let selectedSupplierId = $state('');
  let selectedProductId = $state('');
  let selectedVariantId = $state('');
  let qty = $state(1);
  let unitCost = $state(0);
  let items = $state<POItem[]>([]);

  let errorMessage = $state('');
  let successMessage = $state('');

  async function loadAll() {
    suppliers = await api.get<Supplier[]>('/suppliers');
    products = await api.get<Product[]>('/products');
    purchaseOrders = await api.get<PurchaseOrder[]>('/purchase-orders');
  }

  onMount(async () => {
    try {
      await loadAll();
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat data';
    }
  });

  async function onProductChange() {
    selectedVariantId = '';
    variants = selectedProductId ? await api.get<Variant[]>(`/products/${selectedProductId}/variants`) : [];
  }

  function addItem() {
    const variant = variants.find((v) => v.id === selectedVariantId);
    if (!variant) return;
    items = [...items, { variantId: variant.id, sku: variant.sku, qty, unitCost }];
    selectedVariantId = '';
    qty = 1;
    unitCost = 0;
  }

  function removeItem(index: number) {
    items = items.filter((_, i) => i !== index);
  }

  async function createPO() {
    errorMessage = '';
    successMessage = '';
    try {
      await api.post('/purchase-orders', {
        supplierId: selectedSupplierId,
        items: items.map((i) => ({ variantId: i.variantId, qty: i.qty, unitCost: i.unitCost })),
      });
      successMessage = 'Purchase Order berhasil dibuat';
      items = [];
      selectedSupplierId = '';
      purchaseOrders = await api.get<PurchaseOrder[]>('/purchase-orders');
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal membuat PO';
    }
  }

  async function receivePO(id: string) {
    errorMessage = '';
    try {
      await api.post(`/purchase-orders/${id}/receive`);
      purchaseOrders = await api.get<PurchaseOrder[]>('/purchase-orders');
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal menerima barang';
    }
  }
</script>

<h1 class="mb-6 text-lg font-semibold text-slate-900">Pembelian</h1>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
  <div class="rounded-xl border border-slate-200 bg-white p-5">
    <h2 class="mb-3 text-sm font-semibold text-slate-800">Buat Purchase Order</h2>

    <select bind:value={selectedSupplierId} class="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
      <option value="">Pilih Supplier</option>
      {#each suppliers as supplier (supplier.id)}
        <option value={supplier.id}>{supplier.name}</option>
      {/each}
    </select>

    <div class="mb-3 space-y-2 rounded-lg border border-slate-200 p-3">
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
            <option value={variant.id}>{variant.sku}</option>
          {/each}
        </select>
      {/if}
      <div class="grid grid-cols-2 gap-2">
        <input type="number" min="1" bind:value={qty} placeholder="Qty" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input type="number" min="0" bind:value={unitCost} placeholder="Harga Beli/pcs" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <button onclick={addItem} disabled={!selectedVariantId} class="w-full rounded-lg bg-slate-800 py-2 text-sm text-white disabled:opacity-50">
        + Tambah Item
      </button>
    </div>

    {#if items.length > 0}
      <table class="mb-3 w-full text-sm">
        <tbody>
          {#each items as item, i (i)}
            <tr class="border-b border-slate-100">
              <td class="py-1 font-mono text-xs">{item.sku}</td>
              <td class="py-1">{item.qty}x @ Rp{item.unitCost}</td>
              <td class="py-1 text-right"><button onclick={() => removeItem(i)} class="text-xs text-red-600">Hapus</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    {#if errorMessage}<p class="mb-2 text-sm text-red-600">{errorMessage}</p>{/if}
    {#if successMessage}<p class="mb-2 text-sm text-emerald-600">{successMessage}</p>{/if}

    <button
      onclick={createPO}
      disabled={!selectedSupplierId || items.length === 0}
      class="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      Buat Purchase Order
    </button>
  </div>

  <div class="rounded-xl border border-slate-200 bg-white p-5">
    <h2 class="mb-3 text-sm font-semibold text-slate-800">Daftar Purchase Order</h2>
    {#if purchaseOrders.length === 0}
      <p class="text-sm text-slate-500">Belum ada Purchase Order.</p>
    {:else}
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-left text-slate-500">
            <th class="pb-2 font-medium">Status</th>
            <th class="pb-2 font-medium">Dibuat</th>
            <th class="pb-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {#each purchaseOrders as po (po.id)}
            <tr class="border-b border-slate-100">
              <td class="py-2">
                <span
                  class="rounded-full px-2 py-0.5 text-xs {po.status === 'RECEIVED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'}"
                >
                  {po.status}
                </span>
              </td>
              <td class="py-2 text-xs text-slate-500">{new Date(po.createdAt).toLocaleString('id-ID')}</td>
              <td class="py-2 text-right">
                {#if po.status !== 'RECEIVED'}
                  <button onclick={() => receivePO(po.id)} class="text-xs font-medium text-indigo-600 hover:underline">
                    Terima Barang
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>
