import { Elysia, t } from 'elysia';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../../config/database';
import { categories, productVariants, products } from '../../db/schema';
import { authPlugin } from '../auth';
import { ok, NotFoundError, ValidationError } from '../../utils/http';

const activeQuery = t.Object({ is_active: t.Optional(t.String()) });
const statusBody = t.Object({ is_active: t.Boolean() });

export const productsRoutes = new Elysia()
  .use(authPlugin)
  .get(
    '/products',
    async ({ query }) => {
      const conditions = [isNull(products.deletedAt)];
      if (query.category_id) conditions.push(eq(products.categoryId, query.category_id));
      // MVP 3 Phase 1: Strict Filtering — form POS/Pembelian/Adjustment memanggil ?is_active=true
      // supaya produk non-aktif otomatis tersembunyi dari transaksi baru.
      if (query.is_active !== undefined) conditions.push(eq(products.isActive, query.is_active === 'true'));
      return ok(await db.select().from(products).where(and(...conditions)));
    },
    {
      query: t.Object({ category_id: t.Optional(t.String()), is_active: t.Optional(t.String()) }),
      requireRole: ['OWNER', 'GUDANG', 'KASIR'],
    },
  )
  .get(
    '/products/:id/variants',
    async ({ params, query }) => {
      const conditions = [eq(productVariants.productId, params.id), isNull(productVariants.deletedAt)];
      if (query.is_active !== undefined) conditions.push(eq(productVariants.isActive, query.is_active === 'true'));
      return ok(await db.select().from(productVariants).where(and(...conditions)));
    },
    { query: activeQuery, requireRole: ['OWNER', 'GUDANG', 'KASIR'] },
  )
  .get(
    '/product-variants',
    async ({ query }) => {
      // Tab "Varian" (Master Data) — daftar flat seluruh SKU lintas produk, dilengkapi nama produk & kategori.
      const conditions = [isNull(productVariants.deletedAt)];
      if (query.is_active !== undefined) conditions.push(eq(productVariants.isActive, query.is_active === 'true'));
      const rows = await db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          sku: productVariants.sku,
          material: productVariants.material,
          color: productVariants.color,
          size: productVariants.size,
          price: productVariants.price,
          avgCost: productVariants.avgCost,
          totalStock: productVariants.totalStock,
          leadTimeDays: productVariants.leadTimeDays,
          safetyStock: productVariants.safetyStock,
          isActive: productVariants.isActive,
          productName: products.name,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(and(...conditions));
      return ok(rows);
    },
    { query: activeQuery, requireRole: ['OWNER', 'GUDANG', 'KASIR'] },
  )
  .get(
    '/product-variants/by-sku/:sku',
    async ({ params }) => {
      // Dipakai POS untuk scan barcode: SKU di-generate & di-print sebagai barcode (lihat PRODUCT_KNOWLEDGE.md §2).
      const [row] = await db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          sku: productVariants.sku,
          color: productVariants.color,
          size: productVariants.size,
          price: productVariants.price,
          totalStock: productVariants.totalStock,
          productName: products.name,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(and(eq(productVariants.sku, params.sku), isNull(productVariants.deletedAt)))
        .limit(1);
      if (!row) throw new NotFoundError('SKU tidak ditemukan');
      return ok(row);
    },
    { requireRole: ['OWNER', 'GUDANG', 'KASIR'] },
  )
  .put(
    '/products/:id',
    async ({ params, body }) => {
      if (body.category_id) {
        const [category] = await db.select().from(categories).where(eq(categories.id, body.category_id)).limit(1);
        if (!category) throw new NotFoundError('Kategori tidak ditemukan');
      }
      const [row] = await db
        .update(products)
        .set({
          name: body.name,
          categoryId: body.category_id,
          uomId: body.uom_id,
          isActive: body.is_active,
          updatedAt: new Date(),
        })
        .where(and(eq(products.id, params.id), isNull(products.deletedAt)))
        .returning();
      if (!row) throw new NotFoundError('Produk tidak ditemukan');
      return ok(row, 'Produk berhasil diperbarui');
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        category_id: t.Optional(t.String()),
        uom_id: t.Optional(t.String()),
        is_active: t.Optional(t.Boolean()),
      }),
      requireRole: ['OWNER'],
    },
  )
  .patch(
    '/products/:id/status',
    async ({ params, body }) => {
      const [row] = await db
        .update(products)
        .set({ isActive: body.is_active, updatedAt: new Date() })
        .where(and(eq(products.id, params.id), isNull(products.deletedAt)))
        .returning();
      if (!row) throw new NotFoundError('Produk tidak ditemukan');
      return ok(row, 'Status produk berhasil diperbarui');
    },
    { body: statusBody, requireRole: ['OWNER'] },
  )
  .delete(
    '/products/:id',
    async ({ params }) => {
      const [row] = await db
        .update(products)
        .set({ deletedAt: new Date() })
        .where(and(eq(products.id, params.id), isNull(products.deletedAt)))
        .returning();
      if (!row) throw new NotFoundError('Produk tidak ditemukan');
      // Cascade: varian SKU di bawah produk ini ikut di-soft-delete agar tidak lagi muncul di POS/Master Data.
      await db
        .update(productVariants)
        .set({ deletedAt: new Date() })
        .where(and(eq(productVariants.productId, params.id), isNull(productVariants.deletedAt)));
      return ok(row, 'Produk & seluruh varian SKU-nya berhasil dihapus');
    },
    { requireRole: ['OWNER'] },
  )
  .post(
    '/products/matrix',
    async ({ body }) => {
      const [category] = await db.select().from(categories).where(eq(categories.id, body.category_id)).limit(1);
      if (!category) throw new NotFoundError('Kategori tidak ditemukan');

      const [product] = await db
        .insert(products)
        .values({ name: body.name, categoryId: body.category_id, uomId: body.uom_id })
        .returning();

      // Generate matrix SKU dari kombinasi colors x sizes (lihat PRODUCT_KNOWLEDGE.md §2).
      // TODO: ganti generator kode SKU ini dengan aturan resmi [Parent Model Code]-[Material]-[Color]-[Size].
      const variantsToInsert = body.colors.flatMap((color) =>
        body.sizes.map((size) => ({
          productId: product!.id,
          sku: `${product!.id.slice(0, 4).toUpperCase()}-${color.slice(0, 3).toUpperCase()}-${size.toUpperCase()}`,
          material: body.material,
          color,
          size,
          price: String(body.base_price),
          totalStock: body.initial_stock ?? 0,
        })),
      );

      const insertedVariants = await db.insert(productVariants).values(variantsToInsert).returning();

      return ok({ product, variants: insertedVariants }, 'Produk & varian SKU berhasil dibuat');
    },
    {
      body: t.Object({
        name: t.String(),
        category_id: t.String(),
        uom_id: t.Optional(t.String()),
        material: t.Optional(t.String()),
        colors: t.Array(t.String()),
        sizes: t.Array(t.String()),
        base_price: t.Number(),
        initial_stock: t.Optional(t.Number()),
      }),
      requireRole: ['OWNER'],
    },
  )
  .post(
    '/products/:id/variants/matrix',
    async ({ params, body }) => {
      // Matrix Generator untuk produk yang SUDAH ada (tab "Varian" — MVP 3 Phase 1),
      // beda dari /products/matrix yang sekaligus membuat produk baru.
      const [product] = await db.select().from(products).where(and(eq(products.id, params.id), isNull(products.deletedAt))).limit(1);
      if (!product) throw new NotFoundError('Produk tidak ditemukan');
      if (body.colors.length === 0 || body.sizes.length === 0) {
        throw new ValidationError('Kombinasi warna & ukuran wajib diisi minimal 1');
      }

      const variantsToInsert = body.colors.flatMap((color) =>
        body.sizes.map((size) => ({
          productId: product.id,
          sku: `${product.id.slice(0, 4).toUpperCase()}-${color.slice(0, 3).toUpperCase()}-${size.toUpperCase()}`,
          material: body.material,
          color,
          size,
          price: String(body.base_price),
          totalStock: body.initial_stock ?? 0,
        })),
      );

      const insertedVariants = await db.insert(productVariants).values(variantsToInsert).returning();
      return ok(insertedVariants, 'Varian SKU berhasil digenerate dari Matrix Generator');
    },
    {
      body: t.Object({
        material: t.Optional(t.String()),
        colors: t.Array(t.String()),
        sizes: t.Array(t.String()),
        base_price: t.Number(),
        initial_stock: t.Optional(t.Number()),
      }),
      requireRole: ['OWNER'],
    },
  )
  .post(
    '/product-variants/bulk-fill',
    async ({ body }) => {
      // Bulk Fill (MVP 3 Phase 1): terapkan harga & stok awal yang sama ke sekumpulan SKU sekaligus,
      // biasanya dipanggil langsung setelah Matrix Generator.
      if (body.variant_ids.length === 0) throw new ValidationError('Pilih minimal 1 varian SKU');
      const updated = await db
        .update(productVariants)
        .set({
          price: body.price !== undefined ? String(body.price) : undefined,
          totalStock: body.stock,
          updatedAt: new Date(),
        })
        .where(and(inArray(productVariants.id, body.variant_ids), isNull(productVariants.deletedAt)))
        .returning();
      return ok(updated, 'Bulk fill berhasil diterapkan');
    },
    {
      body: t.Object({
        variant_ids: t.Array(t.String()),
        price: t.Optional(t.Number()),
        stock: t.Optional(t.Number()),
      }),
      requireRole: ['OWNER'],
    },
  )
  .put(
    '/product-variants/:id',
    async ({ params, body }) => {
      const [row] = await db
        .update(productVariants)
        .set({
          price: body.price !== undefined ? String(body.price) : undefined,
          material: body.material,
          color: body.color,
          size: body.size,
          leadTimeDays: body.lead_time_days,
          safetyStock: body.safety_stock,
          isActive: body.is_active,
          updatedAt: new Date(),
        })
        .where(and(eq(productVariants.id, params.id), isNull(productVariants.deletedAt)))
        .returning();
      if (!row) throw new NotFoundError('Varian SKU tidak ditemukan');
      return ok(row, 'Varian SKU berhasil diperbarui');
    },
    {
      body: t.Object({
        price: t.Optional(t.Number()),
        material: t.Optional(t.String()),
        color: t.Optional(t.String()),
        size: t.Optional(t.String()),
        lead_time_days: t.Optional(t.Number()),
        safety_stock: t.Optional(t.Number()),
        is_active: t.Optional(t.Boolean()),
      }),
      requireRole: ['OWNER'],
    },
  )
  .patch(
    '/product-variants/:id/status',
    async ({ params, body }) => {
      const [row] = await db
        .update(productVariants)
        .set({ isActive: body.is_active, updatedAt: new Date() })
        .where(and(eq(productVariants.id, params.id), isNull(productVariants.deletedAt)))
        .returning();
      if (!row) throw new NotFoundError('Varian SKU tidak ditemukan');
      return ok(row, 'Status varian SKU berhasil diperbarui');
    },
    { body: statusBody, requireRole: ['OWNER'] },
  )
  .delete(
    '/product-variants/:id',
    async ({ params }) => {
      const [row] = await db
        .update(productVariants)
        .set({ deletedAt: new Date() })
        .where(and(eq(productVariants.id, params.id), isNull(productVariants.deletedAt)))
        .returning();
      if (!row) throw new NotFoundError('Varian SKU tidak ditemukan');
      return ok(row, 'Varian SKU berhasil dihapus');
    },
    { requireRole: ['OWNER'] },
  );
