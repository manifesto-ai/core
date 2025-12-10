import React, { createContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { User, Organization } from '../../types';
import { authApi } from '../../api/auth';

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionExpiresAt: Date | null;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; organization: Organization } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<User> }
  | { type: 'SWITCH_ORGANIZATION'; payload: Organization }
  | { type: 'REFRESH_SESSION'; payload: Date };

const initialState: AuthState = {
  user: null,
  organization: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  sessionExpiresAt: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true, error: null };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        organization: action.payload.organization,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        organization: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return { ...initialState, isLoading: false };
    case 'UPDATE_USER':
      return state.user
        ? { ...state, user: { ...state.user, ...action.payload } }
        : state;
    case 'SWITCH_ORGANIZATION':
      return { ...state, organization: action.payload };
    case 'REFRESH_SESSION':
      return { ...state, sessionExpiresAt: action.payload };
    default:
      return state;
  }
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginWithSSO: (provider: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await authApi.getSession();
        if (session) {
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: { user: session.user, organization: session.organization },
          });
        } else {
          dispatch({ type: 'AUTH_FAILURE', payload: '' });
        }
      } catch {
        dispatch({ type: 'AUTH_FAILURE', payload: '' });
      }
    };
    checkSession();
  }, []);

  // Session refresh timer
  useEffect(() => {
    if (!state.isAuthenticated || !state.sessionExpiresAt) return;

    const timeUntilExpiry = state.sessionExpiresAt.getTime() - Date.now();
    const refreshTime = Math.max(timeUntilExpiry - 5 * 60 * 1000, 0); // 5 min before expiry

    const timer = setTimeout(async () => {
      try {
        const newExpiry = await authApi.refreshToken();
        dispatch({ type: 'REFRESH_SESSION', payload: newExpiry });
      } catch {
        dispatch({ type: 'LOGOUT' });
      }
    }, refreshTime);

    return () => clearTimeout(timer);
  }, [state.isAuthenticated, state.sessionExpiresAt]);

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const { user, organization } = await authApi.login(email, password);
      dispatch({ type: 'AUTH_SUCCESS', payload: { user, organization } });
    } catch (err) {
      dispatch({ type: 'AUTH_FAILURE', payload: (err as Error).message });
      throw err;
    }
  }, []);

  const loginWithSSO = useCallback(async (provider: string) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const { user, organization } = await authApi.loginWithSSO(provider);
      dispatch({ type: 'AUTH_SUCCESS', payload: { user, organization } });
    } catch (err) {
      dispatch({ type: 'AUTH_FAILURE', payload: (err as Error).message });
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    dispatch({ type: 'LOGOUT' });
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const { user, organization } = await authApi.register(data);
      dispatch({ type: 'AUTH_SUCCESS', payload: { user, organization } });
    } catch (err) {
      dispatch({ type: 'AUTH_FAILURE', payload: (err as Error).message });
      throw err;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await authApi.resetPassword(email);
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    const updatedUser = await authApi.updateProfile(data);
    dispatch({ type: 'UPDATE_USER', payload: updatedUser });
  }, []);

  const switchOrganization = useCallback(async (orgId: string) => {
    const organization = await authApi.switchOrganization(orgId);
    dispatch({ type: 'SWITCH_ORGANIZATION', payload: organization });
  }, []);

  const refreshSession = useCallback(async () => {
    const newExpiry = await authApi.refreshToken();
    dispatch({ type: 'REFRESH_SESSION', payload: newExpiry });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        loginWithSSO,
        logout,
        register,
        resetPassword,
        updateProfile,
        switchOrganization,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
