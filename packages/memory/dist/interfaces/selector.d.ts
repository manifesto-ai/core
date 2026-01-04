/**
 * Memory Selector Interface
 *
 * Defines the interface for memory selection.
 * Applications MUST implement this interface (M-6).
 *
 * @see SPEC-1.2v §6.3, §8.3
 */
import type { SelectionRequest, SelectionResult } from "../schema/selection.js";
/**
 * Interface for memory selection operations.
 *
 * Applications MUST provide MemorySelector implementation (M-6).
 * Selection logic (LLM, embedding, rules) is application's concern.
 *
 * This layer is IMPURE:
 * - ✅ Calls MemoryStore (IO)
 * - ✅ Calls Verifier.prove()
 * - ✅ Adds timestamps (Date.now())
 * - ✅ Adds actor references (request.selector)
 *
 * Selection Process:
 * 1. Find candidate memories (vector search, keyword matching, etc.)
 * 2. Fetch World data from Store
 * 3. Call Verifier.prove() for each candidate
 * 4. Wrap VerificationProof into VerificationEvidence (M-9)
 *    - Add verifiedAt = Date.now()
 *    - Add verifiedBy = request.selector
 * 5. Apply constraints (confidence, verification status)
 * 6. Return SelectionResult with selected memories
 *
 * Module Access:
 * - Actor: ✅ Full access
 * - Projection: ❌ Forbidden (M-10)
 * - Authority: ❌ Forbidden (M-4)
 * - Host: ❌ Forbidden
 * - Core: ❌ Forbidden
 *
 * Non-determinism:
 * - Selection is intentionally NON-DETERMINISTIC
 * - Same query MAY yield different results
 * - This is why MemoryTrace records all selection details
 */
export interface MemorySelector {
    /**
     * Select relevant memories for a query.
     *
     * This operation is NON-DETERMINISTIC.
     * Same request MAY yield different results.
     * Results MUST satisfy constraints if provided.
     *
     * @param request - Selection request with query and constraints
     * @returns SelectionResult with selected memories and timestamp
     */
    select(request: SelectionRequest): Promise<SelectionResult>;
}
//# sourceMappingURL=selector.d.ts.map