/**
 * SmartSoma Auth Helpers
 * Store and retrieve the JWT token + user metadata from localStorage.
 * All functions are SSR-safe (check typeof window before accessing browser APIs).
 */

const TOKEN_KEY = "smartsoma_token";
const USER_KEY = "smartsoma_user";

export interface StoredUser {
  user_id: number;
  full_name: string;
  role: "student" | "teacher";
  school_id: string | null;
}

/** Decode the JWT payload and return the `exp` Unix timestamp, or null if unreadable. */
function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof decoded.exp === "number" ? decoded.exp : null;
  } catch {
    return null;
  }
}

/** Returns true if the token is missing or its exp claim is in the past. */
function isTokenExpired(token: string): boolean {
  const exp = getTokenExpiry(token);
  if (exp === null) return false; // no exp claim → treat as non-expiring
  return Date.now() >= exp * 1000;
}

export function saveAuth(token: string, user: StoredUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Presence cookie read by Next.js proxy (middleware) for server-side route protection
  document.cookie = "smartsoma_auth=1; path=/; max-age=172800; SameSite=Lax";
}

/**
 * Returns the stored JWT, or null if:
 * - there is no token
 * - the token's `exp` claim has passed (auto-clears storage in that case)
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isTokenExpired(token)) {
    // silently wipe stale session so the next page load lands on /login
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    document.cookie = "smartsoma_auth=; path=/; max-age=0";
    return null;
  }
  return token;
}

// Module-level cache so getUser() returns a stable reference when localStorage
// hasn't changed — required by useSyncExternalStore's getSnapshot contract.
let _rawCache: string | null | undefined;
let _userCache: StoredUser | null = null;

export function getUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (raw === _rawCache) return _userCache; // same string → same object reference
  _rawCache = raw;
  if (!raw) { _userCache = null; return null; }
  try {
    _userCache = JSON.parse(raw) as StoredUser;
  } catch {
    _userCache = null;
  }
  return _userCache;
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  document.cookie = "smartsoma_auth=; path=/; max-age=0";
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
