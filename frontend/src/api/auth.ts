import { apiClient } from '@/api/client';
import type { User, AuthResponse } from '@/types/auth';

export const authApi = {
  async register(data: { email: string; password: string; first_name?: string; last_name?: string }): Promise<AuthResponse> {
    const res = await apiClient.post('/auth/register/', data);
    return res.data.data || res.data;
  },

  async login(data: { email: string; password: string }): Promise<AuthResponse> {
    const res = await apiClient.post('/auth/login/', data);
    return res.data.data || res.data;
  },

  async googleAuth(id_token: string): Promise<AuthResponse> {
    const res = await apiClient.post('/auth/google/', { id_token });
    return res.data.data || res.data;
  },

  async getMe(): Promise<User> {
    const res = await apiClient.get('/auth/me/');
    return res.data.data?.user || res.data.data || res.data.user || res.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout/', {});
    } catch (e) {
      console.warn('Logout API notification failed:', e);
    } finally {
      localStorage.removeItem('knowflow_user');
      localStorage.removeItem('knowflow_active_workspace_id');
      window.dispatchEvent(new Event('knowflow_auth_logout'));
    }
  }
};
