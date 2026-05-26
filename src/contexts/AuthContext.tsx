import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, Identity } from '../types';

interface AuthState {
  isLoggedIn: boolean;
  coupleCode: string;
  identity: Identity | null;
  user: User | null;
  partner: User | null;
}

interface AuthContextType extends AuthState {
  login: (code: string, identity: Identity) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  updatePartner: (partner: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'love-supply-auth';

function loadState(): AuthState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { isLoggedIn: false, coupleCode: '', identity: null, user: null, partner: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const login = (code: string, identity: Identity) => {
    // Create demo users based on identity
    const me: User = {
      id: identity === 'me' ? 'user_1' : 'user_2',
      nickname: identity === 'me' ? '小可爱' : '大笨蛋',
      avatar: identity === 'me' ? '🐰' : '🐻',
      coins: 50,
      mood: '😊',
      partnerId: identity === 'me' ? 'user_2' : 'user_1',
      coupleCode: code,
    };
    const partner: User = {
      id: identity === 'me' ? 'user_2' : 'user_1',
      nickname: identity === 'me' ? '大笨蛋' : '小可爱',
      avatar: identity === 'me' ? '🐻' : '🐰',
      coins: 50,
      mood: '😊',
      partnerId: identity === 'me' ? 'user_1' : 'user_2',
      coupleCode: code,
    };
    setState({
      isLoggedIn: true,
      coupleCode: code,
      identity,
      user: me,
      partner,
    });
  };

  const logout = () => {
    setState({ isLoggedIn: false, coupleCode: '', identity: null, user: null, partner: null });
  };

  const updateUser = (updates: Partial<User>) => {
    setState(prev => prev.user ? { ...prev, user: { ...prev.user, ...updates } } : prev);
  };

  const updatePartner = (partner: User) => {
    setState(prev => ({ ...prev, partner }));
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser, updatePartner }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
