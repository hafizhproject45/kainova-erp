<script lang="ts">
  import { Table, TableHead, TableHeadCell, TableBody, TableBodyRow, TableBodyCell, Spinner } from 'flowbite-svelte';
  import type { Snippet } from 'svelte';
  import { formatNumber, formatRupiah } from '../utils/formatters';

  type ColumnFormat = 'text' | 'number' | 'currency';

  export type AppTableColumn = {
    key: string;
    label: string;
    align?: 'left' | 'right' | 'center';
    format?: ColumnFormat;
    sortable?: boolean;
  };

  let {
    columns,
    rows,
    pageSize = 10,
    loading = false,
    emptyText = 'Belum ada data.',
    rowActions,
  }: {
    columns: AppTableColumn[];
    rows: Record<string, unknown>[];
    pageSize?: number;
    loading?: boolean;
    emptyText?: string;
    rowActions?: Snippet<[Record<string, unknown>]>;
  } = $props();

  let sortKey = $state<string | null>(null);
  let sortDir = $state<'asc' | 'desc'>('asc');
  let currentPage = $state(1);

  function toggleSort(col: AppTableColumn) {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = col.key;
      sortDir = 'asc';
    }
    currentPage = 1;
  }

  const sortedRows = $derived.by(() => {
    if (!sortKey) return rows;
    const key = sortKey;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return av > bv ? dir : -dir;
    });
  });

  const totalPages = $derived(Math.max(1, Math.ceil(sortedRows.length / pageSize)));

  $effect(() => {
    if (currentPage > totalPages) currentPage = totalPages;
  });

  const pagedRows = $derived(sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize));

  function formatCell(value: unknown, format?: ColumnFormat) {
    if (format === 'currency') return formatRupiah(value as number);
    if (format === 'number') return formatNumber(value as number);
    return value ?? '-';
  }

  function alignClass(align?: 'left' | 'right' | 'center') {
    return align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  }
</script>

<div class="overflow-x-auto rounded-lg border border-slate-200">
  <Table striped hoverable class="min-w-full">
    <TableHead class="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-600">
      {#each columns as col (col.key)}
        <TableHeadCell
          class="{alignClass(col.align)} {col.sortable ? 'cursor-pointer select-none' : ''}"
          onclick={() => toggleSort(col)}
        >
          {col.label}
          {#if col.sortable && sortKey === col.key}
            <span class="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>
          {/if}
        </TableHeadCell>
      {/each}
      {#if rowActions}
        <TableHeadCell class="text-right">Aksi</TableHeadCell>
      {/if}
    </TableHead>
    <TableBody>
      {#if loading}
        <TableBodyRow>
          <TableBodyCell colspan={columns.length + (rowActions ? 1 : 0)}>
            <div class="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
              <Spinner size="5" /> Memuat data...
            </div>
          </TableBodyCell>
        </TableBodyRow>
      {:else if pagedRows.length === 0}
        <TableBodyRow>
          <TableBodyCell colspan={columns.length + (rowActions ? 1 : 0)}>
            <p class="py-6 text-center text-sm text-slate-500">{emptyText}</p>
          </TableBodyCell>
        </TableBodyRow>
      {:else}
        {#each pagedRows as row, i (i)}
          <TableBodyRow>
            {#each columns as col (col.key)}
              <TableBodyCell class={alignClass(col.align)}>
                {formatCell(row[col.key], col.format)}
              </TableBodyCell>
            {/each}
            {#if rowActions}
              <TableBodyCell class="text-right">
                {@render rowActions(row)}
              </TableBodyCell>
            {/if}
          </TableBodyRow>
        {/each}
      {/if}
    </TableBody>
  </Table>
</div>

{#if !loading && totalPages > 1}
  <div class="mt-3 flex items-center justify-between text-sm text-slate-600">
    <p>Halaman {currentPage} dari {totalPages} ({sortedRows.length} baris)</p>
    <div class="flex gap-1">
      <button
        class="rounded-lg border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={currentPage === 1}
        onclick={() => (currentPage = Math.max(1, currentPage - 1))}
      >
        Sebelumnya
      </button>
      <button
        class="rounded-lg border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={currentPage === totalPages}
        onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
      >
        Berikutnya
      </button>
    </div>
  </div>
{/if}
