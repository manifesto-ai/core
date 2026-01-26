/**
 * @fileoverview MelCandidate Generation (SPEC Section 11.4)
 *
 * Generate MEL schema extension suggestions for intents that cannot be lowered.
 *
 * Per SPEC Section 11.4:
 * - Generated ONLY when lexicon.resolveActionType() fails
 * - OR when required role mapping fails
 * - NOT generated for Abstract nodes
 */

import type { IntentIR, Role } from "@manifesto-ai/intent-ir";
import type {
  IntentGraph,
  IntentNodeId,
  MelCandidate,
  LoweringFailureReason,
} from "../types/index.js";

// =============================================================================
// generateMelCandidate
// =============================================================================

/**
 * Generate a MelCandidate for a failed lowering.
 *
 * @param nodeId - The node ID
 * @param ir - The IntentIR that failed to lower
 * @param reason - Why lowering failed
 * @param graph - The Intent Graph (for determining wouldEnable)
 * @returns MelCandidate with suggested MEL code
 */
export function generateMelCandidate(
  nodeId: IntentNodeId,
  ir: IntentIR,
  reason: LoweringFailureReason,
  graph?: IntentGraph
): MelCandidate {
  const suggestedMel = generateMelCode(ir, reason);

  // Find nodes that depend on this node (would be enabled if this MEL is applied)
  const wouldEnable = graph
    ? graph.nodes
        .filter((n) => n.dependsOn.includes(nodeId))
        .map((n) => n.id)
    : [];

  return {
    nodeId,
    ir,
    suggestedMel,
    reason,
    wouldEnable: wouldEnable.length > 0 ? wouldEnable : undefined,
  };
}

// =============================================================================
// generateMelCode
// =============================================================================

/**
 * Generate MEL code suggestion based on the IntentIR and failure reason.
 */
function generateMelCode(ir: IntentIR, reason: LoweringFailureReason): string {
  const lemma = ir.event.lemma.toLowerCase();
  const eventClass = ir.event.class;

  // Build argument list from IR args
  const argList = buildArgList(ir);

  // Build action body based on event class
  const body = buildActionBody(ir, eventClass);

  return `action ${lemma}(${argList}) {
${body}
}`;
}

/**
 * Build argument list from IR args.
 */
function buildArgList(ir: IntentIR): string {
  const args: string[] = [];

  for (const [role, term] of Object.entries(ir.args)) {
    const roleName = role.toLowerCase();

    if (term.kind === "entity") {
      const entityType = (term as { entityType: string }).entityType;
      // Check if it might be a collection (no ref or collection ref)
      const hasRef = "ref" in term && term.ref;
      if (!hasRef) {
        args.push(`${roleName}: ${entityType}[]`);
      } else {
        args.push(`${roleName}: ${entityType}`);
      }
    } else if (term.kind === "value") {
      const valueType = (term as { valueType: string }).valueType;
      args.push(`${roleName}: ${valueType}`);
    } else if (term.kind === "path") {
      args.push(`${roleName}: path`);
    } else if (term.kind === "artifact") {
      args.push(`${roleName}: artifact`);
    } else if (term.kind === "expr") {
      args.push(`${roleName}: expr`);
    }
  }

  return args.join(", ");
}

/**
 * Build action body based on event class.
 */
function buildActionBody(ir: IntentIR, eventClass: string): string {
  switch (eventClass) {
    case "OBSERVE":
      return `  // Read operation
  get target`;

    case "CREATE":
      return `  // Create operation
  create target`;

    case "TRANSFORM":
      return `  // Transform operation
  set target.* = theme`;

    case "CONTROL":
      return `  // Control operation
  set target.status = "updated"`;

    case "DECIDE":
      return `  // Decision operation
  select from target`;

    case "SOLVE":
      return `  // Solve operation
  compute result from target`;

    default:
      return `  // TODO: Implement ${ir.event.lemma}`;
  }
}
