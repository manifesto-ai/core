import React, { createContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { UserPreferences, OrganizationSettings } from '../../types';
import { settingsApi } from '../../api/settings';
import { useCurrentUser, useCurrentOrganization } from '../auth/useAuth';

interface SettingsState {
  userPreferences: UserPreferences | null;
  organizationSettings: OrganizationSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  isDirty: boolean;
  activeTab: SettingsTab;
}

type SettingsTab = 'profile' | 'preferences' | 'notifications' | 'security' | 'organization' | 'integrations';

type SettingsAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: { userPreferences: UserPreferences; organizationSettings: OrganizationSettings } }
  | { type: 'FETCH_FAILURE'; payload: string }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_FAILURE'; payload: string }
  | { type: 'UPDATE_USER_PREFERENCES'; payload: Partial<UserPreferences> }
  | { type: 'UPDATE_ORG_SETTINGS'; payload: Partial<OrganizationSettings> }
  | { type: 'SET_ACTIVE_TAB'; payload: SettingsTab }
  | { type: 'RESET_CHANGES' }
  | { type: 'MARK_DIRTY' };

const initialState: SettingsState = {
  userPreferences: null,
  organizationSettings: null,
  isLoading: true,
  isSaving: false,
  error: null,
  isDirty: false,
  activeTab: 'profile',
};

function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        userPreferences: action.payload.userPreferences,
        organizationSettings: action.payload.organizationSettings,
        isLoading: false,
        isDirty: false,
      };
    case 'FETCH_FAILURE':
      return { ...state, isLoading: false, error: action.payload };
    case 'SAVE_START':
      return { ...state, isSaving: true, error: null };
    case 'SAVE_SUCCESS':
      return { ...state, isSaving: false, isDirty: false };
    case 'SAVE_FAILURE':
      return { ...state, isSaving: false, error: action.payload };
    case 'UPDATE_USER_PREFERENCES':
      return {
        ...state,
        userPreferences: state.userPreferences
          ? { ...state.userPreferences, ...action.payload }
          : null,
        isDirty: true,
      };
    case 'UPDATE_ORG_SETTINGS':
      return {
        ...state,
        organizationSettings: state.organizationSettings
          ? { ...state.organizationSettings, ...action.payload }
          : null,
        isDirty: true,
      };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'RESET_CHANGES':
      return { ...state, isDirty: false };
    case 'MARK_DIRTY':
      return { ...state, isDirty: true };
    default:
      return state;
  }
}

interface SettingsContextValue extends SettingsState {
  fetchSettings: () => Promise<void>;
  saveUserPreferences: () => Promise<void>;
  saveOrganizationSettings: () => Promise<void>;
  updateUserPreferences: (updates: Partial<UserPreferences>) => void;
  updateOrganizationSettings: (updates: Partial<OrganizationSettings>) => void;
  setActiveTab: (tab: SettingsTab) => void;
  resetChanges: () => void;
  // Security
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  enableTwoFactor: () => Promise<{ qrCode: string; secret: string }>;
  disableTwoFactor: (code: string) => Promise<void>;
  regenerateApiKey: () => Promise<string>;
  // Integrations
  connectIntegration: (provider: string) => Promise<void>;
  disconnectIntegration: (provider: string) => Promise<void>;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [state, dispatch] = useReducer(settingsReducer, initialState);
  const { user } = useCurrentUser();
  const { organization } = useCurrentOrganization();

  const fetchSettings = useCallback(async () => {
    if (!user || !organization) return;
    dispatch({ type: 'FETCH_START' });
    try {
      const [userPreferences, organizationSettings] = await Promise.all([
        settingsApi.getUserPreferences(user.id),
        settingsApi.getOrganizationSettings(organization.id),
      ]);
      dispatch({ type: 'FETCH_SUCCESS', payload: { userPreferences, organizationSettings } });
    } catch (err) {
      dispatch({ type: 'FETCH_FAILURE', payload: (err as Error).message });
    }
  }, [user, organization]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveUserPreferences = useCallback(async () => {
    if (!user || !state.userPreferences) return;
    dispatch({ type: 'SAVE_START' });
    try {
      await settingsApi.updateUserPreferences(user.id, state.userPreferences);
      dispatch({ type: 'SAVE_SUCCESS' });
    } catch (err) {
      dispatch({ type: 'SAVE_FAILURE', payload: (err as Error).message });
      throw err;
    }
  }, [user, state.userPreferences]);

  const saveOrganizationSettings = useCallback(async () => {
    if (!organization || !state.organizationSettings) return;
    dispatch({ type: 'SAVE_START' });
    try {
      await settingsApi.updateOrganizationSettings(organization.id, state.organizationSettings);
      dispatch({ type: 'SAVE_SUCCESS' });
    } catch (err) {
      dispatch({ type: 'SAVE_FAILURE', payload: (err as Error).message });
      throw err;
    }
  }, [organization, state.organizationSettings]);

  const updateUserPreferences = useCallback((updates: Partial<UserPreferences>) => {
    dispatch({ type: 'UPDATE_USER_PREFERENCES', payload: updates });
  }, []);

  const updateOrganizationSettings = useCallback((updates: Partial<OrganizationSettings>) => {
    dispatch({ type: 'UPDATE_ORG_SETTINGS', payload: updates });
  }, []);

  const setActiveTab = useCallback((tab: SettingsTab) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  }, []);

  const resetChanges = useCallback(() => {
    fetchSettings();
    dispatch({ type: 'RESET_CHANGES' });
  }, [fetchSettings]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!user) return;
    await settingsApi.changePassword(user.id, currentPassword, newPassword);
  }, [user]);

  const enableTwoFactor = useCallback(async () => {
    if (!user) throw new Error('No user');
    return settingsApi.enableTwoFactor(user.id);
  }, [user]);

  const disableTwoFactor = useCallback(async (code: string) => {
    if (!user) return;
    await settingsApi.disableTwoFactor(user.id, code);
  }, [user]);

  const regenerateApiKey = useCallback(async () => {
    if (!user) throw new Error('No user');
    return settingsApi.regenerateApiKey(user.id);
  }, [user]);

  const connectIntegration = useCallback(async (provider: string) => {
    if (!organization) return;
    await settingsApi.connectIntegration(organization.id, provider);
  }, [organization]);

  const disconnectIntegration = useCallback(async (provider: string) => {
    if (!organization) return;
    await settingsApi.disconnectIntegration(organization.id, provider);
  }, [organization]);

  return (
    <SettingsContext.Provider
      value={{
        ...state,
        fetchSettings,
        saveUserPreferences,
        saveOrganizationSettings,
        updateUserPreferences,
        updateOrganizationSettings,
        setActiveTab,
        resetChanges,
        changePassword,
        enableTwoFactor,
        disableTwoFactor,
        regenerateApiKey,
        connectIntegration,
        disconnectIntegration,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
