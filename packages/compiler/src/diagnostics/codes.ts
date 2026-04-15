/**
 * MEL Compiler Diagnostic Codes
 * Based on MEL SPEC v0.3.3 Appendix A
 */

/**
 * Diagnostic code information
 */
export interface DiagnosticCode {
  code: string;
  message: string;
  category: "syntax" | "semantic" | "type" | "system";
}

/**
 * All diagnostic codes
 */
export const DIAGNOSTIC_CODES: Record<string, DiagnosticCode> = {
  // ============ Syntax Errors (E0xx) ============
  E001: {
    code: "E001",
    message: "$system.* cannot be used in computed expressions (non-deterministic)",
    category: "semantic",
  },
  E002: {
    code: "E002",
    message: "$system.* cannot be used in state initializers",
    category: "semantic",
  },
  E003: {
    code: "E003",
    message: "Invalid $system reference",
    category: "semantic",
  },
  E004: {
    code: "E004",
    message: "Identifier starts with reserved prefix '__sys__'",
    category: "syntax",
  },

  // ============ v0.3.3 Errors (E0xx) ============
  E005: {
    code: "E005",
    message: "available expression must be pure (no Effects, no $system.*)",
    category: "semantic",
  },
  E006: {
    code: "E006",
    message: "fail must be inside a guard (when, once, or onceIntent)",
    category: "semantic",
  },
  E007: {
    code: "E007",
    message: "stop must be inside a guard (when, once, or onceIntent)",
    category: "semantic",
  },
  E008: {
    code: "E008",
    message: "stop message suggests waiting/pending - use 'Already processed' style instead",
    category: "semantic",
  },
  E009: {
    code: "E009",
    message: "Primitive aggregation (sum, min, max) only allowed in computed",
    category: "semantic",
  },
  E010: {
    code: "E010",
    message: "Primitive aggregation does not allow composition - use direct reference only",
    category: "semantic",
  },
  E011: {
    code: "E011",
    message: "reduce/fold/scan is forbidden - use sum, min, max for aggregation",
    category: "semantic",
  },
  E013: {
    code: "E013",
    message: "Circular include detected",
    category: "semantic",
  },
  E014: {
    code: "E014",
    message: "Include expansion depth exceeds limit",
    category: "semantic",
  },
  E015: {
    code: "E015",
    message: "Include target is not a declared flow",
    category: "semantic",
  },
  E016: {
    code: "E016",
    message: "Include not allowed in InnerStmt position",
    category: "semantic",
  },
  E017: {
    code: "E017",
    message: "once() not allowed in flow",
    category: "semantic",
  },
  E018: {
    code: "E018",
    message: "onceIntent not allowed in flow",
    category: "semantic",
  },
  E019: {
    code: "E019",
    message: "patch not allowed in flow",
    category: "semantic",
  },
  E020: {
    code: "E020",
    message: "effect not allowed in flow",
    category: "semantic",
  },
  E021: {
    code: "E021",
    message: "Flow parameter name conflicts with top-level identifier",
    category: "semantic",
  },
  E022: {
    code: "E022",
    message: "Flow and action share the same name",
    category: "semantic",
  },
  E023: {
    code: "E023",
    message: "Wrong number of arguments for included flow",
    category: "semantic",
  },
  E024: {
    code: "E024",
    message: "Include argument type mismatch",
    category: "type",
  },
  E030: {
    code: "E030",
    message: "Collection element type does not have an 'id' field",
    category: "type",
  },
  E030a: {
    code: "E030a",
    message: "Collection element 'id' field is not a primitive type",
    category: "type",
  },
  E030b: {
    code: "E030b",
    message: "Duplicate '.id' values detected in state initializer",
    category: "type",
  },
  E031: {
    code: "E031",
    message: "updateById/removeById not allowed in this context",
    category: "semantic",
  },
  E032: {
    code: "E032",
    message: "Nested transform primitive",
    category: "semantic",
  },
  E033: {
    code: "E033",
    message: "Transform primitive collection argument is not a state path",
    category: "semantic",
  },
  E034: {
    code: "E034",
    message: "Transform primitive in guard condition",
    category: "semantic",
  },
  E035: {
    code: "E035",
    message: "Transform primitive in available condition",
    category: "semantic",
  },
  E040: {
    code: "E040",
    message: "Circular computed dependency",
    category: "semantic",
  },
  E041: {
    code: "E041",
    message: "Computed references undeclared identifier",
    category: "semantic",
  },
  E042: {
    code: "E042",
    message: "State initializer references non-constant value",
    category: "semantic",
  },
  E043: {
    code: "E043",
    message: "Non-trivial union type cannot be lowered to FieldSpec",
    category: "type",
  },
  E044: {
    code: "E044",
    message: "Recursive named type cannot be lowered to FieldSpec",
    category: "type",
  },
  E045: {
    code: "E045",
    message: "Nullable type cannot be lowered to FieldSpec",
    category: "type",
  },
  E046: {
    code: "E046",
    message: "Record type cannot be lowered to FieldSpec",
    category: "type",
  },
  E047: {
    code: "E047",
    message: "dispatchable expression must be pure (state/computed/action parameters only)",
    category: "semantic",
  },
  E048: {
    code: "E048",
    message: "Transform primitive in dispatchable condition",
    category: "semantic",
  },
  E049: {
    code: "E049",
    message: "Invalid literal clamp bounds",
    category: "semantic",
  },
  E050: {
    code: "E050",
    message: "Invalid match() form",
    category: "semantic",
  },
  E051: {
    code: "E051",
    message: "Duplicate match() key",
    category: "semantic",
  },
  E052: {
    code: "E052",
    message: "Invalid argmax()/argmin() form",
    category: "semantic",
  },
  E053: {
    code: "E053",
    message: "@meta can attach only to domain, type, type field, state field, computed, or action declarations",
    category: "syntax",
  },
  E054: {
    code: "E054",
    message: "Action-parameter annotations are not part of the current MEL syntax",
    category: "syntax",
  },
  E055: {
    code: "E055",
    message: "Annotation payloads must be JSON-like literals",
    category: "semantic",
  },
  E056: {
    code: "E056",
    message: "Annotation payload nesting exceeds the current MEL limit of 2 levels",
    category: "semantic",
  },
  E057: {
    code: "E057",
    message: "Annotation target does not map to the emitted DomainSchema",
    category: "semantic",
  },

  // ============ Scope Errors (E1xx) ============
  E_UNDEFINED: {
    code: "E_UNDEFINED",
    message: "Undefined identifier",
    category: "semantic",
  },
  E_DUPLICATE: {
    code: "E_DUPLICATE",
    message: "Duplicate identifier",
    category: "semantic",
  },
  E_INVALID_ACCESS: {
    code: "E_INVALID_ACCESS",
    message: "Invalid access to identifier in this context",
    category: "semantic",
  },

  // ============ Statement Errors (E2xx) ============
  E_UNGUARDED_STMT: {
    code: "E_UNGUARDED_STMT",
    message: "Statement must be inside a guard (when or once)",
    category: "semantic",
  },
  E_UNGUARDED_PATCH: {
    code: "E_UNGUARDED_PATCH",
    message: "Patch must be inside a guard",
    category: "semantic",
  },
  E_UNGUARDED_EFFECT: {
    code: "E_UNGUARDED_EFFECT",
    message: "Effect must be inside a guard",
    category: "semantic",
  },

  // ============ Type Errors (E3xx) ============
  E_ARG_COUNT: {
    code: "E_ARG_COUNT",
    message: "Wrong number of arguments",
    category: "type",
  },
  E_TYPE_MISMATCH: {
    code: "E_TYPE_MISMATCH",
    message: "Type mismatch",
    category: "type",
  },

  // ============ Warnings (W0xx) ============
  W_NON_BOOL_COND: {
    code: "W_NON_BOOL_COND",
    message: "Condition may not be boolean",
    category: "semantic",
  },
  W_UNUSED: {
    code: "W_UNUSED",
    message: "Unused identifier",
    category: "semantic",
  },
  W012: {
    code: "W012",
    message: "Anonymous object type in state field - use named type declaration instead",
    category: "type",
  },

  // ============ Lexer Errors ============
  MEL_LEXER: {
    code: "MEL_LEXER",
    message: "Lexer error",
    category: "syntax",
  },

  // ============ Parser Errors ============
  MEL_PARSER: {
    code: "MEL_PARSER",
    message: "Parser error",
    category: "syntax",
  },
};

/**
 * Get diagnostic code information
 */
export function getDiagnosticInfo(code: string): DiagnosticCode | undefined {
  return DIAGNOSTIC_CODES[code];
}

/**
 * Format a diagnostic code for display
 */
export function formatDiagnosticCode(code: string): string {
  const info = DIAGNOSTIC_CODES[code];
  if (info) {
    return `${code}: ${info.message}`;
  }
  return code;
}
