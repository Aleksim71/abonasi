const TOKEN_KEY = 'token';
const LOCATION_ID_KEY = 'locationId';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getLocationId(): string | null {
  return localStorage.getItem(LOCATION_ID_KEY);
}

export function setLocationId(locationId: string): void {
  localStorage.setItem(LOCATION_ID_KEY, locationId);
}

export function clearLocationId(): void {
  localStorage.removeItem(LOCATION_ID_KEY);
}
