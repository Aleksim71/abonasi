import { getToken } from '../utils/storage';

export type ApiErrorShape = { error: string; message: string };

export class ApiError extends Error {
  public readonly errorCode: string;
  public readonly status: number;

  constructor(params: { errorCode: string; message: string; status: number }) {
    super(params.message);
    this.name = 'ApiError';
    this.errorCode = params.errorCode;
    this.status = params.status;
  }
}

function normalizePath(path: string): string {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * - If VITE_API_BASE_URL is provided, we prefix it.
 * - Otherwise we use relative (Vite proxy in dev).
 * - In dev, we force relative for /api/* to use Vite proxy even if base is set.
 */
function buildUrl(path: string): string {
  const p = normalizePath(path);

  // ✅ In dev, force relative for /api/* to use Vite proxy.
  if (import.meta.env.DEV && p.startsWith('/api/')) return p;

  const base = (import.meta.env.VITE_API_BASE_URL as string) || '';
  return `${base}${p}`;
}

function hasErrorShape(x: unknown): x is Partial<ApiErrorShape> {
  return typeof x === 'object' && x !== null && ('error' in x || 'message' in x);
}

async function readJsonSafely(res: Response): Promise<unknown | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function apiFetch<TData>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<TData> {
  const url = buildUrl(path);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };

  if (init.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new ApiError({ errorCode: 'NETWORK_ERROR', message: 'Failed to fetch', status: 0 });
  }

  const payload = await readJsonSafely(res);

  if (!res.ok) {
    const err = hasErrorShape(payload) ? payload : {};
    const errorCode =
      typeof err.error === 'string' && err.error.trim() ? err.error : 'HTTP_ERROR';
    const message =
      typeof err.message === 'string' && err.message.trim()
        ? err.message
        : `Request failed with status ${res.status}`;

    throw new ApiError({
      errorCode,
      message,
      status: res.status,
    });
  }

  // Expect backend response contract: { data: ... }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiError({ errorCode: 'BAD_RESPONSE', message: 'Expected { data }', status: 0 });
  }

  return (payload as { data: TData }).data;
}
