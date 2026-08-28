/**
 * API client tipis untuk KaiNova ERP backend.
 * Backend selalu pakai snake_case di boundary JSON (lihat API_SPECIFICATION.md),
 * jadi di sini kita convert otomatis: request (camelCase -> snake_case),
 * response (snake_case -> camelCase) supaya kode Svelte tetap idiomatic camelCase.
 */
import { get } from 'svelte/store';
import { authState, logout } from './stores/auth';

const API_BASE = '/v1';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function camelToSnake(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function toSnakeCase<T = unknown>(input: T): T {
  if (Array.isArray(input)) return input.map(toSnakeCase) as unknown as T;
  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) out[camelToSnake(k)] = toSnakeCase(v);
    return out as T;
  }
  return input;
}

export function toCamelCase<T = unknown>(input: T): T {
  if (Array.isArray(input)) return input.map(toCamelCase) as unknown as T;
  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) out[snakeToCamel(k)] = toCamelCase(v);
    return out as T;
  }
  return input;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: unknown;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: unknown = null,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { query?: Record<string, unknown> } = {}): Promise<T> {
  const { query, ...rest } = init;
  const token = get(authState).token;

  let url = `${API_BASE}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(toSnakeCase(query) as Record<string, unknown>)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
    },
  });

  const json = (await res.json()) as ApiEnvelope<unknown>;

  if (res.status === 401) {
    logout();
  }

  if (!json.success) {
    throw new ApiClientError(res.status, json.message, json.errors);
  }

  return toCamelCase(json.data) as T;
}

export const api = {
  get: <T>(path: string, query?: Record<string, unknown>) => request<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(toSnakeCase(body)) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(toSnakeCase(body)) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
