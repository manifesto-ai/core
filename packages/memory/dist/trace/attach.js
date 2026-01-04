import { MEMORY_TRACE_KEY } from "../schema/trace.js";
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
export function attachToProposal(proposal, trace) {
    const existingTrace = proposal.trace ?? {
        summary: "Memory-enhanced proposal",
    };
    const existingContext = existingTrace.context ?? {};
    const newTrace = {
        ...existingTrace,
        context: {
            ...existingContext,
            [MEMORY_TRACE_KEY]: trace,
        },
    };
    return {
        ...proposal,
        trace: newTrace,
    };
}
/**
 * Get the MemoryTrace from a Proposal.
 *
 * @param proposal - The Proposal to extract the trace from
 * @returns The MemoryTrace if present, undefined otherwise
 */
export function getFromProposal(proposal) {
    const context = proposal.trace?.context;
    if (!context) {
        return undefined;
    }
    const memoryTrace = context[MEMORY_TRACE_KEY];
    if (!memoryTrace) {
        return undefined;
    }
    // Basic type check - we assume if it has the right shape, it's valid
    if (typeof memoryTrace === "object" &&
        memoryTrace !== null &&
        "selector" in memoryTrace &&
        "query" in memoryTrace &&
        "selectedAt" in memoryTrace &&
        "atWorldId" in memoryTrace &&
        "selected" in memoryTrace) {
        return memoryTrace;
    }
    return undefined;
}
/**
 * Check if a Proposal has a MemoryTrace attached.
 *
 * @param proposal - The Proposal to check
 * @returns true if the Proposal has a memory trace
 */
export function hasTrace(proposal) {
    return getFromProposal(proposal) !== undefined;
}
//# sourceMappingURL=attach.js.map