/**
 * DoD #1 (jalur Adjustment Stok) & #4 (stok tidak berubah tanpa status POSTED):
 * Stock Opname surplus (buat batch baru + rehitung avg_cost) dan defisit
 * (potong FIFO dari batch tertua), serta memastikan status DRAFT belum
 * mengubah stok sama sekali.
 */
import { describe, test, expect } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../src/config/database';
import { inventoryBatches, productVariants } from '../src/db/schema';
import { api, createFixtures, loginOwner, openingBalance, setCostingMethod, type Fixtures } from './helpers';

async function createOpname(token: string, variantId: string, systemQty: number, actualQty: number, unitCost?: number) {
  const res = await api<{ id: string; status: string }>('POST', '/v1/stock-adjustments', {
    token,
    body: {
      type: 'OPNAME',
      reason: 'Integration test opname',
      items: [{ variant_id: variantId, system_qty: systemQty, actual_qty: actualQty, unit_cost: unitCost }],
    },
  });
  expect(res.success).toBe(true);
  return res.data!;
}

describe('Stock Opname', () => {
  test('DRAFT belum mengubah stok; POSTED baru mengubah, surplus bikin batch baru & rehitung avg_cost', async () => {
    const token = await loginOwner();
    await setCostingMethod(token, 'FIFO');
    const fx: Fixtures = await createFixtures(token, 10000);

    await openingBalance(token, fx.variantId, 10, 5000); // batch1: 10 @ 5000, avg_cost -> 5000

    const draft = await createOpname(token, fx.variantId, 10, 15, 8000); // surplus +5 @ 8000
    expect(draft.status).toBe('DRAFT');

    // Selama masih DRAFT, stok TIDAK BOLEH berubah sama sekali.
    const [beforePost] = await db.select().from(productVariants).where(eq(productVariants.id, fx.variantId));
    expect(beforePost!.totalStock).toBe(10);

    const post = await api('POST', `/v1/stock-adjustments/${draft.id}/post`, { token });
    expect(post.success).toBe(true);

    const [afterPost] = await db.select().from(productVariants).where(eq(productVariants.id, fx.variantId));
    expect(afterPost!.totalStock).toBe(15); // 10 + 5
    // avg_cost weighted: (10*5000 + 5*8000) / 15 = 6000
    expect(Number(afterPost!.avgCost)).toBe(6000);

    const batches = await db
      .select()
      .from(inventoryBatches)
      .where(eq(inventoryBatches.variantId, fx.variantId))
      .orderBy(inventoryBatches.receivedAt);
    expect(batches).toHaveLength(2);
    expect(batches[1]!.remainingQty).toBe(5); // batch baru dari surplus

    // Posting ulang adjustment yang sama harus ditolak (tidak boleh POSTED dua kali).
    const repost = await api('POST', `/v1/stock-adjustments/${draft.id}/post`, { token });
    expect(repost.success).toBe(false);
  });

  test('defisit memotong FIFO dari batch tertua, avg_cost tidak berubah', async () => {
    const token = await loginOwner();
    await setCostingMethod(token, 'FIFO');
    const fx: Fixtures = await createFixtures(token, 10000);

    await openingBalance(token, fx.variantId, 10, 5000); // batch1: 10 @ 5000
    const [variantAfterOpening] = await db.select().from(productVariants).where(eq(productVariants.id, fx.variantId));
    expect(Number(variantAfterOpening!.avgCost)).toBe(5000);

    const draft = await createOpname(token, fx.variantId, 10, 6); // defisit -4, tanpa unit_cost (tidak perlu utk defisit)
    const post = await api('POST', `/v1/stock-adjustments/${draft.id}/post`, { token });
    expect(post.success).toBe(true);

    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, fx.variantId));
    expect(variant!.totalStock).toBe(6);
    expect(Number(variant!.avgCost)).toBe(5000); // defisit tidak mengubah avg_cost

    const [batch] = await db.select().from(inventoryBatches).where(eq(inventoryBatches.variantId, fx.variantId));
    expect(batch!.remainingQty).toBe(6); // 10 - 4
  });
});
