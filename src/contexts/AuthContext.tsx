import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  type User,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../utils/firebase';
import { posthog, syncPostHogDistinctId } from '../utils/posthog';
import { syncAuthCache } from '../utils/authCache';
import { recordUserLead } from '../utils/authLead';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  loginWithGoogle: (origin?: string) => Promise<User | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isConfigured: false,
  loginWithGoogle: async () => null,
  logout: async () => {}
});

const ADMIN_EMAILS = ['neves.leonardoc@gmail.com'];

const checkAndHandleAdmin = (user: User | null): boolean => {
  if (!user?.email) return false;
  const isAdm = ADMIN_EMAILS.includes(user.email.toLowerCase().trim());
  if (isAdm) {
    try {
      localStorage.setItem('fixdata_is_admin', 'true');
      posthog.opt_out_capturing();
    } catch (_) {}
    return true;
  }
  return false;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      syncAuthCache(currentUser);
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        const isAdmin = checkAndHandleAdmin(currentUser);
        if (!isAdmin) {
          syncPostHogDistinctId(currentUser.uid);
          posthog.identify(currentUser.uid, {
            email: currentUser.email,
            name: currentUser.displayName
          });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async (origin = 'geral'): Promise<User | null> => {
    if (!auth || !googleProvider) {
      alert('Configuração do Firebase não encontrada. Verifique as variáveis de ambiente.');
      return null;
    }

    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const loggedUser = result.user;

      if (loggedUser) {
        syncAuthCache(loggedUser);
        await recordUserLead(loggedUser, origin);
      }

      setUser(loggedUser);
      const isAdmin = checkAndHandleAdmin(loggedUser);
      if (!isAdmin) {
        syncPostHogDistinctId(loggedUser.uid);
        posthog.identify(loggedUser.uid, {
          email: loggedUser.email,
          name: loggedUser.displayName,
          origin
        });
        posthog.capture('user_logged_in', { origin });
      }
      return loggedUser;
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user') {
        console.error('Erro ao fazer login com Google:', error);
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      posthog.reset();
      try {
        const nextDid = typeof posthog.get_distinct_id === 'function' ? posthog.get_distinct_id() : null;
        syncPostHogDistinctId(nextDid);
      } catch (_) {}
      syncAuthCache(null);
      setUser(null);
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured: isFirebaseConfigured,
        loginWithGoogle,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
