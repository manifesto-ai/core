/**
 * useDispatch Hook
 *
 * Returns a stable dispatch function for sending IntentBody to the domain.
 */
import { useCallback } from "react";
import type { IntentBody, SourceEvent } from "@manifesto-ai/bridge";
import { useBridge } from "./useBridge.js";

/**
 * Dispatch function type
 */
export type DispatchFn = (
  body: IntentBody,
  source?: SourceEvent
) => Promise<void>;

/**
 * useDispatch
 *
 * Returns a stable function for dispatching IntentBody to the domain.
 * The returned function reference is stable across re-renders.
 *
 * @returns Dispatch function
 *
 * @example
 * ```tsx
 * function AddTodoButton() {
 *   const dispatch = useDispatch();
 *
 *   const handleClick = async () => {
 *     await dispatch({
 *       type: "todo.create",
 *       input: { title: "New Todo" },
 *     });
 *   };
 *
 *   return <button onClick={handleClick}>Add Todo</button>;
 * }
 * ```
 */
export function useDispatch(): DispatchFn {
  const bridge = useBridge();

  return useCallback(
    (body: IntentBody, source?: SourceEvent) => {
      return bridge.dispatch(body, source);
    },
    [bridge]
  );
}
