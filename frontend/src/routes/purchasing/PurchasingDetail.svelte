<script lang="ts">
  // MVP 3 Phase 2 — Detail Pembelian: hub Horizontal Stepper + aksi kontekstual per step
  // (Approve/Terbitkan PO, Terima Barang bertahap, Selesaikan) + Document Viewer link PR/PO.
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { ArrowLeftOutline, CheckOutline, FileLinesOutline, PenOutline } from 'flowbite-svelte-icons';
  import { api, ApiClientError } from '../../lib/api';
  import { authState } from '../../lib/stores/auth';
  import AppCard from '../../lib/components/AppCard.svelte';
  import AppButton from '../../lib/components/AppButton.svelte';
  import AppInput from '../../lib/components/AppInput.svelte';
  import AppBadge from '../../lib/components/AppBadge.svelte';
  import HorizontalStepper from '../../lib/components/HorizontalStepper.svelte';
  import { formatRupiah } from '../../lib/utils/formatters';

  let { params } = $props<{ params: { id: string } }>();

  interface Item {
    id: string;
    variantId: string;
    qty: number;
    qtyReceived: number;
    unitCost: string | null;
    sku: string;
    color: string;
    size: string;
    productName: string;
    uomName: string | null;
  }
  interface PODetail {
    id: string;
    prNumber: string;
    poNumber: string | null;
    supplierName: string;
    requestedByName: string;
    approvedByName: string | null;
    status: string;
    notes: string | null;
    createdAt: string;
    items: Item[];
  }

  const STEPS = ['Pengajuan', 'Penerbitan PO', 'Penerimaan Barang', 'Selesai'];
  const STEP_INDEX: Record<string, number> = {
    DRAFT_PR: 0,
    PO_ISSUED: 1,
    PARTIALLY_RECEIVED: 2,
    RECEIVED: 2,
    COMPLETED: 3,
    CANCELLED: 0,
  };

  let po = $state<PODetail | null>(null);
  let loading = $state(true);
  let errorMessage = $state('');
  let actionSaving = $state(false);

  // Form state Step 2 (Approve): harga beli per item.
  let priceByItem = $state<Record<string, string>>({});
  // Form state Step 3 (Receive): qty diterima SESI INI per item.
  let receiveByItem = $state<Record<string, string>>({});

  const role = $derived($authState.user?.role ?? '');
  const currentIndex = $derived(po ? (STEP_INDEX[po.status] ?? 0) : 0);
  const cancelled = $derived(po?.status === 'CANCELLED');
  const totalAmount = $derived((po?.items ?? []).reduce((sum, i) => sum + i.qty * Number(i.unitCost ?? 0), 0));

  async function load() {
    loading = true;
    errorMessage = '';
    try {
      po = await api.get<PODetail>(`/purchase-orders/${params.id}`);
      priceByItem = Object.fromEntries(po.items.map((i) => [i.id, i.unitCost ?? '']));
      receiveByItem = Object.fromEntries(po.items.map((i) => [i.id, '']));
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal memuat detail Pembelian';
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function submitApprove() {
    if (!po) return;
    actionSaving = true;
    errorMessage = '';
    try {
      await api.post(`/purchase-orders/${po.id}/approve`, {
        items: po.items.map((i) => ({ itemId: i.id, unitCost: Number(priceByItem[i.id] || 0) })),
      });
      await load();
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal menyetujui pengajuan';
    } finally {
      actionSaving = false;
    }
  }

  async function submitReceive() {
    if (!po) return;
    actionSaving = true;
    errorMessage = '';
    try {
      await api.post(`/purchase-orders/${po.id}/receive`, {
        items: po.items.map((i) => ({ itemId: i.id, qtyReceived: Number(receiveByItem[i.id] || 0) })),
      });
      await load();
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal mencatat penerimaan barang';
    } finally {
      actionSaving = false;
    }
  }

  async function submitComplete() {
    if (!po) return;
    if (!confirm('Selesaikan & kunci Purchase Order ini secara permanen?')) return;
    actionSaving = true;
    errorMessage = '';
    try {
      await api.post(`/purchase-orders/${po.id}/complete`);
      await load();
    } catch (err) {
      errorMessage = err instanceof ApiClientError ? err.message : 'Gagal menyelesaikan Purchase Order';
    } finally {
      actionSaving = false;
    }
  }

  function variantLabel(item: Item) {
    return [item.color, item.size].filter(Boolean).join('/');
  }
</script>

<div class="mb-4 flex items-center gap-3">
  <button
    onclick={() => push('/purchasing')}
    class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
  >
    <ArrowLeftOutline class="h-4 w-4" /> Kembali
  </button>
  <h1 class="text-lg font-semibold text-slate-900">Detail Pembelian</h1>
</div>

{#if loading}
  <p class="text-sm text-slate-500">Memuat...</p>
{:else if errorMessage && !po}
  <p class="text-sm text-red-600">{errorMessage}</p>
{:else if po}
  <AppCard>
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs text-slate-500">No. PR / No. PO</p>
        <p class="text-sm font-semibold text-slate-800">{po.prNumber} {po.poNumber ? `/ ${po.poNumber}` : ''}</p>
        <p class="mt-1 text-xs text-slate-500">
          Supplier: <span class="font-medium text-slate-700">{po.supplierName}</span>
        </p>
        <p class="text-xs text-slate-500">
          Diajukan oleh <span class="font-medium text-slate-700">{po.requestedByName}</span>
          {#if po.approvedByName}· Disetujui oleh <span class="font-medium text-slate-700">{po.approvedByName}</span>{/if}
        </p>
        {#if po.notes}<p class="mt-1 text-xs text-slate-500">Catatan: {po.notes}</p>{/if}
      </div>
      <AppBadge status={po.status} />
    </div>

    <div class="mb-6 overflow-x-auto py-2">
      <HorizontalStepper steps={STEPS} {currentIndex} {cancelled} />
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-2">
      {#if po.status === 'DRAFT_PR'}
        <AppButton variant="outline" onclick={() => push(`/purchasing/${po!.id}/edit`)}>
          <PenOutline class="me-1.5 h-4 w-4" /> Edit Pengajuan
        </AppButton>
      {/if}
      <AppButton variant="outline" onclick={() => push(`/purchasing/${po!.id}/document?type=pr`)}>
        <FileLinesOutline class="me-1.5 h-4 w-4" /> Lihat Dokumen PR
      </AppButton>
      {#if po.poNumber}
        <AppButton variant="outline" onclick={() => push(`/purchasing/${po!.id}/document?type=po`)}>
          <FileLinesOutline class="me-1.5 h-4 w-4" /> Lihat Dokumen PO
        </AppButton>
      {/if}
    </div>

    {#if errorMessage}<p class="mb-3 text-sm text-red-600">{errorMessage}</p>{/if}

    <div class="overflow-x-auto rounded-lg border border-slate-200">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left font-medium">Produk / Varian</th>
            <th class="px-3 py-2 text-right font-medium">Qty Diajukan</th>
            <th class="px-3 py-2 text-right font-medium">Qty Diterima</th>
            <th class="px-3 py-2 text-right font-medium">Harga Beli/pcs</th>
            {#if po.status === 'PO_ISSUED' || po.status === 'PARTIALLY_RECEIVED'}
              <th class="px-3 py-2 text-right font-medium">Terima Sekarang</th>
            {/if}
            <th class="px-3 py-2 text-right font-medium">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {#each po.items as item (item.id)}
            <tr class="border-t border-slate-100">
              <td class="px-3 py-2">
                <p class="font-medium text-slate-800">{item.productName}</p>
                <p class="text-xs text-slate-500">{item.sku} {variantLabel(item) ? `(${variantLabel(item)})` : ''}</p>
              </td>
              <td class="px-3 py-2 text-right">{item.qty} {item.uomName ?? ''}</td>
              <td class="px-3 py-2 text-right">{item.qtyReceived} / {item.qty}</td>
              <td class="px-3 py-2 text-right">
                {#if po.status === 'DRAFT_PR' && role === 'OWNER'}
                  <AppInput name="price-{item.id}" numeric bind:value={priceByItem[item.id]} class="w-28 text-right" />
                {:else}
                  {item.unitCost ? formatRupiah(Number(item.unitCost)) : '-'}
                {/if}
              </td>
              {#if po.status === 'PO_ISSUED' || po.status === 'PARTIALLY_RECEIVED'}
                <td class="px-3 py-2 text-right">
                  {#if item.qtyReceived < item.qty}
                    <AppInput
                      name="receive-{item.id}"
                      numeric
                      bind:value={receiveByItem[item.id]}
                      placeholder={String(item.qty - item.qtyReceived)}
                      class="w-24 text-right"
                    />
                  {:else}
                    <span class="text-xs text-slate-400">Lengkap</span>
                  {/if}
                </td>
              {/if}
              <td class="px-3 py-2 text-right">{item.unitCost ? formatRupiah(item.qty * Number(item.unitCost)) : '-'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <p class="mt-3 text-right text-sm font-semibold text-slate-800">Total: {formatRupiah(totalAmount)}</p>

    <div class="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
      {#if po.status === 'DRAFT_PR' && role === 'OWNER'}
        <AppButton loading={actionSaving} onclick={submitApprove}>
          <CheckOutline class="me-1.5 h-4 w-4" /> Setujui & Terbitkan PO
        </AppButton>
      {:else if (po.status === 'PO_ISSUED' || po.status === 'PARTIALLY_RECEIVED') && (role === 'OWNER' || role === 'GUDANG')}
        <AppButton loading={actionSaving} onclick={submitReceive}>
          <CheckOutline class="me-1.5 h-4 w-4" /> Simpan Penerimaan Barang
        </AppButton>
      {:else if po.status === 'RECEIVED' && role === 'OWNER'}
        <AppButton loading={actionSaving} onclick={submitComplete}>
          <CheckOutline class="me-1.5 h-4 w-4" /> Selesaikan Purchase Order
        </AppButton>
      {:else if po.status === 'COMPLETED'}
        <p class="text-sm text-slate-500">Purchase Order ini sudah selesai & terkunci.</p>
      {:else if po.status === 'CANCELLED'}
        <p class="text-sm text-slate-500">Purchase Order ini dibatalkan.</p>
      {/if}
    </div>
  </AppCard>
{/if}
