import { apiClient } from './api-client.js';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'student' | 'admin' | 'judge';
  };
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    role: 'student' | 'admin' | 'judge';
  };
}

/**
 * Auth API client — handles authentication endpoints.
 * Token management is automatic via HTTP-only cookies.
 */
export class AuthApiClient {
  /**
   * POST /auth/login
   * Login with email and password.
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', {
      email,
      password,
    });
    if (!response.success) {
      throw new Error(response.error?.message || 'Login failed');
    }
    return response.data;
  }

  /**
   * POST /auth/register
   * Register a new account.
   */
  async register(data: {
    email: string;
    password: string;
    name: string;
    matricNumber: string;
    department: string;
    level: number;
  }): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    if (!response.success) {
      throw new Error(response.error?.message || 'Registration failed');
    }
    return response.data;
  }

  /**
   * POST /auth/refresh
   * Refresh the access token.
   */
  async refresh(): Promise<void> {
    const response = await apiClient.post('/auth/refresh', {});
    if (!response.success) {
      throw new Error(response.error?.message || 'Token refresh failed');
    }
  }

  /**
   * POST /auth/logout
   * Logout and clear cookies.
   */
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout', {});
  }

  /**
   * GET /auth/me
   * Get current authenticated user.
   */
  async getMe(): Promise<MeResponse> {
    const response = await apiClient.get<MeResponse>('/auth/me');
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch user');
    }
    return response.data;
  }

  /**
   * POST /auth/verify-email
   * Verify email using a verification token from the email link.
   */
  async verifyEmail(token: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/verify-email', { token });
    if (!response.success) {
      throw new Error(response.error?.message || 'Email verification failed');
    }
    return response.data;
  }

  /**
   * POST /auth/forgot-password
   * Request a password reset email.
   */
  async forgotPassword(email: string): Promise<void> {
    const response = await apiClient.post('/auth/forgot-password', { email });
    if (!response.success) {
      throw new Error(response.error?.message || 'Password reset request failed');
    }
  }

  /**
   * POST /auth/reset-password
   * Reset password using a token from the reset email.
   */
  async resetPassword(token: string, password: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/reset-password', {
      token,
      password,
    });
    if (!response.success) {
      throw new Error(response.error?.message || 'Password reset failed');
    }
    return response.data;
  }
}

export const authClient = new AuthApiClient();
