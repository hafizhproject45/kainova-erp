<script lang="ts">
  import { link, router } from 'svelte-spa-router';
  import { authState, logout } from './stores/auth';

  let { children } = $props();

  const navItems = [
    { href: '/', label: 'Dashboard', roles: ['OWNER'] },
    { href: '/master-data', label: 'Master Data', roles: ['OWNER'] },
    { href: '/pos', label: 'Penjualan (POS)', roles: ['OWNER', 'KASIR'] },
    { href: '/purchasing', label: 'Pembelian', roles: ['OWNER', 'GUDANG'] },
    { href: '/stock-adjustment', label: 'Adjustment Stok', roles: ['OWNER', 'GUDANG'] },
    { href: '/reports', label: 'Laporan', roles: ['OWNER'] },
    { href: '/settings', label: 'Settings', roles: ['OWNER'] },
  ];

  const visibleNavItems = $derived(navItems.filter((item) => item.roles.includes($authState.user?.role ?? '')));

  // Sidebar jadi off-canvas drawer di layar < md (tablet/mobile toko) supaya tidak
  // mendorong konten utama keluar viewport & memicu scroll horizontal.
  let mobileMenuOpen = $state(false);
</script>

<div class="flex min-h-screen bg-slate-50">
  {#if mobileMenuOpen}
    <button
      aria-label="Tutup menu"
      class="fixed inset-0 z-40 bg-slate-900/30 md:hidden"
      onclick={() => (mobileMenuOpen = false)}
    ></button>
  {/if}

  <aside
    class="fixed inset-y-0 left-0 z-50 w-60 shrink-0 border-r border-slate-200 bg-white transition-transform duration-200 print:hidden md:static md:translate-x-0 {mobileMenuOpen
      ? 'translate-x-0'
      : '-translate-x-full'}"
  >
    <div class="border-b border-slate-200 px-5 py-4">
      <p class="text-sm font-semibold text-slate-900">KaiNova ERP</p>
      <p class="text-xs text-slate-500">Popyshop</p>
    </div>
    <nav class="flex flex-col gap-0.5 p-3">
      {#each visibleNavItems as item (item.href)}
        <a
          href={item.href}
          use:link
          onclick={() => (mobileMenuOpen = false)}
          class="rounded-lg px-3 py-2 text-sm font-medium transition {router.location === item.href
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-slate-600 hover:bg-slate-100'}"
        >
          {item.label}
        </a>
      {/each}
    </nav>
  </aside>

  <div class="flex min-w-0 flex-1 flex-col">
    <header class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 print:hidden sm:px-6">
      <button
        aria-label="Buka menu"
        onclick={() => (mobileMenuOpen = true)}
        class="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 md:hidden"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div class="flex items-center gap-3">
        <div class="text-right">
          <p class="text-sm font-medium text-slate-800">{$authState.user?.name}</p>
          <p class="text-xs text-slate-500">{$authState.user?.role}</p>
        </div>
        <button
          onclick={logout}
          class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Keluar
        </button>
      </div>
    </header>

    <main class="min-w-0 flex-1 overflow-x-auto p-4 sm:p-6">
      {@render children()}
    </main>
  </div>
</div>
