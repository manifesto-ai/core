/**
 * @manifesto-ai/react
 *
 * React bindings for Manifesto Bridge.
 * Provides Context and Hooks for integrating Bridge into React applications.
 *
 * ## Quick Start (Recommended)
 *
 * Use `createManifestoApp` for zero-config setup:
 *
 * @example
 * ```tsx
 * import { createManifestoApp } from "@manifesto-ai/react";
 * import { TodoDomain, initialState } from "./domain";
 *
 * const TodoApp = createManifestoApp(TodoDomain, { initialState });
 *
 * function App() {
 *   return (
 *     <TodoApp.Provider>
 *       <TodoList />
 *     </TodoApp.Provider>
 *   );
 * }
 *
 * function TodoList() {
 *   const todos = TodoApp.useValue(s => s.todos);
 *   const { add, toggle } = TodoApp.useActions();
 *
 *   return (
 *     <ul>
 *       {todos.map(t => (
 *         <li key={t.id} onClick={() => toggle({ id: t.id })}>
 *           {t.title}
 *         </li>
 *       ))}
 *       <button onClick={() => add({ title: "New Todo" })}>Add</button>
 *     </ul>
 *   );
 * }
 * ```
 *
 * ## Low-Level API
 *
 * For advanced use cases, use the low-level BridgeProvider API:
 *
 * @example
 * ```tsx
 * import { createBridge } from "@manifesto-ai/bridge";
 * import { BridgeProvider, useValue, useDispatch } from "@manifesto-ai/react";
 *
 * function App() {
 *   return (
 *     <BridgeProvider bridge={bridge}>
 *       <TodoList />
 *     </BridgeProvider>
 *   );
 * }
 * ```
 */

// =============================================================================
// Factory API (Recommended)
// =============================================================================

export {
  createManifestoApp,
  type InferState,
  type InferComputed,
  type InferActions,
  type ActionDispatchers,
  type ManifestoAppOptions,
  type ManifestoApp,
} from "./factory/index.js";

// =============================================================================
// Low-Level API (Advanced)
// =============================================================================

// Context
export {
  BridgeContext,
  type BridgeContextValue,
} from "./context/BridgeContext.js";
export {
  BridgeProvider,
  type BridgeProviderProps,
} from "./context/BridgeProvider.js";

// Hooks
export { useBridge } from "./hooks/useBridge.js";
export { useSnapshot } from "./hooks/useSnapshot.js";
export { useValue } from "./hooks/useValue.js";
export { useDispatch, type DispatchFn } from "./hooks/useDispatch.js";
export {
  useDispatchEvent,
  type DispatchEventFn,
} from "./hooks/useDispatchEvent.js";
