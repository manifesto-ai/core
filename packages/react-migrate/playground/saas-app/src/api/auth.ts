import { User, Organization } from '../types';

interface LoginResponse {
  user: User;
  organization: Organization;
  token: string;
}

interface Session {
  user: User;
  organization: Organization;
  expiresAt: Date;
}

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw new Error('Login failed');
    return response.json();
  },

  async loginWithSSO(provider: string): Promise<LoginResponse> {
    // Redirect to SSO provider
    window.location.href = `/api/auth/sso/${provider}`;
    return new Promise(() => {}); // Never resolves as we redirect
  },

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('token');
  },

  async register(data: { email: string; password: string; name: string; organizationName?: string }): Promise<LoginResponse> {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Registration failed');
    return response.json();
  },

  async getSession(): Promise<Session | null> {
    const response = await fetch('/api/auth/session');
    if (!response.ok) return null;
    return response.json();
  },

  async refreshToken(): Promise<Date> {
    const response = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!response.ok) throw new Error('Token refresh failed');
    const { expiresAt } = await response.json();
    return new Date(expiresAt);
  },

  async resetPassword(email: string): Promise<void> {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) throw new Error('Password reset failed');
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Profile update failed');
    return response.json();
  },

  async switchOrganization(orgId: string): Promise<Organization> {
    const response = await fetch(`/api/auth/switch-org/${orgId}`, { method: 'POST' });
    if (!response.ok) throw new Error('Organization switch failed');
    return response.json();
  },
};
