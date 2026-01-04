/**
 * HITL Context v1.1
 *
 * Extended HITL context with prompt builder.
 * Added in v1.1.
 */
import type { Snapshot, Proposal } from "@manifesto-ai/world";
import type { HITLContextV1, HITLAction, PendingReason, RenderContext, DecisionRecord } from "../types.js";
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
export declare function createHITLContext(options: CreateHITLContextOptions): HITLContextV1;
/**
 * Create a decision record for a pending decision.
 *
 * @param authorityId - The authority that made the decision
 * @param options - Additional options
 * @returns DecisionRecord
 */
export declare function createPendingDecisionRecord(authorityId: string, options?: {
    confidence?: number;
    note?: string;
    verificationMethod?: DecisionRecord["verificationMethod"];
}): DecisionRecord;
/**
 * Check if a context can be auto-resolved based on suggestions.
 *
 * @param context - The HITL context
 * @returns true if auto-resolution is possible
 */
export declare function canAutoResolve(context: HITLContextV1): boolean;
/**
 * Get suggested action for auto-resolution.
 *
 * @param context - The HITL context
 * @returns Suggested action type or null
 */
export declare function getSuggestedAction(context: HITLContextV1): HITLAction["type"] | null;
//# sourceMappingURL=context-v1.d.ts.map