<script lang="ts">
  import { link, push } from 'svelte-spa-router';
  import { PlusOutline, PenOutline, TrashBinOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../../lib/api';
  import AppTable from '../../lib/components/AppTable.svelte';
  import AppButton from '../../lib/components/AppButton.svelte';
  import AppInput from '../../lib/components/AppInput.svelte';
  import AppSelect from '../../lib/components/AppSelect.svelte';
  import { MASTER_DATA_TABS, columnsFor, tabConfig, type TabKey } from '../../lib/masterDataConfig';

  let { params } = $props<{ params?: { tab?: string } }>();

  const activeTab = $derived((params?.tab as TabKey) ?? 'categories');

  let rows = $state<Record<string, unknown>[]>([]);
  let categories = $state<Array<{ id: string; name: string }>>([]);
  let uoms = $state<Array<{ id: string; name: string }>>([]);
  let loading = $state(false);
  let errorMessage = $state('');

  let searchQuery = $state('');
  let categoryFilter = $state('');

  const categoryNameById = $derived(new Map(categories.map((c) => [c.id, c.name])));
  const uomNameById = $derived(new Map(uoms.map((u) => [u.id, u.name])));

  // Baris yang sudah diperkaya untuk ditampilkan di AppTable: produk -> nama kategori/uom
  // hasil lookup (backend hanya kirim id). Kolom Status pakai Toggle langsung dari isActive.
  const displayRows = $derived(
    rows.map((row) => {
      const enriched: Record<string, unknown> = { ...row };
      if (activeTab === 'products') {
        enriched.categoryName = categoryNameById.get(String(row.categoryId)) ?? '-';
        enriched.uomName = row.uomId ? (uomNameById.get(String(row.uomId)) ?? '-') : '-';
      }
      return enriched;
    }),
  );

  const filteredRows = $derived(
    displayRows.filter((row) => {
      if (activeTab === 'products' && categoryFilter && row.categoryId !== categoryFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return columnsFor(activeTab).some((col) => String(row[col.key] ?? '').toLowerCase().includes(q));
    }),
  );

  async function loadRows() {
    loading = true;
    errorMessage = '';
    try {
      rows = await api.get<Record<string, unknown>[]>(tabConfig(activeTab).apiPath);
      if (activeTab === 'products') {
        categories = await api.get<Array<{ id: string; name: string }>>('/categories');
        uoms = await api.get<Array<{ id: string; name: string }>>('/uoms');
      }
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat data';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    activeTab;
    searchQuery = '';
    categoryFilter = '';
    loadRows();
  });

  async function handleDelete(row: Record<string, unknown>) {
    if (!confirm(`Hapus "${row.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    errorMessage = '';
    try {
      await api.delete(`${tabConfig(activeTab).apiPath}/${row.id}`);
      await loadRows();
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal menghapus data';
    }
  }

  // Inline Quick Toggle (MVP 3 Phase 1) — update optimistik + PATCH /:id/status, rollback jika gagal.
  async function handleToggleActive(row: Record<string, unknown>, next: boolean) {
    const id = String(row.id);
    const prev = rows;
    rows = rows.map((r) => (String(r.id) === id ? { ...r, isActive: next } : r));
    errorMessage = '';
    try {
      await api.patch(`${tabConfig(activeTab).apiPath}/${id}/status`, { isActive: next });
    } catch (err) {
      rows = prev;
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal mengubah status';
    }
  }
</script>

<div class="mb-4 flex items-center justify-between">
  <h1 class="text-lg font-semibold text-slate-900">Master Data</h1>
  <AppButton
    onclick={() =>
      push(activeTab === 'variants' ? '/master-data/variants/matrix' : `/master-data/${activeTab}/create`)}
  >
    <PlusOutline class="me-1.5 h-4 w-4" />
    {activeTab === 'variants' ? 'Matrix Generator' : `Tambah ${tabConfig(activeTab).label}`}
  </AppButton>
</div>

<div class="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
  {#each MASTER_DATA_TABS as tab (tab.key)}
    <a
      href="/master-data/{tab.key}"
      use:link
      class="border-b-2 px-3 py-2 text-sm font-medium {activeTab === tab.key
        ? 'border-primary-600 text-primary-700'
        : 'border-transparent text-slate-500 hover:text-slate-700'}"
    >
      {tab.label}
    </a>
  {/each}
</div>

<div class="rounded-xl border border-slate-200 bg-white p-5">
  <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
    <AppInput placeholder="Cari..." bind:value={searchQuery} class="sm:max-w-xs" />
    {#if activeTab === 'products'}
      <AppSelect
        placeholder="Semua Kategori"
        items={categories.map((c) => ({ value: c.id, name: c.name }))}
        bind:value={categoryFilter}
        class="sm:max-w-xs"
      />
    {/if}
    {#if searchQuery || categoryFilter}
      <span class="text-xs text-slate-500">{filteredRows.length} dari {rows.length} data</span>
    {/if}
  </div>

  {#if errorMessage}<p class="mb-3 text-sm text-red-600">{errorMessage}</p>{/if}

  <AppTable columns={columnsFor(activeTab)} rows={filteredRows} {loading} onToggleActive={handleToggleActive}>
    {#snippet rowActions(row)}
      <button
        aria-label="Edit"
        onclick={() => push(`/master-data/${activeTab}/${row.id}/edit`)}
        class="mr-3 inline-flex items-center text-primary-600 hover:underline"
      >
        <PenOutline class="h-4 w-4" />
      </button>
      <button
        aria-label="Hapus"
        onclick={() => handleDelete(row)}
        class="inline-flex items-center text-red-600 hover:underline"
      >
        <TrashBinOutline class="h-4 w-4" />
      </button>
    {/snippet}
  </AppTable>
</div>
