import axios, { type AxiosRequestConfig } from 'axios';

function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  // On Vercel, route via relative /api/v1 so the edge BFF proxy handles auth cookies.
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost && envUrl && envUrl.startsWith('http')) {
      return '/api/v1';
    }
  }
  return envUrl || '/api/v1';
}

export const API_BASE_URL = getApiBaseUrl();

// ─── Legacy storage purge ─────────────────────────────────────────────────────
// Wipe any tokens that may have been stored by previous builds.
// Auth tokens now live exclusively in edge-managed HttpOnly cookies (kf_at, kf_rt).
if (typeof window !== 'undefined') {
  const STALE_KEYS = [
    'kf_access', 'kf_refresh',
    'knowflow_session_token', 'knowflow_session_refresh',
    'knowflow_access_token', 'knowflow_refresh_token',
  ];
  STALE_KEYS.forEach(k => { sessionStorage.removeItem(k); localStorage.removeItem(k); });
}

/**
 * Read a non-HttpOnly cookie by name (used only for CSRF double-submit token).
 * JWT tokens (kf_at, kf_rt) are HttpOnly and invisible to this function — by design.
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[2]) : null;
}

// ─── Axios instance ───────────────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // withCredentials ensures the browser sends kf_at / kf_rt HttpOnly cookies
  // on every request to the Vercel edge proxy (same-origin).
  // The edge proxy reads those cookies and injects Authorization: Bearer before
  // forwarding to the Render backend. The frontend never sees the raw tokens.
  withCredentials: true,
});

// ─── Request interceptor ──────────────────────────────────────────────────────
// The edge proxy handles Bearer token injection. This interceptor only needs to
// attach the CSRF double-submit cookie value (non-HttpOnly, readable by JS) on
// mutating requests for cookie-authenticated sessions.
apiClient.interceptors.request.use(
  (config) => {
    const method = config.method?.toUpperCase() || 'GET';
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = getCookie('knowflow_csrf') || getCookie('__Secure-knowflow_csrf');
      if (csrf) config.headers['X-CSRF-Token'] = csrf;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

// ─── Token refresh queue ──────────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: { resolve: (v?: any) => void; reject: (e: any) => void }[] = [];

const processQueue = (error: any) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve());
  failedQueue = [];
};

// Skip refresh attempt on these endpoints to prevent infinite loops
const REFRESH_SKIP_URLS = [
  '/auth/refresh/', '/auth/login/', '/auth/register/', '/auth/google/', '/auth/me/',
];

// ─── Response interceptor ─────────────────────────────────────────────────────
// On 401: ask the edge proxy to perform a silent token refresh.
// The edge proxy reads kf_rt (HttpOnly refresh cookie), sends it in the body
// to /auth/refresh/, gets new tokens, and sets fresh kf_at/kf_rt cookies.
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const orig = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status !== 401 || !orig || orig._retry) return Promise.reject(error);

    const url = orig.url || '';
    if (REFRESH_SKIP_URLS.some(s => url.includes(s))) {
      if (url.includes('/auth/refresh/')) {
        // Refresh token also expired — log out
        localStorage.removeItem('knowflow_user');
        window.dispatchEvent(new Event('knowflow_auth_logout'));
      }
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
        .then(() => apiClient(orig))
        .catch(e => Promise.reject(e));
    }

    orig._retry   = true;
    isRefreshing  = true;

    try {
      // POST to /auth/refresh/ with empty body.
      // The edge proxy intercepts this, reads kf_rt cookie, injects refresh token in body,
      // sends to Render, and sets fresh kf_at + kf_rt HttpOnly cookies on the response.
      await axios.post(`${API_BASE_URL}/auth/refresh/`, {}, { withCredentials: true });
      processQueue(null);
      return apiClient(orig);
    } catch (e) {
      processQueue(e);
      localStorage.removeItem('knowflow_user');
      window.dispatchEvent(new Event('knowflow_auth_logout'));
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);
