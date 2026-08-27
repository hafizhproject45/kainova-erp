<script lang="ts">
  import { api, ApiClientError } from '../lib/api';

  let { params } = $props<{ params?: { tab?: string } }>();

  type TabKey = 'categories' | 'products' | 'suppliers' | 'customers' | 'taxes' | 'discounts';

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

  // Form state per tab (disederhanakan jadi satu object generik).
  let form = $state<Record<string, string>>({});

  function resetForm() {
    form = {};
  }

  async function loadRows() {
    loading = true;
    errorMessage = '';
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
  });

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = '';
    successMessage = '';
    try {
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
      resetForm();
      await loadRows();
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal menyimpan data';
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
  <h2 class="mb-3 text-sm font-semibold text-slate-800">Tambah {tabs.find((t) => t.key === activeTab)?.label}</h2>
  <form class="grid grid-cols-1 gap-3 sm:grid-cols-4" onsubmit={handleCreate}>
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
      <select bind:value={form.type} required class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="" disabled selected>Tipe Pajak</option>
        <option value="PPN">PPN</option>
        <option value="PPH">PPh</option>
      </select>
      <input
        type="number"
        step="0.01"
        placeholder="Rate (%)"
        bind:value={form.rate}
        required
        class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    {/if}

    {#if activeTab === 'discounts'}
      <select bind:value={form.type} required class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="" disabled selected>Tipe Diskon</option>
        <option value="PERCENTAGE">Persentase (%)</option>
        <option value="NOMINAL">Nominal (Rp)</option>
      </select>
      <input
        type="number"
        placeholder="Nilai"
        bind:value={form.value}
        required
        class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    {/if}

    {#if activeTab === 'products'}
      <select bind:value={form.categoryId} required class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="" disabled selected>Kategori</option>
        {#each categories as category (category.id)}
          <option value={category.id}>{category.name}</option>
        {/each}
      </select>
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

    <button type="submit" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
      Simpan
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
        </tr>
      </thead>
      <tbody>
        {#each rows as row, i (i)}
          <tr class="border-b border-slate-100">
            {#each columnsFor(activeTab) as col (col)}
              <td class="py-2 pr-4">{String(row[col] ?? '')}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
