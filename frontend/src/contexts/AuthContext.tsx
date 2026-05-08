import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'admin' | 'teacher' | 'parent';
  schoolId: string;
  preferredLanguage: 'ar' | 'fr';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function extractUserFromToken(token: string): User | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  return {
    id: payload.sub as string,
    email: payload.email as string,
    firstName: payload.firstName as string,
    lastName: payload.lastName as string,
    role: payload.role as User['role'],
    schoolId: payload.schoolId as string,
    preferredLanguage: (payload.preferredLanguage as User['preferredLanguage']) || 'fr',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Initialize auth state from stored token
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      try {
        const user = JSON.parse(storedUser) as User;
        setState({ user, isAuthenticated: true, isLoading: false });
      } catch {
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    } else if (token) {
      // Fallback: try to extract from token (may have limited info)
      const user = extractUserFromToken(token);
      setState({ user, isAuthenticated: !!user, isLoading: false });
    } else {
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  // Listen for forced logout events (e.g., from API client on refresh failure)
  useEffect(() => {
    const handleLogout = () => {
      setState({ user: null, isAuthenticated: false, isLoading: false });
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiClient.post<{
      accessToken: string;
      refreshToken: string;
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: User['role'];
        schoolId: string;
        preferredLanguage?: User['preferredLanguage'];
      };
    }>(
      '/auth/login',
      { email, password },
      { skipAuth: true } as RequestInit,
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Login failed');
    }

    const { accessToken, refreshToken, user: userData } = response.data;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);

    // Store user data in localStorage so we can restore it on page refresh
    const user: User = {
      id: userData.id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      schoolId: userData.schoolId,
      preferredLanguage: userData.preferredLanguage || 'fr',
    };
    localStorage.setItem('user', JSON.stringify(user));

    setState({ user, isAuthenticated: true, isLoading: false });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Proceed with local logout even if server call fails
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  const setTokens = useCallback((accessToken: string, refreshToken: string) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    const user = extractUserFromToken(accessToken);
    setState({ user, isAuthenticated: true, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setTokens }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
