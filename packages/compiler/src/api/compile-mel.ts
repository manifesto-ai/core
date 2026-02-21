/**
 * MEL Text Ingest API
 *
 * Compiles MEL text to DomainSchema or RuntimeConditionalPatchOp[].
 *
 * @see SPEC v0.4.0 §19
 */

import type { Diagnostic } from "../diagnostics/types.js";
import type { DomainSchema } from "../generator/ir.js";
import type { RuntimeConditionalPatchOp } from "../lowering/lower-runtime-patch.js";

import { tokenize, type Token } from "../lexer/index.js";
import { parse, type ProgramNode } from "../parser/index.js";
import { generate } from "../generator/ir.js";
import { compileMelPatchText } from "./compile-mel-patch.js";

// ============ Types ============

/**
 * Trace entry for compilation steps.
 */
export interface CompileTrace {
  phase: "lex" | "parse" | "analyze" | "generate" | "lower";
  durationMs: number;
  details?: Record<string, unknown>;
}

/**
 * Domain compilation options.
 */
export interface CompileMelDomainOptions {
  mode: "domain";
  fnTableVersion?: string;
}

/**
 * Domain compilation result.
 *
 * @see SPEC v0.4.0 §19.1
 */
export interface CompileMelDomainResult {
  /**
   * Compiled schema, or null if errors occurred.
   */
  schema: DomainSchema | null;

  /**
   * Compilation trace.
   */
  trace: CompileTrace[];

  /**
   * Warning diagnostics.
   */
  warnings: Diagnostic[];

  /**
   * Error diagnostics.
   */
  errors: Diagnostic[];
}

/**
 * Patch compilation options.
 */
export interface CompileMelPatchOptions {
  mode: "patch";

  /**
   * Action name for context.
   */
  actionName: string;

  /**
   * Allowed system path prefixes.
   * Default: ["meta", "input"] (system is forbidden per §20.3).
   */
  allowSysPaths?: { prefixes: ("meta" | "input")[] };

  /**
   * Function table version.
   */
  fnTableVersion?: string;
}

/**
 * Patch compilation result.
 *
 * @see SPEC v0.4.0 §19.2
 */
export interface CompileMelPatchResult {
  /**
   * Compiled patch operations.
   * These still contain Core IR expressions that need evaluation.
   */
  ops: RuntimeConditionalPatchOp[];

  /**
   * Compilation trace.
   */
  trace: CompileTrace[];

  /**
   * Warning diagnostics.
   */
  warnings: Diagnostic[];

  /**
   * Error diagnostics.
   */
  errors: Diagnostic[];
}

// ============ Main Functions ============

/**
 * Compile MEL text to DomainSchema.
 *
 * Takes a complete MEL domain definition and produces a DomainSchema
 * suitable for use with core.compute().
 *
 * @param melText - MEL domain source text
 * @param options - Compilation options
 * @returns Compilation result with schema or errors
 *
 * @see SPEC v0.4.0 §19.1
 */
export function compileMelDomain(
  melText: string,
  options?: CompileMelDomainOptions
): CompileMelDomainResult {
  const trace: CompileTrace[] = [];
  const warnings: Diagnostic[] = [];
  const errors: Diagnostic[] = [];

  // Phase 1: Lex
  const lexStart = performance.now();
  let tokens: Token[];
  try {
    const lexResult = tokenize(melText);
    tokens = lexResult.tokens;
  } catch (e) {
    const error = e as Error;
    errors.push({
      severity: "error",
      code: "E_LEX",
      message: error.message,
      location: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
    });
    trace.push({ phase: "lex", durationMs: performance.now() - lexStart });
    return { schema: null, trace, warnings, errors };
  }
  trace.push({ phase: "lex", durationMs: performance.now() - lexStart, details: { tokenCount: tokens.length } });

  // Phase 2: Parse
  const parseStart = performance.now();
  let ast: ProgramNode;
  try {
    const parseResult = parse(tokens);
    const parseErrors = parseResult.diagnostics.filter(d => d.severity === "error");
    if (parseErrors.length > 0) {
      errors.push(...parseErrors);
      trace.push({ phase: "parse", durationMs: performance.now() - parseStart });
      return { schema: null, trace, warnings, errors };
    }
    ast = parseResult.program as ProgramNode;
  } catch (e) {
    const error = e as Error;
    errors.push({
      severity: "error",
      code: "E_PARSE",
      message: error.message,
      location: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
    });
    trace.push({ phase: "parse", durationMs: performance.now() - parseStart });
    return { schema: null, trace, warnings, errors };
  }
  trace.push({ phase: "parse", durationMs: performance.now() - parseStart });

  // Phase 3: Generate IR
  const genStart = performance.now();
  const genResult = generate(ast);
  trace.push({ phase: "generate", durationMs: performance.now() - genStart });

  // Separate warnings and errors from generation
  for (const diag of genResult.diagnostics) {
    if (diag.severity === "warning") {
      warnings.push(diag);
    } else {
      errors.push(diag);
    }
  }

  return {
    schema: genResult.schema,
    trace,
    warnings,
    errors,
  };
}

/**
 * Compile MEL patch text to RuntimeConditionalPatchOp[].
 *
 * Takes MEL patch statements (set, unset, merge) and produces
 * RuntimeConditionalPatchOp[] with Core IR expressions.
 *
 * The returned ops still contain expressions that need to be evaluated
 * by evaluateRuntimePatches() to get concrete values.
 *
 * Constraints:
 * - §20.3: $system.* is forbidden in Translator path
 *
 * @param melText - MEL patch source text
 * @param options - Compilation options
 * @returns Compilation result with ops or errors
 *
 * @see SPEC v0.4.0 §19.2
 */
export function compileMelPatch(
  melText: string,
  options: CompileMelPatchOptions
): CompileMelPatchResult {
  return compileMelPatchText(melText, options);
}
