import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, apiErrorMessage } from '../api/client';
import type { Household, Member } from '../types';

interface Me {
  id: number;
  name: string;
  color: string;
}

interface AuthContextValue {
  user: Me | null;
  household: Household | null;
  members: Member[];
  loading: boolean;
  checkCode: (code: string) => Promise<Member[]>;
  enter: (code: string, name: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setHousehold(null);
      setMembers([]);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setHousehold(res.data.household);
      setMembers(res.data.members);
    } catch {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Household membership can change from the partner's device (e.g. they just
  // entered their name for the first time) without any action in this tab, so
  // re-sync periodically and whenever the tab regains focus rather than only
  // once at login.
  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const interval = setInterval(refresh, 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(interval);
    };
  }, [refresh, user]);

  const checkCode = useCallback(async (code: string) => {
    try {
      const res = await api.post('/auth/check', { code });
      return res.data.members as Member[];
    } catch (err) {
      throw new Error(apiErrorMessage(err, 'Incorrect code'));
    }
  }, []);

  const enter = useCallback(
    async (code: string, name: string) => {
      try {
        const res = await api.post('/auth/enter', { code, name });
        localStorage.setItem('token', res.data.token);
        await refresh();
      } catch (err) {
        throw new Error(apiErrorMessage(err, 'Could not continue'));
      }
    },
    [refresh]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    setHousehold(null);
    setMembers([]);
  }, []);

  return (
    <AuthContext.Provider value={{ user, household, members, loading, checkCode, enter, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
