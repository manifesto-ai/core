/**
 * Verifier that only checks if a World exists.
 *
 * This is the simplest verification strategy:
 * - prove() returns valid=true if world is not null/undefined
 * - verifyProof() returns true if method is 'existence'
 *
 * PURE: No IO, no timestamps, no actor context.
 */
export class ExistenceVerifier {
    /**
     * Generate an existence proof.
     *
     * @param _memory - The memory reference (unused in existence check)
     * @param world - The World to verify
     * @returns ProveResult with validity
     */
    prove(_memory, world) {
        const valid = world !== null && world !== undefined;
        return {
            valid,
            proof: valid
                ? { method: "existence" }
                : undefined,
            error: valid ? undefined : "World not found",
        };
    }
    /**
     * Verify an existence proof.
     *
     * @param proof - The proof to verify
     * @returns true if method is 'existence'
     */
    verifyProof(proof) {
        return proof.method === "existence";
    }
}
/**
 * Factory function to create an ExistenceVerifier.
 */
export function createExistenceVerifier() {
    return new ExistenceVerifier();
}
//# sourceMappingURL=existence.js.map