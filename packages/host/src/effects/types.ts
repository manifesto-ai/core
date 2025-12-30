import type { Patch, Requirement, Snapshot } from "@manifesto-ai/core";

/**
 * Context provided to effect handlers
 */
export interface EffectContext {
  /**
   * Current snapshot (read-only)
   */
  readonly snapshot: Readonly<Snapshot>;

  /**
   * The requirement being fulfilled
   */
  readonly requirement: Requirement;
}

/**
 * Effect handler function signature
 *
 * Effect handlers:
 * - MUST return Patch[] (can be empty)
 * - MUST NOT throw exceptions (return error patches instead)
 * - MUST NOT contain domain logic
 * - SHOULD be idempotent when possible
 */
export type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: EffectContext
) => Promise<Patch[]>;

/**
 * Effect handler options
 */
export interface EffectHandlerOptions {
  /**
   * Timeout in milliseconds (default: 30000)
   */
  timeout?: number;

  /**
   * Number of retry attempts (default: 0)
   */
  retries?: number;

  /**
   * Retry delay in milliseconds (default: 1000)
   */
  retryDelay?: number;
}

/**
 * Registered effect handler with options
 */
export interface RegisteredHandler {
  handler: EffectHandler;
  options: Required<EffectHandlerOptions>;
}

/**
 * Effect execution result
 */
export interface EffectResult {
  /**
   * Whether the effect was successful
   */
  success: boolean;

  /**
   * Patches returned by the handler (empty on failure)
   */
  patches: Patch[];

  /**
   * Error message if failed
   */
  error?: string;

  /**
   * Time taken in milliseconds
   */
  duration: number;
}
