export const AUTH_CACHE_KEY = 'fixdata_auth_user';

export interface CachedAuthUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

/**
 * Mirrors minimal Firebase auth display fields to localStorage so static HTML
 * pages can render navbar session state without eagerly loading Firebase SDK.
 */
export function syncAuthCache(
  u: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null } | null
): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (u && u.uid) {
      const payload: CachedAuthUser = {
        uid: u.uid,
        displayName: u.displayName || '',
        email: u.email || '',
        photoURL: u.photoURL || '',
      };
      window.localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(payload));
    } else {
      window.localStorage.removeItem(AUTH_CACHE_KEY);
    }
  } catch {
    // Ignore storage quota or private-mode access errors.
  }
}
