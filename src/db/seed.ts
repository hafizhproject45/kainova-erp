/**
 * Seed data awal: 1 user OWNER + system_settings default row.
 * Jalankan: bun run src/db/seed.ts (setelah `bun run db:push` atau `db:migrate`).
 */
import { db } from '../config/database';
import { systemSettings, users } from './schema';

async function main() {
  const [existingSettings] = await db.select().from(systemSettings).limit(1);
  if (!existingSettings) {
    await db.insert(systemSettings).values({});
    console.log('✅ system_settings default row created');
  }

  const passwordHash = await Bun.password.hash('popyshop123');
  await db
    .insert(users)
    .values({
      username: 'owner',
      passwordHash,
      name: 'Owner Popyshop',
      role: 'OWNER',
    })
    .onConflictDoNothing();

  console.log('✅ Seed selesai. Login dengan username "owner" / password "popyshop123" (ganti setelah login pertama!).');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
