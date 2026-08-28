<script lang="ts">
  import { Badge } from 'flowbite-svelte';

  // Status yang dipakai lintas modul: Adjustment/PO/Sales (POSTED/DRAFT), Stock Alert (FAST_MOVING/DEAD_STOCK/ROP),
  // Procurement PR-to-PO lifecycle (MVP 3 Phase 2): DRAFT_PR/PO_ISSUED/PARTIALLY_RECEIVED/RECEIVED/COMPLETED.
  type Status =
    | 'POSTED'
    | 'DRAFT'
    | 'FAST_MOVING'
    | 'DEAD_STOCK'
    | 'ROP_ALERT'
    | 'PAID'
    | 'CANCELLED'
    | 'DRAFT_PR'
    | 'PO_ISSUED'
    | 'PARTIALLY_RECEIVED'
    | 'RECEIVED'
    | 'COMPLETED'
    | 'PEMBELIAN'
    | 'PENJUALAN'
    | 'ADJUSTMENT'
    | (string & {});

  let { status, class: className = '' }: { status: Status; class?: string } = $props();

  // 'amber' dipakai (bukan 'yellow' bawaan Flowbite) supaya badge alert/highlight
  // konsisten dengan token Tertiary KaiNova (Amber/Gold) — lihat app.css @theme.
  const colorByStatus: Record<string, 'green' | 'gray' | 'primary' | 'red' | 'amber' | 'secondary'> = {
    POSTED: 'green',
    PAID: 'green',
    RECEIVED: 'green',
    COMPLETED: 'green',
    Aktif: 'green',
    DRAFT: 'gray',
    DRAFT_PR: 'gray',
    PENDING: 'amber',
    PO_ISSUED: 'primary',
    PARTIALLY_RECEIVED: 'amber',
    Nonaktif: 'gray',
    FAST_MOVING: 'primary',
    DEAD_STOCK: 'red',
    ROP_ALERT: 'amber',
    CANCELLED: 'secondary',
    // Stock Ledger (MVP 3 Phase 3) — jenis transaksi kartu stok.
    PEMBELIAN: 'green',
    PENJUALAN: 'primary',
    ADJUSTMENT: 'amber',
  };

  const color = $derived(colorByStatus[status] ?? 'gray');
  const label = $derived(status.replace(/_/g, ' '));
</script>

<Badge {color} class="whitespace-nowrap font-medium {className}">{label}</Badge>
