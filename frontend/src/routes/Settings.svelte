<script lang="ts">
  import { onMount } from 'svelte';
  import { BuildingOutline, CogOutline, FloppyDiskAltOutline, ReceiptOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../lib/api';
  import AppCard from '../lib/components/AppCard.svelte';
  import AppInput from '../lib/components/AppInput.svelte';
  import AppSelect from '../lib/components/AppSelect.svelte';
  import AppButton from '../lib/components/AppButton.svelte';

  interface Tax {
    id: string;
    name: string;
    type: 'PPN' | 'PPH';
  }

  // Form pakai string kosong sebagai representasi "tidak diisi" (bukan null) —
  // Svelte 5 melarang bind:value ke null/undefined saat komponen anak (AppInput/
  // AppSelect) punya fallback value, jadi normalisasi dilakukan segera setelah fetch.
  let businessName = $state('');
  let costingMethod = $state<'FIFO' | 'AVERAGE'>('FIFO');
  let defaultPpnTaxId = $state('');
  let defaultPphTaxId = $state('');
  let slowMovingThresholdDays = $state('30');
  let deadStockThresholdDays = $state('90');
  let receiptFooterNote = $state('');

  let taxes = $state<Tax[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  const ppnOptions = $derived(taxes.filter((t) => t.type === 'PPN').map((t) => ({ value: t.id, name: t.name })));
  const pphOptions = $derived(taxes.filter((t) => t.type === 'PPH').map((t) => ({ value: t.id, name: t.name })));
  const costingMethodOptions = [
    { value: 'FIFO', name: 'FIFO (First In, First Out)' },
    { value: 'AVERAGE', name: 'Moving Average' },
  ];

  onMount(async () => {
    try {
      const [settings, taxRows] = await Promise.all([
        api.get<{
          businessName: string;
          costingMethod: 'FIFO' | 'AVERAGE';
          defaultPpnTaxId: string | null;
          defaultPphTaxId: string | null;
          slowMovingThresholdDays: number;
          deadStockThresholdDays: number;
          receiptFooterNote: string | null;
        }>('/settings'),
        api.get<Tax[]>('/taxes'),
      ]);
      businessName = settings.businessName ?? '';
      costingMethod = settings.costingMethod;
      defaultPpnTaxId = settings.defaultPpnTaxId ?? '';
      defaultPphTaxId = settings.defaultPphTaxId ?? '';
      slowMovingThresholdDays = String(settings.slowMovingThresholdDays ?? 30);
      deadStockThresholdDays = String(settings.deadStockThresholdDays ?? 90);
      receiptFooterNote = settings.receiptFooterNote ?? '';
      taxes = taxRows;
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat settings';
    } finally {
      loading = false;
    }
  });

  async function handleSave(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = '';
    successMessage = '';
    saving = true;
    try {
      await api.put('/settings', {
        businessName,
        costingMethod,
        defaultPpnTaxId: defaultPpnTaxId || null,
        defaultPphTaxId: defaultPphTaxId || null,
        slowMovingThresholdDays: Number(slowMovingThresholdDays) || 0,
        deadStockThresholdDays: Number(deadStockThresholdDays) || 0,
        receiptFooterNote: receiptFooterNote || undefined,
      });
      successMessage = 'Pengaturan berhasil disimpan';
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal menyimpan pengaturan';
    } finally {
      saving = false;
    }
  }
</script>

<div class="mb-6 flex items-center gap-2.5">
  <CogOutline class="h-5 w-5 text-slate-400" />
  <h1 class="text-lg font-semibold text-slate-900">Pengaturan</h1>
</div>

{#if loading}
  <p class="text-sm text-slate-500">Memuat...</p>
{:else}
  <form onsubmit={handleSave} class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <AppCard title="Informasi Bisnis">
      <div class="flex items-start gap-3">
        <BuildingOutline class="mt-7 h-5 w-5 shrink-0 text-slate-400" />
        <div class="flex-1 space-y-4">
          <AppInput label="Nama Bisnis" name="businessName" bind:value={businessName} placeholder="mis. Popyshop" />
        </div>
      </div>
    </AppCard>

    <AppCard title="Kalkulasi & Pajak">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AppSelect
          label="Metode Costing (HPP)"
          name="costingMethod"
          items={costingMethodOptions}
          bind:value={costingMethod}
        />
        <div></div>
        <AppSelect
          label="PPN Default"
          name="defaultPpnTaxId"
          placeholder="Tidak ada"
          items={ppnOptions}
          bind:value={defaultPpnTaxId}
        />
        <AppSelect
          label="PPh Default"
          name="defaultPphTaxId"
          placeholder="Tidak ada"
          items={pphOptions}
          bind:value={defaultPphTaxId}
        />
      </div>
      <p class="mt-2 text-xs text-slate-500">Pajak default akan otomatis terpilih setiap kali membuka halaman POS.</p>
    </AppCard>

    <AppCard title="Threshold Analitik Stok">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AppInput
          label="Slow-Moving (hari tanpa penjualan)"
          name="slowMovingThresholdDays"
          numeric
          bind:value={slowMovingThresholdDays}
        />
        <AppInput
          label="Dead Stock (hari tanpa penjualan)"
          name="deadStockThresholdDays"
          numeric
          bind:value={deadStockThresholdDays}
        />
      </div>
    </AppCard>

    <AppCard title="Struk Pembayaran">
      <div class="flex items-start gap-3">
        <ReceiptOutline class="mt-7 h-5 w-5 shrink-0 text-slate-400" />
        <div class="flex-1">
          <AppInput
            label="Catatan Footer Struk"
            name="receiptFooterNote"
            bind:value={receiptFooterNote}
            placeholder="mis. Terima kasih sudah belanja di Popyshop!"
          />
        </div>
      </div>
    </AppCard>

    <div class="lg:col-span-2">
      {#if errorMessage}<p class="mb-3 text-sm text-red-600">{errorMessage}</p>{/if}
      {#if successMessage}<p class="mb-3 text-sm text-primary-700">{successMessage}</p>{/if}

      <div class="flex justify-end">
        <AppButton type="submit" loading={saving}>
          <FloppyDiskAltOutline class="me-1.5 h-4 w-4" /> Simpan Pengaturan
        </AppButton>
      </div>
    </div>
  </form>
{/if}
