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
export class SimpleSelector {
    store;
    verifier;
    index = [];
    constructor(store, verifier) {
        this.store = store;
        this.verifier = verifier;
    }
    /**
     * Add a World to the index with associated keywords.
     *
     * @param worldId - The World ID to index
     * @param keywords - Keywords associated with this World
     * @param createdAt - When the World was created
     */
    addToIndex(worldId, keywords, createdAt) {
        this.index.push({
            worldId,
            keywords: keywords.map((k) => k.toLowerCase()),
            createdAt,
        });
    }
    /**
     * Remove a World from the index.
     *
     * @param worldId - The World ID to remove
     */
    removeFromIndex(worldId) {
        const idx = this.index.findIndex((e) => e.worldId === worldId);
        if (idx !== -1) {
            this.index.splice(idx, 1);
        }
    }
    /**
     * Clear the index.
     */
    clearIndex() {
        this.index.length = 0;
    }
    /**
     * Select relevant memories based on keyword matching.
     *
     * @param request - The selection request
     * @returns SelectionResult with matched memories
     */
    async select(request) {
        const queryKeywords = request.query.toLowerCase().split(/\s+/);
        const selectedAt = Date.now();
        // Find matching entries
        const matches = this.index
            .map((entry) => {
            // Calculate match score (number of matching keywords)
            const matchCount = queryKeywords.filter((q) => entry.keywords.some((k) => k.includes(q) || q.includes(k))).length;
            const confidence = queryKeywords.length > 0 ? matchCount / queryKeywords.length : 0;
            return { entry, confidence };
        })
            .filter(({ confidence }) => confidence > 0)
            .sort((a, b) => b.confidence - a.confidence);
        // Apply constraints
        let candidates = matches;
        if (request.constraints?.minConfidence !== undefined) {
            candidates = candidates.filter((m) => m.confidence >= request.constraints.minConfidence);
        }
        if (request.constraints?.maxResults !== undefined) {
            candidates = candidates.slice(0, request.constraints.maxResults);
        }
        if (request.constraints?.timeRange) {
            const { after, before } = request.constraints.timeRange;
            candidates = candidates.filter(({ entry }) => {
                if (after !== undefined && entry.createdAt < after)
                    return false;
                if (before !== undefined && entry.createdAt > before)
                    return false;
                return true;
            });
        }
        // Build selected memories
        const selected = await Promise.all(candidates.map(async ({ entry, confidence }) => {
            const world = await this.store.get(entry.worldId);
            // Generate proof (pure - Verifier)
            const proveResult = world
                ? this.verifier.prove({ worldId: entry.worldId }, world)
                : { valid: false, error: "World not found" };
            // Create evidence (Selector adds timestamp/actor)
            const evidence = proveResult.proof
                ? {
                    method: proveResult.proof.method,
                    proof: proveResult.proof.proof,
                    verifiedAt: selectedAt,
                    verifiedBy: request.selector,
                }
                : undefined;
            return {
                ref: { worldId: entry.worldId },
                reason: `Matched keywords in query: ${request.query}`,
                confidence,
                verified: proveResult.valid,
                evidence,
            };
        }));
        // Apply post-verification constraints
        let filtered = selected;
        if (request.constraints?.requireVerified) {
            filtered = filtered.filter((m) => m.verified);
        }
        if (request.constraints?.requireEvidence) {
            filtered = filtered.filter((m) => m.evidence !== undefined && m.evidence.method !== "none");
        }
        return {
            selected: filtered,
            selectedAt,
        };
    }
}
/**
 * Factory function to create a SimpleSelector.
 *
 * @param store - The MemoryStore to use for retrieval
 * @param verifier - The MemoryVerifier to use for proof generation
 */
export function createSimpleSelector(store, verifier) {
    return new SimpleSelector(store, verifier);
}
//# sourceMappingURL=simple-selector.js.map