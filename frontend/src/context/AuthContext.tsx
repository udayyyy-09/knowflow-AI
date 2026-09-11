import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/types/auth';
import { authApi } from '@/api/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  authModalMode: 'login' | 'register';
  login: (data: { email: string; password: string }) => Promise<void>;
  register: (data: { email: string; password: string; first_name?: string; last_name?: string }) => Promise<void>;
  loginWithGoogle: (id_token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('knowflow_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('knowflow_access_token');
      if (token) {
        try {
          const currentUser = await authApi.getMe();
          setUser(currentUser);
          localStorage.setItem('knowflow_user', JSON.stringify(currentUser));
        } catch (e) {
          setUser(null);
          localStorage.removeItem('knowflow_access_token');
          localStorage.removeItem('knowflow_user');
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };

    checkAuth();

    const handleLogoutEvent = () => {
      setUser(null);
      setIsAuthModalOpen(true);
    };

    window.addEventListener('knowflow_auth_logout', handleLogoutEvent);
    return () => window.removeEventListener('knowflow_auth_logout', handleLogoutEvent);
  }, []);

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const login = async (data: { email: string; password: string }) => {
    const res: any = await authApi.login(data);
    const tokens = res.tokens || res.data?.tokens;
    const userData = res.user || res.data?.user;
    if (tokens?.access) {
      localStorage.setItem('knowflow_access_token', tokens.access);
      localStorage.setItem('knowflow_refresh_token', tokens.refresh);
    }
    if (userData) {
      localStorage.setItem('knowflow_user', JSON.stringify(userData));
      setUser(userData);
    }
    setIsAuthModalOpen(false);
  };

  const register = async (data: { email: string; password: string; first_name?: string; last_name?: string }) => {
    const res: any = await authApi.register(data);
    const tokens = res.tokens || res.data?.tokens;
    const userData = res.user || res.data?.user;
    if (tokens?.access) {
      localStorage.setItem('knowflow_access_token', tokens.access);
      localStorage.setItem('knowflow_refresh_token', tokens.refresh);
    }
    if (userData) {
      localStorage.setItem('knowflow_user', JSON.stringify(userData));
      setUser(userData);
    }
    setIsAuthModalOpen(false);
  };

  const loginWithGoogle = async (id_token: string) => {
    const res: any = await authApi.googleAuth(id_token);
    const tokens = res.tokens || res.data?.tokens;
    const userData = res.user || res.data?.user;
    if (tokens?.access) {
      localStorage.setItem('knowflow_access_token', tokens.access);
      localStorage.setItem('knowflow_refresh_token', tokens.refresh);
    }
    if (userData) {
      localStorage.setItem('knowflow_user', JSON.stringify(userData));
      setUser(userData);
    }
    setIsAuthModalOpen(false);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loading: isLoading,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        authModalMode,
        login,
        register,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
