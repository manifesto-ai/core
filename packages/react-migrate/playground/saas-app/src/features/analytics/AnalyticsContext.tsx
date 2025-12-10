import React, { createContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { DashboardMetrics, ProjectMetrics, AnalyticsEvent } from '../../types';
import { analyticsApi } from '../../api/analytics';
import { useCurrentOrganization } from '../auth/useAuth';

interface DateRange {
  start: Date;
  end: Date;
}

interface AnalyticsState {
  dashboardMetrics: DashboardMetrics | null;
  projectMetrics: Record<string, ProjectMetrics>;
  recentEvents: AnalyticsEvent[];
  isLoading: boolean;
  error: string | null;
  dateRange: DateRange;
  refreshInterval: number | null;
}

type AnalyticsAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_DASHBOARD_SUCCESS'; payload: DashboardMetrics }
  | { type: 'FETCH_PROJECT_SUCCESS'; payload: { projectId: string; metrics: ProjectMetrics } }
  | { type: 'FETCH_EVENTS_SUCCESS'; payload: AnalyticsEvent[] }
  | { type: 'FETCH_FAILURE'; payload: string }
  | { type: 'SET_DATE_RANGE'; payload: DateRange }
  | { type: 'SET_REFRESH_INTERVAL'; payload: number | null }
  | { type: 'TRACK_EVENT'; payload: AnalyticsEvent };

const initialState: AnalyticsState = {
  dashboardMetrics: null,
  projectMetrics: {},
  recentEvents: [],
  isLoading: true,
  error: null,
  dateRange: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date(),
  },
  refreshInterval: null,
};

function analyticsReducer(state: AnalyticsState, action: AnalyticsAction): AnalyticsState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true, error: null };
    case 'FETCH_DASHBOARD_SUCCESS':
      return { ...state, dashboardMetrics: action.payload, isLoading: false };
    case 'FETCH_PROJECT_SUCCESS':
      return {
        ...state,
        projectMetrics: {
          ...state.projectMetrics,
          [action.payload.projectId]: action.payload.metrics,
        },
        isLoading: false,
      };
    case 'FETCH_EVENTS_SUCCESS':
      return { ...state, recentEvents: action.payload, isLoading: false };
    case 'FETCH_FAILURE':
      return { ...state, isLoading: false, error: action.payload };
    case 'SET_DATE_RANGE':
      return { ...state, dateRange: action.payload };
    case 'SET_REFRESH_INTERVAL':
      return { ...state, refreshInterval: action.payload };
    case 'TRACK_EVENT':
      return {
        ...state,
        recentEvents: [action.payload, ...state.recentEvents.slice(0, 99)],
      };
    default:
      return state;
  }
}

interface AnalyticsContextValue extends AnalyticsState {
  fetchDashboardMetrics: () => Promise<void>;
  fetchProjectMetrics: (projectId: string) => Promise<void>;
  fetchRecentEvents: () => Promise<void>;
  trackEvent: (eventType: string, properties?: Record<string, unknown>) => void;
  setDateRange: (range: DateRange) => void;
  setRefreshInterval: (interval: number | null) => void;
  exportReport: (format: 'csv' | 'pdf') => Promise<void>;
}

export const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

interface AnalyticsProviderProps {
  children: ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const [state, dispatch] = useReducer(analyticsReducer, initialState);
  const { organization } = useCurrentOrganization();

  const fetchDashboardMetrics = useCallback(async () => {
    if (!organization) return;
    dispatch({ type: 'FETCH_START' });
    try {
      const metrics = await analyticsApi.getDashboardMetrics(
        organization.id,
        state.dateRange
      );
      dispatch({ type: 'FETCH_DASHBOARD_SUCCESS', payload: metrics });
    } catch (err) {
      dispatch({ type: 'FETCH_FAILURE', payload: (err as Error).message });
    }
  }, [organization, state.dateRange]);

  const fetchProjectMetrics = useCallback(async (projectId: string) => {
    dispatch({ type: 'FETCH_START' });
    try {
      const metrics = await analyticsApi.getProjectMetrics(projectId, state.dateRange);
      dispatch({ type: 'FETCH_PROJECT_SUCCESS', payload: { projectId, metrics } });
    } catch (err) {
      dispatch({ type: 'FETCH_FAILURE', payload: (err as Error).message });
    }
  }, [state.dateRange]);

  const fetchRecentEvents = useCallback(async () => {
    if (!organization) return;
    try {
      const events = await analyticsApi.getRecentEvents(organization.id, 100);
      dispatch({ type: 'FETCH_EVENTS_SUCCESS', payload: events });
    } catch (err) {
      dispatch({ type: 'FETCH_FAILURE', payload: (err as Error).message });
    }
  }, [organization]);

  const trackEvent = useCallback((eventType: string, properties?: Record<string, unknown>) => {
    if (!organization) return;

    const event: AnalyticsEvent = {
      id: crypto.randomUUID(),
      userId: '', // Would come from auth context
      organizationId: organization.id,
      eventType,
      properties: properties || {},
      timestamp: new Date(),
    };

    // Send to API asynchronously
    analyticsApi.trackEvent(event).catch(console.error);

    // Update local state immediately
    dispatch({ type: 'TRACK_EVENT', payload: event });
  }, [organization]);

  const setDateRange = useCallback((range: DateRange) => {
    dispatch({ type: 'SET_DATE_RANGE', payload: range });
  }, []);

  const setRefreshInterval = useCallback((interval: number | null) => {
    dispatch({ type: 'SET_REFRESH_INTERVAL', payload: interval });
  }, []);

  const exportReport = useCallback(async (format: 'csv' | 'pdf') => {
    if (!organization) return;
    await analyticsApi.exportReport(organization.id, format, state.dateRange);
  }, [organization, state.dateRange]);

  // Initial fetch
  useEffect(() => {
    fetchDashboardMetrics();
  }, [fetchDashboardMetrics]);

  // Auto-refresh
  useEffect(() => {
    if (!state.refreshInterval) return;

    const timer = setInterval(() => {
      fetchDashboardMetrics();
    }, state.refreshInterval);

    return () => clearInterval(timer);
  }, [state.refreshInterval, fetchDashboardMetrics]);

  return (
    <AnalyticsContext.Provider
      value={{
        ...state,
        fetchDashboardMetrics,
        fetchProjectMetrics,
        fetchRecentEvents,
        trackEvent,
        setDateRange,
        setRefreshInterval,
        exportReport,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}
