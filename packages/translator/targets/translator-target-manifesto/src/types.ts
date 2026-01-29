/**
 * @fileoverview Manifesto target types for translator output.
 */

import type { IntentIR, IntentBody, Lexicon, Resolver } from "@manifesto-ai/intent-ir";
import type {
  IntentNodeId,
  Resolution,
  DependencyEdge,
  ExtensionCandidate,
} from "@manifesto-ai/translator";

// =============================================================================
// Context
// =============================================================================

/**
 * Context required for Manifesto export.
 */
export interface ManifestoExportContext {
  readonly lexicon: Lexicon;
  readonly resolver: Resolver;
  readonly domain?: string;
}

// =============================================================================
// Lowering
// =============================================================================

/**
 * Reason why lowering failed.
 */
export type LoweringFailure = {
  readonly kind:
    | "UNSUPPORTED_EVENT"
    | "INVALID_ARGS"
    | "MISSING_REQUIRED"
    | "SCHEMA_MISMATCH"
    | "INTERNAL_ERROR";
  readonly details: string;
};

/**
 * Result of lowering an IntentIR to IntentBody.
 */
export type LoweringResult =
  | {
      readonly status: "ready";
      readonly intentBody: IntentBody;
    }
  | {
      readonly status: "deferred";
      readonly reason: string;
    }
  | {
      readonly status: "failed";
      readonly failure: LoweringFailure;
    };

// =============================================================================
// Invocation Plan
// =============================================================================

/**
 * A single step in an InvocationPlan.
 */
export type InvocationStep = {
  readonly nodeId: IntentNodeId;
  readonly ir: IntentIR;
  readonly resolution: Resolution;
  readonly lowering: LoweringResult;
};

/**
 * A sequence of executable steps derived from the Intent Graph.
 */
export type InvocationPlan = {
  readonly steps: readonly InvocationStep[];
  readonly dependencyEdges: readonly DependencyEdge[];
  readonly abstractNodes: readonly IntentNodeId[];
};

// =============================================================================
// Bundle
// =============================================================================

/**
 * Manifesto target output bundle.
 */
export interface ManifestoBundle {
  readonly invocationPlan: InvocationPlan;
  readonly extensionCandidates: readonly ExtensionCandidate[];
  readonly meta: Readonly<{
    nodeCount: number;
    readyCount: number;
    deferredCount: number;
    failedCount: number;
  }>;
}
