/**
 * The reader's account, from the browser only. Pages are the same cached HTML for everyone,
 * so nothing here runs on the server: the session is an HttpOnly cookie scoped to /api, and
 * this module talks to the API with it.
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/** Set while a reader is signed in, so guests and crawlers never call /me */
export const SIGNED_IN_KEY = 'signedIn';

export interface Me {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  locale: string | null;
  createdAt: string;
}

export class AccountError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** A request to an account endpoint: the session cookie, plus the header the API requires on writes */
export async function accountFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-kitabxana': '1', ...init.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AccountError(body.message ?? `Error ${res.status}`, res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const googleStartUrl = (returnTo: string) =>
  `${API}/auth/google/start?${new URLSearchParams({ returnTo })}`;

export function readFlag(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(SIGNED_IN_KEY, '1');
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch {}
}
