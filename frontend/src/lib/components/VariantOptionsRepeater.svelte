<script lang="ts">
  // MVP 3 Phase 4 — Product Variant Options Repeater Engine. Dynamic row repeater di
  // form Tambah Produk: tiap row = satu Opsi Varian (Warna/Ukuran) + daftar nilainya
  // (pisah koma). Hasilnya di-passing langsung (Seamless Matrix Feeding) sebagai
  // `colors`/`sizes` ke Matrix Generator (lihat MasterDataForm.svelte & VariantMatrixForm.svelte)
  // — schema SKU (product_variants.color/size) memang cuma mendukung 2 dimensi varian,
  // jadi repeater ini dibatasi maksimal 2 row (satu per atribut) supaya pemetaannya tidak ambigu.
  import { PlusOutline, TrashBinOutline } from 'flowbite-svelte-icons';
  import AppSelect from './AppSelect.svelte';
  import AppInput from './AppInput.svelte';
  import type { VariantOptionRow } from './VariantOptionsRepeater.types';

  let { rows = $bindable<VariantOptionRow[]>([]) }: { rows: VariantOptionRow[] } = $props();

  const ATTRIBUTE_LABELS: Record<string, string> = { WARNA: 'Warna', UKURAN: 'Ukuran' };

  function availableAttributes(currentIndex: number) {
    const used = new Set(rows.map((r, i) => (i === currentIndex ? null : r.attribute)).filter(Boolean));
    return (['WARNA', 'UKURAN'] as const).filter((a) => !used.has(a)).map((a) => ({ value: a, name: ATTRIBUTE_LABELS[a] }));
  }

  function addRow() {
    if (rows.length >= 2) return;
    const used = new Set(rows.map((r) => r.attribute));
    const next = (['WARNA', 'UKURAN'] as const).find((a) => !used.has(a)) ?? '';
    rows = [...rows, { attribute: next, values: '' }];
  }

  function removeRow(index: number) {
    rows = rows.filter((_, i) => i !== index);
  }
</script>

<div class="sm:col-span-2">
  <p class="mb-2 text-sm font-medium text-slate-700">Opsi Varian</p>
  <div class="space-y-2">
    {#each rows as row, i (i)}
      <div class="flex items-start gap-2">
        <div class="w-36 shrink-0">
          <AppSelect name={`variant-attr-${i}`} items={availableAttributes(i)} bind:value={row.attribute} />
        </div>
        <div class="flex-1">
          <AppInput
            name={`variant-values-${i}`}
            bind:value={row.values}
            placeholder={row.attribute === 'UKURAN' ? 'mis. S, M, L' : 'mis. Hitam, Putih'}
          />
        </div>
        <button
          type="button"
          aria-label="Hapus baris"
          onclick={() => removeRow(i)}
          class="mt-2 inline-flex shrink-0 items-center text-red-500 hover:text-red-700"
        >
          <TrashBinOutline class="h-4 w-4" />
        </button>
      </div>
    {/each}
  </div>

  {#if rows.length < 2}
    <button
      type="button"
      onclick={addRow}
      class="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline"
    >
      <PlusOutline class="h-3.5 w-3.5" /> Tambah Atribut Varian
    </button>
  {/if}
  <p class="mt-1 text-xs text-slate-500">
    Isi nilai tiap atribut dipisah koma. Hasilnya otomatis membentuk kombinasi SKU (Matrix Generator).
  </p>
</div>
