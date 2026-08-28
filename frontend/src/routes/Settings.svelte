<script lang="ts">
  // MVP 3 Phase 4 — Enterprise System Settings & Policy: Company Profile, Inventory
  // Policy (costing/negative-stock/low-stock threshold), Role & Permission Matrix, dan
  // Receipt & Auto-Numbering Templates. Semua tersimpan di 1 baris `system_settings`.
  import { onMount } from 'svelte';
  import { BuildingOutline, CogOutline, FloppyDiskAltOutline, ReceiptOutline, UsersGroupOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../lib/api';
  import AppCard from '../lib/components/AppCard.svelte';
  import AppInput from '../lib/components/AppInput.svelte';
  import AppSelect from '../lib/components/AppSelect.svelte';
  import AppButton from '../lib/components/AppButton.svelte';
  import AppToggle from '../lib/components/AppToggle.svelte';

  interface Tax {
    id: string;
    name: string;
    type: 'PPN' | 'PPH';
  }

  interface SettingsResponse {
    businessName: string;
    businessAddress: string | null;
    businessNpwp: string | null;
    businessPhone: string | null;
    costingMethod: 'FIFO' | 'AVERAGE';
    defaultPpnTaxId: string | null;
    defaultPphTaxId: string | null;
    slowMovingThresholdDays: number;
    deadStockThresholdDays: number;
    allowNegativeStock: boolean;
    lowStockThreshold: number;
    receiptFooterNote: string | null;
    receiptPaperSize: '58mm' | '80mm';
    prNumberFormat: string;
    poNumberFormat: string;
    invoiceNumberFormat: string;
    rolePermissions: Record<string, Record<string, boolean>> | null;
  }

  // Role & Permission Matrix (MVP 3 Phase 4) — daftar aksi granular per modul yang boleh
  // dibatasi untuk GUDANG/KASIR. OWNER selalu penuh akses (super-admin, tidak bisa dicabut).
  // Key dipakai HARUS camelCase murni (bukan snake_case) & role key HARUS lowercase — payload
  // ini adalah JSON bebas (bukan nama field schema) yang tetap melewati konverter
  // snake_case<->camelCase generik di boundary API (lihat backend/src/utils/http.ts &
  // frontend/src/lib/api.ts), jadi harus dipilih bentuk yang stabil bolak-balik lewat konverter itu.
  const PERMISSION_ACTIONS: { key: string; label: string }[] = [
    { key: 'approvePo', label: 'Menyetujui PO (Purchase Order)' },
    { key: 'receivePo', label: 'Menerima Barang (Purchase Order)' },
    { key: 'stockAdjustment', label: 'Melakukan Adjustment Stok' },
    { key: 'voidTransaction', label: 'Void/Batalkan Transaksi Penjualan' },
    { key: 'manageMasterData', label: 'Kelola Master Data' },
    { key: 'viewReports', label: 'Melihat Laporan' },
  ];
  const PERMISSION_ROLES = ['GUDANG', 'KASIR'] as const;

  // Form pakai string kosong sebagai representasi "tidak diisi" (bukan null) —
  // Svelte 5 melarang bind:value ke null/undefined saat komponen anak (AppInput/
  // AppSelect) punya fallback value, jadi normalisasi dilakukan segera setelah fetch.
  let businessName = $state('');
  let businessAddress = $state('');
  let businessNpwp = $state('');
  let businessPhone = $state('');
  let costingMethod = $state<'FIFO' | 'AVERAGE'>('FIFO');
  let defaultPpnTaxId = $state('');
  let defaultPphTaxId = $state('');
  let slowMovingThresholdDays = $state('30');
  let deadStockThresholdDays = $state('90');
  let allowNegativeStock = $state(false);
  let lowStockThreshold = $state('5');
  let receiptFooterNote = $state('');
  let receiptPaperSize = $state<'58mm' | '80mm'>('58mm');
  let prNumberFormat = $state('');
  let poNumberFormat = $state('');
  let invoiceNumberFormat = $state('');
  let rolePermissions = $state<Record<string, Record<string, boolean>>>({});

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
  const paperSizeOptions = [
    { value: '58mm', name: 'Thermal 58mm' },
    { value: '80mm', name: 'Thermal 80mm' },
  ];

  function isPermitted(action: string, role: string): boolean {
    return rolePermissions[action]?.[role.toLowerCase()] ?? false;
  }
  function togglePermission(action: string, role: string, value: boolean) {
    const roleKey = role.toLowerCase();
    rolePermissions = { ...rolePermissions, [action]: { ...rolePermissions[action], [roleKey]: value } };
  }

  onMount(async () => {
    try {
      const [settings, taxRows] = await Promise.all([api.get<SettingsResponse>('/settings'), api.get<Tax[]>('/taxes')]);
      businessName = settings.businessName ?? '';
      businessAddress = settings.businessAddress ?? '';
      businessNpwp = settings.businessNpwp ?? '';
      businessPhone = settings.businessPhone ?? '';
      costingMethod = settings.costingMethod;
      defaultPpnTaxId = settings.defaultPpnTaxId ?? '';
      defaultPphTaxId = settings.defaultPphTaxId ?? '';
      slowMovingThresholdDays = String(settings.slowMovingThresholdDays ?? 30);
      deadStockThresholdDays = String(settings.deadStockThresholdDays ?? 90);
      allowNegativeStock = settings.allowNegativeStock ?? false;
      lowStockThreshold = String(settings.lowStockThreshold ?? 5);
      receiptFooterNote = settings.receiptFooterNote ?? '';
      receiptPaperSize = settings.receiptPaperSize ?? '58mm';
      prNumberFormat = settings.prNumberFormat ?? 'PR/{YYYY}/{MM}/{SEQ}';
      poNumberFormat = settings.poNumberFormat ?? 'PO/{YYYY}/{MM}/{SEQ}';
      invoiceNumberFormat = settings.invoiceNumberFormat ?? 'INV/{YYYY}/{MM}/{SEQ}';
      rolePermissions = settings.rolePermissions ?? {};
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
        businessAddress: businessAddress || undefined,
        businessNpwp: businessNpwp || undefined,
        businessPhone: businessPhone || undefined,
        costingMethod,
        defaultPpnTaxId: defaultPpnTaxId || null,
        defaultPphTaxId: defaultPphTaxId || null,
        slowMovingThresholdDays: Number(slowMovingThresholdDays) || 0,
        deadStockThresholdDays: Number(deadStockThresholdDays) || 0,
        allowNegativeStock,
        lowStockThreshold: Number(lowStockThreshold) || 0,
        receiptFooterNote: receiptFooterNote || undefined,
        receiptPaperSize,
        prNumberFormat: prNumberFormat || undefined,
        poNumberFormat: poNumberFormat || undefined,
        invoiceNumberFormat: invoiceNumberFormat || undefined,
        rolePermissions,
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
    <AppCard title="Profil Perusahaan">
      <div class="flex items-start gap-3">
        <BuildingOutline class="mt-7 h-5 w-5 shrink-0 text-slate-400" />
        <div class="flex-1 space-y-4">
          <AppInput label="Nama Bisnis" name="businessName" bind:value={businessName} placeholder="mis. Popyshop" />
          <AppInput label="Alamat" name="businessAddress" bind:value={businessAddress} placeholder="Alamat lengkap toko" />
          <div class="grid grid-cols-2 gap-4">
            <AppInput label="NPWP" name="businessNpwp" bind:value={businessNpwp} placeholder="XX.XXX.XXX.X-XXX.XXX" />
            <AppInput label="Telepon" name="businessPhone" bind:value={businessPhone} placeholder="08xx-xxxx-xxxx" />
          </div>
        </div>
      </div>
      <p class="mt-2 text-xs text-slate-500">Dipakai sebagai header dokumen (PR/PO/Invoice) & struk kasir.</p>
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

    <AppCard title="Kebijakan Inventaris">
      <div class="space-y-4">
        <AppToggle
          label="Izinkan Stok Minus"
          checked={allowNegativeStock}
          onchange={(v) => (allowNegativeStock = v)}
        />
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <AppInput
            label="Threshold Stok Minimum (Notifikasi)"
            name="lowStockThreshold"
            numeric
            bind:value={lowStockThreshold}
          />
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
      </div>
    </AppCard>

    <AppCard title="Struk & Penomoran Otomatis">
      <div class="flex items-start gap-3">
        <ReceiptOutline class="mt-7 h-5 w-5 shrink-0 text-slate-400" />
        <div class="flex-1 space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AppSelect label="Ukuran Kertas Struk" name="receiptPaperSize" items={paperSizeOptions} bind:value={receiptPaperSize} />
            <AppInput label="Catatan Footer Struk" name="receiptFooterNote" bind:value={receiptFooterNote} />
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AppInput label="Format Nomor PR" name="prNumberFormat" bind:value={prNumberFormat} />
            <AppInput label="Format Nomor PO" name="poNumberFormat" bind:value={poNumberFormat} />
            <AppInput label="Format Nomor Invoice" name="invoiceNumberFormat" bind:value={invoiceNumberFormat} />
          </div>
          <p class="text-xs text-slate-500">
            Placeholder yang didukung: <code>{'{YYYY}'}</code>, <code>{'{MM}'}</code>, <code>{'{SEQ}'}</code>.
          </p>
        </div>
      </div>
    </AppCard>

    <AppCard title="Role & Permission Matrix" class="lg:col-span-2">
      <div class="flex items-start gap-3">
        <UsersGroupOutline class="mt-1 h-5 w-5 shrink-0 text-slate-400" />
        <div class="flex-1">
          <p class="mb-3 text-xs text-slate-500">
            OWNER selalu memiliki akses penuh ke seluruh aksi. Atur akses granular untuk GUDANG & KASIR di bawah ini.
          </p>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead>
                <tr class="border-b border-slate-200 text-slate-500">
                  <th class="py-2 pr-4 font-medium">Aksi</th>
                  <th class="py-2 pr-4 font-medium">OWNER</th>
                  {#each PERMISSION_ROLES as role (role)}
                    <th class="py-2 pr-4 font-medium">{role}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each PERMISSION_ACTIONS as action (action.key)}
                  <tr class="border-b border-slate-100">
                    <td class="py-2 pr-4 text-slate-700">{action.label}</td>
                    <td class="py-2 pr-4 text-slate-400">
                      <input type="checkbox" checked disabled class="h-4 w-4 rounded border-slate-300" />
                    </td>
                    {#each PERMISSION_ROLES as role (role)}
                      <td class="py-2 pr-4">
                        <input
                          type="checkbox"
                          checked={isPermitted(action.key, role)}
                          onchange={(e) => togglePermission(action.key, role, (e.target as HTMLInputElement).checked)}
                          class="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
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
