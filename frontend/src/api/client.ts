import axios, { type AxiosRequestConfig } from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// In-memory / session storage token helpers for dual-transport resilience
const TOKEN_KEY = 'knowflow_session_token';
const REFRESH_KEY = 'knowflow_session_refresh';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(REFRESH_KEY) || localStorage.getItem(REFRESH_KEY);
}

export function setAuthTokens(access?: string | null, refresh?: string | null) {
  if (typeof window === 'undefined') return;
  if (access) {
    sessionStorage.setItem(TOKEN_KEY, access);
  }
  if (refresh) {
    sessionStorage.setItem(REFRESH_KEY, refresh);
  }
}

export function clearAuthTokens() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/**
 * Utility to extract a cookie value by name from document.cookie.
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Automatically sends secure HttpOnly cookies across all REST requests
});

// Request interceptor to attach Bearer header and CSRF double-submit token
apiClient.interceptors.request.use(
  (config) => {
    const method = config.method?.toUpperCase() || 'GET';
    const url = config.url || '';
    const token = getAccessToken();
    const hasBearer = Boolean(token);

    // 1. Attach Bearer token fallback if available (essential when cross-domain third-party cookies are partitioned)
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. Attach CSRF token on mutating requests
    let hasCsrf = false;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = getCookie('knowflow_csrf') || getCookie('__Secure-knowflow_csrf');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
        hasCsrf = true;
      }
    }

    // Log diagnostic transport info to console
    if (hasBearer && hasCsrf) {
      console.log(
        `%c[KnowFlow Auth] 🛡️ Dual-Transport (${method} ${url}): HttpOnly Cookie + CSRF Header + Bearer Fallback attached`,
        'color: #2E6F5E; font-weight: 600;'
      );
    } else if (hasBearer) {
      console.log(
        `%c[KnowFlow Auth] 🔑 Fallback Mode (${method} ${url}): Bearer Token Header attached`,
        'color: #D97706; font-weight: 600;'
      );
    } else if (hasCsrf) {
      console.log(
        `%c[KnowFlow Auth] 🍪 Cookie Mode (${method} ${url}): HttpOnly Cookie + CSRF Double-Submit attached`,
        'color: #2563EB; font-weight: 600;'
      );
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Concurrency-safe Token Refresh Queue
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// Endpoints that should never trigger automatic 401 refresh (loop guards)
const REFRESH_SKIP_URLS = [
  '/auth/refresh/',
  '/auth/login/',
  '/auth/register/',
  '/auth/google/',
  '/auth/me/',
];

// Response interceptor to handle silent token refresh via both HttpOnly cookies and payload fallback
apiClient.interceptors.response.use(
  (response) => {
    // Log server verification source from backend X-Auth-Source header
    const authSource = response.headers['x-auth-source'];
    if (authSource) {
      if (authSource === 'cookie') {
        console.info(
          `%c[KnowFlow Auth] 🍪 Server Verified: Authenticated via HttpOnly Cookie (${response.config.method?.toUpperCase()} ${response.config.url})`,
          'color: #2E6F5E; font-weight: bold;'
        );
      } else if (authSource === 'header') {
        console.info(
          `%c[KnowFlow Auth] 🔑 Server Verified: Authenticated via Bearer Header Fallback (${response.config.method?.toUpperCase()} ${response.config.url})`,
          'color: #D97706; font-weight: bold;'
        );
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // If 401 and request has not already been retried
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const requestUrl = originalRequest.url || '';

      // Loop guard: Skip auth probe endpoints to prevent infinite refresh cycles
      const isSkipUrl = REFRESH_SKIP_URLS.some(
        (skipUrl) => requestUrl.includes(skipUrl) || requestUrl.endsWith(skipUrl.replace(/^\//, ''))
      );

      if (isSkipUrl) {
        if (requestUrl.includes('/auth/refresh/')) {
          console.warn('[KnowFlow Auth] Session refresh failed or unauthenticated. Logging out.');
          clearAuthTokens();
          localStorage.removeItem('knowflow_user');
          window.dispatchEvent(new Event('knowflow_auth_logout'));
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue parallel requests until the first refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => apiClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();
        console.log(
          `%c[KnowFlow Auth] 🔄 Token Refreshing: ${refreshToken ? 'Sending Refresh Payload + HttpOnly Cookies' : 'Using HttpOnly Cookies'}`,
          'color: #6366F1; font-weight: 600;'
        );

        // Send refresh token both via HttpOnly cookie AND body payload for maximum browser compatibility
        const refreshPayload = refreshToken ? { refresh: refreshToken } : {};

        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh/`,
          refreshPayload,
          { withCredentials: true }
        );

        const newAccess = res.data?.data?.access || res.data?.access;
        const newRefresh = res.data?.data?.refresh || res.data?.refresh;
        if (newAccess) {
          setAuthTokens(newAccess, newRefresh);
        }

        console.info('%c[KnowFlow Auth] ✅ Token Refreshed Successfully', 'color: #2E6F5E; font-weight: bold;');
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshErr) {
        console.error('[KnowFlow Auth] ❌ Token Refresh Failed:', refreshErr);
        processQueue(refreshErr);
        clearAuthTokens();
        localStorage.removeItem('knowflow_user');
        window.dispatchEvent(new Event('knowflow_auth_logout'));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

