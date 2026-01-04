/**
 * Type guard for Fulfilled
 */
export function isFulfilled(result) {
    return result.status === "fulfilled";
}
/**
 * Type guard for Rejected
 */
export function isRejected(result) {
    return result.status === "rejected";
}
//# sourceMappingURL=settled.js.map