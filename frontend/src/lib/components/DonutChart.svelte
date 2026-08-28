<script lang="ts">
  // Donut Chart interaktif ringan (native SVG) — MVP 3 Phase 1: Interactive Visual
  // Dashboard. Hover/tap segmen menampilkan label, nilai nominal & persentase.
  import { formatRupiah } from '../utils/formatters';

  let {
    segments,
  }: {
    segments: Array<{ label: string; value: number }>;
  } = $props();

  const palette = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#64748b'];

  const size = 160;
  const radius = 60;
  const strokeWidth = 24;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let hoverIndex = $state<number | null>(null);

  const total = $derived(Math.max(1, segments.reduce((sum, s) => sum + s.value, 0)));

  const arcs = $derived.by(() => {
    let offset = 0;
    return segments.map((s, i) => {
      const fraction = s.value / total;
      const dash = fraction * circumference;
      const arc = { ...s, color: palette[i % palette.length]!, dash, offset, fraction };
      offset += dash;
      return arc;
    });
  });
</script>

<div class="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
  <div class="relative shrink-0" style="width: {size}px; height: {size}px">
    <svg viewBox="0 0 {size} {size}" width={size} height={size} class="-rotate-90">
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#e2e8f0" stroke-width={strokeWidth} />
      {#each arcs as arc, i (arc.label)}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={arc.color}
          stroke-width={hoverIndex === i ? strokeWidth + 4 : strokeWidth}
          stroke-dasharray="{arc.dash} {circumference - arc.dash}"
          stroke-dashoffset={-arc.offset}
          class="cursor-pointer transition-all focus:outline-none"
          tabindex="0"
          role="button"
          onmouseenter={() => (hoverIndex = i)}
          onmouseleave={() => (hoverIndex = null)}
          onfocus={() => (hoverIndex = i)}
          onblur={() => (hoverIndex = null)}
          onclick={() => (hoverIndex = hoverIndex === i ? null : i)}
          onkeydown={(e) => e.key === 'Enter' && (hoverIndex = hoverIndex === i ? null : i)}
          aria-label="{arc.label}: {formatRupiah(arc.value)} ({Math.round(arc.fraction * 100)}%)"
        />
      {/each}
    </svg>
    <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
      {#if hoverIndex !== null && arcs[hoverIndex]}
        <p class="text-xs font-semibold text-slate-800">{Math.round(arcs[hoverIndex].fraction * 100)}%</p>
        <p class="max-w-[80px] truncate text-[10px] text-slate-500">{arcs[hoverIndex].label}</p>
      {:else}
        <p class="text-xs font-semibold text-slate-800">{formatRupiah(total)}</p>
        <p class="text-[10px] text-slate-500">Total</p>
      {/if}
    </div>
  </div>

  <ul class="flex flex-col gap-1.5 text-xs">
    {#each arcs as arc, i (arc.label)}
      <li
        class="flex items-center gap-2 rounded px-1.5 py-0.5 {hoverIndex === i ? 'bg-slate-100' : ''}"
        onmouseenter={() => (hoverIndex = i)}
        onmouseleave={() => (hoverIndex = null)}
        role="presentation"
      >
        <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color: {arc.color}"></span>
        <span class="text-slate-600">{arc.label}</span>
        <span class="ml-auto font-medium text-slate-800">{formatRupiah(arc.value)}</span>
      </li>
    {/each}
    {#if segments.length === 0}
      <li class="text-slate-400">Belum ada data.</li>
    {/if}
  </ul>
</div>
