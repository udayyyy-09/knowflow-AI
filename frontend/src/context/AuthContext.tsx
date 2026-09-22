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
    // Wipe any tokens that may have been stored in JS-accessible storage from previous builds.
    // JWTs must ONLY live in HttpOnly cookies — not in localStorage or sessionStorage.
    sessionStorage.removeItem('knowflow_session_token');
    sessionStorage.removeItem('knowflow_session_refresh');
    sessionStorage.removeItem('kf_access');
    sessionStorage.removeItem('kf_refresh');
    localStorage.removeItem('knowflow_session_token');
    localStorage.removeItem('knowflow_session_refresh');
    localStorage.removeItem('knowflow_access_token');
    localStorage.removeItem('knowflow_refresh_token');

    // Verify active session with backend via HttpOnly cookies.
    // If the access cookie is valid, the backend returns the user profile.
    const checkAuth = async () => {
      try {
        const currentUser = await authApi.getMe();
        if (currentUser && currentUser.id) {
          setUser(currentUser);
          localStorage.setItem('knowflow_user', JSON.stringify(currentUser));
        } else {
          setUser(null);
          localStorage.removeItem('knowflow_user');
        }
      } catch {
        setUser(null);
        localStorage.removeItem('knowflow_user');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    const handleLogoutEvent = () => {
      setUser(null);
      localStorage.removeItem('knowflow_user');
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
    // Tokens are set as HttpOnly cookies by the backend response.
    // We only extract the non-sensitive user profile to store in localStorage.
    const userData = res.user || res.data?.user;
    if (userData) {
      localStorage.setItem('knowflow_user', JSON.stringify(userData));
      setUser(userData);
    }
    setIsAuthModalOpen(false);
  };

  const register = async (data: { email: string; password: string; first_name?: string; last_name?: string }) => {
    const res: any = await authApi.register(data);
    // Tokens are set as HttpOnly cookies by the backend response.
    const userData = res.user || res.data?.user;
    if (userData) {
      localStorage.setItem('knowflow_user', JSON.stringify(userData));
      setUser(userData);
    }
    setIsAuthModalOpen(false);
  };

  const loginWithGoogle = async (id_token: string) => {
    const res: any = await authApi.googleAuth(id_token);
    // Tokens are set as HttpOnly cookies by the backend response.
    // The edge proxy in api/[...path].ts correctly forwards all Set-Cookie headers
    // so cookies land on the Vercel domain and are sent on all subsequent requests.
    const userData = res.user || res.data?.user;
    if (userData) {
      localStorage.setItem('knowflow_user', JSON.stringify(userData));
      setUser(userData);
    }
    setIsAuthModalOpen(false);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      localStorage.removeItem('knowflow_user');
      localStorage.removeItem('knowflow_active_workspace_id');
    }
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
