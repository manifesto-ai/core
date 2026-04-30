/**
 * Host-Owned State Namespace
 *
 * Defines the Host-owned state stored at `namespaces.host` in the Snapshot.
 * This namespace is exclusively managed by Host and should not be modified by Core.
 *
 * @see host-SPEC.md §3.3.1
 */

import type { ErrorValue, Snapshot } from "@manifesto-ai/core";

/**
 * Intent slot storing type and input for an intent
 */
export interface IntentSlot {
  readonly type: string;
  readonly input?: unknown;
}

/**
 * Host-owned state namespace structure
 *
 * Stored at `namespaces.host` in the Snapshot
 */
export interface HostOwnedState {
  /**
   * Intent slots keyed by intentId
   */
  readonly intentSlots?: Record<string, IntentSlot>;

  /**
   * Current intent ID being processed
   */
  readonly currentIntentId?: string | null;

  /**
   * Last host-recorded error (optional)
   */
  readonly lastError?: ErrorValue | null;

}

/**
 * Extract Host-owned state from a canonical snapshot.
 *
 * @param snapshotOrData - Core Snapshot
 * @returns HostOwnedState if present, undefined otherwise
 */
export function getHostState(snapshotOrData: unknown): HostOwnedState | undefined {
  if (!isObjectRecord(snapshotOrData)) {
    return undefined;
  }

  if ("namespaces" in snapshotOrData) {
    const namespaces = (snapshotOrData as Pick<Snapshot, "namespaces">).namespaces;
    const host = namespaces.host;
    return isObjectRecord(host) ? host as HostOwnedState : undefined;
  }

  return undefined;
}

/**
 * Explicit compatibility helper for retired data-root snapshots.
 */
export function getLegacyDataRootHostState(data: unknown): HostOwnedState | undefined {
  if (!isObjectRecord(data) || !("$host" in data)) {
    return undefined;
  }

  const host = (data as { $host: unknown }).$host;
  return isObjectRecord(host) ? host as HostOwnedState : undefined;
}

/**
 * Get a specific intent slot from a canonical snapshot.
 *
 * @param snapshotOrData - Core Snapshot
 * @param intentId - Intent ID to look up
 * @returns IntentSlot if found, undefined otherwise
 */
export function getIntentSlot(
  snapshotOrData: unknown,
  intentId: string
): IntentSlot | undefined {
  const hostState = getHostState(snapshotOrData);
  return hostState?.intentSlots?.[intentId];
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
