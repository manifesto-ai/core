import type { MemorySelector } from "../interfaces/selector.js";
import type { MemoryStore } from "../interfaces/store.js";
import type { MemoryVerifier } from "../interfaces/verifier.js";
import type { SelectionRequest, SelectionResult } from "../schema/selection.js";
/**
 * Simple keyword-based implementation of MemorySelector.
 *
 * Features:
 * - Keyword-based matching
 * - Integrates with MemoryStore for retrieval
 * - Integrates with MemoryVerifier for proof generation
 * - Creates VerificationEvidence (adds timestamps/actor)
 *
 * Use cases:
 * - Unit testing
 * - Development/prototyping
 * - Examples and documentation
 *
 * For production, consider:
 * - LLM-based semantic search
 * - Embedding-based similarity search
 * - Hybrid approaches
 */
export declare class SimpleSelector implements MemorySelector {
    private readonly store;
    private readonly verifier;
    private readonly index;
    constructor(store: MemoryStore, verifier: MemoryVerifier);
    /**
     * Add a World to the index with associated keywords.
     *
     * @param worldId - The World ID to index
     * @param keywords - Keywords associated with this World
     * @param createdAt - When the World was created
     */
    addToIndex(worldId: string, keywords: string[], createdAt: number): void;
    /**
     * Remove a World from the index.
     *
     * @param worldId - The World ID to remove
     */
    removeFromIndex(worldId: string): void;
    /**
     * Clear the index.
     */
    clearIndex(): void;
    /**
     * Select relevant memories based on keyword matching.
     *
     * @param request - The selection request
     * @returns SelectionResult with matched memories
     */
    select(request: SelectionRequest): Promise<SelectionResult>;
}
/**
 * Factory function to create a SimpleSelector.
 *
 * @param store - The MemoryStore to use for retrieval
 * @param verifier - The MemoryVerifier to use for proof generation
 */
export declare function createSimpleSelector(store: MemoryStore, verifier: MemoryVerifier): SimpleSelector;
//# sourceMappingURL=simple-selector.d.ts.map