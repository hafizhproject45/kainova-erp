<script module lang="ts">
  // Satu menu terbuka pada satu waktu lintas SEMUA instance AppKebabMenu di halaman —
  // `<script module>` di Svelte 5 dibagi antar instance komponen, jadi state ini otomatis
  // ter-share tanpa perlu store terpisah. Fix bug: klik kebab baris lain sekarang otomatis
  // menutup kebab baris sebelumnya.
  let activeId = $state<symbol | null>(null);
</script>

<script lang="ts">
  // Vertical Kebab Action Menu (MVP 3 Phase 2) — dropdown pop-up self-contained (bukan
  // flowbite Dropdown/Popper). Panel di-render dengan `position: fixed` + koordinat dihitung
  // dari getBoundingClientRect() tombol trigger, supaya TIDAK ikut ke-clip oleh container
  // tabel yang overflow-x-auto (bug: popup baris terakhir kepotong/tidak terlihat).
  import type { Snippet } from 'svelte';
  import { DotsVerticalOutline } from 'flowbite-svelte-icons';

  let { children }: { children: Snippet<[{ close: () => void }]> } = $props();

  const id = Symbol('kebab-menu');
  const open = $derived(activeId === id);

  let containerEl: HTMLDivElement | undefined = $state();
  let buttonEl: HTMLButtonElement | undefined = $state();
  let menuStyle = $state('');

  const MENU_WIDTH = 176; // w-44

  function updatePosition() {
    if (!buttonEl) return;
    const rect = buttonEl.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    const top = Math.min(rect.bottom + 4, window.innerHeight - 8);
    menuStyle = `position: fixed; top: ${top}px; left: ${left}px; width: ${MENU_WIDTH}px;`;
  }

  function toggle() {
    if (open) {
      close();
      return;
    }
    updatePosition();
    activeId = id;
  }
  function close() {
    if (activeId === id) activeId = null;
  }
  function handleFocusOut(e: FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (!containerEl?.contains(next)) close();
  }

  // Klik di luar (mouse tidak selalu memicu blur/focusout), scroll, atau resize -> tutup.
  $effect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (!containerEl?.contains(e.target as Node)) close();
    }
    function handleReposition() {
      close();
    }
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  });
</script>

<div bind:this={containerEl} class="relative inline-block" onfocusout={handleFocusOut}>
  <button
    bind:this={buttonEl}
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
      style={menuStyle}
      class="z-50 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
    >
      {@render children({ close })}
    </ul>
  {/if}
</div>
