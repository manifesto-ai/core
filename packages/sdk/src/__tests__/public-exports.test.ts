import { describe, expect, it } from 'vitest';

import * as sdk from '../index.js';

describe('sdk public exports contract', () => {
  it('exposes the expected runtime value exports only', () => {
    const exportedKeys = Object.keys(sdk).sort();

    const expectedKeys = [
      'ActionFailedError',
      'ActionNotFoundError',
      'ActionPreparationError',
      'ActionRejectedError',
      'ActionTimeoutError',
      'AppDisposedError',
      'AppNotReadyError',
      'AppRefImpl',
      'BranchHeadNotFoundError',
      'BranchNotFoundError',
      'DomainCompileError',
      'HandleDetachedError',
      'HookContextImpl',
      'HookMutationError',
      'HookableImpl',
      'JobQueue',
      'ManifestoApp',
      'ManifestoAppError',
      'MemoryDisabledError',
      'MissingDefaultActorError',
      'PluginInitError',
      'ReservedEffectTypeError',
      'ReservedNamespaceError',
      'SchemaMismatchOnResumeError',
      'SystemActionDisabledError',
      'SystemActionRoutingError',
      'WorldNotFoundError',
      'WorldNotInLineageError',
      'WorldSchemaHashMismatchError',
      'createApp',
      'createAppRef',
      'createHookContext',
      'createTestApp',
      'defineOps',
    ].sort();

    expect(exportedKeys).toEqual(expectedKeys);
  });

  it('does not expose non-contract helpers from former app facade', () => {
    const forbidden = [
      'createSilentPolicyService',
      'createStrictPolicyService',
      'createDefaultPolicyService',
      'createInMemoryWorldStore',
      'withDxAliases',
      'validateSchemaCompatibility',
      'withPlatformNamespaces',
    ];

    for (const key of forbidden) {
      expect((sdk as Record<string, unknown>)[key]).toBeUndefined();
    }
  });
});
