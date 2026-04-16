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
import type {
  Annotation,
  AnnotationIndex,
  DomainModule,
  JsonLiteral,
  LocalTargetKey,
} from "../annotations.js";
import type {
  SourceMapEmissionContext,
  SourceMapEntry,
  SourceMapIndex,
  SourceMapPath,
  SourcePoint,
  SourceSpan,
} from "../source-map.js";

import { buildAnnotationIndex } from "../annotations.js";
import { tokenize, type Token } from "../lexer/index.js";
import { parse, type ProgramNode } from "../parser/index.js";
import { generate } from "../generator/ir.js";
import { analyzeScope } from "../analyzer/scope.js";
import { validateSemantics } from "../analyzer/validator.js";
import { validateAndExpandFlows } from "../analyzer/flow-composition.js";
import { extractSchemaGraph } from "../schema-graph.js";
import {
  createDefaultSourceMapEmissionContext,
  extractSourceMap,
} from "../source-map.js";
import { compileMelPatchText } from "./compile-mel-patch.js";

const COMPILER_VERSION = "3.5.0";

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

export interface CompileMelModuleOptions {
  mode: "module";
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

export interface CompileMelModuleResult {
  /**
   * Tooling-only compiled module, or null if errors occurred.
   */
  module: DomainModule | null;

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

export type {
  Annotation,
  AnnotationIndex,
  DomainModule,
  JsonLiteral,
  LocalTargetKey,
} from "../annotations.js";
export type {
  SourceMapEmissionContext,
  SourceMapEntry,
  SourceMapIndex,
  SourceMapPath,
  SourcePoint,
  SourceSpan,
} from "../source-map.js";

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
  const result = compileMelArtifacts(melText, options);
  return {
    schema: result.schema,
    trace: result.trace,
    warnings: result.warnings,
    errors: result.errors,
  };
}

export function compileMelModule(
  melText: string,
  options?: CompileMelModuleOptions,
): CompileMelModuleResult {
  const result = compileMelArtifacts(melText, options);

  if (result.errors.length > 0 || !result.schema || !result.annotations || !result.sourceMap) {
    return {
      module: null,
      trace: result.trace,
      warnings: result.warnings,
      errors: result.errors,
    };
  }

  return {
    module: createDomainModule(result.schema, result.annotations, result.sourceMap),
    trace: result.trace,
    warnings: result.warnings,
    errors: result.errors,
  };
}

interface CompileMelArtifactsResult {
  program: ProgramNode | null;
  schema: DomainSchema | null;
  annotations: AnnotationIndex | null;
  sourceMap: SourceMapIndex | null;
  trace: CompileTrace[];
  warnings: Diagnostic[];
  errors: Diagnostic[];
}

function compileMelArtifacts(
  melText: string,
  _options?: CompileMelDomainOptions | CompileMelModuleOptions,
): CompileMelArtifactsResult {
  const trace: CompileTrace[] = [];
  const warnings: Diagnostic[] = [];
  const errors: Diagnostic[] = [];

  // Phase 1: Lex
  const lexStart = performance.now();
  let tokens: Token[];
  try {
    const lexResult = tokenize(melText);
    tokens = lexResult.tokens;

    // Collect lexer diagnostics (unterminated strings, invalid characters, etc.)
    const lexErrors = lexResult.diagnostics.filter(d => d.severity === "error");
    if (lexErrors.length > 0) {
      errors.push(...lexErrors);
      trace.push({ phase: "lex", durationMs: performance.now() - lexStart, details: { tokenCount: tokens.length } });
      return { program: null, schema: null, annotations: null, sourceMap: null, trace, warnings, errors };
    }
    const lexWarnings = lexResult.diagnostics.filter(d => d.severity === "warning");
    warnings.push(...lexWarnings);
  } catch (e) {
    const error = e as Error;
    errors.push({
      severity: "error",
      code: "E_LEX",
      message: error.message,
      location: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
    });
    trace.push({ phase: "lex", durationMs: performance.now() - lexStart });
    return { program: null, schema: null, annotations: null, sourceMap: null, trace, warnings, errors };
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
      return { program: null, schema: null, annotations: null, sourceMap: null, trace, warnings, errors: capDiagnostics(errors) };
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
    return { program: null, schema: null, annotations: null, sourceMap: null, trace, warnings, errors };
  }
  trace.push({ phase: "parse", durationMs: performance.now() - parseStart });

  // Phase 2.5: Semantic Analysis (scope + validation)
  const analyzeStart = performance.now();
  const flowResult = validateAndExpandFlows(ast);
  const flowErrors = flowResult.diagnostics.filter((d) => d.severity === "error");
  const flowWarnings = flowResult.diagnostics.filter((d) => d.severity === "warning");

  const scopeResult = analyzeScope(flowResult.program);
  const validateResult = validateSemantics(flowResult.program);
  const analyzeErrors = [
    ...flowErrors,
    ...scopeResult.diagnostics.filter(d => d.severity === "error"),
    ...validateResult.diagnostics.filter(d => d.severity === "error"),
  ];
  const analyzeWarnings = [
    ...flowWarnings,
    ...scopeResult.diagnostics.filter(d => d.severity === "warning"),
    ...validateResult.diagnostics.filter(d => d.severity === "warning"),
  ];
  warnings.push(...analyzeWarnings);
  trace.push({ phase: "analyze", durationMs: performance.now() - analyzeStart });

  if (analyzeErrors.length > 0) {
    errors.push(...analyzeErrors);
    return {
      program: flowResult.program,
      schema: null,
      annotations: null,
      sourceMap: null,
      trace,
      warnings,
      errors: capDiagnostics(errors),
    };
  }

  // Phase 3: Generate IR
  const genStart = performance.now();
  const genResult = generate(flowResult.program);
  trace.push({ phase: "generate", durationMs: performance.now() - genStart });

  // Separate warnings and errors from generation
  for (const diag of genResult.diagnostics) {
    if (diag.severity === "warning") {
      warnings.push(diag);
    } else {
      errors.push(diag);
    }
  }

  if (genResult.schema) {
    const annotationResult = buildAnnotationIndex(flowResult.program, genResult.schema);
    const annotationWarnings = annotationResult.diagnostics.filter((d) => d.severity === "warning");
    const annotationErrors = annotationResult.diagnostics.filter((d) => d.severity === "error");
    warnings.push(...annotationWarnings);
    errors.push(...annotationErrors);

    if (annotationErrors.length > 0) {
      return {
        program: flowResult.program,
        schema: null,
        annotations: null,
        sourceMap: null,
        trace,
        warnings,
        errors: capDiagnostics(errors),
      };
    }

    const sourceMapContext: SourceMapEmissionContext =
      createDefaultSourceMapEmissionContext(COMPILER_VERSION);
    const sourceMapResult = extractSourceMap(
      flowResult.program,
      melText,
      genResult.schema,
      sourceMapContext,
    );
    const sourceMapWarnings = sourceMapResult.diagnostics.filter((d) => d.severity === "warning");
    const sourceMapErrors = sourceMapResult.diagnostics.filter((d) => d.severity === "error");
    warnings.push(...sourceMapWarnings);
    errors.push(...sourceMapErrors);

    if (sourceMapErrors.length > 0) {
      return {
        program: flowResult.program,
        schema: null,
        annotations: null,
        sourceMap: null,
        trace,
        warnings,
        errors: capDiagnostics(errors),
      };
    }

    return {
      program: flowResult.program,
      schema: genResult.schema,
      annotations: annotationResult.annotations,
      sourceMap: sourceMapResult.sourceMap,
      trace,
      warnings,
      errors: capDiagnostics(errors),
    };
  }

  return {
    program: flowResult.program,
    schema: null,
    annotations: null,
    sourceMap: null,
    trace,
    warnings,
    errors: capDiagnostics(errors),
  };
}

function createDomainModule(
  schema: DomainSchema,
  annotations: AnnotationIndex,
  sourceMap: SourceMapIndex,
): DomainModule {
  return Object.freeze({
    schema,
    graph: deepFreeze(extractSchemaGraph(schema)),
    annotations,
    sourceMap,
  });
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry);
    }
    return Object.freeze(value);
  }

  for (const entry of Object.values(value)) {
    deepFreeze(entry);
  }

  return Object.freeze(value);
}

/** Cap diagnostics to prevent error flooding in output. */
const MAX_ERRORS = 10;
function capDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  if (diagnostics.length <= MAX_ERRORS) return diagnostics;
  const capped = diagnostics.slice(0, MAX_ERRORS);
  capped.push({
    severity: "error",
    code: "E_TOO_MANY",
    message: `... and ${diagnostics.length - MAX_ERRORS} more error(s). Fix the errors above first.`,
    location: { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
  });
  return capped;
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
