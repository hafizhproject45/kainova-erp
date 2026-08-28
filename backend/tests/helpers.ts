/**
 * Helper untuk integration test (bun test). Boot server Elysia asli lewat import
 * `../src/index` (efek samping top-level `.listen()`), lalu test memukul endpoint
 * via HTTP `fetch` persis seperti klien nyata — bukan memanggil handler langsung.
 *
 * WAJIB jalan dengan env terpisah dari dev (lihat .env.test.example / README.md):
 * DB & PORT beda supaya tidak bentrok dengan server dev yang mungkin sedang jalan,
 * dan supaya data test tidak mengotori data dev.
 */
import '../src/index';
import { env } from '../src/config/env';

if (!env.databaseUrl.includes('_test')) {
  throw new Error(
    `Integration test menolak jalan karena DATABASE_URL (${env.databaseUrl}) sepertinya bukan database test ` +
      '(harus mengandung "_test"). Jalankan lewat `bun run test` (baca .env.test), jangan `bun test` polos.',
  );
}

export const baseUrl = `http://localhost:${env.port}`;

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: unknown;
  status: number;
}

export async function api<T = unknown>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const json = (await res.json()) as Omit<ApiEnvelope<T>, 'status'>;
  return { ...json, status: res.status };
}

let cachedOwnerToken: string | null = null;

/** Login sebagai user OWNER hasil `bun run db:seed` (username "owner" / password "popyshop123"). */
export async function loginOwner(): Promise<string> {
  if (cachedOwnerToken) return cachedOwnerToken;
  const res = await api<{ token: string }>('POST', '/v1/auth/login', {
    body: { username: 'owner', password: 'popyshop123' },
  });
  if (!res.success || !res.data) {
    throw new Error(`Login owner gagal: ${res.message}. Sudah jalankan "bun run db:seed" ke database test?`);
  }
  cachedOwnerToken = res.data.token;
  return cachedOwnerToken;
}

/** Nama unik per test run supaya test tidak saling bentrok (unique constraint SKU/nama). */
export function uniqueName(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export interface Fixtures {
  categoryId: string;
  productId: string;
  variantId: string;
  supplierId: string;
}

/** Bikin 1 kategori + 1 produk dgn 1 varian SKU + 1 supplier, siap dipakai transaksi. */
export async function createFixtures(token: string, basePrice = 100000): Promise<Fixtures> {
  const cat = await api<{ id: string }>('POST', '/v1/categories', { token, body: { name: uniqueName('Kategori') } });
  if (!cat.success || !cat.data) throw new Error(`Gagal bikin kategori: ${cat.message}`);

  const prod = await api<{ product: { id: string }; variants: Array<{ id: string }> }>('POST', '/v1/products/matrix', {
    token,
    body: {
      name: uniqueName('Produk'),
      category_id: cat.data.id,
      colors: ['Test'],
      sizes: ['OS'],
      base_price: basePrice,
    },
  });
  if (!prod.success || !prod.data) throw new Error(`Gagal bikin produk: ${prod.message}`);

  const sup = await api<{ id: string }>('POST', '/v1/suppliers', { token, body: { name: uniqueName('Supplier') } });
  if (!sup.success || !sup.data) throw new Error(`Gagal bikin supplier: ${sup.message}`);

  return {
    categoryId: cat.data.id,
    productId: prod.data.product.id,
    variantId: prod.data.variants[0]!.id,
    supplierId: sup.data.id,
  };
}

/** Terima barang lewat PO penuh (create + receive) — mengisi inventory_batches & avg_cost. */
export async function receiveStock(token: string, variantId: string, supplierId: string, qty: number, unitCost: number) {
  const po = await api<{ id: string }>('POST', '/v1/purchase-orders', {
    token,
    body: { supplier_id: supplierId, items: [{ variant_id: variantId, qty, unit_cost: unitCost }] },
  });
  if (!po.success || !po.data) throw new Error(`Gagal bikin PO: ${po.message}`);

  const receive = await api('POST', `/v1/purchase-orders/${po.data.id}/receive`, { token });
  if (!receive.success) throw new Error(`Gagal menerima barang PO: ${receive.message}`);
  return po.data.id;
}

/** Isi stok lewat Adjustment Saldo Awal (DRAFT -> POSTED), alternatif dari `receiveStock`. */
export async function openingBalance(token: string, variantId: string, qty: number, unitCost: number) {
  const adj = await api<{ id: string }>('POST', '/v1/stock-adjustments', {
    token,
    body: {
      type: 'OPENING_BALANCE',
      reason: 'Integration test seed stock',
      items: [{ variant_id: variantId, system_qty: 0, actual_qty: qty, unit_cost: unitCost }],
    },
  });
  if (!adj.success || !adj.data) throw new Error(`Gagal bikin adjustment: ${adj.message}`);

  const post = await api('POST', `/v1/stock-adjustments/${adj.data.id}/post`, { token });
  if (!post.success) throw new Error(`Gagal posting adjustment: ${post.message}`);
  return adj.data.id;
}

export async function setCostingMethod(token: string, method: 'FIFO' | 'AVERAGE') {
  const res = await api('PUT', '/v1/settings', { token, body: { costing_method: method } });
  if (!res.success) throw new Error(`Gagal set costing method: ${res.message}`);
}
