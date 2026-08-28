<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { ArrowLeftOutline, FloppyDiskAltOutline, TrashBinOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../../lib/api';
  import AppCard from '../../lib/components/AppCard.svelte';
  import AppButton from '../../lib/components/AppButton.svelte';
  import AppInput from '../../lib/components/AppInput.svelte';
  import AppSelect from '../../lib/components/AppSelect.svelte';

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
  }

  const typeOptions = [
    { value: 'OPENING_BALANCE', name: 'Saldo Awal' },
    { value: 'OPNAME', name: 'Stock Opname' },
    { value: 'CORRECTION', name: 'Koreksi' },
  ];

  let products = $state<Product[]>([]);
  let variants = $state<Variant[]>([]);

  let type = $state('OPNAME');
  let reason = $state('');
  let productId = $state('');
  let variantId = $state('');
  let actualQty = $state('0');
  let items = $state<AdjustmentItem[]>([]);

  let errorMessage = $state('');
  let saving = $state(false);

  onMount(async () => {
    try {
      // MVP 3 Phase 1: Strict Filtering — hanya produk aktif yang bisa disesuaikan stoknya.
      products = await api.get<Product[]>('/products', { isActive: true });
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat data';
    }
  });

  $effect(() => {
    productId;
    variantId = '';
    variants = [];
    if (productId) api.get<Variant[]>(`/products/${productId}/variants`, { isActive: true }).then((v) => (variants = v));
  });

  function addItem() {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;
    items = [
      ...items,
      {
        variantId: variant.id,
        sku: variant.sku,
        systemQty: type === 'OPENING_BALANCE' ? 0 : variant.totalStock,
        actualQty: Number(actualQty) || 0,
      },
    ];
    variantId = '';
    actualQty = '0';
  }

  function removeItem(index: number) {
    items = items.filter((_, i) => i !== index);
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = '';
    saving = true;
    try {
      await api.post('/stock-adjustments', {
        type,
        reason,
        items: items.map((i) => ({ variantId: i.variantId, systemQty: i.systemQty, actualQty: i.actualQty })),
      });
      push('/stock-adjustment');
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal membuat adjustment';
    } finally {
      saving = false;
    }
  }
</script>

<div class="mb-4 flex items-center gap-3">
  <button
    onclick={() => push('/stock-adjustment')}
    class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
  >
    <ArrowLeftOutline class="h-4 w-4" /> Kembali
  </button>
  <h1 class="text-lg font-semibold text-slate-900">Buat Adjustment Stok</h1>
</div>

<form onsubmit={handleSubmit} class="grid grid-cols-1 gap-6 lg:grid-cols-2">
  <AppCard title="Detail Adjustment">
    <div class="space-y-4">
      <AppSelect label="Tipe" name="type" required items={typeOptions} bind:value={type} />
      <AppInput label="Alasan" name="reason" required bind:value={reason} placeholder="mis. Stock Opname Q1 2026" />

      <div class="space-y-3 rounded-lg border border-slate-200 p-3">
        <AppSelect
          label="Produk"
          name="productId"
          items={products.map((p) => ({ value: p.id, name: p.name }))}
          bind:value={productId}
        />
        {#if variants.length > 0}
          <AppSelect
            label="SKU"
            name="variantId"
            items={variants.map((v) => ({ value: v.id, name: `${v.sku} (sistem: ${v.totalStock})` }))}
            bind:value={variantId}
          />
        {/if}
        <AppInput label="Qty Fisik (hasil hitung nyata)" name="actualQty" numeric bind:value={actualQty} />
        <AppButton type="button" variant="outline" disabled={!variantId} onclick={addItem} class="w-full">
          + Tambah Item
        </AppButton>
      </div>
    </div>
  </AppCard>

  <AppCard title="Item Adjustment">
    {#if items.length === 0}
      <p class="text-sm text-slate-500">Belum ada item ditambahkan.</p>
    {:else}
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-left text-xs text-slate-500">
            <th class="pb-2 font-medium">SKU</th>
            <th class="pb-2 text-right font-medium">Sistem</th>
            <th class="pb-2 text-right font-medium">Fisik</th>
            <th class="pb-2 text-right font-medium">Selisih</th>
            <th class="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each items as item, i (i)}
            <tr class="border-b border-slate-100">
              <td class="py-2 font-mono text-xs">{item.sku}</td>
              <td class="py-2 text-right">{item.systemQty}</td>
              <td class="py-2 text-right">{item.actualQty}</td>
              <td class="py-2 text-right {item.actualQty - item.systemQty < 0 ? 'text-red-600' : 'text-emerald-600'}">
                {item.actualQty - item.systemQty > 0 ? '+' : ''}{item.actualQty - item.systemQty}
              </td>
              <td class="py-2 text-right">
                <button type="button" onclick={() => removeItem(i)} aria-label="Hapus" class="text-red-600">
                  <TrashBinOutline class="h-4 w-4" />
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    {#if errorMessage}<p class="mt-3 text-sm text-red-600">{errorMessage}</p>{/if}

    <div class="mt-4 flex justify-end gap-2">
      <AppButton type="submit" loading={saving} disabled={!reason || items.length === 0}>
        <FloppyDiskAltOutline class="me-1.5 h-4 w-4" /> Simpan sebagai Draft
      </AppButton>
    </div>
  </AppCard>
</form>
