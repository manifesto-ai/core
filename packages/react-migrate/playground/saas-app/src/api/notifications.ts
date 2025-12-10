import { Notification } from '../types';

export const notificationsApi = {
  async getNotifications(userId: string): Promise<Notification[]> {
    const response = await fetch(`/api/users/${userId}/notifications`);
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return response.json();
  },

  async markAsRead(notificationId: string): Promise<void> {
    const response = await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to mark notification as read');
  },

  async markAllAsRead(userId: string): Promise<void> {
    const response = await fetch(`/api/users/${userId}/notifications/read-all`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to mark all notifications as read');
  },

  async deleteNotification(notificationId: string): Promise<void> {
    const response = await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete notification');
  },

  async clearAll(userId: string): Promise<void> {
    const response = await fetch(`/api/users/${userId}/notifications`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to clear notifications');
  },

  subscribeToRealtime(userId: string, callback: (notification: Notification) => void): () => void {
    // This would typically use WebSocket or SSE
    const eventSource = new EventSource(`/api/users/${userId}/notifications/stream`);

    eventSource.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      callback(notification);
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  },
};
