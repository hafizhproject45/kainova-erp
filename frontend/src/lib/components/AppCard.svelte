<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title = '',
    class: className = '',
    children,
    footer,
  }: {
    title?: string;
    class?: string;
    children?: Snippet;
    footer?: Snippet;
  } = $props();
</script>

<div class="w-full max-w-none rounded-xl border border-slate-200 bg-white shadow-sm {className}">
  {#if title}
    <div class="border-b border-slate-200 px-5 py-4">
      <h2 class="text-base font-semibold text-slate-900">{title}</h2>
    </div>
  {/if}

  <div class="p-5">
    {@render children?.()}
  </div>

  {#if footer}
    <div class="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
      {@render footer()}
    </div>
  {/if}
</div>
