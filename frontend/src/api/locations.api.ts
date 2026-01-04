import { apiFetch } from './http';

export type Location = {
  id: string;
  country: string;
  city: string;
  district: string;
};

export function listLocations(params?: { country?: string; city?: string }): Promise<Location[]> {
  const q = new URLSearchParams();
  if (params?.country) q.set('country', params.country);
  if (params?.city) q.set('city', params.city);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<Location[]>(`/api/locations${suffix}`, { method: 'GET' });
}
