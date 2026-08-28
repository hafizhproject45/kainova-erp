<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { untrack } from 'svelte';
  import { ArrowLeftOutline, FloppyDiskAltOutline, PenOutline, TrashBinOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../../lib/api';
  import AppCard from '../../lib/components/AppCard.svelte';
  import AppButton from '../../lib/components/AppButton.svelte';
  import AppInput from '../../lib/components/AppInput.svelte';
  import AppSelect from '../../lib/components/AppSelect.svelte';
  import AppTable from '../../lib/components/AppTable.svelte';
  import { tabConfig, type TabKey } from '../../lib/masterDataConfig';

  let { params } = $props<{ params?: { tab?: string; id?: string } }>();

  const activeTab = $derived((params?.tab as TabKey) ?? 'categories');
  const editingId = $derived(params?.id ?? null);
  const isEdit = $derived(Boolean(editingId));

  // Svelte 5 melarang `bind:value` ke properti yang masih `undefined` ketika komponen anak
  // (AppInput/AppSelect) punya fallback value — jadi setiap field HARUS diseed string kosong
  // sejak render pertama (bukan hanya di dalam $effect, yang baru jalan setelah mount).
  function emptyFormFor(tab: TabKey): Record<string, string> {
    switch (tab) {
      case 'categories':
        return { name: '' };
      case 'uoms':
        return { code: '', name: '', description: '' };
      case 'suppliers':
      case 'customers':
        return { name: '', phone: '', email: '', address: '' };
      case 'taxes':
        return { name: '', type: '', rate: '', isActive: 'true' };
      case 'discounts':
        return { name: '', type: '', value: '', isActive: 'true' };
      case 'products':
        return { name: '', categoryId: '', uomId: '', material: '', basePrice: '', colors: '', sizes: '' };
    }
  }

  let form = $state<Record<string, string>>(untrack(() => emptyFormFor((params?.tab as TabKey) ?? 'categories')));
  let categories = $state<Array<{ id: string; name: string }>>([]);
  let uoms = $state<Array<{ id: string; name: string }>>([]);
  let loading = $state(false);
  let saving = $state(false);
  let errorMessage = $state('');

  // --- Varian SKU (khusus tab produk, mode edit) ---
  let variantRows = $state<Record<string, unknown>[]>([]);
  let variantLoading = $state(false);
  let editingVariantId = $state<string | null>(null);
  let variantForm = $state<Record<string, string>>({});

  async function loadVariants() {
    if (!editingId) return;
    variantLoading = true;
    try {
      variantRows = await api.get<Record<string, unknown>[]>(`/products/${editingId}/variants`);
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat varian SKU';
    } finally {
      variantLoading = false;
    }
  }

  function startEditVariant(variant: Record<string, unknown>) {
    editingVariantId = String(variant.id);
    variantForm = {
      price: String(variant.price ?? ''),
      material: String(variant.material ?? ''),
      color: String(variant.color ?? ''),
      size: String(variant.size ?? ''),
    };
  }

  async function saveVariant(variantId: string) {
    errorMessage = '';
    try {
      await api.put(`/product-variants/${variantId}`, {
        price: variantForm.price ? Number(variantForm.price) : undefined,
        material: variantForm.material || undefined,
        color: variantForm.color || undefined,
        size: variantForm.size || undefined,
      });
      editingVariantId = null;
      await loadVariants();
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memperbarui varian SKU';
    }
  }

  async function deleteVariant(variant: Record<string, unknown>) {
    if (!confirm(`Hapus SKU "${variant.sku}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    errorMessage = '';
    try {
      await api.delete(`/product-variants/${variant.id}`);
      await loadVariants();
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal menghapus varian SKU';
    }
  }

  async function loadForm() {
    errorMessage = '';
    form = emptyFormFor(activeTab);
    if (activeTab === 'products') {
      categories = await api.get<Array<{ id: string; name: string }>>('/categories');
      uoms = await api.get<Array<{ id: string; name: string }>>('/uoms');
    }
    if (!editingId) return;

    loading = true;
    try {
      const list = await api.get<Record<string, unknown>[]>(tabConfig(activeTab).apiPath);
      const row = list.find((r) => String(r.id) === editingId);
      if (!row) throw new Error('Data tidak ditemukan');

      if (activeTab === 'categories') {
        form = { name: String(row.name ?? '') };
      } else if (activeTab === 'uoms') {
        form = { code: String(row.code ?? ''), name: String(row.name ?? ''), description: String(row.description ?? '') };
      } else if (activeTab === 'suppliers' || activeTab === 'customers') {
        form = {
          name: String(row.name ?? ''),
          phone: String(row.phone ?? ''),
          email: String(row.email ?? ''),
          address: String(row.address ?? ''),
        };
      } else if (activeTab === 'taxes') {
        form = { name: String(row.name ?? ''), rate: String(row.rate ?? ''), isActive: String(row.isActive ?? 'true') };
      } else if (activeTab === 'discounts') {
        form = { name: String(row.name ?? ''), value: String(row.value ?? ''), isActive: String(row.isActive ?? 'true') };
      } else if (activeTab === 'products') {
        form = { name: String(row.name ?? ''), categoryId: String(row.categoryId ?? ''), uomId: String(row.uomId ?? '') };
        await loadVariants();
      }
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat data';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    activeTab;
    editingId;
    loadForm();
  });

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = '';
    saving = true;
    try {
      if (isEdit && editingId) {
        if (activeTab === 'categories') {
          await api.put(`/categories/${editingId}`, { name: form.name });
        } else if (activeTab === 'uoms') {
          await api.put(`/uoms/${editingId}`, { code: form.code, name: form.name, description: form.description || undefined });
        } else if (activeTab === 'suppliers' || activeTab === 'customers') {
          await api.put(`/${activeTab}/${editingId}`, {
            name: form.name,
            phone: form.phone || undefined,
            email: form.email || undefined,
            address: form.address || undefined,
          });
        } else if (activeTab === 'taxes') {
          await api.put(`/taxes/${editingId}`, {
            name: form.name,
            rate: Number(form.rate),
            isActive: form.isActive === 'true',
          });
        } else if (activeTab === 'discounts') {
          await api.put(`/discounts/${editingId}`, {
            name: form.name,
            value: Number(form.value),
            isActive: form.isActive === 'true',
          });
        } else if (activeTab === 'products') {
          await api.put(`/products/${editingId}`, { name: form.name, categoryId: form.categoryId, uomId: form.uomId });
        }
      } else {
        if (activeTab === 'categories') {
          await api.post('/categories', { name: form.name });
        } else if (activeTab === 'uoms') {
          await api.post('/uoms', { code: form.code, name: form.name, description: form.description || undefined });
        } else if (activeTab === 'suppliers' || activeTab === 'customers') {
          await api.post(`/${activeTab}`, {
            name: form.name,
            phone: form.phone || undefined,
            email: form.email || undefined,
            address: form.address || undefined,
          });
        } else if (activeTab === 'taxes') {
          await api.post('/taxes', { name: form.name, type: form.type, rate: Number(form.rate) });
        } else if (activeTab === 'discounts') {
          await api.post('/discounts', { name: form.name, type: form.type, value: Number(form.value) });
        } else if (activeTab === 'products') {
          await api.post('/products/matrix', {
            name: form.name,
            categoryId: form.categoryId,
            uomId: form.uomId,
            material: form.material || undefined,
            colors: (form.colors ?? '').split(',').map((s) => s.trim()).filter(Boolean),
            sizes: (form.sizes ?? '').split(',').map((s) => s.trim()).filter(Boolean),
            basePrice: Number(form.basePrice),
          });
        }
      }
      push(`/master-data/${activeTab}`);
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal menyimpan data';
    } finally {
      saving = false;
    }
  }
</script>

<div class="mb-4 flex items-center gap-3">
  <button
    onclick={() => push(`/master-data/${activeTab}`)}
    class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
  >
    <ArrowLeftOutline class="h-4 w-4" /> Kembali
  </button>
  <h1 class="text-lg font-semibold text-slate-900">
    {isEdit ? 'Edit' : 'Tambah'} {tabConfig(activeTab).label}
  </h1>
</div>

{#if loading}
  <p class="text-sm text-slate-500">Memuat...</p>
{:else}
  <AppCard>
    <form class="grid grid-cols-1 gap-4 sm:grid-cols-2" onsubmit={handleSubmit}>
      {#if activeTab === 'uoms'}
        <AppInput label="Kode" name="code" required bind:value={form.code} placeholder="mis. PCS" />
        <AppInput label="Nama Satuan" name="name" required bind:value={form.name} placeholder="mis. Pieces" />
        <AppInput label="Deskripsi" name="description" bind:value={form.description} class="sm:col-span-2" />
      {:else if activeTab === 'categories'}
        <AppInput label="Nama Kategori" name="name" required bind:value={form.name} class="sm:col-span-2" />
      {:else if activeTab === 'suppliers' || activeTab === 'customers'}
        <AppInput label="Nama" name="name" required bind:value={form.name} class="sm:col-span-2" />
        <AppInput label="Telepon" name="phone" bind:value={form.phone} />
        <AppInput label="Email" name="email" type="email" bind:value={form.email} />
        <AppInput label="Alamat" name="address" bind:value={form.address} class="sm:col-span-2" />
      {:else if activeTab === 'taxes'}
        <AppInput label="Nama Pajak" name="name" required bind:value={form.name} />
        {#if !isEdit}
          <AppSelect
            label="Tipe Pajak"
            name="type"
            required
            items={[{ value: 'PPN', name: 'PPN' }, { value: 'PPH', name: 'PPh' }]}
            bind:value={form.type}
          />
        {/if}
        <AppInput label="Rate (%)" name="rate" required numeric bind:value={form.rate} />
        {#if isEdit}
          <AppSelect
            label="Status"
            name="isActive"
            items={[{ value: 'true', name: 'Aktif' }, { value: 'false', name: 'Nonaktif' }]}
            bind:value={form.isActive}
          />
        {/if}
      {:else if activeTab === 'discounts'}
        <AppInput label="Nama Diskon" name="name" required bind:value={form.name} />
        {#if !isEdit}
          <AppSelect
            label="Tipe Diskon"
            name="type"
            required
            items={[{ value: 'PERCENTAGE', name: 'Persentase (%)' }, { value: 'NOMINAL', name: 'Nominal (Rp)' }]}
            bind:value={form.type}
          />
        {/if}
        <AppInput label="Nilai" name="value" required numeric bind:value={form.value} />
        {#if isEdit}
          <AppSelect
            label="Status"
            name="isActive"
            items={[{ value: 'true', name: 'Aktif' }, { value: 'false', name: 'Nonaktif' }]}
            bind:value={form.isActive}
          />
        {/if}
      {:else if activeTab === 'products'}
        <AppInput label="Nama Produk" name="name" required bind:value={form.name} class="sm:col-span-2" />
        <AppSelect
          label="Kategori"
          name="categoryId"
          required
          items={categories.map((c) => ({ value: c.id, name: c.name }))}
          bind:value={form.categoryId}
        />
        <AppSelect
          label="UOM (Satuan)"
          name="uomId"
          required
          items={uoms.map((u) => ({ value: u.id, name: u.name }))}
          bind:value={form.uomId}
        />
        {#if !isEdit}
          <AppInput label="Material" name="material" bind:value={form.material} />
          <AppInput label="Harga Dasar" name="basePrice" required numeric bind:value={form.basePrice} />
          <AppInput label="Warna (pisah koma)" name="colors" required bind:value={form.colors} placeholder="Hitam, Putih" />
          <AppInput label="Ukuran (pisah koma)" name="sizes" required bind:value={form.sizes} placeholder="S, M, L" />
        {/if}
      {/if}

      {#if errorMessage}<p class="text-sm text-red-600 sm:col-span-2">{errorMessage}</p>{/if}

      <div class="flex justify-end gap-2 sm:col-span-2">
        <AppButton variant="outline" type="button" onclick={() => push(`/master-data/${activeTab}`)}>Batal</AppButton>
        <AppButton type="submit" loading={saving}>
          <FloppyDiskAltOutline class="me-1.5 h-4 w-4" /> {isEdit ? 'Update' : 'Simpan'}
        </AppButton>
      </div>
    </form>
  </AppCard>

  {#if activeTab === 'products' && isEdit}
    <AppCard title="Varian SKU" class="mt-6">
      <AppTable
        loading={variantLoading}
        columns={[
          { key: 'sku', label: 'SKU' },
          { key: 'material', label: 'Material' },
          { key: 'color', label: 'Warna' },
          { key: 'size', label: 'Ukuran' },
          { key: 'price', label: 'Harga', align: 'right', format: 'currency' },
          { key: 'totalStock', label: 'Stok', align: 'right', format: 'number' },
        ]}
        rows={variantRows}
        emptyText="Belum ada varian SKU untuk produk ini."
      >
        {#snippet rowActions(row)}
          {#if editingVariantId === row.id}
            <div class="mb-2 grid grid-cols-2 gap-2 text-left">
              <AppInput name="v-material" bind:value={variantForm.material} placeholder="Material" />
              <AppInput name="v-color" bind:value={variantForm.color} placeholder="Warna" />
              <AppInput name="v-size" bind:value={variantForm.size} placeholder="Ukuran" />
              <AppInput name="v-price" numeric bind:value={variantForm.price} placeholder="Harga" />
            </div>
            <button onclick={() => saveVariant(String(row.id))} class="mr-3 font-medium text-primary-600 hover:underline">
              Simpan
            </button>
            <button onclick={() => (editingVariantId = null)} class="text-slate-500 hover:underline">Batal</button>
          {:else}
            <button
              aria-label="Edit"
              onclick={() => startEditVariant(row)}
              class="mr-3 inline-flex items-center text-primary-600 hover:underline"
            >
              <PenOutline class="h-4 w-4" />
            </button>
            <button
              aria-label="Hapus"
              onclick={() => deleteVariant(row)}
              class="inline-flex items-center text-red-600 hover:underline"
            >
              <TrashBinOutline class="h-4 w-4" />
            </button>
          {/if}
        {/snippet}
      </AppTable>
    </AppCard>
  {/if}
{/if}
