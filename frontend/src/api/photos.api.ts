// frontend/src/api/photos.api.ts
'use strict';

export type Photo = {
  id: string;
  filePath: string;
  // Backend сейчас отдаёт order (как в DraftPhotosPage). На всякий случай оставим оба.
  order?: number;
  position?: number;

  // Иногда может прилетать превью как string или объект
  previewPhoto?: string | { id?: string; filePath?: string } | null;
};

export type UploadProgress = {
  loaded: number;
  total?: number;
  percent?: number;
};

export type UploadPhotosResult = { photos: Photo[] };
export type ReorderPhotosResult = { photos: Photo[] };
export type DeletePhotoResult = { ok: true } | { photos: Photo[] };

// --- small helpers ----------------------------------------------------------

function getBaseUrl(): string {
  // В dev у тебя работает Vite proxy на /api, значит baseUrl можно оставлять пустым.
  // Если когда-то будет VITE_API_URL, можно будет использовать его.
  const envUrl =
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_URL;
  return envUrl ? String(envUrl).replace(/\/$/, '') : '';
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function normalizePhotosPayload(payload: unknown): Photo[] {
  if (!payload) return [];

  // 1) сразу массив
  if (Array.isArray(payload)) return payload as Photo[];

  // 2) { photos: [...] }
  if (isObject(payload) && Array.isArray(payload.photos)) return payload.photos as Photo[];

  // 3) { items: [...] }
  if (isObject(payload) && Array.isArray(payload.items)) return payload.items as Photo[];

  // 4) { data: [...] } или { data: { photos: [...] } }
  if (isObject(payload)) {
    const data = payload.data;
    if (Array.isArray(data)) return data as Photo[];
    if (isObject(data) && Array.isArray(data.photos)) return data.photos as Photo[];
  }

  return [];
}

async function readJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

type ApiErrorLike = Error & { status?: number; body?: unknown };

async function request<T = unknown>(
  path: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
    token?: string;
    signal?: AbortSignal;
  } = {}
): Promise<T> {
  const base = getBaseUrl();
  const url = `${base}${path}`;

  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ?? undefined,
    signal: opts.signal,
  });

  if (!res.ok) {
    const body = await readJsonSafe(res);
    const err = new Error(
      isObject(body) && typeof body.message === 'string' ? body.message : `Request failed: ${res.status}`
    ) as ApiErrorLike;

    err.name = 'ApiError';
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return (await readJsonSafe(res)) as T;
}

// --- API --------------------------------------------------------------------

/**
 * Upload photos (multipart/form-data) with PROGRESS (XHR).
 * Backend: POST /api/ads/:id/photos with fields "photos"
 */
export function uploadAdPhotosMultipart(opts: {
  adId: string;
  files: File[];
  token?: string;
  signal?: AbortSignal;
  onProgress?: (p: UploadProgress) => void;
}): Promise<UploadPhotosResult> {
  const { adId, files, token, signal, onProgress } = opts;

  const fd = new FormData();
  for (const f of files) fd.append('photos', f);

  const base = getBaseUrl();
  const url = `${base}/api/ads/${encodeURIComponent(adId)}/photos`;

  return new Promise<UploadPhotosResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', url, true);
    xhr.responseType = 'json';

    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    // progress
    xhr.upload.onprogress = (ev: ProgressEvent) => {
      if (!onProgress) return;

      const progress: UploadProgress = { loaded: ev.loaded };

      if (ev.lengthComputable && typeof ev.total === 'number' && ev.total > 0) {
        progress.total = ev.total;
        progress.percent = Math.round((ev.loaded / ev.total) * 100);
      }

      onProgress(progress);
    };

    xhr.onerror = () => {
      const err = new Error('Network error') as ApiErrorLike;
      err.name = 'ApiError';
      err.status = 0;
      reject(err);
    };

    xhr.onabort = () => {
      const err = new Error('Request aborted') as ApiErrorLike;
      err.name = 'ApiError';
      err.status = 0;
      reject(err);
    };

    xhr.onload = () => {
      const status = xhr.status;

      // xhr.response при responseType='json' может быть null если пусто/невалидный JSON
      const payload: unknown =
        xhr.response ?? (xhr.responseText ? ((): unknown => {
          try {
            return JSON.parse(xhr.responseText) as unknown;
          } catch {
            return { raw: xhr.responseText };
          }
        })() : null);

      if (status >= 200 && status < 300) {
        resolve({ photos: normalizePhotosPayload(payload) });
        return;
      }

      const body = payload;
      const msg =
        isObject(body) && typeof body.message === 'string' ? body.message : `Request failed: ${status}`;

      const err = new Error(msg) as ApiErrorLike;
      err.name = 'ApiError';
      err.status = status;
      err.body = body;
      reject(err);
    };

    // AbortSignal support
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      const onAbort = () => xhr.abort();
      signal.addEventListener('abort', onAbort, { once: true });
      xhr.addEventListener(
        'loadend',
        () => {
          signal.removeEventListener('abort', onAbort);
        },
        { once: true }
      );
    }

    xhr.send(fd);
  });
}

/**
 * Upload photos (multipart/form-data) WITHOUT progress (fetch).
 * Если не нужен прогресс — можно использовать это.
 */
export async function uploadAdPhotos(opts: {
  adId: string;
  files: File[];
  token?: string;
  signal?: AbortSignal;
}): Promise<UploadPhotosResult> {
  const { adId, files, token, signal } = opts;

  const fd = new FormData();
  for (const f of files) fd.append('photos', f);

  const payload = await request<unknown>(`/api/ads/${encodeURIComponent(adId)}/photos`, {
    method: 'POST',
    body: fd,
    // Content-Type не ставим для FormData
    token,
    signal,
  });

  return { photos: normalizePhotosPayload(payload) };
}

/**
 * DELETE /api/ads/:adId/photos/:photoId
 */
export async function deleteAdPhoto(opts: {
  adId: string;
  photoId: string;
  token?: string;
  signal?: AbortSignal;
}): Promise<DeletePhotoResult> {
  const { adId, photoId, token, signal } = opts;

  const payload = await request<unknown>(
    `/api/ads/${encodeURIComponent(adId)}/photos/${encodeURIComponent(photoId)}`,
    { method: 'DELETE', token, signal }
  );

  const photos = normalizePhotosPayload(payload);
  if (photos.length) return { photos };

  return { ok: true };
}

/**
 * PUT /api/ads/:adId/photos/reorder
 * Body: { photoIds: string[] }
 */
export async function reorderAdPhotos(opts: {
  adId: string;
  photoIds: string[];
  token?: string;
  signal?: AbortSignal;
}): Promise<ReorderPhotosResult> {
  const { adId, photoIds, token, signal } = opts;

  const payload = await request<unknown>(`/api/ads/${encodeURIComponent(adId)}/photos/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoIds }),
    token,
    signal,
  });

  return { photos: normalizePhotosPayload(payload) };
}

// --- helpers for UI/tests ---------------------------------------------------

export function sortPhotosByOrder(photos: Photo[]): Photo[] {
  return [...photos].sort((a, b) => (a.order ?? a.position ?? 0) - (b.order ?? b.position ?? 0));
}

export function getPreviewFilePath(photo: Photo): string | null {
  const p = photo.previewPhoto;
  if (!p) return null;

  if (typeof p === 'string') return p;

  if (isObject(p) && typeof p.filePath === 'string') return p.filePath;

  return null;
}
