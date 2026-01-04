/**
 * Memory Selector Interface
 *
 * Defines the interface for selecting relevant memories.
 * Applications MUST implement this interface (M-6).
 *
 * @see SPEC-1.2v §6.3
 */
import type { SelectionRequest, SelectionResult } from "../schema/selection.js";
/**
 * Interface for memory selection operations.
 *
 * Applications MUST provide MemorySelector implementation (M-6).
 *
 * Selection is NON-DETERMINISTIC and explicitly TRACED.
 * All selections MUST be recorded in MemoryTrace (M-2).
 *
 * Selector is responsible for:
 * - Calling MemoryStore to retrieve candidates
 * - Calling MemoryVerifier.prove() for verification
 * - Creating VerificationEvidence (adding timestamps/actor)
 * - Applying selection constraints
 *
 * Module Access:
 * - Actor: ✅ Full access
 * - Projection: ❌ Forbidden (M-10)
 * - Authority: ❌ Forbidden (M-4)
 * - Host: ❌ Forbidden
 * - Core: ❌ Forbidden
 *
 * Example implementations:
 * - LLM-based semantic search
 * - Embedding-based similarity search
 * - Rule-based keyword matching
 * - Hybrid approaches
 */
export interface MemorySelector {
    /**
     * Select relevant memories based on the request.
     *
     * Selection is non-deterministic. Results MUST be traced.
     *
     * @param request - The selection request with query and constraints
     * @returns SelectionResult with selected memories and timestamp
     */
    select(request: SelectionRequest): Promise<SelectionResult>;
}
//# sourceMappingURL=selector.d.ts.map