/**
 * @manifesto-ai/sdk v0.1.0
 *
 * Public developer API layer for the Manifesto protocol stack.
 *
 * @see sdk-SPEC-v0.1.0.md
 * @packageDocumentation
 */
export type { SdkManifest } from './manifest.js';

// =============================================================================
// App Factory (SDK-CREATE)
// =============================================================================

export { createApp, createTestApp } from './create-app.js';

// =============================================================================
// ManifestoApp (SDK-APP)
// =============================================================================

export { ManifestoApp } from './app.js';

// =============================================================================
// Hooks (SDK-HOOKS)
// =============================================================================

export { AppRefImpl, createAppRef } from './hooks/index.js';
export type { AppRefCallbacks } from './hooks/index.js';
export { HookableImpl } from './hooks/index.js';
export type { HookState } from './hooks/index.js';
export { JobQueue } from './hooks/index.js';
export { HookContextImpl, createHookContext } from './hooks/index.js';
