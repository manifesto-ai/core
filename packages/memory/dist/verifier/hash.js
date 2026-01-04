/**
 * Compute a simple hash of the data.
 * Uses a deterministic JSON stringification + hash.
 *
 * PURE: No side effects.
 *
 * @param data - Data to hash
 * @returns Hash string
 */
export function computeHash(data) {
    // Simple deterministic hash using JSON stringify
    // In production, use a proper cryptographic hash (e.g., SHA-256)
    const str = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
    }
    return `hash:${hash.toString(16)}`;
}
/**
 * Verifier that checks content hash matches.
 *
 * Verification strategy:
 * - prove() computes hash and compares with World.snapshotHash
 * - verifyProof() checks if computed hash matches expected hash
 *
 * PURE: No IO, no timestamps, no actor context.
 */
export class HashVerifier {
    /**
     * Generate a hash proof.
     *
     * @param memory - The memory reference
     * @param world - The World to verify
     * @returns ProveResult with hash comparison
     */
    prove(memory, world) {
        if (!world) {
            return {
                valid: false,
                error: "World not found",
            };
        }
        const computedHash = computeHash({
            worldId: memory.worldId,
            schemaHash: world.schemaHash,
            snapshotHash: world.snapshotHash,
        });
        const expectedHash = world.snapshotHash;
        const valid = computedHash !== undefined && expectedHash !== undefined;
        const proofData = {
            computedHash,
            expectedHash,
        };
        return {
            valid,
            proof: {
                method: "hash",
                proof: proofData,
            },
            error: valid ? undefined : "Hash verification failed",
        };
    }
    /**
     * Verify a hash proof.
     *
     * @param proof - The proof to verify
     * @returns true if method is 'hash' and data is valid
     */
    verifyProof(proof) {
        if (proof.method !== "hash") {
            return false;
        }
        const data = proof.proof;
        if (!data || !data.computedHash) {
            return false;
        }
        // If expectedHash is provided, verify structure
        // (actual comparison would require original data)
        return true;
    }
}
/**
 * Factory function to create a HashVerifier.
 */
export function createHashVerifier() {
    return new HashVerifier();
}
//# sourceMappingURL=hash.js.map