/**
 * @fileoverview Feature Checking (SPEC Section 14)
 *
 * Check IR validity against Lexicon.
 * Errors are values, not exceptions (per Constitution).
 */

import type {
  IntentIR,
  Term,
  Role,
  EventClass,
  ValueType,
  EntityRefTerm,
} from "../schema/index.js";
import type { Lexicon, SelectionalRestriction } from "./interface.js";

// =============================================================================
// CheckError Types
// =============================================================================

export type CheckError =
  | { readonly code: "UNKNOWN_LEMMA"; readonly lemma: string }
  | {
      readonly code: "CLASS_MISMATCH";
      readonly expected: EventClass;
      readonly actual: EventClass;
    }
  | { readonly code: "MISSING_ROLE"; readonly role: Role }
  | {
      readonly code: "INVALID_TERM_KIND";
      readonly role: Role;
      readonly expected: readonly Term["kind"][];
      readonly actual: Term["kind"];
    }
  | {
      readonly code: "INVALID_ENTITY_TYPE";
      readonly role: Role;
      readonly entityType: string;
      readonly allowed: readonly string[];
    }
  | {
      readonly code: "INVALID_VALUE_TYPE";
      readonly role: Role;
      readonly valueType: ValueType;
      readonly allowed: readonly ValueType[];
    }
  | {
      readonly code: "UNKNOWN_ENTITY_TYPE";
      readonly entityType: string;
    };

// =============================================================================
// CheckResult
// =============================================================================

export type CheckResult =
  | {
      readonly valid: true;
      readonly requiresConfirm?: boolean;
    }
  | {
      readonly valid: false;
      readonly error: CheckError;
      readonly suggest: "ERROR" | "CLARIFY";
    };

// =============================================================================
// checkFeatures
// =============================================================================

/**
 * Check IR validity against Lexicon.
 *
 * Per SPEC Section 14.3:
 * 1. Lemma must exist in Lexicon
 * 2. Event class must match Lexicon entry
 * 3. All required roles must be present
 * 4. Term kinds must match selectional restrictions
 * 5. Entity types must be valid
 * 6. Policy hints trigger confirmations
 *
 * @example
 * const result = checkFeatures(ir, lexicon);
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 */
export function checkFeatures(ir: IntentIR, lexicon: Lexicon): CheckResult {
  // 1. Resolve event entry
  const entry = lexicon.resolveEvent(ir.event.lemma);
  if (!entry) {
    return {
      valid: false,
      error: { code: "UNKNOWN_LEMMA", lemma: ir.event.lemma },
      suggest: "CLARIFY",
    };
  }

  // 2. Check event class consistency
  if (entry.eventClass !== ir.event.class) {
    return {
      valid: false,
      error: {
        code: "CLASS_MISMATCH",
        expected: entry.eventClass,
        actual: ir.event.class,
      },
      suggest: "ERROR",
    };
  }

  // 3. Check required roles
  for (const role of entry.thetaFrame.required) {
    if (!(role in ir.args) || ir.args[role] === undefined) {
      return {
        valid: false,
        error: { code: "MISSING_ROLE", role },
        suggest: "CLARIFY",
      };
    }
  }

  // 4. Check selectional restrictions for all present args
  for (const [roleStr, term] of Object.entries(ir.args)) {
    if (term === undefined) continue;

    const role = roleStr as Role;
    const restriction = entry.thetaFrame.restrictions[role];

    if (restriction) {
      const restrictionResult = checkRestriction(term, restriction, role, lexicon);
      if (restrictionResult) {
        return restrictionResult;
      }
    }
  }

  // 5. Check entity types exist in lexicon
  for (const term of Object.values(ir.args)) {
    if (!term) continue;
    const entities = collectEntityTerms(term);
    for (const entity of entities) {
      const entitySpec = lexicon.resolveEntity(entity.entityType);
      if (!entitySpec) {
        return {
          valid: false,
          error: { code: "UNKNOWN_ENTITY_TYPE", entityType: entity.entityType },
          suggest: "CLARIFY",
        };
      }
    }
  }

  // 6. Check policy hints
  if (entry.policyHints?.destructive) {
    return { valid: true, requiresConfirm: true };
  }

  return { valid: true };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check a term against selectional restriction.
 */
function checkRestriction(
  term: Term,
  restriction: SelectionalRestriction,
  role: Role,
  lexicon: Lexicon
): CheckResult | null {
  if (term.kind === "list") {
    if (!restriction.termKinds.includes("list")) {
      return {
        valid: false,
        error: {
          code: "INVALID_TERM_KIND",
          role,
          expected: restriction.termKinds,
          actual: term.kind,
        },
        suggest: "CLARIFY",
      };
    }

    const itemKinds = restriction.termKinds.filter((kind) => kind !== "list");
    const itemRestriction: SelectionalRestriction = {
      termKinds: itemKinds,
      entityTypes: restriction.entityTypes,
      valueTypes: restriction.valueTypes,
    };

    for (const item of term.items) {
      const itemResult = checkRestriction(
        item as Term,
        itemRestriction,
        role,
        lexicon
      );
      if (itemResult) {
        return itemResult;
      }
    }

    return null;
  }

  const allowedKinds = restriction.termKinds.filter((kind) => kind !== "list");

  // Check term kind
  if (!allowedKinds.includes(term.kind)) {
    return {
      valid: false,
      error: {
        code: "INVALID_TERM_KIND",
        role,
        expected: allowedKinds,
        actual: term.kind,
      },
      suggest: "CLARIFY",
    };
  }

  // Check entity type (for entity terms)
  if (
    term.kind === "entity" &&
    restriction.entityTypes &&
    !restriction.entityTypes.includes(term.entityType)
  ) {
    return {
      valid: false,
      error: {
        code: "INVALID_ENTITY_TYPE",
        role,
        entityType: term.entityType,
        allowed: restriction.entityTypes,
      },
      suggest: "CLARIFY",
    };
  }

  // Check value type (for value terms)
  if (
    term.kind === "value" &&
    restriction.valueTypes &&
    !restriction.valueTypes.includes(term.valueType)
  ) {
    return {
      valid: false,
      error: {
        code: "INVALID_VALUE_TYPE",
        role,
        valueType: term.valueType,
        allowed: restriction.valueTypes,
      },
      suggest: "CLARIFY",
    };
  }

  return null; // No error
}

function collectEntityTerms(term: Term): EntityRefTerm[] {
  if (term.kind === "entity") {
    return [term];
  }

  if (term.kind === "list") {
    const items = term.items.flatMap((item) =>
      collectEntityTerms(item as Term)
    );
    return items;
  }

  return [];
}
