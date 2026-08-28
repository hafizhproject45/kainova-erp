/**
 * DoD #3: kalkulasi diskon & pajak checkout POS untuk 7 kombinasi
 * (lihat DEVELOPMENT_ROADMAP_MVP_1.md). Formula: Subtotal -> Diskon Per-Item ->
 * Diskon Keseluruhan -> DPP -> PPN (+) / PPh (-) -> Grand Total (PRODUCT_KNOWLEDGE.md §4).
 */
import { describe, test, expect, beforeAll } from 'bun:test';
import { api, createFixtures, loginOwner, openingBalance, uniqueName, type Fixtures } from './helpers';

const PRICE = 100000;
const QTY = 2;
const SUBTOTAL = PRICE * QTY; // 200000

let token: string;
let fixtures: Fixtures;
let itemDiscountId: string;
let orderDiscountId: string;
let ppnTaxId: string;
let pphTaxId: string;

beforeAll(async () => {
  token = await loginOwner();
  fixtures = await createFixtures(token, PRICE);
  // Stok banyak supaya cukup untuk 7 checkout qty=2 di test ini.
  await openingBalance(token, fixtures.variantId, 100, 50000);

  const disc = await api<{ id: string }>('POST', '/v1/discounts', {
    token,
    body: { name: uniqueName('Diskon10'), type: 'PERCENTAGE', value: 10 },
  });
  itemDiscountId = disc.data!.id;
  orderDiscountId = disc.data!.id; // diskon yang sama boleh dipakai di level item maupun keseluruhan

  const ppn = await api<{ id: string }>('POST', '/v1/taxes', { token, body: { name: uniqueName('PPN11'), type: 'PPN', rate: 11 } });
  ppnTaxId = ppn.data!.id;
  const pph = await api<{ id: string }>('POST', '/v1/taxes', { token, body: { name: uniqueName('PPh0.5'), type: 'PPH', rate: 0.5 } });
  pphTaxId = pph.data!.id;
});

interface CheckoutOpts {
  itemDiscount?: boolean;
  orderDiscount?: boolean;
  ppn?: boolean;
  pph?: boolean;
}

async function checkout(opts: CheckoutOpts) {
  const res = await api<{
    subtotal: number;
    item_discount_total: number;
    discount_amount: number;
    dpp: number;
    ppn_amount: number;
    pph_amount: number;
    grand_total: number;
  }>('POST', '/v1/sales/checkout', {
    token,
    body: {
      channel: 'POS_TEST',
      payment_method: 'CASH',
      items: [
        {
          variant_id: fixtures.variantId,
          qty: QTY,
          price: PRICE,
          discount_id: opts.itemDiscount ? itemDiscountId : undefined,
        },
      ],
      discount_id: opts.orderDiscount ? orderDiscountId : undefined,
      ppn_tax_id: opts.ppn ? ppnTaxId : undefined,
      pph_tax_id: opts.pph ? pphTaxId : undefined,
    },
  });
  expect(res.success).toBe(true);
  return res.data!;
}

describe('POS checkout — kombinasi diskon & pajak', () => {
  test('1. tanpa diskon/pajak sama sekali', async () => {
    const r = await checkout({});
    expect(r.subtotal).toBe(200000);
    expect(r.item_discount_total).toBe(0);
    expect(r.discount_amount).toBe(0);
    expect(r.dpp).toBe(200000);
    expect(r.ppn_amount).toBe(0);
    expect(r.pph_amount).toBe(0);
    expect(r.grand_total).toBe(200000);
  });

  test('2. hanya diskon per-item', async () => {
    const r = await checkout({ itemDiscount: true });
    expect(r.item_discount_total).toBe(20000);
    expect(r.discount_amount).toBe(0);
    expect(r.dpp).toBe(180000);
    expect(r.grand_total).toBe(180000);
  });

  test('3. hanya diskon keseluruhan', async () => {
    const r = await checkout({ orderDiscount: true });
    expect(r.item_discount_total).toBe(0);
    expect(r.discount_amount).toBe(20000); // 10% dari 200000
    expect(r.dpp).toBe(180000);
    expect(r.grand_total).toBe(180000);
  });

  test('4. diskon per-item + diskon keseluruhan bersamaan', async () => {
    const r = await checkout({ itemDiscount: true, orderDiscount: true });
    expect(r.item_discount_total).toBe(20000);
    // Diskon keseluruhan dihitung dari (subtotal - itemDiscountTotal) = 180000, bukan dari subtotal mentah.
    expect(r.discount_amount).toBe(18000);
    expect(r.dpp).toBe(162000);
    expect(r.grand_total).toBe(162000);
  });

  test('5. hanya PPN', async () => {
    const r = await checkout({ ppn: true });
    expect(r.dpp).toBe(200000);
    expect(r.ppn_amount).toBe(22000); // 11% dari 200000
    expect(r.pph_amount).toBe(0);
    expect(r.grand_total).toBe(222000);
  });

  test('6. hanya PPh', async () => {
    const r = await checkout({ pph: true });
    expect(r.dpp).toBe(200000);
    expect(r.ppn_amount).toBe(0);
    expect(r.pph_amount).toBe(1000); // 0.5% dari 200000
    expect(r.grand_total).toBe(199000); // PPh MENGURANGI grand total
  });

  test('7. PPN dan PPh bersamaan', async () => {
    const r = await checkout({ ppn: true, pph: true });
    expect(r.dpp).toBe(200000);
    expect(r.ppn_amount).toBe(22000);
    expect(r.pph_amount).toBe(1000);
    expect(r.grand_total).toBe(221000); // 200000 + 22000 - 1000
  });

  test('8. semua sekaligus (diskon item + keseluruhan + PPN + PPh)', async () => {
    const r = await checkout({ itemDiscount: true, orderDiscount: true, ppn: true, pph: true });
    expect(r.item_discount_total).toBe(20000);
    expect(r.discount_amount).toBe(18000);
    expect(r.dpp).toBe(162000);
    expect(r.ppn_amount).toBe(17820); // 11% dari 162000
    expect(r.pph_amount).toBe(810); // 0.5% dari 162000
    expect(r.grand_total).toBe(179010); // 162000 + 17820 - 810
  });
});
