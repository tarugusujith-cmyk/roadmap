import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getOne, list } from '../api';
import type { User } from '../types';

const KEY = 'productpulse.userId';

interface AuthCtx {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem(KEY);
    if (!id) { setReady(true); return; }
    getOne<User>('users', id)
      .then(setUser)
      .catch(() => localStorage.removeItem(KEY))
      .finally(() => setReady(true));
  }, []);

  const login = async (email: string, password: string) => {
    const matches = await list<User>('users', { email: email.trim().toLowerCase() });
    const found = matches.find((u) => u.password === password);
    if (!found) throw new Error('Incorrect email or password.');
    localStorage.setItem(KEY, String(found.id));
    setUser(found);
  };
  const logout = () => { localStorage.removeItem(KEY); setUser(null); };

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}
