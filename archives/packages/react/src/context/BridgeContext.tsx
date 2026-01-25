/**
 * Bridge Context
 *
 * React Context for providing Bridge instance throughout the component tree.
 */
import { createContext } from "react";
import type { Bridge, SnapshotView } from "@manifesto-ai/bridge";

// ============================================================================
// Context Value Type
// ============================================================================

/**
 * Value provided by BridgeContext
 */
export interface BridgeContextValue {
  /** Bridge instance */
  bridge: Bridge;

  /** Current snapshot (may be null before first load) */
  snapshot: SnapshotView | null;
}

// ============================================================================
// Context
// ============================================================================

/**
 * React Context for Bridge
 *
 * Use BridgeProvider to provide a Bridge instance to the tree.
 * Use useBridge() hook to access the Bridge from components.
 */
export const BridgeContext = createContext<BridgeContextValue | null>(null);

BridgeContext.displayName = "BridgeContext";
