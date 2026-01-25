/**
 * useSnapshot Hook
 *
 * Subscribe to the full SnapshotView from BridgeContext.
 */
import { useContext } from "react";
import type { SnapshotView } from "@manifesto-ai/bridge";
import { BridgeContext } from "../context/BridgeContext.js";

/**
 * useSnapshot
 *
 * Returns the current SnapshotView from the nearest BridgeProvider.
 * The component will re-render whenever the snapshot changes.
 *
 * @returns Current SnapshotView or null if not yet loaded
 * @throws Error if used outside of BridgeProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const snapshot = useSnapshot();
 *
 *   if (!snapshot) {
 *     return <div>Loading...</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <pre>{JSON.stringify(snapshot.data, null, 2)}</pre>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSnapshot(): SnapshotView | null {
  const context = useContext(BridgeContext);

  if (!context) {
    throw new Error(
      "useSnapshot must be used within a BridgeProvider. " +
        "Wrap your component tree with <BridgeProvider bridge={bridge}>."
    );
  }

  return context.snapshot;
}
