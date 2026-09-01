/**
 * Who is signed in.
 *
 * Deliberately separate from AppContext: identity decides what the app is
 * allowed to fetch at all, so it has to settle before any domain data is
 * requested. Keeping them apart also means a sign-out clears identity without
 * having to reason about half-loaded donation state.
 *
 * The token is the only thing persisted. On a reload the account itself is
 * re-fetched from `/api/auth/me` rather than restored from storage, so a
 * suspended or re-roled account cannot keep acting on a stale local copy of
 * its own permissions.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { User, UserRole } from '../types';
import { ApiError, api, getToken, setToken, setUnauthorizedHandler, type RegisterBody } from '../lib/api';
import { toUser } from '../lib/adapters';

/** Where each role lands after signing in. */
export const HOME_PATH: Record<UserRole, string> = {
  donor: '/donor',
  ngo: '/ngo',
  volunteer: '/volunteer',
  admin: '/admin',
};

interface AuthContextValue {
  user: User | null;
  /** True while the stored token is being exchanged for an account on boot. */
  isLoading: boolean;
  /** Set when a session ended on its own, so the login screen can explain why. */
  expiredMessage: string | null;
  clearExpiredMessage: () => void;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (body: RegisterBody) => Promise<User>;
  signOut: () => void;
  /** Update your own name / organisation / phone, and refresh the session copy. */
  updateProfile: (changes: { name?: string; organization?: string; phone?: string }) => Promise<void>;
  /** Change your own password, proving the current one. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => getToken() !== null);
  const [expiredMessage, setExpiredMessage] = useState<string | null>(null);

  // Guards against a 401 arriving from several in-flight requests at once and
  // announcing the expiry several times over.
  const expiring = useRef(false);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // Any request anywhere in the app can discover that the session is gone —
  // the backend re-reads the account on every request, so suspension takes
  // effect mid-session rather than at expiry.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (expiring.current) return;
      expiring.current = true;
      setUser(current => {
        if (current) setExpiredMessage('Your session ended. Please sign in again.');
        return null;
      });
      window.setTimeout(() => {
        expiring.current = false;
      }, 1000);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Boot: exchange a stored token for the account it belongs to.
  useEffect(() => {
    let cancelled = false;
    if (getToken() === null) {
      setIsLoading(false);
      return;
    }
    api
      .me()
      .then(apiUser => {
        if (!cancelled) setUser(toUser(apiUser));
      })
      .catch(() => {
        // A 401 has already cleared the token via the handler above. Anything
        // else (the backend being down) leaves the token alone so a retry can
        // succeed, but there is still nobody signed in right now.
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await api.login(email.trim(), password);
    setToken(response.accessToken);
    const signedIn = toUser(response.user);
    setUser(signedIn);
    setExpiredMessage(null);
    return signedIn;
  }, []);

  const signUp = useCallback(async (body: RegisterBody) => {
    const response = await api.register(body);
    setToken(response.accessToken);
    const created = toUser(response.user);
    setUser(created);
    setExpiredMessage(null);
    return created;
  }, []);

  const updateProfile = useCallback(
    async (changes: { name?: string; organization?: string; phone?: string }) => {
      const updated = await api.updateMe(changes);
      setUser(toUser(updated));
    },
    [],
  );

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.changePassword(currentPassword, newPassword);
  }, []);

  const clearExpiredMessage = useCallback(() => setExpiredMessage(null), []);

  const value = useMemo(
    () => ({
      user, isLoading, expiredMessage, clearExpiredMessage,
      signIn, signUp, signOut, updateProfile, changePassword,
    }),
    [
      user, isLoading, expiredMessage, clearExpiredMessage,
      signIn, signUp, signOut, updateProfile, changePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/**
 * The signed-in account, for screens that already sit behind a ProtectedRoute
 * and would otherwise have to null-check on every line.
 */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser used outside a protected route');
  return user;
}

/** Turn any thrown value into one sentence worth showing someone. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}
