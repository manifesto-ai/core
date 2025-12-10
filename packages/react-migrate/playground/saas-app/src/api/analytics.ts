import { DashboardMetrics, ProjectMetrics, AnalyticsEvent } from '../types';

interface DateRange {
  start: Date;
  end: Date;
}

export const analyticsApi = {
  async getDashboardMetrics(orgId: string, dateRange: DateRange): Promise<DashboardMetrics> {
    const params = new URLSearchParams({
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    });
    const response = await fetch(`/api/organizations/${orgId}/analytics/dashboard?${params}`);
    if (!response.ok) throw new Error('Failed to fetch dashboard metrics');
    return response.json();
  },

  async getProjectMetrics(projectId: string, dateRange: DateRange): Promise<ProjectMetrics> {
    const params = new URLSearchParams({
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    });
    const response = await fetch(`/api/projects/${projectId}/analytics?${params}`);
    if (!response.ok) throw new Error('Failed to fetch project metrics');
    return response.json();
  },

  async getRecentEvents(orgId: string, limit: number): Promise<AnalyticsEvent[]> {
    const response = await fetch(`/api/organizations/${orgId}/analytics/events?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch recent events');
    return response.json();
  },

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    await fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  },

  async exportReport(orgId: string, format: 'csv' | 'pdf', dateRange: DateRange): Promise<void> {
    const params = new URLSearchParams({
      format,
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    });
    const response = await fetch(`/api/organizations/${orgId}/analytics/export?${params}`);
    if (!response.ok) throw new Error('Failed to export report');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-report.${format}`;
    a.click();
  },
};
