import { $fetch, FetchError, type FetchOptions } from 'ofetch';
import { env } from '@/shared/config/env.configuration';
import { jwt } from '@/shared/config/jwt.configuration';
import { WEB_ROUTES } from '@/shared/constants/routes.constant';

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_BASE_URL = env.client.NEXT_PUBLIC_API_ENDPOINT!;
const DEFAULT_REFRESH_PATH = 'refresh-token'; // TODO: change to actual refresh endpoint

// --- token helpers (client-only) ---

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(jwt.accessToken.key);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(jwt.refreshToken.key);
}

function setTokens(access: string, refresh: string): void {
  localStorage.setItem(jwt.accessToken.key, access);
  localStorage.setItem(jwt.refreshToken.key, refresh);
}

function clearTokensAndRedirect(): void {
  localStorage.removeItem(jwt.accessToken.key);
  localStorage.removeItem(jwt.refreshToken.key);
  window.location.replace(WEB_ROUTES.SIGN_IN);
}

// --- Request class ---

export class Request {
  private readonly baseOptions: FetchOptions;

  constructor() {
    this.baseOptions = {
      baseURL: DEFAULT_BASE_URL,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    };
  }

  private getAuthHeaders(): Record<string, string> {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async refreshToken(): Promise<string> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokensAndRedirect();
      throw new Error('No refresh token');
    }
    const res = await $fetch<{ data: Record<string, string> }>(
      DEFAULT_REFRESH_PATH,
      {
        baseURL: DEFAULT_BASE_URL,
        method: 'POST',
        body: { refresh_token: refreshToken },
        credentials: 'include',
      },
    );
    const newAccess = res.data[jwt.accessToken.key]!;
    const newRefresh = res.data[jwt.refreshToken.key]!;
    setTokens(newAccess, newRefresh);
    return newAccess;
  }

  private async fetch<R>(url: string, options: FetchOptions): Promise<R> {
    const opts: FetchOptions = {
      ...this.baseOptions,
      ...options,
      headers: {
        ...this.baseOptions.headers,
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    };

    try {
      return await $fetch<R>(url, opts as FetchOptions<'json'>);
    } catch (error) {
      if (
        error instanceof FetchError &&
        error.status === 401 &&
        typeof window !== 'undefined'
      ) {
        try {
          const newToken = await this.refreshToken();
          return $fetch<R>(url, {
            ...(opts as FetchOptions<'json'>),
            headers: { ...opts.headers, Authorization: `Bearer ${newToken}` },
          });
        } catch {
          clearTokensAndRedirect();
        }
      }
      throw error;
    }
  }

  public get<R>(url: string, params?: Record<string, unknown>): Promise<R> {
    return this.fetch<R>(url, { method: 'GET', params });
  }

  public post<D extends Record<string, unknown>, R>(
    url: string,
    body: D,
  ): Promise<R> {
    return this.fetch<R>(url, { method: 'POST', body });
  }

  public put<D extends Record<string, unknown>, R>(
    url: string,
    body: D,
  ): Promise<R> {
    return this.fetch<R>(url, { method: 'PUT', body });
  }

  public patch<D extends Record<string, unknown>, R>(
    url: string,
    body: D,
  ): Promise<R> {
    return this.fetch<R>(url, { method: 'PATCH', body });
  }

  public delete<R>(url: string, params?: Record<string, unknown>): Promise<R> {
    return this.fetch<R>(url, { method: 'DELETE', params });
  }
}
