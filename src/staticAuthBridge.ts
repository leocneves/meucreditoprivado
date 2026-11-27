import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './utils/firebase';
import { syncAuthCache, type CachedAuthUser } from './utils/authCache';
import { recordUserLead } from './utils/authLead';

const ADMIN_EMAILS = ['neves.leonardoc@gmail.com'];
const POSTHOG_KEY = 'phc_DmT88xtTtZeJqtLN7M7k7TM2PrWUtNz3B465c9ZfTwV8';
const POSTHOG_CAPTURE_URL = 'https://us.i.posthog.com/capture/';
const POSTHOG_DID_KEY = 'fixdata_ph_did';

/** Sends a lightweight PostHog login beacon from pure static pages without bundling posthog-js. */
function trackStaticLoginBeacon(uid: string, email: string, displayName: string, origin: string): void {
  if (typeof window === 'undefined') return;
  try {
    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase().trim());
    if (isAdmin) {
      localStorage.setItem('fixdata_is_admin', 'true');
      return;
    }
    if (localStorage.getItem('fixdata_is_admin') === 'true') return;

    localStorage.setItem(POSTHOG_DID_KEY, uid);
    if (typeof fetch !== 'function') return;

    fetch(POSTHOG_CAPTURE_URL, {
      method: 'POST',
      mode: 'cors',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: 'user_logged_in',
        distinct_id: uid,
        properties: {
          origin: `static_${origin}`,
          $current_url: window.location.href,
          $pathname: window.location.pathname,
          $lib: 'fixdata-static-auth',
          $process_person_profile: true,
          $set: {
            email,
            name: displayName,
          },
        },
      }),
    }).catch(() => {});
  } catch (_) {}
}

/**
 * Triggers Google OAuth popup from non-React static pages (/noticias, hubs, etc.),
 * stores the lead in Firestore, and updates the shared localStorage navbar snapshot.
 */
export async function staticLoginWithGoogle(origin = 'navbar'): Promise<CachedAuthUser | null> {
  if (!isFirebaseConfigured || !auth || !googleProvider) {
    alert('Configuração do Firebase não encontrada.');
    return null;
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const loggedUser = result.user;
    if (!loggedUser) return null;

    syncAuthCache(loggedUser);
    await recordUserLead(loggedUser, origin);
    trackStaticLoginBeacon(
      loggedUser.uid,
      loggedUser.email || '',
      loggedUser.displayName || '',
      origin
    );

    return {
      uid: loggedUser.uid,
      displayName: loggedUser.displayName || '',
      email: loggedUser.email || '',
      photoURL: loggedUser.photoURL || '',
    };
  } catch (err: any) {
    if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
      return null;
    }
    console.error('Erro ao realizar login com Google:', err);
    throw err;
  }
}

/**
 * Signs out of Firebase Auth from non-React static pages and clears cached display state.
 */
export async function staticLogout(): Promise<void> {
  if (auth) {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  }
  syncAuthCache(null);
  try {
    localStorage.removeItem(POSTHOG_DID_KEY);
  } catch (_) {}
}
