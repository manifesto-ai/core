/**
 * @fileoverview MEL extension candidate generation.
 */

import type { IntentIR } from "@manifesto-ai/intent-ir";
import type { IntentGraph, IntentNodeId } from "@manifesto-ai/translator";
import type { LoweringFailure } from "./types.js";

// =============================================================================
// Types
// =============================================================================

export type MelCandidate = {
  readonly nodeId: IntentNodeId;
  readonly template: string;
  readonly reason: LoweringFailure;
  readonly wouldEnable?: readonly IntentNodeId[];
};

// =============================================================================
// generateMelCandidate
// =============================================================================

export function generateMelCandidate(
  nodeId: IntentNodeId,
  ir: IntentIR,
  reason: LoweringFailure,
  graph?: IntentGraph
): MelCandidate {
  const template = generateMelTemplate(ir);

  const wouldEnable = graph
    ? graph.nodes
        .filter((n) => n.dependsOn.includes(nodeId))
        .map((n) => n.id)
    : [];

  return {
    nodeId,
    template,
    reason,
    wouldEnable: wouldEnable.length > 0 ? wouldEnable : undefined,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function generateMelTemplate(ir: IntentIR): string {
  const lemma = ir.event.lemma.toLowerCase();
  const eventClass = ir.event.class;

  const argList = buildArgList(ir);
  const body = buildActionBody(ir, eventClass);

  return `action ${lemma}(${argList}) {\n${body}\n}`;
}

function buildArgList(ir: IntentIR): string {
  const args: string[] = [];

  for (const [role, term] of Object.entries(ir.args)) {
    const roleName = role.toLowerCase();

    if (term.kind === "entity") {
      const entityType = (term as { entityType: string }).entityType;
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

function buildActionBody(ir: IntentIR, eventClass: string): string {
  switch (eventClass) {
    case "OBSERVE":
      return "  // Read operation\n  get target";
    case "CREATE":
      return "  // Create operation\n  create target";
    case "TRANSFORM":
      return "  // Transform operation\n  set target.* = theme";
    case "CONTROL":
      return "  // Control operation\n  set target.status = \"updated\"";
    case "DECIDE":
      return "  // Decision operation\n  select from target";
    case "SOLVE":
      return "  // Solve operation\n  compute result from target";
    default:
      return `  // TODO: Implement ${ir.event.lemma}`;
  }
}
