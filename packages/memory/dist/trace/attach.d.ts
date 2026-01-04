/**
 * Memory Trace Attachment
 *
 * Utilities for attaching MemoryTrace to Proposals.
 *
 * @see SPEC-1.2v §10
 */
import type { Proposal } from "@manifesto-ai/world";
import type { MemoryTrace } from "../schema/trace.js";
/**
 * Attach a MemoryTrace to a Proposal.
 *
 * Memory integrates via existing Proposal.trace.context:
 * - proposal.trace.context.memory = MemoryTrace
 *
 * @param proposal - The Proposal to attach the trace to
 * @param trace - The MemoryTrace to attach
 * @returns A new Proposal with the memory trace attached
 */
export declare function attachToProposal<P extends Proposal>(proposal: P, trace: MemoryTrace): P;
/**
 * Get the MemoryTrace from a Proposal.
 *
 * @param proposal - The Proposal to extract the trace from
 * @returns The MemoryTrace if present, undefined otherwise
 */
export declare function getFromProposal(proposal: Proposal): MemoryTrace | undefined;
/**
 * Check if a Proposal has a MemoryTrace attached.
 *
 * @param proposal - The Proposal to check
 * @returns true if the Proposal has a memory trace
 */
export declare function hasTrace(proposal: Proposal): boolean;
//# sourceMappingURL=attach.d.ts.map