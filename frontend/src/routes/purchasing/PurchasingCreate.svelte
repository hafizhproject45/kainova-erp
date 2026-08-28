<script lang="ts">
  // MVP 3 Phase 2 — Step 1: Pengajuan (PR / Purchase Requisition). Staf/Kasir/Gudang mengajukan
  // kebutuhan barang (Supplier, Produk/SKU, Qty) TANPA harga pasti — harga diisi Owner di Step 2 (Approve).
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { ArrowLeftOutline, FloppyDiskAltOutline, TrashBinOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../../lib/api';
  import AppCard from '../../lib/components/AppCard.svelte';
  import AppButton from '../../lib/components/AppButton.svelte';
  import AppInput from '../../lib/components/AppInput.svelte';
  import AppSelect from '../../lib/components/AppSelect.svelte';

  interface Supplier {
    id: string;
    name: string;
  }
  interface Product {
    id: string;
    name: string;
    supplierId?: string | null;
  }
  interface Variant {
    id: string;
    sku: string;
  }
  interface PRItem {
    variantId: string;
    sku: string;
    qty: number;
  }

  let { params } = $props<{ params?: { id?: string } }>();
  const editingId = $derived(params?.id ?? null);
  const isEdit = $derived(Boolean(editingId));

  let suppliers = $state<Supplier[]>([]);
  let products = $state<Product[]>([]);
  let variants = $state<Variant[]>([]);

  let supplierId = $state('');
  let notes = $state('');
  let productId = $state('');
  let variantId = $state('');
  let qty = $state('1');
  let items = $state<PRItem[]>([]);

  let loading = $state(false);
  let errorMessage = $state('');
  let saving = $state(false);

  // Relasi Default Supplier (MVP 3 Phase 1) — begitu supplier dipilih, daftar produk
  // dipersempit ke produk yang default supplier-nya cocok (mempermudah alur pengadaan);
  // produk tanpa default supplier tetap tampil supaya tidak menghalangi PR ad-hoc.
  const productOptions = $derived(
    supplierId ? products.filter((p) => !p.supplierId || p.supplierId === supplierId) : products,
  );

  onMount(async () => {
    try {
      // MVP 3 Phase 1: Strict Filtering — hanya supplier/produk aktif yang bisa dipilih di pengajuan pembelian.
      suppliers = await api.get<Supplier[]>('/suppliers', { isActive: true });
      products = await api.get<Product[]>('/products', { isActive: true });

      if (editingId) {
        loading = true;
        const po = await api.get<{
          supplierId: string;
          notes: string | null;
          status: string;
          items: Array<{ variantId: string; sku: string; qty: number }>;
        }>(`/purchase-orders/${editingId}`);
        if (po.status !== 'DRAFT_PR') {
          errorMessage = 'Pengajuan ini sudah disetujui/diproses & tidak bisa lagi diedit.';
        } else {
          supplierId = po.supplierId;
          notes = po.notes ?? '';
          items = po.items.map((i) => ({ variantId: i.variantId, sku: i.sku, qty: i.qty }));
        }
        loading = false;
      }
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat data';
    }
  });

  $effect(() => {
    supplierId;
    if (productId && !productOptions.some((p) => p.id === productId)) productId = '';
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
    items = [...items, { variantId: variant.id, sku: variant.sku, qty: Number(qty) || 1 }];
    variantId = '';
    qty = '1';
  }

  function removeItem(index: number) {
    items = items.filter((_, i) => i !== index);
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = '';
    saving = true;
    try {
      const payload = {
        supplierId,
        notes: notes || undefined,
        items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
      };
      if (isEdit) {
        await api.put(`/purchase-orders/${editingId}`, payload);
        push(`/purchasing/${editingId}`);
      } else {
        await api.post('/purchase-orders', payload);
        push('/purchasing');
      }
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal menyimpan pengajuan';
    } finally {
      saving = false;
    }
  }
</script>

<div class="mb-4 flex items-center gap-3">
  <button
    onclick={() => push(isEdit ? `/purchasing/${editingId}` : '/purchasing')}
    class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
  >
    <ArrowLeftOutline class="h-4 w-4" /> Kembali
  </button>
  <h1 class="text-lg font-semibold text-slate-900">{isEdit ? 'Edit Pengajuan (PR)' : 'Buat Pengajuan (PR)'}</h1>
</div>

{#if loading}
  <p class="text-sm text-slate-500">Memuat...</p>
{:else}
<form onsubmit={handleSubmit} class="grid grid-cols-1 gap-6 lg:grid-cols-2">
  <AppCard title="Detail Pengajuan">
    <div class="space-y-4">
      <AppSelect
        label="Supplier"
        name="supplierId"
        required
        items={suppliers.map((s) => ({ value: s.id, name: s.name }))}
        bind:value={supplierId}
      />
      <AppInput label="Catatan (opsional)" name="notes" bind:value={notes} />

      <div class="space-y-3 rounded-lg border border-slate-200 p-3">
        <AppSelect
          label="Produk"
          name="productId"
          items={productOptions.map((p) => ({ value: p.id, name: p.name }))}
          bind:value={productId}
        />
        {#if variants.length > 0}
          <AppSelect
            label="SKU"
            name="variantId"
            items={variants.map((v) => ({ value: v.id, name: v.sku }))}
            bind:value={variantId}
          />
        {/if}
        <AppInput label="Qty" name="qty" numeric bind:value={qty} />
        <AppButton type="button" variant="outline" disabled={!variantId} onclick={addItem} class="w-full">
          + Tambah Item
        </AppButton>
      </div>
    </div>
  </AppCard>

  <AppCard title="Item Pengajuan">
    {#if items.length === 0}
      <p class="text-sm text-slate-500">Belum ada item ditambahkan.</p>
    {:else}
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-left text-xs text-slate-500">
            <th class="pb-2 font-medium">SKU</th>
            <th class="pb-2 text-right font-medium">Qty</th>
            <th class="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each items as item, i (i)}
            <tr class="border-b border-slate-100">
              <td class="py-2 font-mono text-xs">{item.sku}</td>
              <td class="py-2 text-right">{item.qty}</td>
              <td class="py-2 text-right">
                <button type="button" onclick={() => removeItem(i)} aria-label="Hapus" class="text-red-600">
                  <TrashBinOutline class="h-4 w-4" />
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="mt-3 text-xs text-slate-500">Harga beli akan diisi Owner saat menyetujui pengajuan ini (Step 2).</p>
    {/if}

    {#if errorMessage}<p class="mt-3 text-sm text-red-600">{errorMessage}</p>{/if}

    <div class="mt-4 flex justify-end gap-2">
      <AppButton type="submit" loading={saving} disabled={!supplierId || items.length === 0}>
        <FloppyDiskAltOutline class="me-1.5 h-4 w-4" /> {isEdit ? 'Simpan Perubahan' : 'Ajukan PR'}
      </AppButton>
    </div>
  </AppCard>
</form>
{/if}
