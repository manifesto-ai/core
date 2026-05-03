/**
 * Context Provider for Host v2.0.1
 *
 * Provides frozen Context per job to ensure determinism.
 *
 * @see host-SPEC-v2.0.1.md §11 Context Determinism
 *
 * Key requirements:
 * - CTX-1: Context MUST be frozen at the start of each job
 * - CTX-2: All operations within a single job MUST use the same frozen context
 * - CTX-3: `now` value MUST NOT change during job execution
 * - CTX-4: `randomSeed` MUST be deterministically derived from intentId
 * - CTX-5: Context MUST be captured ONCE per job, not per operation
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
   * Create a frozen context for a job.
   *
   * MUST be called once at job start. The returned context is frozen
   * and should be reused for all operations within the job.
   *
   * @param intentId - The intent ID for deterministic randomSeed derivation
   * @returns Frozen Context
   */
  createFrozenContext(intentId: string): Context;

  /**
   * Create an initial context for snapshot creation (before intents)
   *
   * @param randomSeed - Optional seed (defaults to "initial")
   */
  createInitialContext(randomSeed?: string): Context;

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
   * Create a frozen context for a job
   *
   * @see SPEC §11.3 Frozen Context Pattern
   */
  createFrozenContext(intentId: string): Context {
    // CTX-3: Call now() exactly once and freeze the value
    const now = this.nowProvider();

    // CTX-4: randomSeed is deterministically derived from intentId
    const randomSeed = intentId;

    // CTX-1: Freeze the context object
    return Object.freeze({
      runtime: {
        time: { timestamp: now },
        random: { seed: randomSeed },
      },
      external: this.envProvider() ?? {},
    });
  }

  /**
   * Create initial context for snapshot creation
   */
  createInitialContext(randomSeed: string = "initial"): Context {
    return Object.freeze({
      runtime: {
        time: { timestamp: this.nowProvider() },
        random: { seed: randomSeed },
      },
      external: this.envProvider() ?? {},
    });
  }

  /**
   * Get environment variables
   */
  getEnv(): Record<string, JsonValue> | undefined {
    return this.envProvider();
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
  options: Omit<HostContextProviderOptions, "now"> = {}
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
  env?: Record<string, JsonValue>
): HostContextProvider {
  return new DefaultHostContextProvider({
    now: () => fixedTimestamp,
    env,
  });
}
