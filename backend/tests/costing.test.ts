/**
 * DoD #1 & #2: pemotongan stok FIFO/Average dari jalur Pembelian -> Penjualan,
 * konsisten dgn sisa stok batch & HPP transaksi. Juga skenario rollback checkout
 * multi-item saat salah satu item gagal karena stok kurang (item lain harus
 * ikut dibatalkan, bukan korup permanen).
 */
import { describe, test, expect } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../src/config/database';
import { inventoryBatches, productVariants, salesOrderItems } from '../src/db/schema';
import { api, createFixtures, loginOwner, receiveStock, setCostingMethod, type Fixtures } from './helpers';

async function checkoutOne(token: string, variantId: string, qty: number, price: number) {
  return api<{ id: string }>('POST', '/v1/sales/checkout', {
    token,
    body: {
      channel: 'POS_TEST',
      payment_method: 'CASH',
      items: [{ variant_id: variantId, qty, price }],
    },
  });
}

describe('Costing engine — FIFO', () => {
  test('checkout memotong batch tertua dulu & HPP dari harga batch masing-masing', async () => {
    const token = await loginOwner();
    await setCostingMethod(token, 'FIFO');
    const fx: Fixtures = await createFixtures(token, 30000);

    await receiveStock(token, fx.variantId, fx.supplierId, 5, 10000); // batch 1: 5 @ 10000
    await receiveStock(token, fx.variantId, fx.supplierId, 5, 20000); // batch 2: 5 @ 20000

    const res = await checkoutOne(token, fx.variantId, 7, 30000); // 5 dari batch1 + 2 dari batch2
    expect(res.success).toBe(true);
    const salesOrderId = res.data!.id;

    const [item] = await db.select().from(salesOrderItems).where(eq(salesOrderItems.salesOrderId, salesOrderId));
    expect(Number(item!.costOfGoods)).toBe(5 * 10000 + 2 * 20000); // 90000

    const batches = await db
      .select()
      .from(inventoryBatches)
      .where(eq(inventoryBatches.variantId, fx.variantId))
      .orderBy(inventoryBatches.receivedAt);
    expect(batches[0]!.remainingQty).toBe(0); // batch tertua habis duluan
    expect(batches[1]!.remainingQty).toBe(3); // batch kedua sisa 5-2

    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, fx.variantId));
    expect(variant!.totalStock).toBe(10 - 7);
  });
});

describe('Costing engine — Average', () => {
  test('HPP checkout pakai avg_cost weighted-average, batch tetap dipotong FIFO untuk ledger', async () => {
    const token = await loginOwner();
    await setCostingMethod(token, 'AVERAGE');
    const fx: Fixtures = await createFixtures(token, 30000);

    await receiveStock(token, fx.variantId, fx.supplierId, 5, 10000); // avg_cost -> 10000
    await receiveStock(token, fx.variantId, fx.supplierId, 5, 20000); // avg_cost -> (5*10000+5*20000)/10 = 15000

    const [variantAfterReceive] = await db.select().from(productVariants).where(eq(productVariants.id, fx.variantId));
    expect(Number(variantAfterReceive!.avgCost)).toBe(15000);

    const res = await checkoutOne(token, fx.variantId, 7, 30000);
    expect(res.success).toBe(true);
    const salesOrderId = res.data!.id;

    const [item] = await db.select().from(salesOrderItems).where(eq(salesOrderItems.salesOrderId, salesOrderId));
    // HPP harus dari avg_cost (15000/unit), BUKAN diam-diam fallback ke harga batch FIFO pertama (10000/unit).
    expect(Number(item!.costOfGoods)).toBe(7 * 15000); // 105000

    // Ledger remaining_qty tetap dipotong FIFO walau mode AVERAGE — hanya sumber HPP yang beda.
    const batches = await db
      .select()
      .from(inventoryBatches)
      .where(eq(inventoryBatches.variantId, fx.variantId))
      .orderBy(inventoryBatches.receivedAt);
    expect(batches[0]!.remainingQty).toBe(0);
    expect(batches[1]!.remainingQty).toBe(3);
  });
});

describe('Checkout rollback', () => {
  test('item ke-2 gagal karena stok kurang -> potongan stok item ke-1 ikut dibatalkan', async () => {
    const token = await loginOwner();
    await setCostingMethod(token, 'FIFO');
    const fxOk: Fixtures = await createFixtures(token, 10000);
    const fxOut: Fixtures = await createFixtures(token, 10000);

    await receiveStock(token, fxOk.variantId, fxOk.supplierId, 5, 5000);
    // fxOut sengaja TIDAK diisi stok sama sekali.

    const [beforeOk] = await db.select().from(productVariants).where(eq(productVariants.id, fxOk.variantId));
    expect(beforeOk!.totalStock).toBe(5);

    const res = await api('POST', '/v1/sales/checkout', {
      token,
      body: {
        channel: 'POS_TEST',
        payment_method: 'CASH',
        items: [
          { variant_id: fxOk.variantId, qty: 5, price: 10000 },
          { variant_id: fxOut.variantId, qty: 1, price: 10000 }, // gagal: stok 0 < 1
        ],
      },
    });
    expect(res.success).toBe(false);

    // Item pertama sempat "berhasil" dipotong sebelum item kedua gagal di tengah loop —
    // tapi karena dibungkus db.transaction(), semuanya harus rollback utuh.
    const [afterOk] = await db.select().from(productVariants).where(eq(productVariants.id, fxOk.variantId));
    expect(afterOk!.totalStock).toBe(5); // tidak berkurang sama sekali, bukan korup jadi 0

    const batchesOk = await db.select().from(inventoryBatches).where(eq(inventoryBatches.variantId, fxOk.variantId));
    expect(batchesOk[0]!.remainingQty).toBe(5); // batch juga utuh, tidak ikut terpotong
  });
});
