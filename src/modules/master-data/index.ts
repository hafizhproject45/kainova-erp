import { Elysia, t } from 'elysia';
import { eq, isNull } from 'drizzle-orm';
import { db } from '../../config/database';
import { categories, customers, discounts, suppliers, taxes } from '../../db/schema';
import { authPlugin } from '../auth';
import { ok, toCamelCase } from '../../utils/http';

// ---------------------------------------------------------------------------
// Kategori Produk
// ---------------------------------------------------------------------------

const categoriesRoutes = new Elysia({ prefix: '/categories' })
  .use(authPlugin)
  .get('', async () => ok(await db.select().from(categories).where(isNull(categories.deletedAt))), {
    requireRole: ['OWNER', 'GUDANG', 'KASIR'],
  })
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
    { body: t.Object({ name: t.String() }), requireRole: ['OWNER'] },
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

const suppliersRoutes = new Elysia({ prefix: '/suppliers' })
  .use(authPlugin)
  .get('', async () => ok(await db.select().from(suppliers).where(isNull(suppliers.deletedAt))), {
    requireRole: ['OWNER', 'GUDANG', 'KASIR'],
  })
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
    { body: partyBody, requireRole: ['OWNER'] },
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
  .get('', async () => ok(await db.select().from(customers).where(isNull(customers.deletedAt))), {
    requireRole: ['OWNER', 'GUDANG', 'KASIR'],
  })
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
    { body: partyBody, requireRole: ['OWNER'] },
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
  .delete(
    '/:id',
    async ({ params }) => {
      await db.delete(discounts).where(eq(discounts.id, params.id));
      return ok(null, 'Diskon berhasil dihapus');
    },
    { requireRole: ['OWNER'] },
  );

export const masterDataRoutes = new Elysia()
  .use(categoriesRoutes)
  .use(suppliersRoutes)
  .use(customersRoutes)
  .use(taxesRoutes)
  .use(discountsRoutes);
