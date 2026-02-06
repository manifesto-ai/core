/**
 * Package scaffold tests
 *
 * Verifies that the package structure is correct and exports work.
 */

import { describe, it, expect } from "vitest";

import {
  // Errors
  ManifestoAppError,
  AppNotReadyError,
  AppDisposedError,
  ActionRejectedError,
  ActionFailedError,
  ActionPreparationError,
  ActionTimeoutError,
  ActionNotFoundError,
  HandleDetachedError,
  HookMutationError,
  ReservedEffectTypeError,
  SystemActionDisabledError,
  SystemActionRoutingError,
  MemoryDisabledError,
  BranchNotFoundError,
  WorldNotFoundError,
  WorldSchemaHashMismatchError,
  WorldNotInLineageError,
  ReservedNamespaceError,
  MissingDefaultActorError,
  DomainCompileError,
  PluginInitError,

  // Constants
  SYSTEM_ACTION_TYPES,

  // Factory
  createApp,
  createTestApp,
} from "../index.js";

describe("Package Scaffold", () => {
  describe("Error Classes", () => {
    it("should export ManifestoAppError base class", () => {
      expect(ManifestoAppError).toBeDefined();
    });

    it("should create AppNotReadyError with correct code", () => {
      const error = new AppNotReadyError("getState");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("APP_NOT_READY");
      expect(error.message).toContain("getState");
      expect(error.timestamp).toBeGreaterThan(0);
    });

    it("should create AppDisposedError with correct code", () => {
      const error = new AppDisposedError("act");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("APP_DISPOSED");
      expect(error.message).toContain("act");
    });

    it("should create ActionRejectedError with correct code", () => {
      const error = new ActionRejectedError("proposal-123", "insufficient permissions");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("ACTION_REJECTED");
      expect(error.proposalId).toBe("proposal-123");
      expect(error.reason).toBe("insufficient permissions");
    });

    it("should create ActionFailedError with correct code", () => {
      const error = new ActionFailedError("proposal-123", "EXEC_ERROR", "Execution failed");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("ACTION_FAILED");
      expect(error.errorCode).toBe("EXEC_ERROR");
    });

    it("should create ActionPreparationError with correct code", () => {
      const error = new ActionPreparationError("proposal-123", "MEMORY_DISABLED", "Memory is disabled");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("ACTION_PREPARATION");
    });

    it("should create ActionTimeoutError with correct code", () => {
      const error = new ActionTimeoutError("proposal-123", 5000);
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("ACTION_TIMEOUT");
      expect(error.timeoutMs).toBe(5000);
    });

    it("should create ActionNotFoundError with correct code", () => {
      const error = new ActionNotFoundError("proposal-123");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("ACTION_NOT_FOUND");
    });

    it("should create HandleDetachedError with correct code", () => {
      const error = new HandleDetachedError("proposal-123");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("HANDLE_DETACHED");
    });

    it("should create HookMutationError with correct code", () => {
      const error = new HookMutationError("act", "action:completed");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("HOOK_MUTATION");
      expect(error.message).toContain("enqueue");
    });

    it("should create ReservedEffectTypeError with correct code", () => {
      const error = new ReservedEffectTypeError("system.get");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("RESERVED_EFFECT_TYPE");
    });

    it("should create SystemActionDisabledError with correct code", () => {
      const error = new SystemActionDisabledError("system.memory.maintain");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("SYSTEM_ACTION_DISABLED");
    });

    it("should create SystemActionRoutingError with correct code", () => {
      const error = new SystemActionRoutingError("system.memory.maintain", "session");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("SYSTEM_ACTION_ROUTING");
      expect(error.source).toBe("session");
    });

    it("should create MemoryDisabledError with correct code", () => {
      const error = new MemoryDisabledError("recall");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("MEMORY_DISABLED");
    });

    it("should create BranchNotFoundError with correct code", () => {
      const error = new BranchNotFoundError("feature-branch");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("BRANCH_NOT_FOUND");
    });

    it("should create WorldNotFoundError with correct code", () => {
      const error = new WorldNotFoundError("world-123");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("WORLD_NOT_FOUND");
    });

    it("should create WorldSchemaHashMismatchError with correct code", () => {
      const error = new WorldSchemaHashMismatchError("world-123", "hash-a", "hash-b");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("SCHEMA_MISMATCH");
    });

    it("should create WorldNotInLineageError with correct code", () => {
      const error = new WorldNotInLineageError("world-123", "branch-1");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("NOT_IN_LINEAGE");
    });

    it("should create ReservedNamespaceError with correct code", () => {
      const error = new ReservedNamespaceError("system.custom", "action");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("RESERVED_NAMESPACE");
    });

    it("should create MissingDefaultActorError with correct code", () => {
      const error = new MissingDefaultActorError();
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("MISSING_ACTOR");
    });

    it("should create DomainCompileError with correct code", () => {
      const error = new DomainCompileError("Syntax error at line 1");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("DOMAIN_COMPILE");
    });

    it("should create PluginInitError with correct code", () => {
      const error = new PluginInitError(0, "Plugin failed to load");
      expect(error).toBeInstanceOf(ManifestoAppError);
      expect(error.code).toBe("PLUGIN_INIT");
      expect(error.pluginIndex).toBe(0);
    });
  });

  describe("Constants", () => {
    it("should export SYSTEM_ACTION_TYPES", () => {
      expect(SYSTEM_ACTION_TYPES).toBeDefined();
      expect(Array.isArray(SYSTEM_ACTION_TYPES)).toBe(true);
      expect(SYSTEM_ACTION_TYPES).toContain("system.memory.maintain");
    });
  });

  describe("Factory", () => {
    it("should export createApp function", () => {
      expect(createApp).toBeDefined();
      expect(typeof createApp).toBe("function");
    });

    it("should return an App instance in created state", () => {
      const app = createTestApp({ id: "test:app", version: "1.0.0", hash: "test", types: {}, actions: {}, computed: { fields: {} }, state: { fields: {} } });
      expect(app).toBeDefined();
      expect(app.status).toBe("created");
    });
  });
});
