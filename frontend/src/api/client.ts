import axios, { type AxiosRequestConfig } from 'axios';

function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  // When running in the browser on remote domains (e.g., Vercel), route requests via relative '/api/v1'
  // so requests go through the Vercel reverse-proxy, ensuring first-party cookies without cross-origin blocking.
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost && envUrl && envUrl.startsWith('http')) {
      return '/api/v1';
    }
  }
  return envUrl || '/api/v1';
}

export const API_BASE_URL = getApiBaseUrl();

// ─── Token Storage Helpers ───────────────────────────────────────────────────
// Tokens are stored in sessionStorage (tab-scoped, cleared on tab close)
// to survive within the session while avoiding XSS risks of localStorage.

const ACCESS_KEY = 'kf_access';
const REFRESH_KEY = 'kf_refresh';

export function storeTokens(access: string, refresh?: string) {
  if (access) sessionStorage.setItem(ACCESS_KEY, access);
  if (refresh) sessionStorage.setItem(REFRESH_KEY, refresh);
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY);
}

export function clearTokens() {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

// ─── Legacy Purge ─────────────────────────────────────────────────────────────
// One-time startup purge: Ensure zero raw JWT tokens remain in old browser storage keys
if (typeof window !== 'undefined') {
  sessionStorage.removeItem('knowflow_session_token');
  sessionStorage.removeItem('knowflow_session_refresh');
  localStorage.removeItem('knowflow_session_token');
  localStorage.removeItem('knowflow_session_refresh');
  localStorage.removeItem('knowflow_access_token');
  localStorage.removeItem('knowflow_refresh_token');
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

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attaches Bearer token (primary) and CSRF double-submit token on mutating methods.
apiClient.interceptors.request.use(
  (config) => {
    const method = config.method?.toUpperCase() || 'GET';
    const url = config.url || '';

    // 1. Always attach stored access token as Authorization: Bearer (most reliable for proxy setups)
    const accessToken = getAccessToken();
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
      console.log(
        `%c[KnowFlow Auth] 🔑 Bearer Token Attached (${method} ${url})`,
        'color: #2E6F5E; font-weight: 600;'
      );
    }

    // 2. Also attach CSRF double-submit token on mutating methods (for cookie-based auth fallback)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = getCookie('knowflow_csrf') || getCookie('__Secure-knowflow_csrf');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
        console.log(
          `%c[KnowFlow Auth] 🍪 CSRF Token Attached (${method} ${url})`,
          'color: #2E6F5E; font-weight: 600;'
        );
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Concurrency-safe Token Refresh Queue ─────────────────────────────────────
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

// ─── Response Interceptor ─────────────────────────────────────────────────────
// Handles silent token refresh when access token expires (401).
apiClient.interceptors.response.use(
  (response) => {
    // Log server verification source from backend X-Auth-Source header
    const authSource = response.headers['x-auth-source'];
    if (authSource) {
      console.info(
        `%c[KnowFlow Auth] ✅ Server Verified: ${authSource} (${response.config.method?.toUpperCase()} ${response.config.url})`,
        'color: #2E6F5E; font-weight: bold;'
      );
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
          console.warn('[KnowFlow Auth] Session refresh failed. Logging out.');
          clearTokens();
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
        console.log(
          '%c[KnowFlow Auth] 🔄 Refreshing session...',
          'color: #6366F1; font-weight: 600;'
        );

        const storedRefresh = getRefreshToken();

        // Send refresh token in request body (primary) and rely on HttpOnly cookie (fallback)
        const refreshRes = await axios.post(
          `${API_BASE_URL}/auth/refresh/`,
          storedRefresh ? { refresh: storedRefresh } : {},
          { withCredentials: true }
        );

        // Store new tokens if returned in response body
        const newAccess = refreshRes.data?.data?.access || refreshRes.data?.access;
        const newRefresh = refreshRes.data?.data?.refresh || refreshRes.data?.refresh;
        if (newAccess) {
          storeTokens(newAccess, newRefresh);
          console.info('%c[KnowFlow Auth] ✅ Session Refreshed', 'color: #2E6F5E; font-weight: bold;');
        }

        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshErr) {
        console.error('[KnowFlow Auth] ❌ Session Refresh Failed:', refreshErr);
        processQueue(refreshErr);
        clearTokens();
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
