<script lang="ts">
  import { Badge } from 'flowbite-svelte';

  // Status yang dipakai lintas modul: Adjustment/PO/Sales (POSTED/DRAFT), Stock Alert (FAST_MOVING/DEAD_STOCK/ROP).
  type Status = 'POSTED' | 'DRAFT' | 'FAST_MOVING' | 'DEAD_STOCK' | 'ROP_ALERT' | 'PAID' | 'CANCELLED' | (string & {});

  let { status, class: className = '' }: { status: Status; class?: string } = $props();

  const colorByStatus: Record<string, 'green' | 'gray' | 'primary' | 'red' | 'yellow' | 'secondary'> = {
    POSTED: 'green',
    PAID: 'green',
    RECEIVED: 'green',
    Aktif: 'green',
    DRAFT: 'gray',
    PENDING: 'yellow',
    Nonaktif: 'gray',
    FAST_MOVING: 'primary',
    DEAD_STOCK: 'red',
    ROP_ALERT: 'yellow',
    CANCELLED: 'secondary',
  };

  const color = $derived(colorByStatus[status] ?? 'gray');
  const label = $derived(status.replace(/_/g, ' '));
</script>

<Badge {color} class="whitespace-nowrap font-medium {className}">{label}</Badge>
