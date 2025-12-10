import { useContext, useMemo, useCallback } from 'react';
import { NotificationsContext } from './NotificationsContext';
import { NotificationType } from '../../types';

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}

export function useUnreadNotifications() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const unreadNotifications = useMemo(
    () => notifications.filter(n => !n.read),
    [notifications]
  );

  return {
    unreadNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}

export function useNotificationsByType() {
  const { notifications } = useNotifications();

  const byType = useMemo(() => {
    const grouped: Record<NotificationType, typeof notifications> = {
      task_assigned: [],
      task_updated: [],
      task_completed: [],
      comment_added: [],
      mention: [],
      project_invited: [],
      team_joined: [],
      billing_alert: [],
      system: [],
    };

    for (const notification of notifications) {
      grouped[notification.type].push(notification);
    }

    return grouped;
  }, [notifications]);

  const taskNotifications = useMemo(
    () => notifications.filter(n =>
      ['task_assigned', 'task_updated', 'task_completed'].includes(n.type)
    ),
    [notifications]
  );

  const socialNotifications = useMemo(
    () => notifications.filter(n =>
      ['comment_added', 'mention', 'project_invited', 'team_joined'].includes(n.type)
    ),
    [notifications]
  );

  const systemNotifications = useMemo(
    () => notifications.filter(n =>
      ['billing_alert', 'system'].includes(n.type)
    ),
    [notifications]
  );

  return {
    byType,
    taskNotifications,
    socialNotifications,
    systemNotifications,
  };
}

export function useNotificationPreferences() {
  // This would typically be connected to user preferences
  const preferences = useMemo(() => ({
    email: true,
    push: true,
    slack: false,
    digest: 'daily' as const,
  }), []);

  const updatePreferences = useCallback(async (updates: Partial<typeof preferences>) => {
    // API call to update preferences
    console.log('Updating preferences:', updates);
  }, []);

  return { preferences, updatePreferences };
}
