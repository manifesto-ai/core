import { createMemoryRef } from "../schema/ref.js";
/**
 * In-memory keyword index implementation.
 *
 * Features:
 * - Case-insensitive matching
 * - Partial keyword overlap scoring
 * - O(n) search complexity
 */
export class InMemoryKeywordIndex {
    entries = new Map();
    findByKeywords(keywords) {
        if (keywords.length === 0) {
            return [];
        }
        const normalizedQuery = keywords.map((k) => k.toLowerCase());
        const matches = [];
        for (const entry of this.entries.values()) {
            const normalizedEntryKeywords = entry.keywords.map((k) => k.toLowerCase());
            const hasMatch = normalizedQuery.some((qk) => normalizedEntryKeywords.some((ek) => ek.includes(qk) || qk.includes(ek)));
            if (hasMatch) {
                matches.push(entry);
            }
        }
        return matches;
    }
    add(entry) {
        this.entries.set(entry.worldId, entry);
    }
    remove(worldId) {
        this.entries.delete(worldId);
    }
    clear() {
        this.entries.clear();
    }
    get size() {
        return this.entries.size;
    }
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
export class SimpleSelector {
    store;
    verifier;
    index;
    constructor(store, verifier, index) {
        this.store = store;
        this.verifier = verifier;
        this.index = index;
    }
    async select(request) {
        const { query, selector, constraints } = request;
        const selectedAt = Date.now();
        // 1. Extract keywords from query (simple split)
        const queryKeywords = this.extractKeywords(query);
        // 2. Find candidates from index
        const candidates = this.index.findByKeywords(queryKeywords);
        // 3. Process each candidate
        const selected = [];
        for (const candidate of candidates) {
            // Calculate confidence based on keyword overlap
            const confidence = this.calculateConfidence(queryKeywords, candidate.keywords);
            // Apply minConfidence constraint early
            if (constraints?.minConfidence !== undefined) {
                if (confidence < constraints.minConfidence) {
                    continue;
                }
            }
            // Fetch World from Store
            const world = await this.store.get(candidate.worldId);
            if (!world) {
                continue; // World not found, skip
            }
            // Call Verifier.prove()
            const ref = createMemoryRef(candidate.worldId);
            const proveResult = this.verifier.prove(ref, world);
            // Apply requireVerified constraint
            if (constraints?.requireVerified === true && !proveResult.valid) {
                continue;
            }
            // Create VerificationEvidence (M-9: Selector wraps proof)
            let evidence;
            if (proveResult.proof) {
                evidence = {
                    method: proveResult.proof.method,
                    proof: proveResult.proof.proof,
                    verifiedAt: selectedAt,
                    verifiedBy: selector,
                };
            }
            // Apply requireEvidence constraint
            if (constraints?.requireEvidence === true) {
                if (!evidence || evidence.method === "none") {
                    continue;
                }
            }
            // Build reason string
            const reason = this.buildReason(queryKeywords, candidate.keywords);
            selected.push({
                ref,
                reason,
                confidence,
                verified: proveResult.valid,
                evidence,
            });
        }
        // Sort by confidence (descending)
        selected.sort((a, b) => b.confidence - a.confidence);
        // Apply maxResults constraint
        const maxResults = constraints?.maxResults;
        const finalSelected = maxResults !== undefined ? selected.slice(0, maxResults) : selected;
        return {
            selected: finalSelected,
            selectedAt,
        };
    }
    /**
     * Extract keywords from a query string.
     * Simple implementation: split by whitespace, lowercase, filter short words.
     */
    extractKeywords(query) {
        return query
            .toLowerCase()
            .split(/\s+/)
            .filter((word) => word.length >= 2)
            .filter((word) => !this.isStopWord(word));
    }
    /**
     * Check if a word is a stop word.
     */
    isStopWord(word) {
        const stopWords = new Set([
            "the",
            "a",
            "an",
            "is",
            "are",
            "was",
            "were",
            "be",
            "been",
            "being",
            "have",
            "has",
            "had",
            "do",
            "does",
            "did",
            "will",
            "would",
            "could",
            "should",
            "may",
            "might",
            "can",
            "to",
            "of",
            "in",
            "for",
            "on",
            "with",
            "at",
            "by",
            "from",
            "as",
            "or",
            "and",
            "but",
            "if",
            "then",
            "so",
            "than",
            "that",
            "this",
            "it",
        ]);
        return stopWords.has(word);
    }
    /**
     * Calculate confidence based on keyword overlap.
     * Returns a value between 0 and 1.
     */
    calculateConfidence(queryKeywords, entryKeywords) {
        if (queryKeywords.length === 0 || entryKeywords.length === 0) {
            return 0;
        }
        const normalizedQuery = new Set(queryKeywords.map((k) => k.toLowerCase()));
        const normalizedEntry = entryKeywords.map((k) => k.toLowerCase());
        let matchCount = 0;
        for (const qk of normalizedQuery) {
            for (const ek of normalizedEntry) {
                if (ek.includes(qk) || qk.includes(ek)) {
                    matchCount++;
                    break;
                }
            }
        }
        return matchCount / normalizedQuery.size;
    }
    /**
     * Build a reason string explaining the match.
     */
    buildReason(queryKeywords, entryKeywords) {
        const matchedKeywords = [];
        const normalizedQuery = queryKeywords.map((k) => k.toLowerCase());
        for (const ek of entryKeywords) {
            const normalizedEk = ek.toLowerCase();
            if (normalizedQuery.some((qk) => normalizedEk.includes(qk) || qk.includes(normalizedEk))) {
                matchedKeywords.push(ek);
            }
        }
        if (matchedKeywords.length === 0) {
            return "Matched by index search";
        }
        return `Matched keywords: ${matchedKeywords.join(", ")}`;
    }
}
/**
 * Factory function to create a SimpleSelector.
 *
 * @param store - MemoryStore for fetching Worlds
 * @param verifier - MemoryVerifier for generating proofs
 * @param index - KeywordIndex for candidate search
 */
export function createSimpleSelector(store, verifier, index) {
    return new SimpleSelector(store, verifier, index);
}
/**
 * Factory function to create an InMemoryKeywordIndex.
 */
export function createKeywordIndex() {
    return new InMemoryKeywordIndex();
}
//# sourceMappingURL=simple-selector.js.map