import { Elysia, t } from 'elysia';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../config/database';
import { categories, customers, discounts, suppliers, taxes, uoms } from '../../db/schema';
import { authPlugin } from '../auth';
import { ok, toCamelCase } from '../../utils/http';

// MVP 3 Phase 1: standardisasi Toggle `is_active` — semua GET list mendukung
// query `?is_active=true|false` untuk Strict Filtering di form transaksi (POS,
// Pembelian, Adjustment Stok), dan setiap entity punya PATCH /:id/status untuk
// Inline Quick Toggle di AppTable Master Data.
const activeQuery = t.Object({ is_active: t.Optional(t.String()) });
const statusBody = t.Object({ is_active: t.Boolean() });

// ---------------------------------------------------------------------------
// Kategori Produk
// ---------------------------------------------------------------------------

const categoriesRoutes = new Elysia({ prefix: '/categories' })
  .use(authPlugin)
  .get(
    '',
    async ({ query }) => {
      const conditions = [isNull(categories.deletedAt)];
      if (query.is_active !== undefined) conditions.push(eq(categories.isActive, query.is_active === 'true'));
      return ok(await db.select().from(categories).where(and(...conditions)));
    },
    { query: activeQuery, requireRole: ['OWNER', 'GUDANG', 'KASIR'] },
  )
  .post(
    '',
    async ({ body }) => {
      const [row] = await db.insert(categories).values(toCamelCase(body)).returning();
      return ok(row, 'Kategori berhasil dibuat');
    },
    { body: t.Object({ name: t.String() }), requireRole: ['OWNER'] },
  )
  .put(
    '/:id',
    async ({ params, body }) => {
      const [row] = await db
        .update(categories)
        .set({ ...toCamelCase(body), updatedAt: new Date() })
        .where(eq(categories.id, params.id))
        .returning();
      return ok(row, 'Kategori berhasil diperbarui');
    },
    { body: t.Object({ name: t.Optional(t.String()), is_active: t.Optional(t.Boolean()) }), requireRole: ['OWNER'] },
  )
  .patch(
    '/:id/status',
    async ({ params, body }) => {
      const [row] = await db
        .update(categories)
        .set({ isActive: body.is_active, updatedAt: new Date() })
        .where(eq(categories.id, params.id))
        .returning();
      return ok(row, 'Status kategori berhasil diperbarui');
    },
    { body: statusBody, requireRole: ['OWNER'] },
  )
  .delete(
    '/:id',
    async ({ params }) => {
      await db.update(categories).set({ deletedAt: new Date() }).where(eq(categories.id, params.id));
      return ok(null, 'Kategori berhasil dihapus');
    },
    { requireRole: ['OWNER'] },
  );

// ---------------------------------------------------------------------------
// Supplier
// ---------------------------------------------------------------------------

const partyBody = t.Object({
  name: t.String(),
  phone: t.Optional(t.String()),
  email: t.Optional(t.String()),
  address: t.Optional(t.String()),
});

const partyUpdateBody = t.Object({
  name: t.Optional(t.String()),
  phone: t.Optional(t.String()),
  email: t.Optional(t.String()),
  address: t.Optional(t.String()),
  is_active: t.Optional(t.Boolean()),
});

const suppliersRoutes = new Elysia({ prefix: '/suppliers' })
  .use(authPlugin)
  .get(
    '',
    async ({ query }) => {
      const conditions = [isNull(suppliers.deletedAt)];
      if (query.is_active !== undefined) conditions.push(eq(suppliers.isActive, query.is_active === 'true'));
      return ok(await db.select().from(suppliers).where(and(...conditions)));
    },
    { query: activeQuery, requireRole: ['OWNER', 'GUDANG', 'KASIR'] },
  )
  .post(
    '',
    async ({ body }) => {
      const [row] = await db.insert(suppliers).values(toCamelCase(body)).returning();
      return ok(row, 'Supplier berhasil dibuat');
    },
    { body: partyBody, requireRole: ['OWNER'] },
  )
  .put(
    '/:id',
    async ({ params, body }) => {
      const [row] = await db
        .update(suppliers)
        .set({ ...toCamelCase(body), updatedAt: new Date() })
        .where(eq(suppliers.id, params.id))
        .returning();
      return ok(row, 'Supplier berhasil diperbarui');
    },
    { body: partyUpdateBody, requireRole: ['OWNER'] },
  )
  .patch(
    '/:id/status',
    async ({ params, body }) => {
      const [row] = await db
        .update(suppliers)
        .set({ isActive: body.is_active, updatedAt: new Date() })
        .where(eq(suppliers.id, params.id))
        .returning();
      return ok(row, 'Status supplier berhasil diperbarui');
    },
    { body: statusBody, requireRole: ['OWNER'] },
  )
  .delete(
    '/:id',
    async ({ params }) => {
      await db.update(suppliers).set({ deletedAt: new Date() }).where(eq(suppliers.id, params.id));
      return ok(null, 'Supplier berhasil dihapus');
    },
    { requireRole: ['OWNER'] },
  );

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

const customersRoutes = new Elysia({ prefix: '/customers' })
  .use(authPlugin)
  .get(
    '',
    async ({ query }) => {
      const conditions = [isNull(customers.deletedAt)];
      if (query.is_active !== undefined) conditions.push(eq(customers.isActive, query.is_active === 'true'));
      return ok(await db.select().from(customers).where(and(...conditions)));
    },
    { query: activeQuery, requireRole: ['OWNER', 'GUDANG', 'KASIR'] },
  )
  .post(
    '',
    async ({ body }) => {
      const [row] = await db.insert(customers).values(toCamelCase(body)).returning();
      return ok(row, 'Customer berhasil dibuat');
    },
    { body: partyBody, requireRole: ['OWNER', 'KASIR'] },
  )
  .put(
    '/:id',
    async ({ params, body }) => {
      const [row] = await db
        .update(customers)
        .set({ ...toCamelCase(body), updatedAt: new Date() })
        .where(eq(customers.id, params.id))
        .returning();
      return ok(row, 'Customer berhasil diperbarui');
    },
    { body: partyUpdateBody, requireRole: ['OWNER'] },
  )
  .patch(
    '/:id/status',
    async ({ params, body }) => {
      const [row] = await db
        .update(customers)
        .set({ isActive: body.is_active, updatedAt: new Date() })
        .where(eq(customers.id, params.id))
        .returning();
      return ok(row, 'Status customer berhasil diperbarui');
    },
    { body: statusBody, requireRole: ['OWNER'] },
  )
  .delete(
    '/:id',
    async ({ params }) => {
      await db.update(customers).set({ deletedAt: new Date() }).where(eq(customers.id, params.id));
      return ok(null, 'Customer berhasil dihapus');
    },
    { requireRole: ['OWNER'] },
  );

// ---------------------------------------------------------------------------
// Pajak (PPN/PPh)
// ---------------------------------------------------------------------------

const taxesRoutes = new Elysia({ prefix: '/taxes' })
  .use(authPlugin)
  .get(
    '',
    async ({ query }) => {
      const isActive = query.is_active;
      const rows =
        isActive === undefined
          ? await db.select().from(taxes)
          : await db.select().from(taxes).where(eq(taxes.isActive, isActive === 'true'));
      return ok(rows);
    },
    { query: t.Object({ is_active: t.Optional(t.String()) }), requireRole: ['OWNER', 'GUDANG', 'KASIR'] },
  )
  .post(
    '',
    async ({ body }) => {
      const [row] = await db.insert(taxes).values({ name: body.name, type: body.type, rate: String(body.rate) }).returning();
      return ok(row, 'Pajak berhasil dibuat');
    },
    {
      body: t.Object({ name: t.String(), type: t.Union([t.Literal('PPN'), t.Literal('PPH')]), rate: t.Number() }),
      requireRole: ['OWNER'],
    },
  )
  .put(
    '/:id',
    async ({ params, body }) => {
      const [row] = await db
        .update(taxes)
        .set({
          name: body.name,
          rate: body.rate !== undefined ? String(body.rate) : undefined,
          isActive: body.is_active,
          updatedAt: new Date(),
        })
        .where(eq(taxes.id, params.id))
        .returning();
      return ok(row, 'Pajak berhasil diperbarui');
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        rate: t.Optional(t.Number()),
        is_active: t.Optional(t.Boolean()),
      }),
      requireRole: ['OWNER'],
    },
  )
  .patch(
    '/:id/status',
    async ({ params, body }) => {
      const [row] = await db
        .update(taxes)
        .set({ isActive: body.is_active, updatedAt: new Date() })
        .where(eq(taxes.id, params.id))
        .returning();
      return ok(row, 'Status pajak berhasil diperbarui');
    },
    { body: statusBody, requireRole: ['OWNER'] },
  )
  .delete(
    '/:id',
    async ({ params }) => {
      await db.delete(taxes).where(eq(taxes.id, params.id));
      return ok(null, 'Pajak berhasil dihapus');
    },
    { requireRole: ['OWNER'] },
  );

// ---------------------------------------------------------------------------
// Diskon
// ---------------------------------------------------------------------------

const discountsRoutes = new Elysia({ prefix: '/discounts' })
  .use(authPlugin)
  .get(
    '',
    async ({ query }) => {
      const isActive = query.is_active;
      const rows =
        isActive === undefined
          ? await db.select().from(discounts)
          : await db.select().from(discounts).where(eq(discounts.isActive, isActive === 'true'));
      return ok(rows);
    },
    { query: t.Object({ is_active: t.Optional(t.String()) }), requireRole: ['OWNER', 'GUDANG', 'KASIR'] },
  )
  .post(
    '',
    async ({ body }) => {
      const [row] = await db
        .insert(discounts)
        .values({
          name: body.name,
          type: body.type,
          value: String(body.value),
          validFrom: body.valid_from ? new Date(body.valid_from) : undefined,
          validUntil: body.valid_until ? new Date(body.valid_until) : undefined,
        })
        .returning();
      return ok(row, 'Diskon berhasil dibuat');
    },
    {
      body: t.Object({
        name: t.String(),
        type: t.Union([t.Literal('PERCENTAGE'), t.Literal('NOMINAL')]),
        value: t.Number(),
        valid_from: t.Optional(t.String()),
        valid_until: t.Optional(t.String()),
      }),
      requireRole: ['OWNER'],
    },
  )
  .put(
    '/:id',
    async ({ params, body }) => {
      const [row] = await db
        .update(discounts)
        .set({
          name: body.name,
          value: body.value !== undefined ? String(body.value) : undefined,
          isActive: body.is_active,
          updatedAt: new Date(),
        })
        .where(eq(discounts.id, params.id))
        .returning();
      return ok(row, 'Diskon berhasil diperbarui');
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        value: t.Optional(t.Number()),
        is_active: t.Optional(t.Boolean()),
      }),
      requireRole: ['OWNER'],
    },
  )
  .patch(
    '/:id/status',
    async ({ params, body }) => {
      const [row] = await db
        .update(discounts)
        .set({ isActive: body.is_active, updatedAt: new Date() })
        .where(eq(discounts.id, params.id))
        .returning();
      return ok(row, 'Status diskon berhasil diperbarui');
    },
    { body: statusBody, requireRole: ['OWNER'] },
  )
  .delete(
    '/:id',
    async ({ params }) => {
      await db.delete(discounts).where(eq(discounts.id, params.id));
      return ok(null, 'Diskon berhasil dihapus');
    },
    { requireRole: ['OWNER'] },
  );

// ---------------------------------------------------------------------------
// UOM (Unit of Measure)
// ---------------------------------------------------------------------------

const uomsRoutes = new Elysia({ prefix: '/uoms' })
  .use(authPlugin)
  .get(
    '',
    async ({ query }) => {
      const conditions = [isNull(uoms.deletedAt)];
      if (query.is_active !== undefined) conditions.push(eq(uoms.isActive, query.is_active === 'true'));
      return ok(await db.select().from(uoms).where(and(...conditions)));
    },
    { query: activeQuery, requireRole: ['OWNER', 'GUDANG', 'KASIR'] },
  )
  .post(
    '',
    async ({ body }) => {
      const [row] = await db.insert(uoms).values(toCamelCase(body)).returning();
      return ok(row, 'UOM berhasil dibuat');
    },
    { body: t.Object({ code: t.String(), name: t.String(), description: t.Optional(t.String()) }), requireRole: ['OWNER'] },
  )
  .put(
    '/:id',
    async ({ params, body }) => {
      const [row] = await db
        .update(uoms)
        .set({ ...toCamelCase(body), updatedAt: new Date() })
        .where(eq(uoms.id, params.id))
        .returning();
      return ok(row, 'UOM berhasil diperbarui');
    },
    {
      body: t.Object({
        code: t.Optional(t.String()),
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        is_active: t.Optional(t.Boolean()),
      }),
      requireRole: ['OWNER'],
    },
  )
  .patch(
    '/:id/status',
    async ({ params, body }) => {
      const [row] = await db
        .update(uoms)
        .set({ isActive: body.is_active, updatedAt: new Date() })
        .where(eq(uoms.id, params.id))
        .returning();
      return ok(row, 'Status UOM berhasil diperbarui');
    },
    { body: statusBody, requireRole: ['OWNER'] },
  )
  .delete(
    '/:id',
    async ({ params }) => {
      await db.update(uoms).set({ deletedAt: new Date() }).where(eq(uoms.id, params.id));
      return ok(null, 'UOM berhasil dihapus');
    },
    { requireRole: ['OWNER'] },
  );

export const masterDataRoutes = new Elysia()
  .use(categoriesRoutes)
  .use(suppliersRoutes)
  .use(customersRoutes)
  .use(taxesRoutes)
  .use(discountsRoutes)
  .use(uomsRoutes);
