import { describe, it, expect } from 'vitest';
import type { SdkManifest } from '../index.js';

describe('@manifesto-ai/sdk bootstrap', () => {
  it('SdkManifest type is importable and structurally correct', () => {
    // Type-level verification: the manifest type constrains to expected shape
    const manifest: SdkManifest = {
      name: '@manifesto-ai/sdk',
      specVersion: '0.1.0',
      phase: 'bootstrap',
    };

    expect(manifest.name).toBe('@manifesto-ai/sdk');
    expect(manifest.specVersion).toBe('0.1.0');
    expect(manifest.phase).toBe('bootstrap');
  });

  it('package entry point resolves without error', async () => {
    const mod = await import('../index.js');
    expect(mod).toBeDefined();
  });

  it('exports SDK components', async () => {
    const mod = await import('../index.js');

    // App Factory
    expect(mod.createApp).toBeDefined();
    expect(mod.createTestApp).toBeDefined();

    // ManifestoApp
    expect(mod.ManifestoApp).toBeDefined();

    // Hooks
    expect(mod.AppRefImpl).toBeDefined();
    expect(mod.createAppRef).toBeDefined();
    expect(mod.HookableImpl).toBeDefined();
    expect(mod.JobQueue).toBeDefined();
    expect(mod.HookContextImpl).toBeDefined();
    expect(mod.createHookContext).toBeDefined();
  });
});
