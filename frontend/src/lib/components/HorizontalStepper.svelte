<script lang="ts">
  // Horizontal Stepper (MVP 3 Phase 2) — indikator kemajuan step transaksi Pembelian
  // (Pengajuan -> Penerbitan PO -> Penerimaan Barang -> Selesai). `currentIndex` boleh
  // melewati beberapa step tanpa "done" penuh (mis. CANCELLED) lewat prop `cancelled`.
  import { CheckOutline } from 'flowbite-svelte-icons';

  let {
    steps,
    currentIndex,
    cancelled = false,
  }: {
    steps: string[];
    currentIndex: number;
    cancelled?: boolean;
  } = $props();
</script>

<div class="flex items-center">
  {#each steps as step, i (step)}
    <div class="flex flex-1 items-center {i === steps.length - 1 ? 'flex-none' : ''}">
      <div class="flex flex-col items-center gap-1.5">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition
            {cancelled
              ? 'border-slate-300 bg-slate-100 text-slate-400'
              : i < currentIndex
                ? 'border-primary-600 bg-primary-600 text-white'
                : i === currentIndex
                  ? 'border-primary-600 bg-white text-primary-600'
                  : 'border-slate-300 bg-white text-slate-400'}"
        >
          {#if !cancelled && i < currentIndex}
            <CheckOutline class="h-4 w-4" />
          {:else}
            {i + 1}
          {/if}
        </div>
        <span
          class="max-w-[90px] text-center text-[11px] font-medium {!cancelled && i <= currentIndex
            ? 'text-slate-800'
            : 'text-slate-400'}"
        >
          {step}
        </span>
      </div>
      {#if i < steps.length - 1}
        <div class="mx-2 h-0.5 flex-1 {!cancelled && i < currentIndex ? 'bg-primary-600' : 'bg-slate-200'}"></div>
      {/if}
    </div>
  {/each}
</div>
