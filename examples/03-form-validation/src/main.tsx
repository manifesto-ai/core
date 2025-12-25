/**
 * Form Validation Example Entry Point
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createRuntime } from '@manifesto-ai/core';
import { RuntimeProvider } from '@manifesto-ai/bridge-react';
import { formDomain, getInitialFormData, type FormData, type FormState } from './domain';
import App from './App';

// ============================================================================
// Create Runtime
// ============================================================================

const runtime = createRuntime<FormData, FormState>({
  domain: formDomain,
  initialData: getInitialFormData(),
});

// ============================================================================
// Render App
// ============================================================================

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <StrictMode>
      <RuntimeProvider runtime={runtime} domain={formDomain}>
        <App />
      </RuntimeProvider>
    </StrictMode>
  );
}
