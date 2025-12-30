/**
 * useDispatchEvent Hook
 *
 * Returns a stable function for dispatching SourceEvents through projections.
 */
import { useCallback } from "react";
import type { SourceEvent, ProjectionResult } from "@manifesto-ai/bridge";
import { useBridge } from "./useBridge.js";

/**
 * DispatchEvent function type
 */
export type DispatchEventFn = (source: SourceEvent) => Promise<ProjectionResult>;

/**
 * useDispatchEvent
 *
 * Returns a stable function for dispatching SourceEvents through projections.
 * The SourceEvent will be routed through registered projections.
 * If a projection matches, the resulting IntentBody will be dispatched.
 *
 * @returns DispatchEvent function
 *
 * @example
 * ```tsx
 * function FormComponent() {
 *   const dispatchEvent = useDispatchEvent();
 *
 *   const handleSubmit = async (data: FormData) => {
 *     const result = await dispatchEvent({
 *       kind: "ui",
 *       eventId: `form-submit-${Date.now()}`,
 *       payload: { action: "submit", data },
 *     });
 *
 *     if (result.kind === "none") {
 *       console.log("No projection matched:", result.reason);
 *     }
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useDispatchEvent(): DispatchEventFn {
  const bridge = useBridge();

  return useCallback(
    (source: SourceEvent) => {
      return bridge.dispatchEvent(source);
    },
    [bridge]
  );
}
