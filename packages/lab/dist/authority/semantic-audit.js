/**
 * Level 2: Semantic Audit Authority
 *
 * For tasks with open-ended goals requiring interpretation.
 * Verification is semantic: can partially prove incorrect.
 * Per SPEC Section 7.1.
 */
/**
 * Default confidence for requiring HITL.
 */
const HITL_CONFIDENCE_THRESHOLD = "medium";
/**
 * Create a Level 2 semantic audit authority.
 *
 * @param options - Authority options
 * @returns LevelAuthorityHandler for Level 2
 */
export function createSemanticAuditAuthority(options) {
    return {
        level: 2,
        verificationMethod: "semantic_audit",
        guarantee: "plausible",
        async evaluate(proposal, _binding) {
            // Level 2: Semantic audit
            // Can partially prove incorrect
            const input = proposal.intent.body.input;
            const interpretedRule = input?.interpretedRule;
            // If no interpretation data, approve (domain-specific validation happens in Host)
            if (!interpretedRule) {
                return {
                    kind: "approved",
                    approvedScope: proposal.intent.body.scopeProposal ?? null,
                };
            }
            // Check validation status
            const validation = interpretedRule.validation;
            if (validation?.validated === false) {
                // Interpretation not yet validated
                if (options?.hitlController) {
                    return {
                        kind: "pending",
                        waitingFor: {
                            kind: "human",
                            delegate: proposal.actor,
                        },
                    };
                }
            }
            // Check confidence level
            const confidence = interpretedRule.confidence;
            if (confidence === "low" || confidence === HITL_CONFIDENCE_THRESHOLD) {
                // Low/medium confidence requires HITL
                if (options?.hitlController) {
                    return {
                        kind: "pending",
                        waitingFor: {
                            kind: "human",
                            delegate: proposal.actor,
                        },
                    };
                }
                if (confidence === "low") {
                    return {
                        kind: "rejected",
                        reason: "Interpretation confidence too low for auto-approval",
                    };
                }
            }
            // Check for critical assumptions
            const assumptions = interpretedRule.assumptions;
            const criticalAssumptions = assumptions?.filter((a) => a.impact === "critical");
            if (criticalAssumptions && criticalAssumptions.length > 0) {
                // Critical assumptions require human review
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
                    reason: `${criticalAssumptions.length} critical assumption(s) require human review`,
                };
            }
            return {
                kind: "approved",
                approvedScope: proposal.intent.body.scopeProposal ?? null,
            };
        },
    };
}
//# sourceMappingURL=semantic-audit.js.map