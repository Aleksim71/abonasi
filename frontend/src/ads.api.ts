import { apiFetch, ApiError } from './http';

export type AdStatus = 'draft' | 'active' | 'stopped';

export type AdListItem = {
  id: string;
  title: string;
  status: AdStatus;
  locationId: string;
  ownerId?: string | null;
};

export type AdDetails = AdListItem & {
  description?: string | null;
  photos?: Array<{ id: string; url: string; order: number }>;
};

export function feed(params: { locationId: string }): Promise<AdListItem[]> {
  const q = new URLSearchParams({ locationId: params.locationId });
  return apiFetch<AdListItem[]>(`/api/ads/feed?${q.toString()}`, { method: 'GET', auth: false });
}

export function getById(id: string): Promise<AdDetails> {
  return apiFetch<AdDetails>(`/api/ads/${id}`, { method: 'GET' });
}

export function myAds(): Promise<AdListItem[]> {
  return apiFetch<AdListItem[]>('/api/ads/my', { method: 'GET' });
}

export function createDraft(body: { locationId: string; title: string; description?: string }): Promise<AdDetails> {
  return apiFetch<AdDetails>('/api/ads', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function publish(id: string): Promise<AdDetails> {
  return apiFetch<AdDetails>(`/api/ads/${id}/publish`, { method: 'POST' });
}

export function stop(id: string): Promise<AdDetails> {
  return apiFetch<AdDetails>(`/api/ads/${id}/stop`, { method: 'POST' });
}

export function restart(id: string): Promise<AdDetails> {
  return apiFetch<AdDetails>(`/api/ads/${id}/restart`, { method: 'POST' });
}

export async function addPhoto(id: string, file: File): Promise<AdDetails> {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string) || '';
  const url = `${baseUrl}/api/ads/${id}/photos`;

  const form = new FormData();
  form.append('photo', file);

  const token = localStorage.getItem('token');
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form
    });
  } catch (e) {
    throw new ApiError({ errorCode: 'NETWORK_ERROR', message: 'Failed to fetch', status: 0 });
  }

  const text = await res.text();
  const payload = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;

  if (!res.ok) {
    const err = (payload ?? {}) as any;
    throw new ApiError({
      errorCode: err.error ?? 'HTTP_ERROR',
      message: err.message ?? `Request failed with status ${res.status}`,
      status: res.status
    });
  }

  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiError({ errorCode: 'BAD_RESPONSE', message: 'Expected { data }', status: 0 });
  }

  return payload.data as AdDetails;
}
