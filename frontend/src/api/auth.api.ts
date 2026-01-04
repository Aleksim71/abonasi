import { apiFetch } from './http';

export type LoginBody = { email: string; password: string };
export type RegisterBody = { email: string; password: string; name: string };

export type AuthUser = { id: string; email: string; name: string; created_at?: string };
export type AuthData = { user: AuthUser; token: string };

export function login(body: LoginBody): Promise<AuthData> {
  return apiFetch<AuthData>('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(body)
  });
}

export function register(body: RegisterBody): Promise<AuthData> {
  return apiFetch<AuthData>('/api/auth/register', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(body)
  });
}

export function me(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/auth/me', { method: 'GET' });
}
