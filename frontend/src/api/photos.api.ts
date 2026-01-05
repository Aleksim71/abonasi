/**
 * Abonasi — Photos API (frontend, app-level)
 *
 * Backend endpoints:
 * - POST   /api/ads/:id/photos              (multipart/form-data)
 * - DELETE /api/ads/:id/photos/:photoId
 * - PUT    /api/ads/:id/photos/reorder
 *
 * HTTP client:
 * - Uses apiFetch() from ../http for JSON requests
 * - Implements a small multipart helper for uploads because apiFetch() enforces JSON Content-Type
 */

import { getToken } from '../utils/storage';
import { ApiError, type ApiErrorShape, apiFetch } from '../api/http';

export type Photo = {
  id: string;
  filePath: string;
  order: number;
  createdAt?: string;
  previewPhoto?: { id: string; filePath: string } | string | null;
};

export type UploadPhotosResult = { photos: Photo[] };
export type ReorderPhotosResult = { photos: Photo[] };
export type DeletePhotoResult = { photos?: Photo[]; ok?: boolean };

function getBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string) || '';
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

function normalizePhotosPayload(payload: unknown): Photo[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Photo[];

  if (typeof payload === 'object' && payload !== null) {
    const p = payload as Record<string, unknown>;

    if (Array.isArray(p.photos)) return p.photos as Photo[];
    if (Array.isArray(p.items)) return p.items as Photo[];
    if (Array.isArray(p.data)) return p.data as Photo[];

    // Sometimes backend returns { data: { photos: [...] } }
    const data = p.data;
    if (typeof data === 'object' && data !== null) {
      const d = data as Record<string, unknown>;
      if (Array.isArray(d.photos)) return d.photos as Photo[];
      if (Array.isArray(d.items)) return d.items as Photo[];
    }
  }

  return [];
}

/**
 * Multipart helper aligned with ../http behaviour:
 * - Uses VITE_API_BASE_URL
 * - Adds Bearer token from storage (same as apiFetch default auth)
 * - Expects backend response shape: { data: ... }
 */
async function apiFetchMultipart<TData>(
  path: string,
  params: {
    method?: 'POST' | 'PUT' | 'PATCH';
    formData: FormData;
    auth?: boolean;
    signal?: AbortSignal;
  }
): Promise<TData> {
  const base = getBaseUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {};

  if (params.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    // IMPORTANT: do NOT set Content-Type manually for FormData
    res = await fetch(url, {
      method: params.method ?? 'POST',
      body: params.formData,
      headers,
      signal: params.signal,
    });
  } catch {
    throw new ApiError({ errorCode: 'NETWORK_ERROR', message: 'Failed to fetch', status: 0 });
  }

  const payload = await readJsonSafely(res);

  if (!res.ok) {
    const err = (payload ?? {}) as Partial<ApiErrorShape>;
    throw new ApiError({
      errorCode: err.error ?? 'HTTP_ERROR',
      message: err.message ?? `Request failed with status ${res.status}`,
      status: res.status,
    });
  }

  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiError({ errorCode: 'BAD_RESPONSE', message: 'Expected { data }', status: 0 });
  }

  return (payload as { data: TData }).data;
}

/**
 * Upload one or many photos for an ad draft.
 * Backend expects multipart/form-data with one or many "photos" fields.
 */
export async function uploadAdPhotos(params: {
  adId: string;
  files: File[];
  signal?: AbortSignal;
}): Promise<UploadPhotosResult> {
  const { adId, files, signal } = params;

  const fd = new FormData();
  for (const file of files) fd.append('photos', file);

  // backend may return: { data: Photo[] } OR { data: { photos: Photo[] } }
  const data = await apiFetchMultipart<unknown>(`/api/ads/${encodeURIComponent(adId)}/photos`, {
    method: 'POST',
    formData: fd,
    signal,
  });

  return { photos: normalizePhotosPayload(data) };
}

/**
 * Delete a photo from an ad draft.
 */
export async function deleteAdPhoto(params: {
  adId: string;
  photoId: string;
  signal?: AbortSignal;
}): Promise<DeletePhotoResult> {
  const { adId, photoId, signal } = params;

  const data = await apiFetch<unknown>(
    `/api/ads/${encodeURIComponent(adId)}/photos/${encodeURIComponent(photoId)}`,
    { method: 'DELETE', signal }
  );

  const photos = normalizePhotosPayload(data);
  if (photos.length) return { photos };

  if (data && typeof data === 'object') return data as DeletePhotoResult;
  return { ok: true };
}

/**
 * Reorder photos for an ad draft.
 * Payload format: { photoIds: string[] }
 */
export async function reorderAdPhotos(params: {
  adId: string;
  photoIds: string[];
  signal?: AbortSignal;
}): Promise<ReorderPhotosResult> {
  const { adId, photoIds, signal } = params;

  const data = await apiFetch<unknown>(
    `/api/ads/${encodeURIComponent(adId)}/photos/reorder`,
    {
      method: 'PUT',
      body: JSON.stringify({ photoIds }),
      signal,
    }
  );

  return { photos: normalizePhotosPayload(data) };
}

/**
 * Small helpers you may reuse in UI/tests.
 */
export function sortPhotosByOrder(photos: Photo[]): Photo[] {
  return [...photos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function getPreviewFilePath(photo: Photo): string | null {
  const p = photo.previewPhoto;
  if (!p) return null;
  if (typeof p === 'string') return p;
  if (typeof p === 'object' && typeof p.filePath === 'string') return p.filePath;
  return null;
}
