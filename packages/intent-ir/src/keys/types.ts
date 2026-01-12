/**
 * @fileoverview Key System Types (SPEC Section 12)
 *
 * Types for strictKey derivation context.
 */

import type { ResolvedIntentIR } from "../schema/index.js";

/**
 * Footprint defines which paths are relevant for effect analysis.
 */
export type Footprint = {
  /** Paths read during computation */
  readonly reads: readonly string[];
  /** Paths written during computation */
  readonly writes: readonly string[];
  /** Paths that affect computed values */
  readonly depends: readonly string[];
  /** Paths for verification */
  readonly verify?: readonly string[];
  /** Paths for policy check */
  readonly policy?: readonly string[];
};

/**
 * Execution context for strictKey derivation.
 */
export type ExecutionContext = {
  /** Domain schema fingerprint */
  readonly schemaHash: string;
  /** Constitution/rules fingerprint */
  readonly constitutionFingerprint?: string;
  /** Invariant constraints fingerprint */
  readonly invariantFingerprint?: string;
  /** Environment variables */
  readonly env?: Record<string, unknown>;
  /** Tenant identifier */
  readonly tenant?: string;
  /** Actor permissions (set-semantic: must be sorted) */
  readonly permissions?: readonly string[];
  /** Focus context fingerprint (for resolver) */
  readonly focusFingerprint?: string;
  /** Discourse context fingerprint (for resolver) */
  readonly discourseFingerprint?: string;
};

/**
 * Snapshot type for subsnapshot extraction.
 * Simplified interface - actual Snapshot from @manifesto-ai/core.
 */
export type Snapshot = {
  readonly data: Record<string, unknown>;
  readonly computed?: Record<string, unknown>;
  readonly meta?: {
    readonly version?: number;
    readonly hash?: string;
  };
};

/**
 * IntentBody type for intentKey derivation.
 * Matches the protocol definition in @manifesto-ai/world.
 */
export type IntentBody = {
  /** Action type identifier */
  readonly type: string;
  /** Action parameters */
  readonly input?: unknown;
  /** Proposed write scope */
  readonly scopeProposal?: IntentScope;
};

export type IntentScope = {
  readonly paths?: readonly string[];
  readonly constraints?: Record<string, unknown>;
};
