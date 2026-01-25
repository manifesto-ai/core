/**
 * Level 3: User Confirmation Authority
 *
 * For tasks with natural language requiring intent grounding.
 * Verification requires user confirmation.
 * Per SPEC Section 7.1.
 */

import type { Proposal, ActorAuthorityBinding, AuthorityResponse } from "@manifesto-ai/world";
import type { LevelAuthorityHandler, LevelAuthorityOptions } from "../types.js";

/**
 * Create a Level 3 confirmation authority.
 *
 * @param options - Authority options
 * @returns LevelAuthorityHandler for Level 3
 */
export function createConfirmationAuthority(
  options?: LevelAuthorityOptions
): LevelAuthorityHandler {
  return {
    level: 3,
    verificationMethod: "user_confirmation",
    guarantee: "confirmed",

    async evaluate(
      proposal: Proposal,
      _binding: ActorAuthorityBinding
    ): Promise<AuthorityResponse> {
      // Level 3: User confirmation required
      // Intent grounding must be confirmed by user

      const input = proposal.intent.body.input as Record<string, unknown> | undefined;
      const grounding = input?.grounding as Record<string, unknown> | undefined;

      // If no grounding data, require confirmation anyway (NL input)
      if (!grounding) {
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
          reason: "Level 3 requires user confirmation for intent grounding",
        };
      }

      // Check confirmation status
      const confirmation = grounding.confirmation as Record<string, unknown> | undefined;

      if (confirmation?.required === true) {
        const status = confirmation.status as string | undefined;
        const level = confirmation.level as string | undefined;

        if (status === "confirmed") {
          // Already confirmed
          return {
            kind: "approved",
            approvedScope: proposal.intent.body.scopeProposal ?? null,
          };
        }

        if (status === "rejected") {
          return {
            kind: "rejected",
            reason: "User rejected the intent grounding",
          };
        }

        // Pending confirmation
        if (level === "critical" || level === "active") {
          // Critical/active confirmation always requires HITL
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
            reason: `Level 3 ${level} confirmation requires human intervention`,
          };
        }
      }

      // Check for unresolved ambiguities
      const ambiguities = grounding.ambiguities as
        | Array<{ resolutionMethod: string }>
        | undefined;
      const unresolvedAmbiguities = ambiguities?.filter(
        (a) => a.resolutionMethod === "unresolved"
      );

      if (unresolvedAmbiguities && unresolvedAmbiguities.length > 0) {
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
          reason: `${unresolvedAmbiguities.length} unresolved ambiguity(ies) require clarification`,
        };
      }

      // Check reference resolution confidence
      const resolutions = grounding.referenceResolutions as
        | Array<{ confidence: number }>
        | undefined;
      const lowConfidenceResolutions = resolutions?.filter(
        (r) => r.confidence < 0.8
      );

      if (lowConfidenceResolutions && lowConfidenceResolutions.length > 0) {
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
          reason: "Low confidence reference resolutions require confirmation",
        };
      }

      // All checks passed
      return {
        kind: "approved",
        approvedScope: proposal.intent.body.scopeProposal ?? null,
      };
    },
  };
}
