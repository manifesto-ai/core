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
});
