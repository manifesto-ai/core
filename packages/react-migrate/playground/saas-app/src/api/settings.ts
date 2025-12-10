import { UserPreferences, OrganizationSettings } from '../types';

export const settingsApi = {
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const response = await fetch(`/api/users/${userId}/preferences`);
    if (!response.ok) throw new Error('Failed to fetch user preferences');
    return response.json();
  },

  async updateUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    const response = await fetch(`/api/users/${userId}/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
    });
    if (!response.ok) throw new Error('Failed to update user preferences');
  },

  async getOrganizationSettings(orgId: string): Promise<OrganizationSettings> {
    const response = await fetch(`/api/organizations/${orgId}/settings`);
    if (!response.ok) throw new Error('Failed to fetch organization settings');
    return response.json();
  },

  async updateOrganizationSettings(orgId: string, settings: OrganizationSettings): Promise<void> {
    const response = await fetch(`/api/organizations/${orgId}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) throw new Error('Failed to update organization settings');
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const response = await fetch(`/api/users/${userId}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) throw new Error('Failed to change password');
  },

  async enableTwoFactor(userId: string): Promise<{ qrCode: string; secret: string }> {
    const response = await fetch(`/api/users/${userId}/2fa/enable`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to enable 2FA');
    return response.json();
  },

  async disableTwoFactor(userId: string, code: string): Promise<void> {
    const response = await fetch(`/api/users/${userId}/2fa/disable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) throw new Error('Failed to disable 2FA');
  },

  async regenerateApiKey(userId: string): Promise<string> {
    const response = await fetch(`/api/users/${userId}/api-key/regenerate`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to regenerate API key');
    const { apiKey } = await response.json();
    return apiKey;
  },

  async connectIntegration(orgId: string, provider: string): Promise<void> {
    // This would typically redirect to OAuth flow
    window.location.href = `/api/organizations/${orgId}/integrations/${provider}/connect`;
  },

  async disconnectIntegration(orgId: string, provider: string): Promise<void> {
    const response = await fetch(`/api/organizations/${orgId}/integrations/${provider}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to disconnect integration');
  },
};
