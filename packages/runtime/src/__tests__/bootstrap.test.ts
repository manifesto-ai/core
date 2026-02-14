import { describe, it, expect } from 'vitest';
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

  it('package entry point resolves without error', async () => {
    const mod = await import('../index.js');
    expect(mod).toBeDefined();
  });

  it('exports core runtime components', async () => {
    const mod = await import('../index.js');

    // Errors
    expect(mod.ManifestoAppError).toBeDefined();
    expect(mod.AppNotReadyError).toBeDefined();
    expect(mod.AppDisposedError).toBeDefined();

    // Runtime components
    expect(mod.AppRuntime).toBeDefined();
    expect(mod.AppBootstrap).toBeDefined();
    expect(mod.SubscriptionStore).toBeDefined();

    // WorldStore
    expect(mod.InMemoryWorldStore).toBeDefined();
    expect(mod.createInMemoryWorldStore).toBeDefined();

    // PolicyService
    expect(mod.createDefaultPolicyService).toBeDefined();
    expect(mod.createSilentPolicyService).toBeDefined();

    // Memory
    expect(mod.createMemoryFacade).toBeDefined();

    // Hooks
    expect(mod.createAppRef).toBeDefined();

    // Constants
    expect(mod.SYSTEM_ACTION_TYPES).toBeDefined();
  });
});
