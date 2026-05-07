import type { NamespaceDelta, Patch, Requirement, Snapshot } from "@manifesto-ai/core";

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

export interface EffectFailure {
  readonly code: string;
  readonly message: string;
}

type EffectResultBase = {
  /**
   * Host-owned namespace deltas produced by internal effect execution plumbing.
   *
   * The public EffectHandler contract remains Patch[]; this field is for
   * Host-owned adapters that need to preserve namespace transitions.
   */
  readonly namespaceDelta?: readonly NamespaceDelta[];

  /**
   * Time taken in milliseconds
   */
  readonly duration: number;
};

export type EffectResult =
  | (EffectResultBase & {
      readonly ok: true;
      /** @deprecated Use ok. */
      readonly success: true;
      readonly patches: Patch[];
    })
  | (EffectResultBase & {
      readonly ok: false;
      /** @deprecated Use ok. */
      readonly success: false;
      readonly patches: [];
      readonly failure: EffectFailure;
      /** @deprecated Use failure.message. */
      readonly error: string;
      /** @deprecated Use failure.code. */
      readonly errorCode: string;
    });
