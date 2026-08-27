import { Elysia, t } from 'elysia';
import { authPlugin } from '../auth';
import { ok } from '../../utils/http';

/**
 * Stub Phase 4 (lihat DEVELOPMENT_ROADMAP.md & API_SPECIFICATION.md §7).
 * TODO per laporan: query filtered rows, dukung `format=json|pdf|xlsx`
 * (pdf/xlsx mengembalikan file binary, bukan JSON envelope).
 */
const reportQuery = t.Object({
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  category_id: t.Optional(t.String()),
  channel: t.Optional(t.String()),
  customer_id: t.Optional(t.String()),
  supplier_id: t.Optional(t.String()),
  invoice_number: t.Optional(t.String()),
  format: t.Optional(t.Union([t.Literal('json'), t.Literal('pdf'), t.Literal('xlsx')])),
});

function stubReport(name: string) {
  return async ({ query }: { query: Record<string, unknown> }) =>
    ok({ filters: query, rows: [], totals: {} }, `TODO: implementasikan laporan ${name}`);
}

export const reportsRoutes = new Elysia({ prefix: '/reports' })
  .use(authPlugin)
  .get('/sales', stubReport('penjualan'), { query: reportQuery, requireRole: ['OWNER'] })
  .get('/purchases', stubReport('pembelian'), { query: reportQuery, requireRole: ['OWNER'] })
  .get('/stock', stubReport('stok'), { query: reportQuery, requireRole: ['OWNER', 'GUDANG'] })
  .get('/stock-adjustments', stubReport('adjustment stok'), { query: reportQuery, requireRole: ['OWNER', 'GUDANG'] })
  .get('/profit-loss', stubReport('laba rugi'), { query: reportQuery, requireRole: ['OWNER'] });
