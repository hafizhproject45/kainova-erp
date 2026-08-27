import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '../../config/database';
import { systemSettings } from '../../db/schema';
import { authPlugin } from '../auth';
import { ok } from '../../utils/http';

/** system_settings didesain sebagai tabel single-row (lihat DESIGN.md §2.6). */
async function getOrCreateSettings() {
  const [existing] = await db.select().from(systemSettings).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(systemSettings).values({}).returning();
  return created!;
}

export const settingsRoutes = new Elysia({ prefix: '/settings' })
  .use(authPlugin)
  .get('', async () => ok(await getOrCreateSettings()), { requireRole: ['OWNER', 'GUDANG', 'KASIR'] })
  .put(
    '',
    async ({ body }) => {
      const current = await getOrCreateSettings();
      const [updated] = await db
        .update(systemSettings)
        .set({
          costingMethod: body.costing_method,
          defaultPpnTaxId: body.default_ppn_tax_id,
          defaultPphTaxId: body.default_pph_tax_id,
          slowMovingThresholdDays: body.slow_moving_threshold_days,
          deadStockThresholdDays: body.dead_stock_threshold_days,
          businessName: body.business_name,
          receiptFooterNote: body.receipt_footer_note,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.id, current.id))
        .returning();
      return ok(updated, 'Settings berhasil diperbarui');
    },
    {
      body: t.Object({
        costing_method: t.Optional(t.Union([t.Literal('FIFO'), t.Literal('AVERAGE')])),
        default_ppn_tax_id: t.Optional(t.Union([t.String(), t.Null()])),
        default_pph_tax_id: t.Optional(t.Union([t.String(), t.Null()])),
        slow_moving_threshold_days: t.Optional(t.Number()),
        dead_stock_threshold_days: t.Optional(t.Number()),
        business_name: t.Optional(t.String()),
        receipt_footer_note: t.Optional(t.String()),
      }),
      requireRole: ['OWNER'],
    },
  );
