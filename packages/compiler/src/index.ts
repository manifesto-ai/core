/**
 * @manifesto-ai/compiler
 *
 * MEL (Manifesto Expression Language) compiler.
 * Provides lexer, parser, analyzer, lowering, evaluation, and rendering.
 */

// ════════════════════════════════════════════════════════════════════════════
// Lexer (MEL source → tokens)
// ════════════════════════════════════════════════════════════════════════════

export * from "./lexer/index.js";

// ════════════════════════════════════════════════════════════════════════════
// Parser (tokens → AST)
// ════════════════════════════════════════════════════════════════════════════

export * from "./parser/index.js";

// ════════════════════════════════════════════════════════════════════════════
// Analyzer (AST validation and scope analysis)
// ════════════════════════════════════════════════════════════════════════════

export * from "./analyzer/index.js";

// ════════════════════════════════════════════════════════════════════════════
// Diagnostics
// ════════════════════════════════════════════════════════════════════════════

export * from "./diagnostics/index.js";

// ════════════════════════════════════════════════════════════════════════════
// Generator (AST → IR)
// ════════════════════════════════════════════════════════════════════════════

export * from "./generator/index.js";

// ════════════════════════════════════════════════════════════════════════════
// MEL Renderer (PatchFragment → MEL text)
// Re-export with namespace to avoid ExprNode conflict with parser
// ════════════════════════════════════════════════════════════════════════════

export {
  renderTypeExpr,
  renderTypeField,
  renderValue,
  renderExprNode,
  renderPatchOp,
  extractTypeName,
  renderFragment,
  renderFragments,
  renderFragmentsByKind,
  renderAsDomain,
  type TypeExpr,
  type TypeField,
  type ExprNode as RendererExprNode,
  type PatchOp,
  type AddTypeOp,
  type AddFieldOp,
  type SetFieldTypeOp,
  type SetDefaultValueOp,
  type AddConstraintOp,
  type AddComputedOp,
  type AddActionAvailableOp,
  type RenderOptions,
  type PatchFragment,
  type FragmentRenderOptions,
} from "./renderer/index.js";

// ════════════════════════════════════════════════════════════════════════════
// Lowering (MEL IR → Core IR)
// ════════════════════════════════════════════════════════════════════════════

export * from "./lowering/index.js";

// ════════════════════════════════════════════════════════════════════════════
// Evaluation (Core IR → Concrete Values)
// ════════════════════════════════════════════════════════════════════════════

export * from "./evaluation/index.js";

// ════════════════════════════════════════════════════════════════════════════
// Compile API (MEL Text Ingest)
// ════════════════════════════════════════════════════════════════════════════

export * from "./api/index.js";
export * from "./annotations.js";
export * from "./schema-graph.js";

// ===========================================================================
// Legacy compatibility API
// ===========================================================================

import type { ParseResult } from "./parser/index.js";
import { analyzeScope, validateSemantics } from "./analyzer/index.js";
import { validateAndExpandFlows } from "./analyzer/flow-composition.js";
import { buildAnnotationIndex } from "./annotations.js";
import { generate, type GenerateResult } from "./generator/ir.js";
import { lowerSystemValues, type DomainSchema } from "./generator/index.js";
import {
  createDefaultSourceMapEmissionContext,
  extractSourceMap,
} from "./source-map.js";
import type { CompileTrace } from "./api/index.js";
import { tokenize } from "./lexer/index.js";
import { parse } from "./parser/index.js";
import { hasErrors } from "./diagnostics/types.js";
import type { Diagnostic } from "./diagnostics/types.js";

const COMPILER_VERSION = "3.5.0";

export interface CompileOptions {
  /** Whether to lower system values during compilation */
  lowerSystemValues?: boolean;
  /** Skip scope/semantic validation */
  skipSemanticAnalysis?: boolean;
  /** Backward-compatible passthrough for legacy callers */
  mode?: "domain";
}

export interface CompileResult {
  schema: DomainSchema | null;
  trace: CompileTrace[];
  warnings: Diagnostic[];
  errors: Diagnostic[];
  success: boolean;
}

/**
 * Backward-compatible compile API.
 *
 * Current public API is `compileMelDomain`, but several test/code paths and CLI
 * still call this legacy helper.
 *
 * This wrapper keeps the legacy contract:
 * - returns `{ success }`
 * - supports optional `lowerSystemValues` and `skipSemanticAnalysis`
 * - includes parse/analyze/generate diagnostics in one result
 */
export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const trace: CompileTrace[] = [];

  const lexStart = performance.now();
  const lexResult = tokenize(source);
  trace.push({ phase: "lex", durationMs: performance.now() - lexStart, details: { tokenCount: lexResult.tokens.length } });

  if (hasErrors(lexResult.diagnostics)) {
    return {
      schema: null,
      trace,
      warnings: lexResult.diagnostics.filter(d => d.severity === "warning"),
      errors: lexResult.diagnostics.filter(d => d.severity === "error"),
      success: false,
    };
  }

  const parseStart = performance.now();
  const parseResult: ParseResult = parse(lexResult.tokens);
  const parseErrors = parseResult.diagnostics;
  trace.push({ phase: "parse", durationMs: performance.now() - parseStart });

  if (hasErrors(parseErrors)) {
    return {
      schema: null,
      trace,
      warnings: parseErrors.filter(d => d.severity === "warning"),
      errors: parseErrors.filter(d => d.severity === "error"),
      success: false,
    };
  }

  const diagnostics: Diagnostic[] = [];
  const analyzeStart = performance.now();
  const flowResult = validateAndExpandFlows(parseResult.program!);
  diagnostics.push(...flowResult.diagnostics);

  if (!options.skipSemanticAnalysis) {
    const scopeResult = analyzeScope(flowResult.program);
    const validateResult = validateSemantics(flowResult.program);
    diagnostics.push(...scopeResult.diagnostics, ...validateResult.diagnostics);
  }
  trace.push({ phase: "analyze", durationMs: performance.now() - analyzeStart });

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return {
      schema: null,
      trace,
      warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning"),
      errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error"),
      success: false,
    };
  }

  const generateStart = performance.now();
  const genResult: GenerateResult = generate(flowResult.program);
  diagnostics.push(...genResult.diagnostics);
  trace.push({ phase: "generate", durationMs: performance.now() - generateStart });

  if (!options.skipSemanticAnalysis && genResult.schema) {
    const annotationResult = buildAnnotationIndex(flowResult.program, genResult.schema);
    diagnostics.push(...annotationResult.diagnostics);
    const sourceMapResult = extractSourceMap(
      flowResult.program,
      source,
      genResult.schema,
      createDefaultSourceMapEmissionContext(COMPILER_VERSION),
    );
    diagnostics.push(...sourceMapResult.diagnostics);
  }

  if (options.skipSemanticAnalysis) {
    diagnostics.push(...parseResult.diagnostics);
  }

  const errors = diagnostics.filter(d => d.severity === "error");
  if (genResult.schema === null || errors.length > 0) {
    return {
      schema: null,
      trace,
      warnings: diagnostics.filter(d => d.severity === "warning"),
      errors,
      success: false,
    };
  }

  let schema: DomainSchema = genResult.schema;
  if (options.lowerSystemValues) {
    const lowerStart = performance.now();
    schema = lowerSystemValues(schema);
    trace.push({ phase: "lower", durationMs: performance.now() - lowerStart });
  }

  const warnings = diagnostics.filter(d => d.severity === "warning");

  return {
    schema,
    trace,
    warnings,
    errors: diagnostics.filter(d => d.severity === "error"),
    success: errors.length === 0,
  };
}

/**
 * Backward-compatible token+parse helper.
 */
export function parseSource(source: string): ParseResult {
  const lexResult = tokenize(source);
  if (hasErrors(lexResult.diagnostics)) {
    return { program: null, diagnostics: lexResult.diagnostics };
  }

  return parse(lexResult.tokens);
}

/**
 * Backward-compatible check helper.
 */
export function check(source: string): Diagnostic[] {
  const result = compile(source);
  return result.errors;
}
