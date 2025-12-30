/**
 * Bridge Provider
 *
 * React Provider component for Bridge.
 * Manages Bridge subscription and provides context to children.
 */
import { useState, useEffect, useMemo, type ReactNode } from "react";
import type { Bridge, SnapshotView } from "@manifesto-ai/bridge";
import { BridgeContext, type BridgeContextValue } from "./BridgeContext.js";

// ============================================================================
// Provider Props
// ============================================================================

/**
 * Props for BridgeProvider
 */
export interface BridgeProviderProps {
  /** Bridge instance to provide */
  bridge: Bridge;

  /** Children components */
  children: ReactNode;
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * BridgeProvider
 *
 * Provides Bridge instance to the component tree via React Context.
 * Automatically subscribes to snapshot changes and triggers re-renders.
 *
 * @example
 * ```tsx
 * const bridge = createBridge({ ... });
 *
 * function App() {
 *   return (
 *     <BridgeProvider bridge={bridge}>
 *       <MyComponent />
 *     </BridgeProvider>
 *   );
 * }
 * ```
 */
export function BridgeProvider({ bridge, children }: BridgeProviderProps) {
  // Track current snapshot state
  const [snapshot, setSnapshot] = useState<SnapshotView | null>(() =>
    bridge.getSnapshot()
  );

  // Subscribe to bridge changes
  useEffect(() => {
    // Update to current snapshot immediately
    setSnapshot(bridge.getSnapshot());

    // Subscribe to future changes
    const unsubscribe = bridge.subscribe((newSnapshot) => {
      setSnapshot(newSnapshot);
    });

    // Cleanup subscription on unmount or bridge change
    return unsubscribe;
  }, [bridge]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo<BridgeContextValue>(
    () => ({ bridge, snapshot }),
    [bridge, snapshot]
  );

  return (
    <BridgeContext.Provider value={value}>
      {children}
    </BridgeContext.Provider>
  );
}
