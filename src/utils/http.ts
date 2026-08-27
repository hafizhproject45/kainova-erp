/**
 * Response envelope & snake_case <-> camelCase conversion helpers.
 *
 * Konvensi (lihat TECH_KNOWLEDGE.md §3 & API_SPECIFICATION.md):
 *  - Properti internal TypeScript/Drizzle: camelCase.
 *  - Payload JSON di boundary API (request & response): snake_case.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function camelToSnake(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

/** Ubah object/array camelCase (internal) menjadi snake_case (JSON response). */
export function toSnakeCase<T = unknown>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => toSnakeCase(item)) as unknown as T;
  }
  if (isPlainObject(input)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      result[camelToSnake(key)] = toSnakeCase(value);
    }
    return result as T;
  }
  return input;
}

/** Ubah object/array snake_case (JSON request) menjadi camelCase (internal). */
export function toCamelCase<T = unknown>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => toCamelCase(item)) as unknown as T;
  }
  if (isPlainObject(input)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      result[snakeToCamel(key)] = toCamelCase(value);
    }
    return result as T;
  }
  return input;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: unknown | null;
}

export function ok<T>(data: T, message = 'OK'): ApiEnvelope<T> {
  return { success: true, message, data: toSnakeCase(data), errors: null };
}

export function fail(message: string, errors: unknown = null): ApiEnvelope<null> {
  return { success: false, message, data: null, errors };
}

/** Error terkontrol dengan HTTP status eksplisit (lihat TECH_KNOWLEDGE.md §5). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message = 'Validation failure', errors: unknown = null) {
    super(400, message, errors);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Token invalid / expired') {
    super(401, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'RBAC role tidak memiliki hak akses') {
    super(403, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Data tidak ditemukan') {
    super(404, message);
  }
}

export class BusinessRuleError extends ApiError {
  constructor(message: string) {
    super(422, message);
  }
}
