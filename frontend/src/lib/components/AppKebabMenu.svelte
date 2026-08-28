<script lang="ts">
  // Vertical Kebab Action Menu (MVP 3 Phase 2) — dropdown pop-up self-contained (bukan
  // flowbite Dropdown/Popper, supaya positioning tetap aman di dalam tabel yang di-scroll
  // horizontal) — pola sama dengan combobox custom di AppSelect.svelte.
  import type { Snippet } from 'svelte';
  import { DotsVerticalOutline } from 'flowbite-svelte-icons';

  let { children }: { children: Snippet<[{ close: () => void }]> } = $props();

  let open = $state(false);
  let containerEl: HTMLDivElement | undefined = $state();

  function toggle() {
    open = !open;
  }
  function close() {
    open = false;
  }
  function handleFocusOut(e: FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (!containerEl?.contains(next)) close();
  }
</script>

<div bind:this={containerEl} class="relative inline-block" onfocusout={handleFocusOut}>
  <button
    type="button"
    aria-label="Aksi lainnya"
    onclick={toggle}
    class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
  >
    <DotsVerticalOutline class="h-4 w-4" />
  </button>

  {#if open}
    <ul
      role="menu"
      class="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
    >
      {@render children({ close })}
    </ul>
  {/if}
</div>
