/**
 * useValue Hook
 *
 * Subscribe to a specific value by path from the snapshot.
 * Optimized to minimize re-renders using useSyncExternalStore.
 */
import { useCallback, useSyncExternalStore } from "react";
import { useBridge } from "./useBridge.js";

/**
 * useValue
 *
 * Returns a value at the specified path from the snapshot.
 * Uses useSyncExternalStore for safe external store subscription.
 *
 * The component will only re-render when the value at the path changes.
 *
 * @param path - Path to the value (e.g., "data.todos", "computed.totalCount")
 * @returns Value at the path, or undefined if not found
 *
 * @example
 * ```tsx
 * interface Todo {
 *   id: string;
 *   title: string;
 *   completed: boolean;
 * }
 *
 * function TodoList() {
 *   const todos = useValue<Todo[]>("data.todos");
 *   const count = useValue<number>("computed.totalCount");
 *
 *   if (!todos) {
 *     return <div>No todos</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <h2>Todos ({count})</h2>
 *       <ul>
 *         {todos.map(todo => (
 *           <li key={todo.id}>{todo.title}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useValue<T>(path: string): T | undefined {
  const bridge = useBridge();

  // Subscribe function for useSyncExternalStore
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return bridge.subscribe(onStoreChange);
    },
    [bridge]
  );

  // Get current value at path
  const getSnapshot = useCallback(() => {
    return bridge.get(path) as T | undefined;
  }, [bridge, path]);

  // Use same function for server snapshot (SSR)
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
