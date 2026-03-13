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

export function saveAuth(token: string, user: StoredUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Presence cookie read by Next.js proxy (middleware) for server-side route protection
  document.cookie = "smartsoma_auth=1; path=/; max-age=172800; SameSite=Lax";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
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
