import type { ExprNode } from "@manifesto-ai/core";
import type { FieldRef } from "../refs/field-ref.js";
import type { Expr } from "./expr-node.js";

/**
 * ItemProxy<T> - Proxy for accessing $item in collection operations
 *
 * Used in filter, map, find, every, some callbacks.
 * Acts like a FieldRef but generates $item.* paths.
 *
 * @example
 * ```ts
 * expr.filter(state.todos, item => expr.not(item.completed))
 * // item.completed compiles to { kind: "get", path: "$item.completed" }
 * ```
 */
export interface ItemProxy<T = unknown> {
  readonly __brand: "FieldRef";
  readonly path: string;
  readonly __type?: T;

  /**
   * Index accessor for nested properties
   * Allows item.nested.field access pattern
   */
  readonly [key: string]: ItemProxy<unknown> | string | T | undefined;
}

/**
 * IndexProxy - Proxy for accessing $index in collection operations
 */
export interface IndexProxy extends FieldRef<number> {}

/**
 * ArrayProxy - Proxy for accessing $array in collection operations
 */
export interface ArrayProxy<T = unknown> extends FieldRef<T[]> {}

/**
 * Create a nested proxy for a given path
 */
function createNestedProxy<T>(path: string): ItemProxy<T> {
  return new Proxy({} as ItemProxy<T>, {
    get(_, prop) {
      if (prop === "__brand") return "FieldRef";
      if (prop === "path") return path;
      if (prop === "__type") return undefined;
      if (prop === "then") return undefined; // Promise 오인 방지

      // 중첩 접근: item.nested.field → $item.nested.field
      const propName = String(prop);
      return createNestedProxy(`${path}.${propName}`);
    },
  });
}

/**
 * Create an ItemProxy that generates $item.* paths
 */
export function createItemProxy<T = unknown>(): ItemProxy<T> {
  return createNestedProxy<T>("$item");
}

/**
 * Create an IndexProxy that generates $index path
 */
export function createIndexProxy(): IndexProxy {
  return {
    __brand: "FieldRef",
    path: "$index",
  } as IndexProxy;
}

/**
 * Create an ArrayProxy that generates $array path
 */
export function createArrayProxy<T = unknown>(): ArrayProxy<T> {
  return {
    __brand: "FieldRef",
    path: "$array",
  } as ArrayProxy<T>;
}

/**
 * Extract predicate ExprNode from callback function
 */
export function extractPredicate<T>(
  callback: (item: ItemProxy<T>, index?: IndexProxy, array?: ArrayProxy<T>) => Expr<boolean>
): ExprNode {
  const itemProxy = createItemProxy<T>();
  const indexProxy = createIndexProxy();
  const arrayProxy = createArrayProxy<T>();

  const result = callback(itemProxy, indexProxy, arrayProxy);
  return result.compile();
}

/**
 * Extract mapper ExprNode from callback function
 */
export function extractMapper<T, R>(
  callback: (item: ItemProxy<T>, index?: IndexProxy, array?: ArrayProxy<T>) => Expr<R>
): ExprNode {
  const itemProxy = createItemProxy<T>();
  const indexProxy = createIndexProxy();
  const arrayProxy = createArrayProxy<T>();

  const result = callback(itemProxy, indexProxy, arrayProxy);
  return result.compile();
}

/**
 * Collect dependencies from an ExprNode (for $item paths, convert to array path)
 */
export function collectPredicateDeps(node: ExprNode, arrayPath: string): string[] {
  const deps: string[] = [];
  collectDepsRecursive(node, deps, arrayPath);
  return deps;
}

function collectDepsRecursive(node: ExprNode, deps: string[], arrayPath: string): void {
  if (!node || typeof node !== "object") return;

  if (node.kind === "get") {
    const path = (node as { path: string }).path;
    // $item.* paths are relative to the array
    if (path.startsWith("$item") || path.startsWith("$index") || path.startsWith("$array")) {
      // These are iteration-local, so dep is the array itself
      if (!deps.includes(arrayPath)) {
        deps.push(arrayPath);
      }
    } else {
      if (!deps.includes(path)) {
        deps.push(path);
      }
    }
  }

  // Recursively collect from all child nodes
  for (const key of Object.keys(node)) {
    const value = (node as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object") {
          collectDepsRecursive(item as ExprNode, deps, arrayPath);
        }
      }
    } else if (value && typeof value === "object") {
      collectDepsRecursive(value as ExprNode, deps, arrayPath);
    }
  }
}
