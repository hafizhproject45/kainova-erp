import { Elysia, t } from 'elysia';
import jwt from '@elysiajs/jwt';
import { eq } from 'drizzle-orm';
import { db } from '../../config/database';
import { users } from '../../db/schema';
import { env } from '../../config/env';
import { ok, fail, UnauthorizedError, ForbiddenError } from '../../utils/http';

export type UserRole = 'OWNER' | 'GUDANG' | 'KASIR';

export interface AuthPayload {
  id: string;
  name: string;
  role: UserRole;
  [key: string]: string; // index signature dibutuhkan oleh @elysiajs/jwt `sign()`
}

/** Elysia plugin: registers `jwt` derive + `auth`/`requireRole` guards for other modules to reuse. */
export const authPlugin = new Elysia({ name: 'auth-plugin' })
  .use(
    jwt({
      name: 'jwt',
      secret: env.jwtSecret,
      exp: env.jwtExpiresIn,
    }),
  )
  .derive({ as: 'global' }, async ({ headers, jwt }) => {
    const authHeader = headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return { user: null as AuthPayload | null };
    const token = authHeader.slice('Bearer '.length);
    const payload = await jwt.verify(token);
    if (!payload) return { user: null as AuthPayload | null };
    return { user: payload as unknown as AuthPayload };
  })
  .macro(({ onBeforeHandle }) => ({
    requireAuth(enabled: boolean) {
      if (!enabled) return;
      onBeforeHandle((context: { user: AuthPayload | null }) => {
        if (!context.user) throw new UnauthorizedError();
      });
    },
    requireRole(roles: UserRole[]) {
      onBeforeHandle((context: { user: AuthPayload | null }) => {
        if (!context.user) throw new UnauthorizedError();
        if (!roles.includes(context.user.role)) throw new ForbiddenError();
      });
    },
  }));

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authPlugin)
  .post(
    '/login',
    async ({ body, jwt, set }) => {
      const [account] = await db.select().from(users).where(eq(users.username, body.username)).limit(1);

      const passwordValid = account ? await Bun.password.verify(body.password, account.passwordHash) : false;

      if (!account || !passwordValid) {
        set.status = 401;
        return fail('Username atau password salah');
      }

      const payload: AuthPayload = { id: account.id, name: account.name, role: account.role };
      const token = await jwt.sign(payload);

      return ok({ token, user: payload });
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
      }),
    },
  );
