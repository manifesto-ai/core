/**
 * Counter Example Entry Point
 *
 * Sets up the Manifesto runtime and React provider.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createRuntime } from '@manifesto-ai/core';
import { RuntimeProvider } from '@manifesto-ai/bridge-react';
import { counterDomain, getInitialCounterData, type CounterData, type CounterState } from './domain';
import App from './App';

// ============================================================================
// Create Runtime
// ============================================================================

const runtime = createRuntime<CounterData, CounterState>({
  domain: counterDomain,
  initialData: getInitialCounterData(),
});

// ============================================================================
// Render App
// ============================================================================

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <StrictMode>
      <RuntimeProvider runtime={runtime} domain={counterDomain}>
        <App />
      </RuntimeProvider>
    </StrictMode>
  );
}
