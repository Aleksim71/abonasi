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

function getBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string) || '';
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

export async function apiFetch<TData>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<TData> {
  const base = getBaseUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined)
  };

  if (init.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e) {
    throw new ApiError({ errorCode: 'NETWORK_ERROR', message: 'Failed to fetch', status: 0 });
  }

  const payload = await readJsonSafely(res);

  if (!res.ok) {
    const err = (payload ?? {}) as Partial<ApiErrorShape>;
    throw new ApiError({
      errorCode: err.error ?? 'HTTP_ERROR',
      message: err.message ?? `Request failed with status ${res.status}`,
      status: res.status
    });
  }

  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiError({ errorCode: 'BAD_RESPONSE', message: 'Expected { data }', status: 0 });
  }

  return (payload as { data: TData }).data;
}
