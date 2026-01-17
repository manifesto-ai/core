import type { Patch, Requirement, Snapshot } from "@manifesto-ai/core";
import type { EffectContext, EffectResult, RegisteredHandler } from "./types.js";
import type { EffectHandlerRegistry } from "./registry.js";
import { createHostError, HostError, isHostError } from "../errors.js";

/**
 * Execute a single effect with timeout and retry support
 */
async function executeWithRetry(
  handler: RegisteredHandler,
  type: string,
  params: Record<string, unknown>,
  context: EffectContext
): Promise<EffectResult> {
  const { options } = handler;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= options.retries; attempt++) {
    if (attempt > 0) {
      await sleep(options.retryDelay);
    }

    const startTime = Date.now();

    try {
      const patches = await withTimeout(
        handler.handler(type, params, context),
        options.timeout
      );

      return {
        success: true,
        patches,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on timeout
      if (isHostError(error) && error.code === "EFFECT_TIMEOUT") {
        return {
          success: false,
          patches: [],
          error: lastError.message,
          duration: Date.now() - startTime,
        };
      }
    }
  }

  return {
    success: false,
    patches: [],
    error: lastError?.message ?? "Unknown error",
    duration: 0,
  };
}

/**
 * Execute with timeout
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(createHostError("EFFECT_TIMEOUT", `Effect timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  const props = Object.getOwnPropertyNames(value);
  for (const prop of props) {
    const child = (value as Record<string, unknown>)[prop];
    if (child && typeof child === "object") {
      deepFreeze(child);
    }
  }

  return Object.freeze(value);
}

/**
 * Effect executor
 *
 * Executes effects from requirements using registered handlers
 */
export class EffectExecutor {
  constructor(private registry: EffectHandlerRegistry) {}

  /**
   * Execute a single requirement
   *
   * @param requirement - The requirement to fulfill
   * @param snapshot - Current snapshot (read-only)
   * @returns Effect execution result
   */
  async execute(requirement: Requirement, snapshot: Snapshot): Promise<EffectResult> {
    const handler = this.registry.get(requirement.type);

    if (!handler) {
      return {
        success: false,
        patches: [],
        error: `Unknown effect type: ${requirement.type}`,
        duration: 0,
      };
    }

    const context: EffectContext = {
      snapshot: deepFreeze(snapshot),
      requirement: deepFreeze(requirement),
    };

    try {
      return await executeWithRetry(
        handler,
        requirement.type,
        requirement.params,
        context
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        patches: [],
        error: message,
        duration: 0,
      };
    }
  }

  /**
   * Execute multiple requirements
   *
   * Effects are executed sequentially to maintain determinism.
   * Failed effects do not stop subsequent effects.
   *
   * @deprecated v2.0.1 - Use FulfillEffect jobs instead. The v2.0.1 model
   * processes effects one at a time via the mailbox, not in batches.
   * This method will be removed in a future major version.
   *
   * @param requirements - Requirements to fulfill
   * @param snapshot - Current snapshot (read-only)
   * @returns Array of results and aggregated patches
   */
  async executeAll(
    requirements: readonly Requirement[],
    snapshot: Snapshot
  ): Promise<{ results: EffectResult[]; patches: Patch[] }> {
    const results: EffectResult[] = [];
    const patches: Patch[] = [];

    for (const requirement of requirements) {
      const result = await this.execute(requirement, snapshot);
      results.push(result);

      if (result.success) {
        patches.push(...result.patches);
      }
    }

    return { results, patches };
  }

  /**
   * Check if all required effect types are registered
   *
   * @deprecated v2.0.1 - The v2.0.1 model handles missing handlers
   * via error patches in FulfillEffect jobs. This method will be
   * removed in a future major version.
   *
   * @param requirements - Requirements to check
   * @returns Array of missing effect types
   */
  getMissingHandlers(requirements: readonly Requirement[]): string[] {
    const missing: string[] = [];

    for (const requirement of requirements) {
      if (!this.registry.has(requirement.type)) {
        if (!missing.includes(requirement.type)) {
          missing.push(requirement.type);
        }
      }
    }

    return missing;
  }
}

/**
 * Create an effect executor with the given registry
 */
export function createEffectExecutor(registry: EffectHandlerRegistry): EffectExecutor {
  return new EffectExecutor(registry);
}
