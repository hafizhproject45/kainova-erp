import { Elysia, t } from 'elysia';
import { eq, isNull } from 'drizzle-orm';
import { db } from '../../config/database';
import { categories, productVariants, products } from '../../db/schema';
import { authPlugin } from '../auth';
import { ok, NotFoundError } from '../../utils/http';

export const productsRoutes = new Elysia()
  .use(authPlugin)
  .get(
    '/products',
    async ({ query }) => {
      const rows = query.category_id
        ? await db.select().from(products).where(eq(products.categoryId, query.category_id))
        : await db.select().from(products).where(isNull(products.deletedAt));
      return ok(rows);
    },
    { query: t.Object({ category_id: t.Optional(t.String()) }), requireRole: ['OWNER', 'GUDANG', 'KASIR'] },
  )
  .get(
    '/products/:id/variants',
    async ({ params }) => ok(await db.select().from(productVariants).where(eq(productVariants.productId, params.id))),
    { requireRole: ['OWNER', 'GUDANG', 'KASIR'] },
  )
  .post(
    '/products/matrix',
    async ({ body }) => {
      const [category] = await db.select().from(categories).where(eq(categories.id, body.category_id)).limit(1);
      if (!category) throw new NotFoundError('Kategori tidak ditemukan');

      const [product] = await db
        .insert(products)
        .values({ name: body.name, categoryId: body.category_id })
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
        })),
      );

      const insertedVariants = await db.insert(productVariants).values(variantsToInsert).returning();

      return ok({ product, variants: insertedVariants }, 'Produk & varian SKU berhasil dibuat');
    },
    {
      body: t.Object({
        name: t.String(),
        category_id: t.String(),
        material: t.Optional(t.String()),
        colors: t.Array(t.String()),
        sizes: t.Array(t.String()),
        base_price: t.Number(),
      }),
      requireRole: ['OWNER'],
    },
  )
  .put(
    '/product-variants/:id',
    async ({ params, body }) => {
      const [row] = await db
        .update(productVariants)
        .set({ price: body.price !== undefined ? String(body.price) : undefined, updatedAt: new Date() })
        .where(eq(productVariants.id, params.id))
        .returning();
      if (!row) throw new NotFoundError('Varian SKU tidak ditemukan');
      return ok(row, 'Varian SKU berhasil diperbarui');
    },
    {
      body: t.Object({ price: t.Optional(t.Number()) }),
      requireRole: ['OWNER'],
    },
  );
