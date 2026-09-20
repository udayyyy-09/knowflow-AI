import axios, { type AxiosRequestConfig } from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// One-time startup purge: Ensure zero JWT tokens remain in browser storage
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

// Request interceptor to attach CSRF double-submit token on mutating methods
apiClient.interceptors.request.use(
  (config) => {
    const method = config.method?.toUpperCase() || 'GET';
    const url = config.url || '';

    // Attach CSRF double-submit token on mutating methods
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

// Response interceptor to handle silent token refresh via HttpOnly cookies
apiClient.interceptors.response.use(
  (response) => {
    // Log server verification source from backend X-Auth-Source header
    const authSource = response.headers['x-auth-source'];
    if (authSource) {
      console.info(
        `%c[KnowFlow Auth] 🍪 Server Verified: Authenticated via HttpOnly Cookie (${response.config.method?.toUpperCase()} ${response.config.url})`,
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
          console.warn('[KnowFlow Auth] Session refresh failed or unauthenticated. Logging out.');
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
          '%c[KnowFlow Auth] 🔄 Refreshing session via HttpOnly Refresh Cookie...',
          'color: #6366F1; font-weight: 600;'
        );

        // Refresh token is transmitted strictly via HttpOnly cookie
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

