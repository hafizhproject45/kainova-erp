<script lang="ts">
  import { api, ApiClientError } from '../lib/api';

  let { params } = $props<{ params?: { tab?: string } }>();

  type TabKey = 'categories' | 'products' | 'suppliers' | 'customers' | 'taxes' | 'discounts';
  const EDITABLE_TABS: TabKey[] = ['categories', 'products', 'suppliers', 'customers', 'taxes', 'discounts'];

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'categories', label: 'Kategori' },
    { key: 'products', label: 'Produk & SKU' },
    { key: 'suppliers', label: 'Supplier' },
    { key: 'customers', label: 'Customer' },
    { key: 'taxes', label: 'Pajak' },
    { key: 'discounts', label: 'Diskon' },
  ];

  // `params` datang dari router (svelte-spa-router) — dibaca sekali saja untuk tab awal;
  // perpindahan tab berikutnya dikendalikan lokal lewat klik, bukan navigasi URL.
  let activeTab = $state<TabKey>('categories');
  $effect(() => {
    if (params?.tab) activeTab = params.tab as TabKey;
  });

  let rows = $state<Record<string, unknown>[]>([]);
  let categories = $state<Array<{ id: string; name: string }>>([]);
  let loading = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  // --- Varian SKU per produk (panel expand di bawah baris produk) ---
  let expandedProductId = $state<string | null>(null);
  let variantRows = $state<Record<string, unknown>[]>([]);
  let variantLoading = $state(false);
  let editingVariantId = $state<string | null>(null);
  let variantForm = $state<Record<string, string>>({});

  async function toggleVariants(productId: string) {
    if (expandedProductId === productId) {
      expandedProductId = null;
      return;
    }
    expandedProductId = productId;
    editingVariantId = null;
    variantLoading = true;
    try {
      variantRows = await api.get<Record<string, unknown>[]>(`/products/${productId}/variants`);
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
    successMessage = '';
    try {
      await api.put(`/product-variants/${variantId}`, {
        price: variantForm.price ? Number(variantForm.price) : undefined,
        material: variantForm.material || undefined,
        color: variantForm.color || undefined,
        size: variantForm.size || undefined,
      });
      successMessage = 'Varian SKU berhasil diperbarui';
      editingVariantId = null;
      if (expandedProductId) {
        variantRows = await api.get<Record<string, unknown>[]>(`/products/${expandedProductId}/variants`);
      }
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memperbarui varian SKU';
    }
  }

  async function deleteVariant(variant: Record<string, unknown>) {
    if (!confirm(`Hapus SKU "${variant.sku}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    errorMessage = '';
    successMessage = '';
    try {
      await api.delete(`/product-variants/${variant.id}`);
      successMessage = 'Varian SKU berhasil dihapus';
      variantRows = variantRows.filter((v) => v.id !== variant.id);
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal menghapus varian SKU';
    }
  }

  // Form state per tab (disederhanakan jadi satu object generik).
  let form = $state<Record<string, string>>({});
  /** Jika terisi, form sedang mode Edit untuk baris dengan id ini (bukan Create baru). */
  let editingId = $state<string | null>(null);

  function resetForm() {
    form = {};
    editingId = null;
  }

  async function loadRows() {
    loading = true;
    errorMessage = '';
    resetForm();
    try {
      if (activeTab === 'products') {
        rows = await api.get<Record<string, unknown>[]>('/products');
        categories = await api.get<Array<{ id: string; name: string }>>('/categories');
      } else {
        rows = await api.get<Record<string, unknown>[]>(`/${activeTab}`);
      }
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat data';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    activeTab;
    loadRows();
    expandedProductId = null;
  });

  function startEdit(row: Record<string, unknown>) {
    editingId = String(row.id);
    successMessage = '';
    errorMessage = '';
    if (activeTab === 'categories') {
      form = { name: String(row.name ?? '') };
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
      form = { name: String(row.name ?? ''), categoryId: String(row.categoryId ?? '') };
    }
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = '';
    successMessage = '';
    try {
      if (editingId) {
        if (activeTab === 'categories') {
          await api.put(`/categories/${editingId}`, { name: form.name });
        } else if (activeTab === 'suppliers' || activeTab === 'customers') {
          await api.put(`/${activeTab}/${editingId}`, {
            name: form.name,
            phone: form.phone || undefined,
            email: form.email || undefined,
            address: form.address || undefined,
          });
        } else if (activeTab === 'taxes') {
          await api.put(`/taxes/${editingId}`, { name: form.name, rate: Number(form.rate), isActive: form.isActive === 'true' });
        } else if (activeTab === 'discounts') {
          await api.put(`/discounts/${editingId}`, {
            name: form.name,
            value: Number(form.value),
            isActive: form.isActive === 'true',
          });
        } else if (activeTab === 'products') {
          await api.put(`/products/${editingId}`, { name: form.name, categoryId: form.categoryId });
        }
        successMessage = 'Berhasil diperbarui';
      } else {
        if (activeTab === 'categories') {
          await api.post('/categories', { name: form.name });
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
            material: form.material || undefined,
            colors: (form.colors ?? '').split(',').map((s) => s.trim()).filter(Boolean),
            sizes: (form.sizes ?? '').split(',').map((s) => s.trim()).filter(Boolean),
            basePrice: Number(form.basePrice),
          });
        }
        successMessage = 'Berhasil disimpan';
      }
      resetForm();
      await loadRows();
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal menyimpan data';
    }
  }

  async function handleDelete(row: Record<string, unknown>) {
    if (!confirm(`Hapus "${row.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    errorMessage = '';
    successMessage = '';
    try {
      await api.delete(`/${activeTab}/${row.id}`);
      successMessage = 'Berhasil dihapus';
      if (editingId === row.id) resetForm();
      await loadRows();
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal menghapus data';
    }
  }

  function columnsFor(tab: TabKey): string[] {
    switch (tab) {
      case 'categories':
        return ['name'];
      case 'products':
        return ['name', 'categoryId'];
      case 'suppliers':
      case 'customers':
        return ['name', 'phone', 'email'];
      case 'taxes':
        return ['name', 'type', 'rate', 'isActive'];
      case 'discounts':
        return ['name', 'type', 'value', 'isActive'];
      default:
        return [];
    }
  }
</script>

<h1 class="mb-4 text-lg font-semibold text-slate-900">Master Data</h1>

<div class="mb-6 flex gap-1 border-b border-slate-200">
  {#each tabs as tab (tab.key)}
    <button
      onclick={() => (activeTab = tab.key)}
      class="border-b-2 px-3 py-2 text-sm font-medium {activeTab === tab.key
        ? 'border-indigo-600 text-indigo-700'
        : 'border-transparent text-slate-500 hover:text-slate-700'}"
    >
      {tab.label}
    </button>
  {/each}
</div>

<div class="mb-6 rounded-xl border border-slate-200 bg-white p-5">
  <div class="mb-3 flex items-center justify-between">
    <h2 class="text-sm font-semibold text-slate-800">
      {editingId ? 'Edit' : 'Tambah'} {tabs.find((t) => t.key === activeTab)?.label}
    </h2>
    {#if editingId}
      <button onclick={resetForm} class="text-xs font-medium text-slate-500 hover:underline">Batal edit</button>
    {/if}
  </div>
  <form class="grid grid-cols-1 gap-3 sm:grid-cols-4" onsubmit={handleSubmit}>
    <input
      placeholder="Nama"
      bind:value={form.name}
      required
      class="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
    />

    {#if activeTab === 'suppliers' || activeTab === 'customers'}
      <input placeholder="Telepon" bind:value={form.phone} class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input placeholder="Email" bind:value={form.email} class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
    {/if}

    {#if activeTab === 'taxes'}
      {#if !editingId}
        <select bind:value={form.type} required class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="" disabled selected>Tipe Pajak</option>
          <option value="PPN">PPN</option>
          <option value="PPH">PPh</option>
        </select>
      {/if}
      <input
        type="number"
        step="0.01"
        placeholder="Rate (%)"
        bind:value={form.rate}
        required
        class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {#if editingId}
        <select bind:value={form.isActive} class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="true">Aktif</option>
          <option value="false">Nonaktif</option>
        </select>
      {/if}
    {/if}

    {#if activeTab === 'discounts'}
      {#if !editingId}
        <select bind:value={form.type} required class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="" disabled selected>Tipe Diskon</option>
          <option value="PERCENTAGE">Persentase (%)</option>
          <option value="NOMINAL">Nominal (Rp)</option>
        </select>
      {/if}
      <input
        type="number"
        placeholder="Nilai"
        bind:value={form.value}
        required
        class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {#if editingId}
        <select bind:value={form.isActive} class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="true">Aktif</option>
          <option value="false">Nonaktif</option>
        </select>
      {/if}
    {/if}

    {#if activeTab === 'products'}
      <select bind:value={form.categoryId} required class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="" disabled selected>Kategori</option>
        {#each categories as category (category.id)}
          <option value={category.id}>{category.name}</option>
        {/each}
      </select>
      {#if !editingId}
        <input placeholder="Material" bind:value={form.material} class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input placeholder="Warna (pisah koma)" bind:value={form.colors} required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input placeholder="Ukuran (pisah koma)" bind:value={form.sizes} required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input
          type="number"
          placeholder="Harga Dasar"
          bind:value={form.basePrice}
          required
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      {/if}
    {/if}

    <button type="submit" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
      {editingId ? 'Update' : 'Simpan'}
    </button>
  </form>

  {#if successMessage}<p class="mt-2 text-sm text-emerald-600">{successMessage}</p>{/if}
  {#if errorMessage}<p class="mt-2 text-sm text-red-600">{errorMessage}</p>{/if}
</div>

<div class="rounded-xl border border-slate-200 bg-white p-5">
  {#if loading}
    <p class="text-sm text-slate-500">Memuat...</p>
  {:else if rows.length === 0}
    <p class="text-sm text-slate-500">Belum ada data.</p>
  {:else}
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-slate-200 text-left text-slate-500">
          {#each columnsFor(activeTab) as col (col)}
            <th class="pb-2 pr-4 font-medium">{col}</th>
          {/each}
          {#if EDITABLE_TABS.includes(activeTab)}
            <th class="pb-2 pr-4 font-medium"></th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each rows as row, i (i)}
          <tr class="border-b border-slate-100">
            {#each columnsFor(activeTab) as col (col)}
              <td class="py-2 pr-4">{String(row[col] ?? '')}</td>
            {/each}
            {#if EDITABLE_TABS.includes(activeTab)}
              <td class="py-2 pr-4 text-right whitespace-nowrap">
                {#if activeTab === 'products'}
                  <button
                    onclick={() => toggleVariants(String(row.id))}
                    class="mr-3 text-xs font-medium text-slate-600 hover:underline"
                  >
                    {expandedProductId === row.id ? 'Tutup SKU' : 'Lihat SKU'}
                  </button>
                {/if}
                <button onclick={() => startEdit(row)} class="mr-3 text-xs font-medium text-indigo-600 hover:underline">
                  Edit
                </button>
                <button onclick={() => handleDelete(row)} class="text-xs font-medium text-red-600 hover:underline">
                  Hapus
                </button>
              </td>
            {/if}
          </tr>
          {#if activeTab === 'products' && expandedProductId === row.id}
            <tr class="border-b border-slate-100 bg-slate-50">
              <td colspan={columnsFor(activeTab).length + 1} class="p-4">
                {#if variantLoading}
                  <p class="text-xs text-slate-500">Memuat varian SKU...</p>
                {:else if variantRows.length === 0}
                  <p class="text-xs text-slate-500">Belum ada varian SKU untuk produk ini.</p>
                {:else}
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="border-b border-slate-200 text-left text-slate-500">
                        <th class="pb-2 pr-4 font-medium">SKU</th>
                        <th class="pb-2 pr-4 font-medium">Material</th>
                        <th class="pb-2 pr-4 font-medium">Warna</th>
                        <th class="pb-2 pr-4 font-medium">Ukuran</th>
                        <th class="pb-2 pr-4 font-medium">Harga</th>
                        <th class="pb-2 pr-4 font-medium">Stok</th>
                        <th class="pb-2 pr-4 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each variantRows as variant (String(variant.id))}
                        <tr class="border-b border-slate-100">
                          <td class="py-2 pr-4 font-medium text-slate-700">{String(variant.sku ?? '')}</td>
                          {#if editingVariantId === variant.id}
                            <td class="py-2 pr-4">
                              <input bind:value={variantForm.material} class="w-24 rounded border border-slate-300 px-2 py-1" />
                            </td>
                            <td class="py-2 pr-4">
                              <input bind:value={variantForm.color} class="w-20 rounded border border-slate-300 px-2 py-1" />
                            </td>
                            <td class="py-2 pr-4">
                              <input bind:value={variantForm.size} class="w-16 rounded border border-slate-300 px-2 py-1" />
                            </td>
                            <td class="py-2 pr-4">
                              <input
                                type="number"
                                bind:value={variantForm.price}
                                class="w-24 rounded border border-slate-300 px-2 py-1"
                              />
                            </td>
                            <td class="py-2 pr-4">{String(variant.totalStock ?? 0)}</td>
                            <td class="py-2 pr-4 text-right whitespace-nowrap">
                              <button
                                onclick={() => saveVariant(String(variant.id))}
                                class="mr-2 font-medium text-indigo-600 hover:underline"
                              >
                                Simpan
                              </button>
                              <button onclick={() => (editingVariantId = null)} class="text-slate-500 hover:underline">
                                Batal
                              </button>
                            </td>
                          {:else}
                            <td class="py-2 pr-4">{String(variant.material ?? '-')}</td>
                            <td class="py-2 pr-4">{String(variant.color ?? '')}</td>
                            <td class="py-2 pr-4">{String(variant.size ?? '')}</td>
                            <td class="py-2 pr-4">{String(variant.price ?? '')}</td>
                            <td class="py-2 pr-4">{String(variant.totalStock ?? 0)}</td>
                            <td class="py-2 pr-4 text-right whitespace-nowrap">
                              <button
                                onclick={() => startEditVariant(variant)}
                                class="mr-2 font-medium text-indigo-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button onclick={() => deleteVariant(variant)} class="font-medium text-red-600 hover:underline">
                                Hapus
                              </button>
                            </td>
                          {/if}
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                {/if}
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  {/if}
</div>
