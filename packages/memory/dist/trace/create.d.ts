/**
 * Memory Trace Creation
 *
 * Utilities for creating MemoryTrace objects.
 *
 * @see SPEC-1.2v §5.1.5
 */
import type { ActorRef, WorldId } from "@manifesto-ai/world";
import type { MemoryTrace } from "../schema/trace.js";
import type { SelectedMemory, SelectionResult } from "../schema/selection.js";
/**
 * Create a MemoryTrace from selection results.
 *
 * @param selector - Who performed the selection
 * @param query - What was being searched for
 * @param atWorldId - World context at selection time
 * @param selected - What was selected
 * @returns A complete MemoryTrace
 */
export declare function createMemoryTrace(selector: ActorRef, query: string, atWorldId: WorldId, selected: readonly SelectedMemory[]): MemoryTrace;
/**
 * Create a MemoryTrace from a SelectionResult.
 *
 * Convenience function that extracts values from SelectionResult.
 *
 * @param selector - Who performed the selection
 * @param query - What was being searched for
 * @param atWorldId - World context at selection time
 * @param result - The selection result
 * @returns A complete MemoryTrace
 */
export declare function createMemoryTraceFromResult(selector: ActorRef, query: string, atWorldId: WorldId, result: SelectionResult): MemoryTrace;
//# sourceMappingURL=create.d.ts.map