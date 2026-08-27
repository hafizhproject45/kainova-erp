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
</script>

<div class="flex min-h-screen bg-slate-50">
  <aside class="w-60 shrink-0 border-r border-slate-200 bg-white">
    <div class="border-b border-slate-200 px-5 py-4">
      <p class="text-sm font-semibold text-slate-900">KaiNova ERP</p>
      <p class="text-xs text-slate-500">Popyshop</p>
    </div>
    <nav class="flex flex-col gap-0.5 p-3">
      {#each visibleNavItems as item (item.href)}
        <a
          href={item.href}
          use:link
          class="rounded-lg px-3 py-2 text-sm font-medium transition {router.location === item.href
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-slate-600 hover:bg-slate-100'}"
        >
          {item.label}
        </a>
      {/each}
    </nav>
  </aside>

  <div class="flex flex-1 flex-col">
    <header class="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div></div>
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

    <main class="flex-1 p-6">
      {@render children()}
    </main>
  </div>
</div>
