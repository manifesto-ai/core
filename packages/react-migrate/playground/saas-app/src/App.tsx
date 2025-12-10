import React from 'react';
import { AuthProvider } from './features/auth/AuthContext';
import { BillingProvider } from './features/billing/BillingContext';
import { ProjectsProvider } from './features/projects/ProjectsContext';
import { TeamProvider } from './features/team/TeamContext';
import { NotificationsProvider } from './features/notifications/NotificationsContext';
import { AnalyticsProvider } from './features/analytics/AnalyticsContext';
import { SettingsProvider } from './features/settings/SettingsContext';
import { ThemeProvider } from './shared/contexts/ThemeContext';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { useAuth } from './features/auth/useAuth';
import { LoginForm } from './features/auth/LoginForm';

// Main app with all providers
export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppWithAuth />
      </AuthProvider>
    </ThemeProvider>
  );
}

// Inner component that uses auth context
function AppWithAuth() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="login-page">
        <LoginForm />
      </div>
    );
  }

  return (
    <BillingProvider>
      <ProjectsProvider>
        <TeamProvider>
          <NotificationsProvider>
            <AnalyticsProvider>
              <SettingsProvider>
                <AppLayout />
              </SettingsProvider>
            </AnalyticsProvider>
          </NotificationsProvider>
        </TeamProvider>
      </ProjectsProvider>
    </BillingProvider>
  );
}

// Main layout with navigation
function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Header />
        <div className="page-content">
          <DashboardPage />
        </div>
      </main>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">SaaS App</div>
      <nav className="nav">
        <a href="/dashboard" className="nav-item active">Dashboard</a>
        <a href="/projects" className="nav-item">Projects</a>
        <a href="/team" className="nav-item">Team</a>
        <a href="/billing" className="nav-item">Billing</a>
        <a href="/analytics" className="nav-item">Analytics</a>
        <a href="/settings" className="nav-item">Settings</a>
      </nav>
    </aside>
  );
}

function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="search">
        <input type="text" placeholder="Search..." />
      </div>
      <div className="header-actions">
        <NotificationBell />
        <div className="user-menu">
          <span>{user?.name}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </div>
    </header>
  );
}

function NotificationBell() {
  // This would use useNotifications hook
  const unreadCount = 5;

  return (
    <button className="notification-bell">
      🔔
      {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
    </button>
  );
}
