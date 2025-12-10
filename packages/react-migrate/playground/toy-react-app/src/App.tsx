import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { TodoList } from './components/TodoList';
import { UserProfile } from './components/UserProfile';
import { useAuth } from './hooks/useAuth';

function MainContent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  return (
    <div className="app">
      <header>
        <UserProfile userId={user!.id} />
        <button onClick={logout}>Logout</button>
      </header>
      <main>
        <TodoList />
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
