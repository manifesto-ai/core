/**
 * @fileoverview Lexicon-Verified Validation (SPEC Section 9.3)
 *
 * Lexicon-verified validation requires Lexicon and checks:
 * - Lemma exists in Lexicon
 * - Event class matches
 * - Required roles present
 * - Selectional restrictions satisfied
 */

import type {
  Lexicon,
  Role,
  IntentIR,
  ThetaFrame,
  EventEntry,
} from "@manifesto-ai/intent-ir";
import type {
  IntentGraph,
  ValidationResult,
  ValidationContext,
  ValidationWarning,
  IntentNodeId,
} from "../types/index.js";

// =============================================================================
// findMissingRequiredRoles
// =============================================================================

/**
 * Find required roles that are not present in the IR args.
 */
function findMissingRequiredRoles(
  ir: IntentIR,
  thetaFrame: ThetaFrame
): readonly Role[] {
  const missing: Role[] = [];
  for (const role of thetaFrame.required) {
    if (ir.args[role] === undefined) {
      missing.push(role);
    }
  }
  return missing;
}

/**
 * Check if two arrays are equal (simple comparison).
 */
function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, i) => val === sortedB[i]);
}

// =============================================================================
// validateWithLexicon
// =============================================================================

/**
 * Perform Lexicon-verified validation on an Intent Graph.
 *
 * This implements Intent IR v0.1's Feature Checking rules (§14):
 * 1. Lemma exists: resolveEvent(lemma) returns entry
 * 2. Class matches: entry.eventClass === ir.event.class
 * 3. Required roles: All thetaFrame.required in args
 * 4. Selectional restrictions: term.kind in restrictions[role].termKinds
 * 5. Entity type valid: entityType in restrictions[role].entityTypes
 *
 * Note: lexicon.resolveActionType() is NOT used here.
 * ActionType resolution is a lowering concern.
 *
 * @param graph - The Intent Graph to validate
 * @param ctx - Validation context with Lexicon and options
 * @returns Validation result with optional warnings
 */
export function validateWithLexicon(
  graph: IntentGraph,
  ctx: ValidationContext
): ValidationResult {
  const { lexicon, strictMissingCheck = true } = ctx;
  const warnings: ValidationWarning[] = [];

  for (const node of graph.nodes) {
    // 1. Lemma exists
    const entry = lexicon.resolveEvent(node.ir.event.lemma);
    if (!entry) {
      return {
        valid: false,
        error: "EVENT_NOT_FOUND",
        nodeId: node.id,
        details: `Event lemma "${node.ir.event.lemma}" not found in Lexicon`,
      };
    }

    // 2. Class matches (Intent IR §14.2)
    if (entry.eventClass !== node.ir.event.class) {
      return {
        valid: false,
        error: "CLASS_MISMATCH",
        nodeId: node.id,
        details: `Event class mismatch: expected "${entry.eventClass}", got "${node.ir.event.class}"`,
      };
    }

    // 3. Required roles present
    const missingRoles = findMissingRequiredRoles(node.ir, entry.thetaFrame);
    if (missingRoles.length > 0) {
      // If node is marked as Resolved but has missing roles, that's an R1 violation
      if (node.resolution.status === "Resolved") {
        if (strictMissingCheck) {
          // Strict mode: R1 violation is an error
          return {
            valid: false,
            error: "COMPLETENESS_VIOLATION",
            nodeId: node.id,
            details: `Resolved node is missing required roles: ${missingRoles.join(", ")}`,
            warnings: warnings.length > 0 ? warnings : undefined,
          };
        } else {
          // Lenient mode: R1 violation is a warning
          warnings.push({
            code: "R1_VIOLATION",
            message: `Resolved node is missing required roles (lenient): ${missingRoles.join(", ")}`,
            nodeId: node.id,
          });
        }
      }

      // Check that missing roles match what's recorded in node.resolution.missing
      const recordedMissing = node.resolution.missing ?? [];
      if (!arraysEqual(recordedMissing, missingRoles)) {
        return {
          valid: false,
          error: "MISSING_MISMATCH",
          nodeId: node.id,
          details: `Recorded missing roles [${recordedMissing.join(", ")}] do not match actual missing [${missingRoles.join(", ")}]`,
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      }
    }

    // 4. Selectional restrictions (Intent IR §14.2)
    for (const [roleStr, term] of Object.entries(node.ir.args)) {
      const role = roleStr as Role;
      const restriction = entry.thetaFrame.restrictions?.[role];

      if (restriction) {
        // Check term kind
        if (!restriction.termKinds.includes(term.kind)) {
          return {
            valid: false,
            error: "TYPE_MISMATCH",
            nodeId: node.id,
            details: `Role ${role}: expected term kind in [${restriction.termKinds.join(", ")}], got "${term.kind}"`,
          };
        }

        // Check entity type (if applicable)
        if (
          term.kind === "entity" &&
          restriction.entityTypes &&
          restriction.entityTypes.length > 0
        ) {
          const entityType = (term as { entityType: string }).entityType;
          if (!restriction.entityTypes.includes(entityType)) {
            return {
              valid: false,
              error: "TYPE_MISMATCH",
              nodeId: node.id,
              details: `Role ${role}: entity type "${entityType}" not in allowed types [${restriction.entityTypes.join(", ")}]`,
            };
          }
        }

        // Check value type (if applicable)
        if (
          term.kind === "value" &&
          restriction.valueTypes &&
          restriction.valueTypes.length > 0
        ) {
          const valueType = (term as { valueType: string }).valueType;
          if (!restriction.valueTypes.includes(valueType as any)) {
            return {
              valid: false,
              error: "TYPE_MISMATCH",
              nodeId: node.id,
              details: `Role ${role}: value type "${valueType}" not in allowed types [${restriction.valueTypes.join(", ")}]`,
            };
          }
        }
      }
    }
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
