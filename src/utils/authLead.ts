import type { User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Persists or updates the authenticated user's lead record in Firestore.
 */
export async function recordUserLead(loggedUser: User, origin = 'geral'): Promise<void> {
  if (!db || !loggedUser) return;
  try {
    const leadRef = doc(db, 'leads', loggedUser.uid);
    await setDoc(
      leadRef,
      {
        uid: loggedUser.uid,
        email: loggedUser.email,
        displayName: loggedUser.displayName,
        photoURL: loggedUser.photoURL,
        origin,
        lastLoginAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (dbErr) {
    console.warn('Aviso: Não foi possível salvar lead no Firestore:', dbErr);
  }
}
