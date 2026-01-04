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
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Build request URL.
 *
 * DEV rule:
 * - If path starts with /api/, ALWAYS use a relative URL so Vite proxy can forward to backend.
 *   This avoids CORS during local development.
 *
 * PROD rule:
 * - If VITE_API_BASE_URL is provided, we prefix it. Otherwise we use relative.
 */
function buildUrl(path: string): string {
  const p = normalizePath(path);

  // ✅ In dev, force relative for /api/* to use Vite proxy.
  if (import.meta.env.DEV && p.startsWith('/api/')) return p;

  const base = (import.meta.env.VITE_API_BASE_URL as string) || '';
  return `${base}${p}`;
}

async function readJsonSafely(res: Response): Promise<any | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
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
    ...(init.headers as Record<string, string> | undefined)
  };

  if (init.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...init, headers });

  const payload = await readJsonSafely(res);

  if (!res.ok) {
    const err = (payload ?? {}) as Partial<ApiErrorShape>;
    throw new ApiError({
      errorCode: err.error ?? 'HTTP_ERROR',
      message: err.message ?? `Request failed with status ${res.status}`,
      status: res.status
    });
  }

  // Success MUST be { data: ... }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiError({
      errorCode: 'BAD_RESPONSE',
      message: 'Expected success response shape: { data: ... }',
      status: 0
    });
  }

  return (payload as { data: TData }).data;
}
