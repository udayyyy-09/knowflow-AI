export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  auth_provider?: 'email' | 'google';
  avatar_url?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthResponse {
  success: boolean;
  user: User;
  tokens: AuthTokens;
  message?: string;
}
