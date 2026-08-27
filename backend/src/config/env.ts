function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: required('DATABASE_URL', 'postgres://kainova:kainova@localhost:5432/kainova_erp'),
  jwtSecret: required('JWT_SECRET', 'dev-only-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
} as const;

export const isProduction = env.nodeEnv === 'production';
