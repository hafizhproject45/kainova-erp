<script lang="ts">
  // Line Chart interaktif ringan (native SVG, tanpa dependency chart library) —
  // MVP 3 Phase 1: Interactive Visual Dashboard. Hover/tap titik data menampilkan
  // tooltip nilai nominal terformat (formatRupiah).
  import { formatRupiah } from '../utils/formatters';

  let {
    points,
    height = 180,
  }: {
    points: Array<{ label: string; value: number }>;
    height?: number;
  } = $props();

  const width = 600;
  const padding = 28;

  let hoverIndex = $state<number | null>(null);

  const maxValue = $derived(Math.max(1, ...points.map((p) => p.value)));

  const coords = $derived(
    points.map((p, i) => {
      const x = points.length > 1 ? padding + (i / (points.length - 1)) * (width - padding * 2) : width / 2;
      const y = height - padding - (p.value / maxValue) * (height - padding * 2);
      return { x, y, ...p };
    }),
  );

  const pathD = $derived(coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' '));
  const areaD = $derived(
    coords.length > 0
      ? `${pathD} L ${coords[coords.length - 1]!.x} ${height - padding} L ${coords[0]!.x} ${height - padding} Z`
      : '',
  );
</script>

<div class="relative">
  <svg viewBox="0 0 {width} {height}" class="w-full" style="height: {height}px">
    <defs>
      <linearGradient id="line-chart-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#6366f1" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
      </linearGradient>
    </defs>

    {#if areaD}
      <path d={areaD} fill="url(#line-chart-fill)" />
      <path d={pathD} fill="none" stroke="#6366f1" stroke-width="2" />
    {/if}

    {#each coords as c, i (i)}
      <circle
        cx={c.x}
        cy={c.y}
        r={hoverIndex === i ? 5 : 3}
        fill="#6366f1"
        class="cursor-pointer transition-all focus:outline-none"
        tabindex="0"
        role="button"
        onmouseenter={() => (hoverIndex = i)}
        onmouseleave={() => (hoverIndex = null)}
        onfocus={() => (hoverIndex = i)}
        onblur={() => (hoverIndex = null)}
        onclick={() => (hoverIndex = hoverIndex === i ? null : i)}
        onkeydown={(e) => e.key === 'Enter' && (hoverIndex = hoverIndex === i ? null : i)}
        aria-label="{c.label}: {formatRupiah(c.value)}"
      />
      <text x={c.x} y={height - 8} text-anchor="middle" class="fill-slate-500 text-[9px]">{c.label}</text>
    {/each}
  </svg>

  {#if hoverIndex !== null && coords[hoverIndex]}
    {@const c = coords[hoverIndex]}
    <div
      class="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
      style="left: {(c.x / width) * 100}%; top: {(c.y / height) * 100}%; margin-top: -8px"
    >
      <p class="font-semibold">{formatRupiah(c.value)}</p>
      <p class="text-slate-300">{c.label}</p>
    </div>
  {/if}
</div>
