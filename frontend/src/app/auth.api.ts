import { apiFetch } from './http';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  created_at?: string;
};

export type AuthData = {
  user: AuthUser;
  token: string;
};

export function register(params: { email: string; password: string; name: string }): Promise<AuthData> {
  return apiFetch<AuthData>('/api/auth/register', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(params)
  });
}

export function login(params: { email: string; password: string }): Promise<AuthData> {
  return apiFetch<AuthData>('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(params)
  });
}

export function me(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/auth/me', { method: 'GET' });
}
