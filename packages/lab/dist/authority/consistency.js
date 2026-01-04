/**
 * Level 1: Posterior Consistency Authority
 *
 * For tasks with hidden state requiring belief.
 * Verification is consistency-based: can prove incorrect but NOT correct.
 * Per SPEC Section 7.1.
 */
/**
 * Default confidence threshold for Level 1.
 */
const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
/**
 * Create a Level 1 consistency authority.
 *
 * @param options - Authority options
 * @returns LevelAuthorityHandler for Level 1
 */
export function createConsistencyAuthority(options) {
    const confidenceThreshold = options?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    return {
        level: 1,
        verificationMethod: "posterior_consistency",
        guarantee: "consistent",
        async evaluate(proposal, _binding) {
            // Level 1: Posterior consistency check
            // Can prove incorrect but NOT correct
            const input = proposal.intent.body.input;
            const beliefData = input?.belief;
            // Extract confidence from belief or metadata
            const confidence = beliefData?.confidence ??
                input?.confidence ??
                1.0; // Default to high confidence if not specified
            // Check if confidence is below threshold
            if (confidence < confidenceThreshold) {
                // Require HITL for low confidence
                if (options?.hitlController) {
                    return {
                        kind: "pending",
                        waitingFor: {
                            kind: "human",
                            delegate: proposal.actor,
                        },
                    };
                }
                return {
                    kind: "rejected",
                    reason: `Confidence ${confidence.toFixed(2)} below threshold ${confidenceThreshold.toFixed(2)}`,
                };
            }
            // Check for observation contradictions (if hypothesis provided)
            if (beliefData?.hypotheses && Array.isArray(beliefData.hypotheses)) {
                const contradictions = checkObservationContradictions(beliefData.hypotheses, beliefData.observations ?? []);
                if (contradictions.length > 0) {
                    return {
                        kind: "rejected",
                        reason: `Belief contradicts observations: ${contradictions.join(", ")}`,
                    };
                }
            }
            return {
                kind: "approved",
                approvedScope: proposal.intent.body.scopeProposal ?? null,
            };
        },
    };
}
/**
 * Check for contradictions between hypotheses and observations.
 * Per L1-LC2: No hypothesis may contradict observation history.
 */
function checkObservationContradictions(hypotheses, observations) {
    const contradictions = [];
    for (const hypothesis of hypotheses) {
        const h = hypothesis;
        const refutingConditions = h.refutingConditions;
        if (!refutingConditions)
            continue;
        for (const condition of refutingConditions) {
            // Check if any observation matches the refuting condition
            const matchingObs = observations.find((obs) => {
                const o = obs;
                return o.id === condition.observation;
            });
            if (matchingObs) {
                contradictions.push(`Hypothesis ${h.id} refuted by observation ${condition.observation}: ${condition.reason}`);
            }
        }
    }
    return contradictions;
}
//# sourceMappingURL=consistency.js.map