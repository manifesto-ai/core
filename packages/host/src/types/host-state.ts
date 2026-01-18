/**
 * Host-Owned State Namespace (v2.0.2)
 *
 * Defines the Host-owned state stored at `data.$host` in the Snapshot.
 * This namespace is exclusively managed by Host and should not be modified by Core.
 *
 * @see host-SPEC-v2.0.2.md §3.3.1
 */

/**
 * Intent slot storing type and input for an intent
 */
export interface IntentSlot {
  readonly type: string;
  readonly input?: Record<string, unknown>;
}

/**
 * Host-owned state namespace structure
 *
 * Stored at `data.$host` in the Snapshot
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
}

/**
 * Extract Host-owned state from snapshot data
 *
 * @param data - Snapshot.data object
 * @returns HostOwnedState if present, undefined otherwise
 */
export function getHostState(data: unknown): HostOwnedState | undefined {
  if (typeof data === "object" && data !== null && "$host" in data) {
    return (data as { $host: HostOwnedState }).$host;
  }
  return undefined;
}

/**
 * Get a specific intent slot from snapshot data
 *
 * @param data - Snapshot.data object
 * @param intentId - Intent ID to look up
 * @returns IntentSlot if found, undefined otherwise
 */
export function getIntentSlot(
  data: unknown,
  intentId: string
): IntentSlot | undefined {
  const hostState = getHostState(data);
  return hostState?.intentSlots?.[intentId];
}
