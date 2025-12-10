import { useContext, useCallback, useEffect } from 'react';
import { SettingsContext } from './SettingsContext';

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export function useUserPreferences() {
  const { userPreferences, updateUserPreferences, saveUserPreferences, isDirty, isSaving } = useSettings();

  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    updateUserPreferences({ theme });
  }, [updateUserPreferences]);

  const setLanguage = useCallback((language: string) => {
    updateUserPreferences({ language });
  }, [updateUserPreferences]);

  const setTimezone = useCallback((timezone: string) => {
    updateUserPreferences({ timezone });
  }, [updateUserPreferences]);

  return {
    preferences: userPreferences,
    setTheme,
    setLanguage,
    setTimezone,
    save: saveUserPreferences,
    isDirty,
    isSaving,
  };
}

export function useNotificationSettings() {
  const { userPreferences, updateUserPreferences, saveUserPreferences, isDirty, isSaving } = useSettings();

  const notifications = userPreferences?.notifications;

  const toggleEmail = useCallback(() => {
    if (!notifications) return;
    updateUserPreferences({
      notifications: { ...notifications, email: !notifications.email },
    });
  }, [notifications, updateUserPreferences]);

  const togglePush = useCallback(() => {
    if (!notifications) return;
    updateUserPreferences({
      notifications: { ...notifications, push: !notifications.push },
    });
  }, [notifications, updateUserPreferences]);

  const toggleSlack = useCallback(() => {
    if (!notifications) return;
    updateUserPreferences({
      notifications: { ...notifications, slack: !notifications.slack },
    });
  }, [notifications, updateUserPreferences]);

  const setDigest = useCallback((digest: 'daily' | 'weekly' | 'never') => {
    if (!notifications) return;
    updateUserPreferences({
      notifications: { ...notifications, digest },
    });
  }, [notifications, updateUserPreferences]);

  return {
    settings: notifications,
    toggleEmail,
    togglePush,
    toggleSlack,
    setDigest,
    save: saveUserPreferences,
    isDirty,
    isSaving,
  };
}

export function useOrganizationSettings() {
  const {
    organizationSettings,
    updateOrganizationSettings,
    saveOrganizationSettings,
    isDirty,
    isSaving,
  } = useSettings();

  const togglePublicProjects = useCallback(() => {
    if (!organizationSettings) return;
    updateOrganizationSettings({
      allowPublicProjects: !organizationSettings.allowPublicProjects,
    });
  }, [organizationSettings, updateOrganizationSettings]);

  const toggleTwoFactor = useCallback(() => {
    if (!organizationSettings) return;
    updateOrganizationSettings({
      requireTwoFactor: !organizationSettings.requireTwoFactor,
    });
  }, [organizationSettings, updateOrganizationSettings]);

  const toggleSSO = useCallback(() => {
    if (!organizationSettings) return;
    updateOrganizationSettings({
      ssoEnabled: !organizationSettings.ssoEnabled,
    });
  }, [organizationSettings, updateOrganizationSettings]);

  const setSSOProvider = useCallback((provider: string | undefined) => {
    updateOrganizationSettings({ ssoProvider: provider });
  }, [updateOrganizationSettings]);

  return {
    settings: organizationSettings,
    togglePublicProjects,
    toggleTwoFactor,
    toggleSSO,
    setSSOProvider,
    save: saveOrganizationSettings,
    isDirty,
    isSaving,
  };
}

export function useSecuritySettings() {
  const { changePassword, enableTwoFactor, disableTwoFactor, regenerateApiKey } = useSettings();

  return {
    changePassword,
    enableTwoFactor,
    disableTwoFactor,
    regenerateApiKey,
  };
}

export function useUnsavedChangesWarning() {
  const { isDirty } = useSettings();

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return isDirty;
}
