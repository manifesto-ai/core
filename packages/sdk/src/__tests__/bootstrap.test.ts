import { describe, it, expect } from 'vitest';
import * as sdk from '../index.js';
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

  it('package entry point resolves without error', () => {
    expect(sdk).toBeDefined();
  });

  it('exports SDK components', () => {
    // App Factory
    expect(sdk.createApp).toBeDefined();
    expect(sdk.createTestApp).toBeDefined();

    // ManifestoApp
    expect(sdk.ManifestoApp).toBeDefined();

    // Hooks
    expect(sdk.AppRefImpl).toBeDefined();
    expect(sdk.createAppRef).toBeDefined();
    expect(sdk.HookableImpl).toBeDefined();
    expect(sdk.JobQueue).toBeDefined();
    expect(sdk.HookContextImpl).toBeDefined();
    expect(sdk.createHookContext).toBeDefined();
  });
});
