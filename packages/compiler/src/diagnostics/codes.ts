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
    message: "fail must be inside a guard (when or once)",
    category: "semantic",
  },
  E007: {
    code: "E007",
    message: "stop must be inside a guard (when or once)",
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
