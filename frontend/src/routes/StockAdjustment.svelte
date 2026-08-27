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
    totalStock: number;
  }
  interface AdjustmentItem {
    variantId: string;
    sku: string;
    systemQty: number;
    actualQty: number;
    notes?: string;
  }
  interface Adjustment {
    id: string;
    type: string;
    reason: string;
    status: string;
    createdAt: string;
  }

  const typeOptions = [
    { value: 'OPENING_BALANCE', label: 'Saldo Awal' },
    { value: 'OPNAME', label: 'Stock Opname' },
    { value: 'CORRECTION', label: 'Koreksi' },
  ];

  let products = $state<Product[]>([]);
  let variants = $state<Variant[]>([]);
  let adjustments = $state<Adjustment[]>([]);

  let type = $state('OPNAME');
  let reason = $state('');
  let selectedProductId = $state('');
  let selectedVariantId = $state('');
  let actualQty = $state(0);
  let items = $state<AdjustmentItem[]>([]);

  let errorMessage = $state('');
  let successMessage = $state('');

  async function loadAll() {
    products = await api.get<Product[]>('/products');
    adjustments = await api.get<Adjustment[]>('/stock-adjustments');
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
    items = [
      ...items,
      {
        variantId: variant.id,
        sku: variant.sku,
        systemQty: type === 'OPENING_BALANCE' ? 0 : variant.totalStock,
        actualQty,
      },
    ];
    selectedVariantId = '';
    actualQty = 0;
  }

  function removeItem(index: number) {
    items = items.filter((_, i) => i !== index);
  }

  async function createAdjustment() {
    errorMessage = '';
    successMessage = '';
    try {
      await api.post('/stock-adjustments', {
        type,
        reason,
        items: items.map((i) => ({ variantId: i.variantId, systemQty: i.systemQty, actualQty: i.actualQty })),
      });
      successMessage = 'Adjustment stok tersimpan sebagai draft. Posting untuk menerapkan ke stok.';
      items = [];
      reason = '';
      adjustments = await api.get<Adjustment[]>('/stock-adjustments');
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal membuat adjustment';
    }
  }

  async function postAdjustment(id: string) {
    errorMessage = '';
    try {
      await api.post(`/stock-adjustments/${id}/post`);
      adjustments = await api.get<Adjustment[]>('/stock-adjustments');
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal posting adjustment';
    }
  }
</script>

<h1 class="mb-6 text-lg font-semibold text-slate-900">Adjustment Stok</h1>
<p class="mb-6 text-sm text-slate-500">Untuk stock opname (koreksi selisih fisik) maupun input saldo awal saat KaiNova baru digunakan.</p>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
  <div class="rounded-xl border border-slate-200 bg-white p-5">
    <h2 class="mb-3 text-sm font-semibold text-slate-800">Buat Adjustment Baru</h2>

    <select bind:value={type} class="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
      {#each typeOptions as opt (opt.value)}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>

    <input
      bind:value={reason}
      placeholder="Alasan (mis. Stock Opname Q1 2026)"
      class="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
    />

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
            <option value={variant.id}>{variant.sku} (sistem: {variant.totalStock})</option>
          {/each}
        </select>
      {/if}
      <input
        type="number"
        min="0"
        bind:value={actualQty}
        placeholder="Qty Fisik (hasil hitung nyata)"
        class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <button onclick={addItem} disabled={!selectedVariantId} class="w-full rounded-lg bg-slate-800 py-2 text-sm text-white disabled:opacity-50">
        + Tambah Item
      </button>
    </div>

    {#if items.length > 0}
      <table class="mb-3 w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-slate-500">
            <th class="pb-1 font-medium">SKU</th>
            <th class="pb-1 font-medium">Sistem</th>
            <th class="pb-1 font-medium">Fisik</th>
            <th class="pb-1 font-medium">Selisih</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each items as item, i (i)}
            <tr class="border-b border-slate-100">
              <td class="py-1 font-mono text-xs">{item.sku}</td>
              <td class="py-1">{item.systemQty}</td>
              <td class="py-1">{item.actualQty}</td>
              <td class="py-1 {item.actualQty - item.systemQty < 0 ? 'text-red-600' : 'text-emerald-600'}">
                {item.actualQty - item.systemQty > 0 ? '+' : ''}{item.actualQty - item.systemQty}
              </td>
              <td class="py-1 text-right"><button onclick={() => removeItem(i)} class="text-xs text-red-600">Hapus</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    {#if errorMessage}<p class="mb-2 text-sm text-red-600">{errorMessage}</p>{/if}
    {#if successMessage}<p class="mb-2 text-sm text-emerald-600">{successMessage}</p>{/if}

    <button
      onclick={createAdjustment}
      disabled={!reason || items.length === 0}
      class="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      Simpan sebagai Draft
    </button>
  </div>

  <div class="rounded-xl border border-slate-200 bg-white p-5">
    <h2 class="mb-3 text-sm font-semibold text-slate-800">Riwayat Adjustment</h2>
    {#if adjustments.length === 0}
      <p class="text-sm text-slate-500">Belum ada adjustment.</p>
    {:else}
      <table class="w-full text-sm">
        <tbody>
          {#each adjustments as adj (adj.id)}
            <tr class="border-b border-slate-100">
              <td class="py-2">
                <p class="font-medium text-slate-800">{adj.reason}</p>
                <p class="text-xs text-slate-500">{adj.type} — {new Date(adj.createdAt).toLocaleString('id-ID')}</p>
              </td>
              <td class="py-2 text-right">
                <span
                  class="rounded-full px-2 py-0.5 text-xs {adj.status === 'POSTED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'}"
                >
                  {adj.status}
                </span>
              </td>
              <td class="py-2 text-right">
                {#if adj.status === 'DRAFT'}
                  <button onclick={() => postAdjustment(adj.id)} class="text-xs font-medium text-indigo-600 hover:underline">
                    Post
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
