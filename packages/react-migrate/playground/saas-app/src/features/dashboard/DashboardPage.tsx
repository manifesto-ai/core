import React, { useEffect } from 'react';
import { useCurrentUser, useCurrentOrganization } from '../auth/useAuth';
import { useDashboardMetrics, useEventTracking } from '../analytics/useAnalytics';
import { useProjectList } from '../projects/useProjects';
import { useUnreadNotifications } from '../notifications/useNotifications';
import { usePlanLimits } from '../billing/useBilling';

export function DashboardPage() {
  const { user } = useCurrentUser();
  const { organization } = useCurrentOrganization();
  const { metrics, isLoading: metricsLoading, derived } = useDashboardMetrics();
  const { activeProjects, isLoading: projectsLoading } = useProjectList();
  const { unreadCount } = useUnreadNotifications();
  const { limits, usage, percentUsed } = usePlanLimits();
  const { trackPageView } = useEventTracking();

  useEffect(() => {
    trackPageView('dashboard');
  }, [trackPageView]);

  if (!user || !organization) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="welcome">
          <h1>Welcome back, {user.name}</h1>
          <p>{organization.name}</p>
        </div>
        <div className="quick-actions">
          <button className="btn-primary">+ New Project</button>
          <button className="btn-secondary">+ Invite Member</button>
        </div>
      </header>

      {unreadCount > 0 && (
        <div className="notification-banner">
          You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
        </div>
      )}

      <section className="metrics-overview">
        <h2>Overview</h2>
        {metricsLoading ? (
          <div className="loading">Loading metrics...</div>
        ) : metrics ? (
          <div className="metrics-grid">
            <MetricCard
              title="Active Projects"
              value={metrics.activeProjects}
              icon="📁"
            />
            <MetricCard
              title="Completed Tasks"
              value={metrics.completedTasks}
              icon="✅"
              trend={derived.taskCompletionRate}
              trendLabel="completion rate"
            />
            <MetricCard
              title="Pending Tasks"
              value={metrics.pendingTasks}
              icon="📋"
            />
            <MetricCard
              title="Team Members"
              value={metrics.teamMembers}
              icon="👥"
            />
          </div>
        ) : (
          <div className="no-data">No metrics available</div>
        )}
      </section>

      <section className="usage-section">
        <h2>Usage</h2>
        <div className="usage-bars">
          <UsageBar
            label="Storage"
            used={usage.storage}
            limit={limits.storage}
            percentage={percentUsed('storage')}
            unit="MB"
          />
          <UsageBar
            label="API Calls"
            used={usage.apiCalls}
            limit={limits.apiCalls}
            percentage={percentUsed('apiCalls')}
          />
          <UsageBar
            label="Team Seats"
            used={usage.seats}
            limit={limits.seats}
            percentage={percentUsed('seats')}
          />
        </div>
      </section>

      <section className="projects-section">
        <div className="section-header">
          <h2>Recent Projects</h2>
          <a href="/projects" className="view-all">View all</a>
        </div>
        {projectsLoading ? (
          <div className="loading">Loading projects...</div>
        ) : activeProjects.length > 0 ? (
          <div className="projects-list">
            {activeProjects.slice(0, 5).map(project => (
              <div key={project.id} className="project-card">
                <h3>{project.name}</h3>
                <p>{project.description}</p>
                <div className="project-meta">
                  <span>{project.members.length} members</span>
                  <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No projects yet</p>
            <button className="btn-primary">Create your first project</button>
          </div>
        )}
      </section>

      <section className="activity-section">
        <h2>Recent Activity</h2>
        <ActivityFeed />
      </section>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number;
  icon: string;
  trend?: number;
  trendLabel?: string;
}

function MetricCard({ title, value, icon, trend, trendLabel }: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div className="metric-content">
        <h3>{title}</h3>
        <div className="metric-value">{value.toLocaleString()}</div>
        {trend !== undefined && (
          <div className="metric-trend">
            {trend.toFixed(1)}% {trendLabel}
          </div>
        )}
      </div>
    </div>
  );
}

interface UsageBarProps {
  label: string;
  used: number;
  limit: number;
  percentage: number;
  unit?: string;
}

function UsageBar({ label, used, limit, percentage, unit = '' }: UsageBarProps) {
  const isWarning = percentage > 80;
  const isCritical = percentage > 95;

  return (
    <div className="usage-bar-container">
      <div className="usage-info">
        <span className="usage-label">{label}</span>
        <span className="usage-values">
          {used.toLocaleString()}{unit} / {limit === -1 ? '∞' : `${limit.toLocaleString()}${unit}`}
        </span>
      </div>
      <div className="usage-bar">
        <div
          className={`usage-fill ${isWarning ? 'warning' : ''} ${isCritical ? 'critical' : ''}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

function ActivityFeed() {
  // This would typically fetch from an activity API
  const activities = [
    { id: '1', type: 'task_completed', message: 'John completed "Design review"', time: '2 hours ago' },
    { id: '2', type: 'member_joined', message: 'Sarah joined the team', time: '5 hours ago' },
    { id: '3', type: 'project_created', message: 'New project "Mobile App" created', time: '1 day ago' },
  ];

  return (
    <div className="activity-feed">
      {activities.map(activity => (
        <div key={activity.id} className="activity-item">
          <span className="activity-message">{activity.message}</span>
          <span className="activity-time">{activity.time}</span>
        </div>
      ))}
    </div>
  );
}
