import axios, { type AxiosRequestConfig } from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('knowflow_access_token');
    if (token && token !== 'undefined' && token !== 'null') {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Concurrency-safe Token Refresh Queue
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to handle silent token refresh with rotation
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // If 401 and request has not already been retried
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // If the failing request was the refresh endpoint itself, logout immediately
      if (originalRequest.url?.includes('/auth/refresh/')) {
        localStorage.removeItem('knowflow_access_token');
        localStorage.removeItem('knowflow_refresh_token');
        localStorage.removeItem('knowflow_user');
        window.dispatchEvent(new Event('knowflow_auth_logout'));
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem('knowflow_refresh_token');
      if (!refreshToken || refreshToken === 'undefined' || refreshToken === 'null') {
        localStorage.removeItem('knowflow_access_token');
        localStorage.removeItem('knowflow_refresh_token');
        localStorage.removeItem('knowflow_user');
        window.dispatchEvent(new Event('knowflow_auth_logout'));
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue parallel requests until the first refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
          refresh: refreshToken,
        });

        // Handle both wrapped { data: { access, refresh } } and flat { access, refresh } responses
        const payload = res.data?.data || res.data || {};
        const newAccess = payload.access;
        const newRefresh = payload.refresh;

        if (!newAccess) {
          throw new Error('No access token returned from refresh endpoint');
        }

        localStorage.setItem('knowflow_access_token', newAccess);
        if (newRefresh) {
          localStorage.setItem('knowflow_refresh_token', newRefresh);
        }

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        }

        processQueue(null, newAccess);
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('knowflow_access_token');
        localStorage.removeItem('knowflow_refresh_token');
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
