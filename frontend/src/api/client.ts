import axios, { type AxiosRequestConfig } from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

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
    const method = config.method?.toUpperCase();
    if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = getCookie('knowflow_csrf') || getCookie('__Secure-knowflow_csrf');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
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
  (response) => response,
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
        // Refresh token is transmitted via HttpOnly cookie
        await axios.post(
          `${API_BASE_URL}/auth/refresh/`,
          {},
          { withCredentials: true }
        );

        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshErr) {
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
