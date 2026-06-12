import {
  findJsonValueViolation,
  type JsonValueViolation,
  type Snapshot as CoreSnapshot,
} from "@manifesto-ai/core";

const SNAPSHOT_JSON_VALUE_KEYS = ["state", "computed", "system", "meta", "namespaces"] as const;

/**
 * Snapshot `input` is transient and current genesis snapshots use
 * `undefined`. Validate it only when a restore payload actually carries a
 * value; persisted domain/system channels must always stay JSON-compatible.
 */
export function findCanonicalSnapshotValueViolation(
  snapshot: CoreSnapshot,
): JsonValueViolation | null {
  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return findJsonValueViolation(snapshot, "snapshot");
  }

  const record = snapshot as unknown as Record<string, unknown>;
  for (const key of SNAPSHOT_JSON_VALUE_KEYS) {
    const violation = findJsonValueViolation(record[key], `snapshot.${key}`);
    if (violation) {
      return violation;
    }
  }

  if (record.input === undefined) {
    return null;
  }

  return findJsonValueViolation(record.input, "snapshot.input");
}
