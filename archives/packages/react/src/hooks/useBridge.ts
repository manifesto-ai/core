/**
 * useBridge Hook
 *
 * Access the Bridge instance from BridgeContext.
 */
import { useContext } from "react";
import type { Bridge } from "@manifesto-ai/bridge";
import { BridgeContext } from "../context/BridgeContext.js";

/**
 * useBridge
 *
 * Returns the Bridge instance from the nearest BridgeProvider.
 * Throws an error if used outside of a BridgeProvider.
 *
 * @returns Bridge instance
 * @throws Error if used outside of BridgeProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const bridge = useBridge();
 *
 *   // Access bridge directly for advanced use cases
 *   const worldId = bridge.getWorldId();
 *
 *   return <div>World: {worldId}</div>;
 * }
 * ```
 */
export function useBridge(): Bridge {
  const context = useContext(BridgeContext);

  if (!context) {
    throw new Error(
      "useBridge must be used within a BridgeProvider. " +
        "Wrap your component tree with <BridgeProvider bridge={bridge}>."
    );
  }

  return context.bridge;
}
