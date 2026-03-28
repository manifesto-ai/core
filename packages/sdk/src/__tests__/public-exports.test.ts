import { describe, expect, it } from "vitest";

import * as sdk from "../index.js";

describe("sdk public exports contract", () => {
  it("exposes the expected runtime value exports only", () => {
    const exportedKeys = Object.keys(sdk).sort();

    const expectedKeys = [
      // SDK-owned
      "createManifesto",
      "dispatchAsync",
      "ManifestoError",
      "ReservedEffectError",
      "DisposedError",
      "CompileError",
      "DispatchRejectedError",
      "defineOps",
      // Core re-exports
      "createIntent",
      "createSnapshot",
      "createCore",
      // World re-exports
      "createMemoryWorldStore",
      "createInMemoryWorldStore",
      "createWorld",
    ].sort();

    expect(exportedKeys).toEqual(expectedKeys);
  });

  it("does not expose removed v0.x runtime re-exports", () => {
    const forbidden = [
      // Old factory / class
      "createApp",
      "createTestApp",
      "ManifestoApp",
      // Old errors
      "ManifestoAppError",
      "AppNotReadyError",
      "AppDisposedError",
      "ActionRejectedError",
      "ActionFailedError",
      "ActionPreparationError",
      "ActionTimeoutError",
      "ActionNotFoundError",
      "HandleDetachedError",
      "HookMutationError",
      "ReservedEffectTypeError",
      "SystemActionDisabledError",
      "SystemActionRoutingError",
      "MemoryDisabledError",
      "BranchNotFoundError",
      "WorldNotFoundError",
      "WorldSchemaHashMismatchError",
      "WorldNotInLineageError",
      "ReservedNamespaceError",
      "MissingDefaultActorError",
      "DomainCompileError",
      "PluginInitError",
      "SchemaMismatchOnResumeError",
      "BranchHeadNotFoundError",
      // Old hooks
      "AppRefImpl",
      "createAppRef",
      "HookableImpl",
      "JobQueue",
      "HookContextImpl",
      "createHookContext",
      // Old internal re-exports
      "createSilentPolicyService",
      "createStrictPolicyService",
      "createDefaultPolicyService",
      "withDxAliases",
      "validateSchemaCompatibility",
      "withPlatformNamespaces",
    ];

    for (const key of forbidden) {
      expect((sdk as Record<string, unknown>)[key]).toBeUndefined();
    }
  });
});
