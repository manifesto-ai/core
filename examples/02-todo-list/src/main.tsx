/**
 * Todo List Example Entry Point
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createRuntime } from '@manifesto-ai/core';
import { RuntimeProvider } from '@manifesto-ai/bridge-react';
import { todoDomain, getInitialTodoData, type TodoData, type TodoState } from './domain';
import App from './App';

// ============================================================================
// Create Runtime
// ============================================================================

const runtime = createRuntime<TodoData, TodoState>({
  domain: todoDomain,
  initialData: getInitialTodoData(),
});

// ============================================================================
// Render App
// ============================================================================

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <StrictMode>
      <RuntimeProvider runtime={runtime} domain={todoDomain}>
        <App />
      </RuntimeProvider>
    </StrictMode>
  );
}
