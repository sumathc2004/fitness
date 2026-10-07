'use client';

import type { ApiErrorBody } from '@gym/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// One refresh at a time, shared by every request that hits an expired access token.
let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then(async (r) => {
      // 409 = another tab/request just rotated the cookie; the browser already holds the new one.
      if (r.ok || r.status === 409) return true;
      return false;
    })
    .catch(() => false)
    .finally(() => setTimeout(() => { refreshing = null; }, 0));
  return refreshing;
}

function toLogin() {
  if (typeof window === 'undefined') return;
  const here = window.location.pathname + window.location.search;
  if (!window.location.pathname.startsWith('/auth/')) window.location.assign(`/auth/login?next=${encodeURIComponent(here)}`);
}

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skip the redirect-to-login on 401 (used by the login form itself). */
  noAuthRedirect?: boolean;
}

export async function api<T>(path: string, { method = 'GET', body, noAuthRedirect }: Options = {}, retried = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.');
  }

  if (res.status === 401 && !retried && !noAuthRedirect) {
    const data = (await res.clone().json().catch(() => null)) as ApiErrorBody | null;
    if (data?.error.code === 'TOKEN_EXPIRED' || data?.error.code === 'UNAUTHORIZED') {
      if (await refreshSession()) return api<T>(path, { method, body, noAuthRedirect }, true);
    }
    toLogin();
  }

  const json = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const e = (json as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Something went wrong', e?.details);
  }
  return json as T;
}
