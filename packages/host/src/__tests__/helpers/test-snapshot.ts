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
 * Create a test snapshot with the given data and schema hash
 */
export function createTestSnapshot(
  data: unknown,
  schemaHash: string,
  context: HostContext = DEFAULT_HOST_CONTEXT
): Snapshot {
  return createSnapshot(data, schemaHash, context);
}

/**
 * Create a minimal snapshot for testing (without Core schema)
 */
export function createMinimalSnapshot(data: unknown = {}): Snapshot {
  return {
    data,
    system: {
      status: "idle",
      pendingRequirements: [],
      lastError: null,
      errors: [],
      currentAction: null,
    },
    meta: {
      version: 0,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "test-hash",
    },
    computed: {},
    input: null,
  };
}

/**
 * Create a snapshot that mimics the Lineage v2 restore-normalized boundary.
 *
 * `$host` is cleared, `input` is reset to null, and `system.currentAction`
 * is reset to null before Host resumes a fresh job.
 */
export function createRestoreNormalizedSnapshot(
  data: unknown,
  schemaHash: string,
  context: HostContext = DEFAULT_HOST_CONTEXT
): Snapshot {
  const snapshot = createSnapshot(data, schemaHash, context);
  const normalizedData = typeof snapshot.data === "object"
    && snapshot.data !== null
    && !Array.isArray(snapshot.data)
    ? (() => {
        const { $host: _host, ...rest } = snapshot.data as Record<string, unknown>;
        return rest;
      })()
    : snapshot.data;

  return {
    ...snapshot,
    data: normalizedData,
    input: null,
    system: {
      ...snapshot.system,
      currentAction: null,
    },
  };
}

/**
 * Create a test snapshot with pending requirements
 */
export function createSnapshotWithRequirements(
  data: unknown,
  schemaHash: string,
  requirements: Requirement[],
  context: HostContext = DEFAULT_HOST_CONTEXT
): Snapshot {
  const snapshot = createSnapshot(data, schemaHash, context);
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
