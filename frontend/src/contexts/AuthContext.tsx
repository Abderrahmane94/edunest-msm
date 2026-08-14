import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'admin' | 'teacher' | 'parent';
  schoolId: string | null;
  preferredLanguage: 'ar' | 'fr';
  mustChangePassword?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginSchoolOption {
  schoolId: string | null;
  schoolName: string | null;
}

export type LoginResult =
  | { status: 'success' }
  | { status: 'choiceRequired'; schools: LoginSchoolOption[] };

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, schoolId?: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearMustChangePassword: () => void;
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
    schoolId: (payload.schoolId as string | null) ?? null,
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

  const login = useCallback(async (email: string, password: string, schoolId?: string): Promise<LoginResult> => {
    const response = await apiClient.post<{
      choiceRequired?: true;
      schools?: LoginSchoolOption[];
      accessToken: string;
      refreshToken: string;
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: User['role'];
        schoolId: string | null;
        preferredLanguage?: User['preferredLanguage'];
      };
    }>(
      '/auth/login',
      { email, password, schoolId },
      { skipAuth: true } as RequestInit,
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Login failed');
    }

    if (response.data.choiceRequired) {
      return { status: 'choiceRequired', schools: response.data.schools ?? [] };
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
      mustChangePassword: (userData as any).mustChangePassword ?? false,
    };
    localStorage.setItem('user', JSON.stringify(user));

    setState({ user, isAuthenticated: true, isLoading: false });
    return { status: 'success' };
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

  const clearMustChangePassword = useCallback(() => {
    setState((prev) => {
      if (!prev.user) return prev;
      const updated = { ...prev.user, mustChangePassword: false };
      localStorage.setItem('user', JSON.stringify(updated));
      return { ...prev, user: updated };
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setTokens, clearMustChangePassword }}>
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
