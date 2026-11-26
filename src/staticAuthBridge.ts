import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './utils/firebase';
import { syncAuthCache, type CachedAuthUser } from './utils/authCache';
import { recordUserLead } from './utils/authLead';

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
}
