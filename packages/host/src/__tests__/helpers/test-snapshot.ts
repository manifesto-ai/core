/**
 * Common test snapshot helper
 */
import { createSnapshot, type Snapshot, type Requirement, type HostContext } from "@manifesto-ai/core";

/**
 * Default host context for tests (deterministic)
 */
export const DEFAULT_HOST_CONTEXT: HostContext = {
  now: 0,
  randomSeed: "seed",
  durationMs: 0,
};

/**
 * Create a test snapshot with the given state and schema hash
 */
export function createTestSnapshot(
  state: unknown,
  schemaHash: string,
  context: HostContext = DEFAULT_HOST_CONTEXT
): Snapshot {
  return createSnapshot(state, schemaHash, context);
}

/**
 * Create a minimal snapshot for testing (without Core schema)
 */
export function createMinimalSnapshot(state: unknown = {}): Snapshot {
  return {
    state,
    system: {
      status: "idle",
      pendingRequirements: [],
      lastError: null,
      currentAction: null,
    },
    meta: {
      version: 0,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "test-hash",
    },
    computed: {},
    input: undefined,
    namespaces: {
      host: {},
      mel: {
        guards: {
          intent: {},
        },
      },
    },
  };
}

/**
 * Create a snapshot that mimics the Lineage v2 restore-normalized boundary.
 *
 * Legacy state-root `$host` is cleared, `input` is reset, and `system.currentAction`
 * is reset to null before Host resumes a fresh job.
 */
export function createRestoreNormalizedSnapshot(
  state: unknown,
  schemaHash: string,
  context: HostContext = DEFAULT_HOST_CONTEXT
): Snapshot {
  const snapshot = createSnapshot(state, schemaHash, context);
  const normalizedState = typeof snapshot.state === "object"
    && snapshot.state !== null
    && !Array.isArray(snapshot.state)
    ? (() => {
        const { $host: _host, ...rest } = snapshot.state as Record<string, unknown>;
        return rest;
      })()
    : snapshot.state;

  return {
    ...snapshot,
    state: normalizedState,
    input: undefined,
    system: {
      ...snapshot.system,
      currentAction: null,
    },
    namespaces: {
      ...snapshot.namespaces,
      host: {},
    },
  };
}

/**
 * Create a test snapshot with pending requirements
 */
export function createSnapshotWithRequirements(
  state: unknown,
  schemaHash: string,
  requirements: Requirement[],
  context: HostContext = DEFAULT_HOST_CONTEXT
): Snapshot {
  const snapshot = createSnapshot(state, schemaHash, context);
  return {
    ...snapshot,
    system: {
      ...snapshot.system,
      status: "pending" as const,
      pendingRequirements: requirements,
    },
  };
}

/**
 * Create a test requirement
 */
export function createTestRequirement(
  type: string,
  params: Record<string, unknown> = {},
  overrides: Partial<Requirement> = {}
): Requirement {
  return {
    id: overrides.id ?? `req-${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    params,
    actionId: overrides.actionId ?? "test-action",
    flowPosition: overrides.flowPosition ?? {
      nodePath: "root",
      snapshotVersion: 0,
    },
    createdAt: overrides.createdAt ?? Date.now(),
  };
}
