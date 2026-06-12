/**
 * ADR-027 Context Provider for Host
 *
 * Provides materialized Context values for transition attempts.
 *
 * @see host-SPEC.md §10 Context Determinism
 *
 * Key requirements:
 * - CTX-1: Context MUST be materialized once per transition attempt
 * - CTX-2: All compute re-entry in one attempt MUST use the same context
 * - CTX-3: `runtime.time.timestamp` MUST NOT change during the attempt
 * - CTX-4: `runtime.random.seed` MUST be deterministically derived from intentId
 * - CTX-5: Context MUST be captured once per transition attempt, not per operation
 */

import type { Context, JsonValue } from "@manifesto-ai/core";
import type { Runtime } from "./types/execution.js";

/**
 * Options for creating Context
 */
export interface HostContextProviderOptions {
  /**
   * Custom time provider (for testing)
   */
  now?: () => number;

  /**
   * Environment variables to include in context
   */
  env?: Record<string, JsonValue>;
}

/**
 * HostContextProvider interface
 *
 * @see SPEC §11.6 Implementation Pattern
 */
export interface HostContextProvider {
  /**
   * Create a materialized context for a transition attempt.
   *
   * MUST be called once per transition attempt. The returned context is frozen
   * and should be reused for all compute re-entry within the attempt.
   *
   * @param intentId - The intent ID for deterministic randomSeed derivation
   * @returns Frozen Context
   */
  createFrozenContext(intentId: string, external?: Record<string, JsonValue>): Context;

  /**
   * Create an initial context for snapshot creation (before intents)
   *
   * @param randomSeed - Optional seed (defaults to "initial")
   */
  createInitialContext(randomSeed?: string, external?: Record<string, JsonValue>): Context;

  /**
   * Get environment variables
   */
  getEnv(): Record<string, JsonValue> | undefined;
}

/**
 * Default HostContextProvider implementation
 *
 * @see SPEC §11.6
 */
export class DefaultHostContextProvider implements HostContextProvider {
  private readonly nowProvider: () => number;
  private readonly envProvider: () => Record<string, JsonValue> | undefined;

  constructor(options: HostContextProviderOptions = {}) {
    this.nowProvider = options.now ?? (() => Date.now());
    this.envProvider = () => options.env;
  }

  /**
   * Create a materialized context for a transition attempt
   *
   * @see SPEC §11.3 Frozen Context Pattern
   */
  createFrozenContext(intentId: string, external?: Record<string, JsonValue>): Context {
    // CTX-3: Call now() exactly once and freeze the value
    const now = this.nowProvider();

    // CTX-4: randomSeed is deterministically derived from intentId
    const randomSeed = intentId;

    return Object.freeze({
      runtime: Object.freeze({
        time: Object.freeze({ timestamp: now }),
        random: Object.freeze({ seed: randomSeed }),
      }),
      external: cloneExternalContext(external ?? {}),
    });
  }

  /**
   * Create initial context for snapshot creation
   */
  createInitialContext(
    randomSeed: string = "initial",
    external?: Record<string, JsonValue>,
  ): Context {
    return Object.freeze({
      runtime: Object.freeze({
        time: Object.freeze({ timestamp: this.nowProvider() }),
        random: Object.freeze({ seed: randomSeed }),
      }),
      external: cloneExternalContext(external ?? {}),
    });
  }

  /**
   * Get environment variables
   */
  getEnv(): Record<string, JsonValue> | undefined {
    const env = this.envProvider();
    return env ? cloneExternalContext(env) : undefined;
  }
}

function cloneExternalContext(external: Record<string, JsonValue>): Record<string, JsonValue> {
  return cloneJsonObject(external, new WeakSet());
}

function cloneJsonValue(value: JsonValue, seen: WeakSet<object>): JsonValue {
  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError("Context external numbers must be finite");
      }
      return value;
    case "undefined":
      throw new TypeError("Context external values must not contain undefined");
    case "function":
      throw new TypeError("Context external values must not contain functions");
    case "symbol":
      throw new TypeError("Context external values must not contain symbols");
    case "bigint":
      throw new TypeError("Context external values must not contain bigint values");
    case "object":
      break;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new TypeError("Context external value must not contain cycles");
    }
    rejectAccessors(value);
    rejectSymbolKeys(value);
    seen.add(value);
    const cloned: JsonValue[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) {
        throw new TypeError("Context external arrays must not contain holes");
      }
      cloned.push(cloneJsonValue(value[index] as JsonValue, seen));
    }
    seen.delete(value);
    return Object.freeze(cloned);
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return cloneJsonObject(value as { readonly [key: string]: JsonValue }, seen);
  }

  return value;
}

function cloneJsonObject(
  value: { readonly [key: string]: JsonValue },
  seen: WeakSet<object>,
): Record<string, JsonValue> {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Context external objects must be plain JSON objects");
  }

  if (seen.has(value)) {
    throw new TypeError("Context external value must not contain cycles");
  }
  rejectAccessors(value);
  rejectSymbolKeys(value);
  seen.add(value);
  const cloned = Object.freeze(
    Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneJsonValue(child, seen)]),
    ),
  ) as Record<string, JsonValue>;
  seen.delete(value);
  return cloned;
}

function rejectAccessors(value: object): void {
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if (descriptor.get || descriptor.set) {
      throw new TypeError("Context external values must not contain getters or setters");
    }
  }
}

function rejectSymbolKeys(value: object): void {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError("Context external values must not contain symbol keys");
  }
}

/**
 * Create a HostContextProvider with runtime integration
 *
 * @param runtime - Runtime for time provider
 * @param options - Additional options
 */
export function createHostContextProvider(
  runtime: Runtime,
  options: Omit<HostContextProviderOptions, "now"> = {},
): HostContextProvider {
  return new DefaultHostContextProvider({
    now: () => runtime.now(),
    env: options.env,
  });
}

/**
 * Create a HostContextProvider with fixed timestamp (for testing)
 *
 * @see SPEC §11.7 Testing Determinism
 *
 * @param fixedTimestamp - Fixed timestamp value
 * @param env - Environment variables
 */
export function createTestHostContextProvider(
  fixedTimestamp: number,
  env?: Record<string, JsonValue>,
): HostContextProvider {
  return new DefaultHostContextProvider({
    now: () => fixedTimestamp,
    env,
  });
}
