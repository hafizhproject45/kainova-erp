<script lang="ts">
  // Matrix Generator & Bulk Fill (MVP 3 Phase 1) — pilih produk yang sudah ada, generate
  // kombinasi Warna x Ukuran jadi SKU baru sekaligus isi harga & stok awal secara instan.
  import { push } from 'svelte-spa-router';
  import { ArrowLeftOutline, FloppyDiskAltOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../../lib/api';
  import AppCard from '../../lib/components/AppCard.svelte';
  import AppButton from '../../lib/components/AppButton.svelte';
  import AppInput from '../../lib/components/AppInput.svelte';
  import AppSelect from '../../lib/components/AppSelect.svelte';

  let products = $state<Array<{ id: string; name: string }>>([]);
  let productId = $state('');
  let material = $state('');
  let colors = $state('');
  let sizes = $state('');
  let basePrice = $state('');
  let initialStock = $state('0');
  let saving = $state(false);
  let errorMessage = $state('');

  const previewCombos = $derived.by(() => {
    const c = colors.split(',').map((s) => s.trim()).filter(Boolean);
    const s = sizes.split(',').map((s2) => s2.trim()).filter(Boolean);
    return c.flatMap((color) => s.map((size) => `${color} / ${size}`));
  });

  async function loadProducts() {
    try {
      products = await api.get<Array<{ id: string; name: string }>>('/products', { isActive: true });
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat daftar produk';
    }
  }
  loadProducts();

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = '';
    saving = true;
    try {
      await api.post(`/products/${productId}/variants/matrix`, {
        material: material || undefined,
        colors: colors.split(',').map((s) => s.trim()).filter(Boolean),
        sizes: sizes.split(',').map((s) => s.trim()).filter(Boolean),
        basePrice: Number(basePrice),
        initialStock: initialStock ? Number(initialStock) : 0,
      });
      push('/master-data/variants');
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal generate varian SKU';
    } finally {
      saving = false;
    }
  }
</script>

<div class="mb-4 flex items-center gap-3">
  <button
    onclick={() => push('/master-data/variants')}
    class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
  >
    <ArrowLeftOutline class="h-4 w-4" /> Kembali
  </button>
  <h1 class="text-lg font-semibold text-slate-900">Matrix Generator & Bulk Fill</h1>
</div>

<AppCard>
  <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" onsubmit={handleSubmit}>
    <AppSelect
      label="Produk"
      name="productId"
      required
      items={products.map((p) => ({ value: p.id, name: p.name }))}
      bind:value={productId}
      class="sm:col-span-2"
    />
    <AppInput label="Material" name="material" bind:value={material} />
    <AppInput label="Harga Dasar (Bulk Fill)" name="basePrice" required numeric bind:value={basePrice} />
    <AppInput label="Warna (pisah koma)" name="colors" required bind:value={colors} placeholder="Hitam, Putih" />
    <AppInput label="Ukuran (pisah koma)" name="sizes" required bind:value={sizes} placeholder="S, M, L" />
    <AppInput label="Stok Awal (Bulk Fill)" name="initialStock" numeric bind:value={initialStock} class="sm:col-span-2" />

    {#if previewCombos.length > 0}
      <div class="sm:col-span-2">
        <p class="mb-1 text-sm font-medium text-slate-700">Preview {previewCombos.length} kombinasi SKU:</p>
        <div class="flex flex-wrap gap-1.5">
          {#each previewCombos as combo (combo)}
            <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{combo}</span>
          {/each}
        </div>
      </div>
    {/if}

    {#if errorMessage}<p class="text-sm text-red-600 sm:col-span-2">{errorMessage}</p>{/if}

    <div class="flex justify-end gap-2 sm:col-span-2">
      <AppButton variant="outline" type="button" onclick={() => push('/master-data/variants')}>Batal</AppButton>
      <AppButton type="submit" loading={saving} disabled={!productId || previewCombos.length === 0}>
        <FloppyDiskAltOutline class="me-1.5 h-4 w-4" /> Generate & Simpan
      </AppButton>
    </div>
  </form>
</AppCard>
