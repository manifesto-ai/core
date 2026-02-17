import { describe, it, expect } from 'vitest';
import * as runtime from '../index.js';
import type { RuntimeManifest } from '../index.js';

describe('@manifesto-ai/runtime bootstrap', () => {
  it('RuntimeManifest type is importable and structurally correct', () => {
    // Type-level verification: the manifest type constrains to expected shape
    const manifest: RuntimeManifest = {
      name: '@manifesto-ai/runtime',
      specVersion: '0.1.0',
      phase: 'bootstrap',
    };

    expect(manifest.name).toBe('@manifesto-ai/runtime');
    expect(manifest.specVersion).toBe('0.1.0');
    expect(manifest.phase).toBe('bootstrap');
  });

  it('package entry point resolves without error', () => {
    expect(runtime).toBeDefined();
  });

  it('exports core runtime components', () => {
    // Errors
    expect(runtime.ManifestoAppError).toBeDefined();
    expect(runtime.AppNotReadyError).toBeDefined();
    expect(runtime.AppDisposedError).toBeDefined();

    // Runtime components
    expect(runtime.AppRuntime).toBeDefined();
    expect(runtime.AppBootstrap).toBeDefined();
    expect(runtime.SubscriptionStore).toBeDefined();

    // WorldStore
    expect(runtime.InMemoryWorldStore).toBeDefined();
    expect(runtime.createInMemoryWorldStore).toBeDefined();

    // PolicyService
    expect(runtime.createDefaultPolicyService).toBeDefined();
    expect(runtime.createSilentPolicyService).toBeDefined();

    // Memory
    expect(runtime.createMemoryFacade).toBeDefined();

    // Hooks
    expect(runtime.createAppRef).toBeDefined();

    // Constants
    expect(runtime.SYSTEM_ACTION_TYPES).toBeDefined();
  });
});
