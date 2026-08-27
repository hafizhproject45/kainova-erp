<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiClientError } from '../lib/api';

  interface Tax {
    id: string;
    name: string;
    type: 'PPN' | 'PPH';
  }
  interface SettingsData {
    costingMethod: 'FIFO' | 'AVERAGE';
    defaultPpnTaxId: string | null;
    defaultPphTaxId: string | null;
    slowMovingThresholdDays: number;
    deadStockThresholdDays: number;
    businessName: string;
    receiptFooterNote: string | null;
  }

  let settings = $state<SettingsData | null>(null);
  let taxes = $state<Tax[]>([]);
  let loading = $state(true);
  let errorMessage = $state('');
  let successMessage = $state('');

  onMount(async () => {
    try {
      settings = await api.get<SettingsData>('/settings');
      taxes = await api.get<Tax[]>('/taxes');
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat settings';
    } finally {
      loading = false;
    }
  });

  async function handleSave(event: SubmitEvent) {
    event.preventDefault();
    if (!settings) return;
    errorMessage = '';
    successMessage = '';
    try {
      settings = await api.put<SettingsData>('/settings', settings);
      successMessage = 'Settings berhasil disimpan';
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal menyimpan settings';
    }
  }
</script>

<h1 class="mb-6 text-lg font-semibold text-slate-900">Settings</h1>

{#if loading}
  <p class="text-sm text-slate-500">Memuat...</p>
{:else if settings}
  <form onsubmit={handleSave} class="max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6">
    <div>
      <label for="business-name" class="mb-1 block text-sm font-medium text-slate-700">Nama Bisnis</label>
      <input id="business-name" bind:value={settings.businessName} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
    </div>

    <div>
      <label for="costing-method" class="mb-1 block text-sm font-medium text-slate-700">Metode Costing (HPP)</label>
      <select id="costing-method" bind:value={settings.costingMethod} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value="FIFO">FIFO</option>
        <option value="AVERAGE">Moving Average</option>
      </select>
    </div>

    <div>
      <label for="default-ppn" class="mb-1 block text-sm font-medium text-slate-700">PPN Default (auto-terpilih di POS)</label>
      <select id="default-ppn" bind:value={settings.defaultPpnTaxId} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value={null}>Tidak ada</option>
        {#each taxes.filter((t) => t.type === 'PPN') as tax (tax.id)}
          <option value={tax.id}>{tax.name}</option>
        {/each}
      </select>
    </div>

    <div>
      <label for="default-pph" class="mb-1 block text-sm font-medium text-slate-700">PPh Default (auto-terpilih di POS)</label>
      <select id="default-pph" bind:value={settings.defaultPphTaxId} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option value={null}>Tidak ada</option>
        {#each taxes.filter((t) => t.type === 'PPH') as tax (tax.id)}
          <option value={tax.id}>{tax.name}</option>
        {/each}
      </select>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label for="slow-threshold" class="mb-1 block text-sm font-medium text-slate-700">Threshold Slow-Moving (hari)</label>
        <input id="slow-threshold" type="number" bind:value={settings.slowMovingThresholdDays} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label for="dead-threshold" class="mb-1 block text-sm font-medium text-slate-700">Threshold Dead Stock (hari)</label>
        <input id="dead-threshold" type="number" bind:value={settings.deadStockThresholdDays} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
    </div>

    <div>
      <label for="footer-note" class="mb-1 block text-sm font-medium text-slate-700">Catatan Footer Struk</label>
      <input id="footer-note" bind:value={settings.receiptFooterNote} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
    </div>

    {#if errorMessage}<p class="text-sm text-red-600">{errorMessage}</p>{/if}
    {#if successMessage}<p class="text-sm text-emerald-600">{successMessage}</p>{/if}

    <button type="submit" class="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
      Simpan Settings
    </button>
  </form>
{/if}
