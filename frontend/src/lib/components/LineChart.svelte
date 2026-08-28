<script lang="ts">
  // Line Chart interaktif ringan (native SVG, tanpa dependency chart library) —
  // MVP 3 Phase 1: Interactive Visual Dashboard. Hover/tap titik data menampilkan
  // tooltip nilai nominal terformat (formatRupiah).
  //
  // Lebar chart dialokasikan per-titik (bukan dipaksa muat 100% container) supaya label
  // jam ("today", 24 titik) atau tanggal ("month", ~30 titik) tidak saling tumpuk/terpotong —
  // kalau totalnya lebih lebar dari card, wrapper di-scroll horizontal (bukan dipepatkan).
  import { formatRupiah } from '../utils/formatters';

  let {
    points,
    height = 220,
  }: {
    points: Array<{ label: string; value: number }>;
    height?: number;
  } = $props();

  const padding = 32;
  const pxPerPoint = 52;
  const minWidth = 560;

  let hoverIndex = $state<number | null>(null);

  const width = $derived(Math.max(minWidth, points.length * pxPerPoint));
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

<div class="relative overflow-x-auto">
  <div class="relative" style="width: {width}px; min-width: 100%">
    <svg viewBox="0 0 {width} {height}" width={width} height={height}>
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
        <text x={c.x} y={height - 10} text-anchor="middle" class="fill-slate-500 text-[10px]">{c.label}</text>
      {/each}
    </svg>

    {#if hoverIndex !== null && coords[hoverIndex]}
      {@const c = coords[hoverIndex]}
      <div
        class="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg"
        style="left: {c.x}px; top: {c.y}px; margin-top: -8px"
      >
        <p class="font-semibold">{formatRupiah(c.value)}</p>
        <p class="text-slate-300">{c.label}</p>
      </div>
    {/if}
  </div>
</div>
