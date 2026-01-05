// frontend/src/api/ads.api.ts
import { apiFetch } from './http';

export type AdStatus = 'draft' | 'active' | 'stopped';

export type AdPhoto = {
  id: string;
  filePath: string;
  sortOrder: number;
  createdAt?: string;
};

export type AdPreviewPhoto = {
  id: string;
  filePath: string;
  sortOrder: number;
  createdAt?: string;
};

export type AdListItem = {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  status: AdStatus;
  locationId: string;
  ownerId?: string | null;
  createdAt?: string;

  // backend feed extras
  previewPhoto?: AdPreviewPhoto | null;
  photosCount?: number;
};

export type AdDetails = AdListItem & {
  description?: string | null;
  userId?: string | null;
  photos?: AdPhoto[];
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

// Photos (current backend MVP contract: JSON { filePath, sortOrder })
export type PhotosPatchResponse = { adId: string; photos: AdPhoto[] };

export function addPhoto(adId: string, body: { filePath: string; sortOrder?: number }): Promise<PhotosPatchResponse> {
  return apiFetch<PhotosPatchResponse>(`/api/ads/${adId}/photos`, {
    method: 'POST',
    body: JSON.stringify({
      filePath: body.filePath,
      sortOrder: body.sortOrder ?? 0
    })
  });
}

export function deletePhoto(adId: string, photoId: string): Promise<PhotosPatchResponse> {
  return apiFetch<PhotosPatchResponse>(`/api/ads/${adId}/photos/${photoId}`, { method: 'DELETE' });
}

export function reorderPhotos(
  adId: string,
  items: Array<{ photoId: string; sortOrder: number }>
): Promise<PhotosPatchResponse> {
  return apiFetch<PhotosPatchResponse>(`/api/ads/${adId}/photos/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ items })
  });
}
