/**
 * Simple Keyword-Based Selector Implementation
 *
 * A basic MemorySelector implementation using keyword matching.
 * Demonstrates the correct Selector pattern per SPEC-1.2v.
 *
 * NOT for production use - use LLM/embedding-based selectors instead.
 *
 * @see SPEC-1.2v §6.3, Appendix D.3
 */
import type { WorldId } from "@manifesto-ai/world";
import type { MemorySelector } from "../interfaces/selector.js";
import type { MemoryStore } from "../interfaces/store.js";
import type { MemoryVerifier } from "../interfaces/verifier.js";
import type { SelectionRequest, SelectionResult } from "../schema/selection.js";
/**
 * Entry in the keyword index.
 */
export interface KeywordIndexEntry {
    /** World ID this entry refers to */
    worldId: WorldId;
    /** Keywords associated with this World */
    keywords: string[];
    /** Optional metadata for additional filtering */
    metadata?: Record<string, unknown>;
}
/**
 * Interface for keyword-based World indexing.
 */
export interface KeywordIndex {
    /**
     * Find entries by keyword matching.
     *
     * @param keywords - Keywords to search for
     * @returns Matching entries
     */
    findByKeywords(keywords: string[]): KeywordIndexEntry[];
    /**
     * Add an entry to the index.
     *
     * @param entry - Entry to add
     */
    add(entry: KeywordIndexEntry): void;
    /**
     * Remove an entry from the index.
     *
     * @param worldId - World ID to remove
     */
    remove(worldId: WorldId): void;
    /**
     * Clear all entries.
     */
    clear(): void;
    /**
     * Get number of entries.
     */
    readonly size: number;
}
/**
 * In-memory keyword index implementation.
 *
 * Features:
 * - Case-insensitive matching
 * - Partial keyword overlap scoring
 * - O(n) search complexity
 */
export declare class InMemoryKeywordIndex implements KeywordIndex {
    private readonly entries;
    findByKeywords(keywords: string[]): KeywordIndexEntry[];
    add(entry: KeywordIndexEntry): void;
    remove(worldId: WorldId): void;
    clear(): void;
    get size(): number;
}
/**
 * Simple keyword-based MemorySelector.
 *
 * Selection Process:
 * 1. Extract keywords from query
 * 2. Find candidates from index
 * 3. Calculate confidence (keyword overlap ratio)
 * 4. Fetch World from Store, call Verifier.prove()
 * 5. Create VerificationEvidence (M-9)
 * 6. Apply constraints
 * 7. Return SelectionResult
 *
 * This is an IMPURE layer - calls Store, adds timestamps.
 */
export declare class SimpleSelector implements MemorySelector {
    private readonly store;
    private readonly verifier;
    private readonly index;
    constructor(store: MemoryStore, verifier: MemoryVerifier, index: KeywordIndex);
    select(request: SelectionRequest): Promise<SelectionResult>;
    /**
     * Extract keywords from a query string.
     * Simple implementation: split by whitespace, lowercase, filter short words.
     */
    private extractKeywords;
    /**
     * Check if a word is a stop word.
     */
    private isStopWord;
    /**
     * Calculate confidence based on keyword overlap.
     * Returns a value between 0 and 1.
     */
    private calculateConfidence;
    /**
     * Build a reason string explaining the match.
     */
    private buildReason;
}
/**
 * Factory function to create a SimpleSelector.
 *
 * @param store - MemoryStore for fetching Worlds
 * @param verifier - MemoryVerifier for generating proofs
 * @param index - KeywordIndex for candidate search
 */
export declare function createSimpleSelector(store: MemoryStore, verifier: MemoryVerifier, index: KeywordIndex): SimpleSelector;
/**
 * Factory function to create an InMemoryKeywordIndex.
 */
export declare function createKeywordIndex(): InMemoryKeywordIndex;
//# sourceMappingURL=simple-selector.d.ts.map