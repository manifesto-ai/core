import { useContext, useMemo } from 'react';
import { AnalyticsContext } from './AnalyticsContext';

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}

export function useDashboardMetrics() {
  const { dashboardMetrics, isLoading, fetchDashboardMetrics, dateRange, setDateRange } = useAnalytics();

  const storagePercentage = useMemo(() => {
    if (!dashboardMetrics) return 0;
    return (dashboardMetrics.storageUsed / dashboardMetrics.storageLimit) * 100;
  }, [dashboardMetrics]);

  const apiPercentage = useMemo(() => {
    if (!dashboardMetrics) return 0;
    return (dashboardMetrics.apiCallsUsed / dashboardMetrics.apiCallsLimit) * 100;
  }, [dashboardMetrics]);

  const taskCompletionRate = useMemo(() => {
    if (!dashboardMetrics) return 0;
    const total = dashboardMetrics.completedTasks + dashboardMetrics.pendingTasks;
    if (total === 0) return 0;
    return (dashboardMetrics.completedTasks / total) * 100;
  }, [dashboardMetrics]);

  return {
    metrics: dashboardMetrics,
    isLoading,
    refresh: fetchDashboardMetrics,
    dateRange,
    setDateRange,
    derived: {
      storagePercentage,
      apiPercentage,
      taskCompletionRate,
    },
  };
}

export function useProjectMetrics(projectId: string) {
  const { projectMetrics, isLoading, fetchProjectMetrics, dateRange } = useAnalytics();

  const metrics = projectMetrics[projectId];

  const completionRate = useMemo(() => {
    if (!metrics) return 0;
    if (metrics.totalTasks === 0) return 0;
    return (metrics.completedTasks / metrics.totalTasks) * 100;
  }, [metrics]);

  const overdueRate = useMemo(() => {
    if (!metrics) return 0;
    if (metrics.totalTasks === 0) return 0;
    return (metrics.overdueTasks / metrics.totalTasks) * 100;
  }, [metrics]);

  const velocityTrend = useMemo(() => {
    if (!metrics || metrics.velocityTrend.length < 2) return 'stable';
    const recent = metrics.velocityTrend.slice(-3);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const prev = metrics.velocityTrend.slice(-6, -3);
    const prevAvg = prev.reduce((a, b) => a + b, 0) / prev.length;

    if (avg > prevAvg * 1.1) return 'increasing';
    if (avg < prevAvg * 0.9) return 'decreasing';
    return 'stable';
  }, [metrics]);

  return {
    metrics,
    isLoading,
    refresh: () => fetchProjectMetrics(projectId),
    dateRange,
    derived: {
      completionRate,
      overdueRate,
      velocityTrend,
    },
  };
}

export function useEventTracking() {
  const { trackEvent, recentEvents } = useAnalytics();

  const trackPageView = (pageName: string) => {
    trackEvent('page_view', { page: pageName, timestamp: new Date().toISOString() });
  };

  const trackButtonClick = (buttonName: string, context?: Record<string, unknown>) => {
    trackEvent('button_click', { button: buttonName, ...context });
  };

  const trackFeatureUsage = (featureName: string, action: string) => {
    trackEvent('feature_usage', { feature: featureName, action });
  };

  const trackError = (errorType: string, errorMessage: string, context?: Record<string, unknown>) => {
    trackEvent('error', { type: errorType, message: errorMessage, ...context });
  };

  return {
    trackEvent,
    trackPageView,
    trackButtonClick,
    trackFeatureUsage,
    trackError,
    recentEvents,
  };
}
