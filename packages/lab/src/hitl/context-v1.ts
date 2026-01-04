/**
 * HITL Context v1.1
 *
 * Extended HITL context with prompt builder.
 * Added in v1.1.
 */

import type { Snapshot, Proposal } from "@manifesto-ai/world";
import type {
  HITLContextV1,
  HITLPrompt,
  HITLPromptOptions,
  HITLAction,
  PendingReason,
  RenderContext,
  DecisionRecord,
} from "../types.js";
import { buildPrompt } from "./prompt.js";
import { getDefaultActions } from "./actions.js";

// =============================================================================
// Factory
// =============================================================================

/**
 * Options for creating an HITLContextV1.
 */
export interface CreateHITLContextOptions {
  /** Current snapshot */
  snapshot: Snapshot;

  /** The pending proposal */
  proposal: Proposal;

  /** Why the proposal is pending */
  pendingReason: PendingReason;

  /** Render context */
  renderContext: RenderContext;

  /** Decision record from Authority */
  decisionRecord: DecisionRecord;

  /** Custom available actions (optional, defaults based on reason) */
  availableActions?: HITLAction[];
}

/**
 * Create an HITLContextV1 instance.
 *
 * @param options - Creation options
 * @returns HITLContextV1 instance
 */
export function createHITLContext(options: CreateHITLContextOptions): HITLContextV1 {
  const {
    snapshot,
    proposal,
    pendingReason,
    renderContext,
    decisionRecord,
  } = options;

  // Use provided actions or generate defaults based on pending reason
  const availableActions =
    options.availableActions ?? getDefaultActions(pendingReason.code);

  // Create the context object
  const context: HITLContextV1 = {
    snapshot,
    proposal,
    pendingReason,
    availableActions,
    renderContext,
    decisionRecord,

    toPrompt(promptOptions?: HITLPromptOptions): HITLPrompt {
      return buildPrompt({
        snapshot,
        proposal,
        pendingReason,
        availableActions,
        renderContext,
        promptOptions,
      });
    },
  };

  return context;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Create a decision record for a pending decision.
 *
 * @param authorityId - The authority that made the decision
 * @param options - Additional options
 * @returns DecisionRecord
 */
export function createPendingDecisionRecord(
  authorityId: string,
  options?: {
    confidence?: number;
    note?: string;
    verificationMethod?: DecisionRecord["verificationMethod"];
  }
): DecisionRecord {
  return {
    authorityId,
    decision: "pending",
    timestamp: Date.now(),
    verificationMethod: options?.verificationMethod,
    confidence: options?.confidence,
    note: options?.note,
  };
}

/**
 * Check if a context can be auto-resolved based on suggestions.
 *
 * @param context - The HITL context
 * @returns true if auto-resolution is possible
 */
export function canAutoResolve(context: HITLContextV1): boolean {
  // Can auto-resolve if:
  // 1. Low confidence with confidence close to threshold
  // 2. Requires confirmation for low-risk actions
  const reason = context.pendingReason;

  if (reason.code === "LOW_CONFIDENCE") {
    const details = reason.details.confidence;
    if (details) {
      // Auto-resolve if within 10% of threshold
      const gap = details.required - details.actual;
      return gap <= 0.1;
    }
  }

  if (reason.code === "REQUIRES_CONFIRMATION") {
    const details = reason.details.confirmation;
    if (details && details.risk === "low") {
      return true;
    }
  }

  return false;
}

/**
 * Get suggested action for auto-resolution.
 *
 * @param context - The HITL context
 * @returns Suggested action type or null
 */
export function getSuggestedAction(
  context: HITLContextV1
): HITLAction["type"] | null {
  if (!canAutoResolve(context)) {
    return null;
  }

  const reason = context.pendingReason;

  if (reason.code === "LOW_CONFIDENCE") {
    return "retry";
  }

  if (reason.code === "REQUIRES_CONFIRMATION") {
    const details = reason.details.confirmation;
    if (details?.risk === "low") {
      return "retry"; // Auto-approve low-risk
    }
  }

  return null;
}
