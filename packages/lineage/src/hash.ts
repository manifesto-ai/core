import type { ErrorValue, Requirement, Snapshot } from "@manifesto-ai/core";
import { sha256Sync, toJcs } from "@manifesto-ai/core";
import { assertLineage } from "./invariants.js";
import type {
  ErrorSignature,
  SnapshotHashInput,
  TerminalStatus,
  WorldId,
} from "./types.js";

const PLATFORM_NAMESPACE_PREFIX = "$";

export function computeHash(value: unknown): string {
  return sha256Sync(toJcs(value));
}

export function isPlatformNamespace(key: string): boolean {
  return key.startsWith(PLATFORM_NAMESPACE_PREFIX);
}

export function stripPlatformNamespaces(data: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (data == null) {
    return {};
  }

  const keys = Object.keys(data);
  if (!keys.some(isPlatformNamespace)) {
    return data;
  }

  const stripped: Record<string, unknown> = {};
  for (const key of keys) {
    if (!isPlatformNamespace(key)) {
      stripped[key] = data[key];
    }
  }
  return stripped;
}

export function deriveTerminalStatus(snapshot: Snapshot): TerminalStatus {
  if (snapshot.system.pendingRequirements.length > 0) {
    return "failed";
  }
  if (snapshot.system.lastError != null) {
    return "failed";
  }
  return "completed";
}

function normalizeDeterministicValue(value: unknown): unknown {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      return Number.isFinite(value) ? value : null;
    case "bigint":
    case "function":
    case "symbol":
    case "undefined":
      return undefined;
    case "object":
      if (Array.isArray(value)) {
        return value
          .map((item) => normalizeDeterministicValue(item))
          .filter((item) => item !== undefined);
      }

      return normalizeContext(value as Record<string, unknown>);
    default:
      return undefined;
  }
}

export function normalizeContext(ctx: Record<string, unknown>): Record<string, unknown> | undefined {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(ctx)) {
    const nextValue = normalizeDeterministicValue(value);
    if (nextValue !== undefined) {
      normalized[key] = nextValue;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function toErrorSignature(error: ErrorValue): ErrorSignature {
  return {
    code: error.code,
    source: {
      actionId: error.source.actionId,
      nodePath: error.source.nodePath,
    },
    context: error.context ? normalizeContext(error.context) : undefined,
  };
}

export function sortErrorSignatures(signatures: readonly ErrorSignature[]): readonly ErrorSignature[] {
  return [...signatures].sort((left, right) => {
    const leftHash = computeHash(left);
    const rightHash = computeHash(right);
    if (leftHash < rightHash) {
      return -1;
    }
    if (leftHash > rightHash) {
      return 1;
    }
    return 0;
  });
}

export function computePendingDigest(pendingRequirements: readonly Requirement[]): string {
  if (pendingRequirements.length === 0) {
    return "empty";
  }

  const pendingIds = pendingRequirements.map((requirement) => requirement.id).sort();
  return computeHash({ pendingIds });
}

export function createSnapshotHashInput(snapshot: Snapshot): SnapshotHashInput {
  return {
    data: stripPlatformNamespaces(snapshot.data as Record<string, unknown>),
    system: {
      terminalStatus: deriveTerminalStatus(snapshot),
      errors: sortErrorSignatures(snapshot.system.errors.map(toErrorSignature)),
      pendingDigest: computePendingDigest(snapshot.system.pendingRequirements),
    },
  };
}

export function computeSnapshotHash(snapshot: Snapshot): string {
  return computeHash(createSnapshotHashInput(snapshot));
}

export function computeWorldId(schemaHash: string, snapshotHash: string): WorldId {
  return computeHash({ schemaHash, snapshotHash });
}

export function computeBranchId(branchName: string, worldId: WorldId): string {
  return computeHash({
    kind: "genesis-branch",
    branchName,
    worldId,
  });
}

export function computeEdgeId(from: WorldId, to: WorldId): string {
  assertLineage(from !== to, "LIN-COLLISION-2 violation: edge must not be a self-loop");
  return computeHash({ from, to });
}
