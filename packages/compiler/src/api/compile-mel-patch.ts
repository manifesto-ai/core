import type { Diagnostic } from "../diagnostics/types.js";
import type { CompileMelPatchOptions, CompileMelPatchResult, CompileTrace } from "./compile-mel.js";

import { tokenize } from "../lexer/index.js";
import { parse } from "../parser/index.js";
import type { ProgramNode } from "../parser/index.js";
import type { ActionNode } from "../parser/ast.js";
import { lowerRuntimePatch } from "../lowering/lower-runtime-patch.js";
import { LoweringError } from "../lowering/errors.js";
import type { ExprLoweringContext } from "../lowering/context.js";

import {
  compilePatchStmtToMelRuntime,
  PatchCollectContext,
  PatchStatementCollector,
} from "./compile-mel-patch-collector.js";
import { isSyntheticPatchCondition, toMelExpr } from "./compile-mel-patch-expr.js";
import {
  SYNTHETIC_PATCH_PREFIX_LINES,
  computeLineStartOffsets,
  makePatchLocationMapper,
  remapDiagnosticsToPatchSource,
} from "./compile-mel-patch-location.js";

/**
 * Synthetic action name for compile-time wrap.
 */
const SYNTHETIC_ACTION = "__compileMelPatch";
const SYNTHETIC_DOMAIN = "__patchDomain";
const SYNTHETIC_PATCH_INDENT = "      ";

/**
 * Compile MEL patch text into RuntimeConditionalPatchOps.
 */
export function compileMelPatchText(
  melText: string,
  options: CompileMelPatchOptions
): CompileMelPatchResult {
  const trace: CompileTrace[] = [];
  const warnings: Diagnostic[] = [];
  const errors: Diagnostic[] = [];
  const patchLines = melText.split("\n");
  const patchLineStarts = computeLineStartOffsets(patchLines);
  const mapLocation = makePatchLocationMapper(patchLines, patchLineStarts);

  const syntheticMel = buildSyntheticPatchProgram(melText, SYNTHETIC_ACTION);

  // Phase 1: Lex
  const lexStart = performance.now();
  let tokens: ReturnType<typeof tokenize>["tokens"];
  try {
    const lexResult = tokenize(syntheticMel);
    tokens = lexResult.tokens;
    const lexErrors = remapDiagnosticsToPatchSource(
      lexResult.diagnostics.filter(d => d.severity === "error"),
      patchLines,
      patchLineStarts
    );
    if (lexErrors.length > 0) {
      errors.push(...lexErrors);
      trace.push({
        phase: "lex",
        durationMs: performance.now() - lexStart,
        details: { tokenCount: tokens.length },
      });
      return { ops: [], trace, warnings, errors };
    }
  } catch (error) {
    errors.push({
      severity: "error",
      code: "E_LEX",
      message: (error as Error).message,
      location: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 1, offset: 0 },
      },
    });
    trace.push({ phase: "lex", durationMs: performance.now() - lexStart });
    return { ops: [], trace, warnings, errors };
  }
  trace.push({
    phase: "lex",
    durationMs: performance.now() - lexStart,
    details: { tokenCount: tokens.length },
  });

  // Phase 2: Parse
  const parseStart = performance.now();
  let program: ProgramNode;
  try {
    const parseResult = parse(tokens);
    const parsedDiagnostics = remapDiagnosticsToPatchSource(
      parseResult.diagnostics,
      patchLines,
      patchLineStarts
    );
    const parseErrors = parsedDiagnostics.filter(d => d.severity === "error");
    const parseWarnings = parsedDiagnostics.filter(d => d.severity !== "error");

    if (parseErrors.length > 0) {
      errors.push(...parseErrors);
      warnings.push(...parseWarnings);
      trace.push({ phase: "parse", durationMs: performance.now() - parseStart });
      return { ops: [], trace, warnings, errors };
    }
    if (!parseResult.program) {
      errors.push({
        severity: "error",
        code: "E_PARSE",
        message: "Failed to parse MEL patch program",
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 1, offset: 0 },
        },
      });
      warnings.push(...parseWarnings);
      trace.push({ phase: "parse", durationMs: performance.now() - parseStart });
      return { ops: [], trace, warnings, errors };
    }

    program = parseResult.program;
    warnings.push(...parseWarnings);
  } catch (error) {
    errors.push({
      severity: "error",
      code: "E_PARSE",
      message: (error as Error).message,
      location: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 1, offset: 0 },
      },
    });
    trace.push({ phase: "parse", durationMs: performance.now() - parseStart });
    return { ops: [], trace, warnings, errors };
  }
  trace.push({ phase: "parse", durationMs: performance.now() - parseStart });

  // Phase 3: Analyze
  const analyzeStart = performance.now();
  const collectContext: PatchCollectContext = {
    actionName: options.actionName,
    onceIntentCounter: 0,
  };
  const action = program.domain.members.find(
    (member): member is ActionNode =>
      member.kind === "action" && member.name === SYNTHETIC_ACTION
  );
  if (!action) {
    errors.push({
      severity: "error",
      code: "E_ANALYZE",
      message: `Synthetic patch action '${SYNTHETIC_ACTION}' not found during parsing`,
      location: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 1, offset: 0 },
      },
    });
    trace.push({ phase: "analyze", durationMs: performance.now() - analyzeStart });
    return { ops: [], trace, warnings, errors };
  }

  const expectedActionEndLine = patchLines.length + SYNTHETIC_PATCH_PREFIX_LINES + 2;
  if (action.location.end.line !== expectedActionEndLine) {
    errors.push({
      severity: "error",
      code: "E_PATCH_WRAPPER",
      message: `Malformed synthetic patch wrapper for action '${SYNTHETIC_ACTION}'.`,
      location: mapLocation(action.location),
    });
    trace.push({ phase: "analyze", durationMs: performance.now() - analyzeStart });
    return { ops: [], trace, warnings, errors };
  }

  const [patchRoot] = action.body;
  if (
    !patchRoot ||
    patchRoot.kind !== "when" ||
    !isSyntheticPatchCondition(patchRoot.condition) ||
    action.body.length !== 1
  ) {
    errors.push({
      severity: "error",
      code: "E_PATCH_WRAPPER",
      message: `Malformed synthetic patch wrapper for action '${SYNTHETIC_ACTION}'.`,
      location: mapLocation(action.location),
    });
    trace.push({ phase: "analyze", durationMs: performance.now() - analyzeStart });
    return { ops: [], trace, warnings, errors };
  }

  const collector = new PatchStatementCollector({
    mapLocation,
    toMelExpr,
  });
  const patchStatements = collector.collect(
    patchRoot.body,
    errors,
    collectContext,
    undefined
  );

  if (errors.length === 0 && melText.trim() !== "" && patchStatements.length === 0) {
    errors.push({
      severity: "error",
      code: "E_PATCH_WRAPPER",
      message:
        "Patch wrapper parsing produced no patch statements. The patch source may be malformed.",
      location: mapLocation(patchRoot.location),
    });
  }
  trace.push({
    phase: "analyze",
    durationMs: performance.now() - analyzeStart,
    details: { count: patchStatements.length },
  });

  if (errors.length > 0) {
    return { ops: [], trace, warnings, errors };
  }

  // Phase 4: Lowering
  const lowerStart = performance.now();
  const loweringContext: ExprLoweringContext = {
    mode: "action",
    allowSysPaths: options.allowSysPaths ?? { prefixes: ["meta", "input"] },
    fnTableVersion: options.fnTableVersion ?? "1.0",
    actionName: options.actionName,
  };

  const loweredOps: CompileMelPatchResult["ops"] = [];
  for (const patchStatement of patchStatements) {
    try {
      const melPatch = compilePatchStmtToMelRuntime(patchStatement);
      loweredOps.push(lowerRuntimePatch(melPatch, loweringContext));
    } catch (error) {
      if (error instanceof LoweringError) {
        errors.push({
          severity: "error",
          code: error.code,
          message: error.message,
          location: mapLocation(patchStatement.patch.location),
        });
      } else if (error instanceof Error) {
        errors.push({
          severity: "error",
          code: "E_LOWER",
          message: error.message,
          location: mapLocation(patchStatement.patch.location),
        });
      } else {
        errors.push({
          severity: "error",
          code: "E_LOWER",
          message: "Unknown lowering failure",
          location: mapLocation(patchStatement.patch.location),
        });
      }
    }
  }

  trace.push({
    phase: "lower",
    durationMs: performance.now() - lowerStart,
    details: { count: loweredOps.length },
  });

  if (errors.length > 0) {
    return { ops: [], trace, warnings, errors };
  }

  return {
    ops: loweredOps,
    trace,
    warnings,
    errors,
  };
}

function buildSyntheticPatchProgram(melText: string, actionName: string): string {
  const indentedPatchText = melText
    .split("\n")
    .map((line) => `${SYNTHETIC_PATCH_INDENT}${line}`)
    .join("\n");

  return [
    `domain ${SYNTHETIC_DOMAIN} {`,
    `  action ${actionName}() {`,
    "    when true {",
    indentedPatchText,
    "    }",
    "  }",
    "}",
  ].join("\n");
}
