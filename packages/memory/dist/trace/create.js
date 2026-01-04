/**
 * Create a MemoryTrace from selection results.
 *
 * @param selector - Who performed the selection
 * @param query - What was being searched for
 * @param atWorldId - World context at selection time
 * @param selected - What was selected
 * @returns A complete MemoryTrace
 */
export function createMemoryTrace(selector, query, atWorldId, selected) {
    return {
        selector,
        query,
        selectedAt: Date.now(),
        atWorldId,
        selected: [...selected],
    };
}
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
export function createMemoryTraceFromResult(selector, query, atWorldId, result) {
    return {
        selector,
        query,
        selectedAt: result.selectedAt,
        atWorldId,
        selected: [...result.selected],
    };
}
//# sourceMappingURL=create.js.map