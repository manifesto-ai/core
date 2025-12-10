import React, { createContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { Notification, NotificationType } from '../../types';
import { notificationsApi } from '../../api/notifications';
import { useCurrentUser } from '../auth/useAuth';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  isDropdownOpen: boolean;
}

type NotificationsAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: Notification[] }
  | { type: 'FETCH_FAILURE'; payload: string }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_AS_READ'; payload: string }
  | { type: 'MARK_ALL_AS_READ' }
  | { type: 'DELETE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'TOGGLE_DROPDOWN'; payload?: boolean };

const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  isLoading: true,
  error: null,
  isDropdownOpen: false,
};

function calculateUnreadCount(notifications: Notification[]): number {
  return notifications.filter(n => !n.read).length;
}

function notificationsReducer(state: NotificationsState, action: NotificationsAction): NotificationsState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        notifications: action.payload,
        unreadCount: calculateUnreadCount(action.payload),
        isLoading: false,
      };
    case 'FETCH_FAILURE':
      return { ...state, isLoading: false, error: action.payload };
    case 'ADD_NOTIFICATION': {
      const notifications = [action.payload, ...state.notifications];
      return {
        ...state,
        notifications,
        unreadCount: calculateUnreadCount(notifications),
      };
    }
    case 'MARK_AS_READ': {
      const notifications = state.notifications.map(n =>
        n.id === action.payload ? { ...n, read: true } : n
      );
      return {
        ...state,
        notifications,
        unreadCount: calculateUnreadCount(notifications),
      };
    }
    case 'MARK_ALL_AS_READ': {
      const notifications = state.notifications.map(n => ({ ...n, read: true }));
      return { ...state, notifications, unreadCount: 0 };
    }
    case 'DELETE_NOTIFICATION': {
      const notifications = state.notifications.filter(n => n.id !== action.payload);
      return {
        ...state,
        notifications,
        unreadCount: calculateUnreadCount(notifications),
      };
    }
    case 'CLEAR_ALL':
      return { ...state, notifications: [], unreadCount: 0 };
    case 'TOGGLE_DROPDOWN':
      return {
        ...state,
        isDropdownOpen: action.payload !== undefined ? action.payload : !state.isDropdownOpen,
      };
    default:
      return state;
  }
}

interface NotificationsContextValue extends NotificationsState {
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  toggleDropdown: (open?: boolean) => void;
  subscribeToRealtime: () => () => void;
}

export const NotificationsContext = createContext<NotificationsContextValue | null>(null);

interface NotificationsProviderProps {
  children: ReactNode;
}

export function NotificationsProvider({ children }: NotificationsProviderProps) {
  const [state, dispatch] = useReducer(notificationsReducer, initialState);
  const { user } = useCurrentUser();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    dispatch({ type: 'FETCH_START' });
    try {
      const notifications = await notificationsApi.getNotifications(user.id);
      dispatch({ type: 'FETCH_SUCCESS', payload: notifications });
    } catch (err) {
      dispatch({ type: 'FETCH_FAILURE', payload: (err as Error).message });
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    await notificationsApi.markAsRead(notificationId);
    dispatch({ type: 'MARK_AS_READ', payload: notificationId });
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    await notificationsApi.markAllAsRead(user.id);
    dispatch({ type: 'MARK_ALL_AS_READ' });
  }, [user]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    await notificationsApi.deleteNotification(notificationId);
    dispatch({ type: 'DELETE_NOTIFICATION', payload: notificationId });
  }, []);

  const clearAll = useCallback(async () => {
    if (!user) return;
    await notificationsApi.clearAll(user.id);
    dispatch({ type: 'CLEAR_ALL' });
  }, [user]);

  const toggleDropdown = useCallback((open?: boolean) => {
    dispatch({ type: 'TOGGLE_DROPDOWN', payload: open });
  }, []);

  const subscribeToRealtime = useCallback(() => {
    if (!user) return () => {};

    const unsubscribe = notificationsApi.subscribeToRealtime(user.id, (notification) => {
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
    });

    return unsubscribe;
  }, [user]);

  // Subscribe to real-time notifications
  useEffect(() => {
    const unsubscribe = subscribeToRealtime();
    return () => unsubscribe();
  }, [subscribeToRealtime]);

  return (
    <NotificationsContext.Provider
      value={{
        ...state,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        toggleDropdown,
        subscribeToRealtime,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
