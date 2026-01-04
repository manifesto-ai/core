/**
 * Level 0: Deterministic Authority
 *
 * For tasks solvable without LLM.
 * Verification is deterministic: can prove correct AND incorrect.
 * Per SPEC Section 7.1.
 */
/**
 * Create a Level 0 deterministic authority.
 *
 * @returns LevelAuthorityHandler for Level 0
 */
export function createDeterministicAuthority(_options) {
    return {
        level: 0,
        verificationMethod: "deterministic",
        guarantee: "certain",
        async evaluate(proposal, _binding) {
            // Level 0: Deterministic verification
            // Can prove correct AND incorrect
            const meta = proposal.intent.meta;
            // Check if LLM was used (forbidden at Level 0 per SPEC)
            if (meta?.llmUsed === true) {
                return {
                    kind: "rejected",
                    reason: "LLM usage not permitted at Necessity Level 0 (deterministic tasks)",
                };
            }
            // For Level 0, we can deterministically verify the proposal
            // The actual verification logic depends on the domain
            // Here we approve by default, assuming the Host will verify
            return {
                kind: "approved",
                approvedScope: proposal.intent.body.scopeProposal ?? null,
            };
        },
    };
}
//# sourceMappingURL=deterministic.js.map