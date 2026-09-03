const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface ApiError {
  code: string;
  message: string;
  details?: { field: string; message: string }[];
  meta?: Record<string, unknown>;
}

/**
 * Thrown by hooks that need callers to branch on the API error code/meta,
 * not just display a message (e.g. offering to restore a soft-deleted record).
 */
export class ApiRequestError extends Error {
  code: string;
  meta?: Record<string, unknown>;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.code = error.code;
    this.meta = error.meta;
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: { page: number; pageSize: number; total: number; totalPages: number };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  }

  private clearTokens(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  private async refreshAccessToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        this.clearTokens();
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return null;
      }

      const data = await response.json();
      if (data.success && data.data.accessToken) {
        this.setTokens(data.data.accessToken, data.data.refreshToken || refreshToken);
        // Notify listeners (e.g. the socket connection) that the access token
        // changed so they can re-authenticate with the fresh token.
        window.dispatchEvent(new CustomEvent('auth:token-refreshed'));
        return data.data.accessToken;
      }

      return null;
    } catch {
      this.clearTokens();
      return null;
    }
  }

  private async buildHeaders(customHeaders?: Record<string, string>): Promise<Headers> {
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...customHeaders,
    });

    const token = this.getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit & { skipAuth?: boolean } = {},
  ): Promise<ApiResponse<T>> {
    const { skipAuth, headers: customHeaders, ...fetchOptions } = options;

    const headers = skipAuth
      ? new Headers({ 'Content-Type': 'application/json', ...(customHeaders as Record<string, string>) })
      : await this.buildHeaders(customHeaders as Record<string, string>);

    const url = `${this.baseUrl}${endpoint}`;

    let response = await fetch(url, { ...fetchOptions, headers });

    // Handle 401 — attempt token refresh
    if (response.status === 401 && !skipAuth) {
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        response = await fetch(url, { ...fetchOptions, headers });
      } else {
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' },
        };
      }
    }

    const data: ApiResponse<T> = await response.json();
    return data;
  }

  /**
   * Forces an access-token refresh using the stored refresh token. Returns the
   * new access token, or null if refresh failed. Used by the socket connection
   * to recover from an expired token without a full page reload.
   */
  async refreshSession(): Promise<string | null> {
    return this.refreshAccessToken();
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * POST a FormData body (file upload). Unlike request(), this never forces a
   * Content-Type header — the browser must set the multipart boundary itself —
   * but still gets the same 401 -> refresh -> retry handling as JSON requests.
   */
  async uploadFile<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const buildAuthHeaders = () => {
      const headers = new Headers();
      const token = this.getAccessToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    };

    let response = await fetch(url, { method: 'POST', headers: buildAuthHeaders(), body: formData });

    if (response.status === 401) {
      const newToken = await this.refreshAccessToken();
      if (!newToken) {
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' },
        };
      }
      response = await fetch(url, { method: 'POST', headers: buildAuthHeaders(), body: formData });
    }

    return response.json();
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export type { ApiResponse, ApiError };
