import axios, { type AxiosRequestConfig } from 'axios';

function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  // When running in the browser on remote domains (e.g., Vercel), route requests via relative '/api/v1'
  // so requests go through the Vercel reverse-proxy, making cookies same-origin from the browser's view.
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost && envUrl && envUrl.startsWith('http')) {
      return '/api/v1';
    }
  }
  return envUrl || '/api/v1';
}

export const API_BASE_URL = getApiBaseUrl();

// ─── Legacy Purge ─────────────────────────────────────────────────────────────
// Wipe any tokens that may have been previously stored in JS-accessible storage.
// Tokens must ONLY live in HttpOnly cookies — never in localStorage/sessionStorage.
if (typeof window !== 'undefined') {
  sessionStorage.removeItem('knowflow_session_token');
  sessionStorage.removeItem('knowflow_session_refresh');
  sessionStorage.removeItem('kf_access');
  sessionStorage.removeItem('kf_refresh');
  localStorage.removeItem('knowflow_session_token');
  localStorage.removeItem('knowflow_session_refresh');
  localStorage.removeItem('knowflow_access_token');
  localStorage.removeItem('knowflow_refresh_token');
}

/**
 * Utility to extract a cookie value by name from document.cookie.
 * Only works for non-HttpOnly cookies (e.g., the CSRF double-submit cookie).
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
  // withCredentials sends HttpOnly cookies automatically on every request.
  // This is the ONLY secure way to transport JWTs in a browser — no JS access to tokens.
  withCredentials: true,
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attaches the CSRF double-submit token on state-mutating methods.
// The access JWT travels automatically via HttpOnly cookie — no manual attachment needed.
apiClient.interceptors.request.use(
  (config) => {
    const method = config.method?.toUpperCase() || 'GET';
    const url = config.url || '';

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = getCookie('knowflow_csrf') || getCookie('__Secure-knowflow_csrf');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
        console.log(
          `%c[KnowFlow Auth] 🍪 HttpOnly Cookie + CSRF Attached (${method} ${url})`,
          'color: #2E6F5E; font-weight: 600;'
        );
      }
    } else {
      console.log(
        `%c[KnowFlow Auth] 🍪 HttpOnly Cookie Transport (${method} ${url})`,
        'color: #2E6F5E; font-weight: 500;'
      );
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
// Handles silent token refresh when the access token HttpOnly cookie expires (401).
// The refresh token is transmitted strictly via its own HttpOnly cookie.
apiClient.interceptors.response.use(
  (response) => {
    const authSource = response.headers['x-auth-source'];
    if (authSource) {
      console.info(
        `%c[KnowFlow Auth] 🍪 Server Verified via HttpOnly Cookie (${response.config.method?.toUpperCase()} ${response.config.url})`,
        'color: #2E6F5E; font-weight: bold;'
      );
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const requestUrl = originalRequest.url || '';

      const isSkipUrl = REFRESH_SKIP_URLS.some(
        (skipUrl) => requestUrl.includes(skipUrl) || requestUrl.endsWith(skipUrl.replace(/^\//, ''))
      );

      if (isSkipUrl) {
        if (requestUrl.includes('/auth/refresh/')) {
          console.warn('[KnowFlow Auth] Refresh cookie expired or invalid. Logging out.');
          localStorage.removeItem('knowflow_user');
          window.dispatchEvent(new Event('knowflow_auth_logout'));
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
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
          '%c[KnowFlow Auth] 🔄 Refreshing session via HttpOnly Refresh Cookie...',
          'color: #6366F1; font-weight: 600;'
        );

        // Refresh token travels via HttpOnly cookie automatically (withCredentials: true).
        // Empty body is intentional — the backend reads the cookie, not the body.
        await axios.post(
          `${API_BASE_URL}/auth/refresh/`,
          {},
          { withCredentials: true }
        );

        console.info('%c[KnowFlow Auth] ✅ Session Refreshed via HttpOnly Cookies', 'color: #2E6F5E; font-weight: bold;');
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshErr) {
        console.error('[KnowFlow Auth] ❌ Session Refresh Failed:', refreshErr);
        processQueue(refreshErr);
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
