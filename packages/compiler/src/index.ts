/**
 * MEL Compiler - Public API
 * Compiles MEL source code to Manifesto Schema IR
 */

import type { Diagnostic } from "./diagnostics/index.js";
import { tokenize } from "./lexer/index.js";
import { parse } from "./parser/index.js";
import { generate, lowerSystemValues, type DomainSchema } from "./generator/index.js";
import { analyzeScope, validateSemantics } from "./analyzer/index.js";

// Re-export lexer
export { tokenize, type LexResult } from "./lexer/index.js";
export type { Token, TokenKind } from "./lexer/index.js";
export type { SourceLocation, Position } from "./lexer/index.js";

// Re-export parser
export { parse } from "./parser/index.js";
export type { ProgramNode, ExprNode } from "./parser/index.js";

// Re-export generator
export { generate, lowerSystemValues } from "./generator/index.js";
export type {
  DomainSchema,
  StateSpec,
  ComputedSpec,
  ActionSpec,
  FieldSpec,
  CoreExprNode,
  CoreFlowNode,
} from "./generator/index.js";

// Re-export analyzer
export { analyzeScope, validateSemantics } from "./analyzer/index.js";
export type { Scope, Symbol, SymbolKind } from "./analyzer/index.js";

// Re-export diagnostics
export type { Diagnostic, DiagnosticSeverity } from "./diagnostics/index.js";
export { hasErrors, isError } from "./diagnostics/index.js";

// ============ Main Compile API ============

/**
 * Compilation result
 */
export type CompileResult =
  | { success: true; schema: DomainSchema }
  | { success: false; errors: Diagnostic[] };

/**
 * Compile options
 */
export interface CompileOptions {
  skipSemanticAnalysis?: boolean;
  lowerSystemValues?: boolean; // Apply system value lowering (default: false)
}

/**
 * Compile MEL source code to Manifesto Schema IR
 */
export function compile(source: string, options: CompileOptions = {}): CompileResult {
  // Tokenize
  const { tokens, diagnostics: lexDiagnostics } = tokenize(source);

  if (lexDiagnostics.some(d => d.severity === "error")) {
    return {
      success: false,
      errors: lexDiagnostics.filter(d => d.severity === "error"),
    };
  }

  // Parse
  const { program, diagnostics: parseDiagnostics } = parse(tokens);

  if (parseDiagnostics.some(d => d.severity === "error") || !program) {
    return {
      success: false,
      errors: parseDiagnostics.filter(d => d.severity === "error"),
    };
  }

  // Semantic Analysis (optional)
  if (!options.skipSemanticAnalysis) {
    const { diagnostics: scopeDiagnostics } = analyzeScope(program);
    const { diagnostics: validationDiagnostics } = validateSemantics(program);

    const allSemanticErrors = [...scopeDiagnostics, ...validationDiagnostics]
      .filter(d => d.severity === "error");

    if (allSemanticErrors.length > 0) {
      return {
        success: false,
        errors: allSemanticErrors,
      };
    }
  }

  // Generate IR
  const { schema: rawSchema, diagnostics: genDiagnostics } = generate(program);

  if (genDiagnostics.some(d => d.severity === "error") || !rawSchema) {
    return {
      success: false,
      errors: genDiagnostics.filter(d => d.severity === "error"),
    };
  }

  // Apply system value lowering if requested
  const schema = options.lowerSystemValues
    ? lowerSystemValues(rawSchema)
    : rawSchema;

  return {
    success: true,
    schema,
  };
}

/**
 * Parse MEL source code (without IR generation)
 */
export function parseSource(source: string) {
  const { tokens, diagnostics: lexDiagnostics } = tokenize(source);
  const { program, diagnostics: parseDiagnostics } = parse(tokens);

  return {
    program,
    diagnostics: [...lexDiagnostics, ...parseDiagnostics],
  };
}

/**
 * Check MEL source code for errors without generating IR
 */
export function check(source: string): Diagnostic[] {
  const result = compile(source);
  if (!result.success) {
    return result.errors;
  }
  return [];
}
