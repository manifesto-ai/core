import type { Diagnostic } from "../diagnostics/types.js";
import type { CompileMelPatchOptions, CompileMelPatchResult, CompileTrace } from "./compile-mel.js";

import { tokenize } from "../lexer/index.js";
import { parse } from "../parser/index.js";
import type { ProgramNode } from "../parser/index.js";
import type {
  ActionNode,
  BinaryOperator,
  ExprNode,
  GuardedStmtNode,
  InnerStmtNode,
  PatchStmtNode,
  PathNode,
  PathSegmentNode,
} from "../parser/ast.js";
import { lowerRuntimePatch } from "../lowering/lower-runtime-patch.js";
import { LoweringError } from "../lowering/errors.js";
import type { ExprLoweringContext } from "../lowering/context.js";
import type { MelExprNode, MelPathSegment } from "../lowering/lower-expr.js";

/**
 * Synthetic action name for compile-time wrap.
 */
const SYNTHETIC_ACTION = "__compileMelPatch";
const SYNTHETIC_DOMAIN = "__patchDomain";

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

  const syntheticMel = buildSyntheticPatchProgram(melText, SYNTHETIC_ACTION);

  // Phase 1: Lex
  const lexStart = performance.now();
  let tokens: ReturnType<typeof tokenize>["tokens"];
  try {
    const lexResult = tokenize(syntheticMel);
    tokens = lexResult.tokens;
    const lexErrors = lexResult.diagnostics.filter(d => d.severity === "error");
    if (lexErrors.length > 0) {
      errors.push(...lexErrors);
      trace.push({ phase: "lex", durationMs: performance.now() - lexStart, details: { tokenCount: tokens.length } });
      return { ops: [], trace, warnings, errors };
    }
  } catch (error) {
    errors.push({
      severity: "error",
      code: "E_LEX",
      message: (error as Error).message,
      location: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
    });
    trace.push({ phase: "lex", durationMs: performance.now() - lexStart });
    return { ops: [], trace, warnings, errors };
  }
  trace.push({ phase: "lex", durationMs: performance.now() - lexStart, details: { tokenCount: tokens.length } });

  // Phase 2: Parse
  const parseStart = performance.now();
  let program: ProgramNode;
  try {
    const parseResult = parse(tokens);
    const parseErrors = parseResult.diagnostics.filter(d => d.severity === "error");
    const parseWarnings = parseResult.diagnostics.filter(d => d.severity !== "error");

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
        location: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
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
      location: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
    });
    trace.push({ phase: "parse", durationMs: performance.now() - parseStart });
    return { ops: [], trace, warnings, errors };
  }
  trace.push({ phase: "parse", durationMs: performance.now() - parseStart });

  // Phase 3: Extract patch statements
  const analyzeStart = performance.now();
  const action = program.domain.members.find(
    (member): member is ActionNode => member.kind === "action" && member.name === SYNTHETIC_ACTION
  );
  if (!action) {
    errors.push({
      severity: "error",
      code: "E_ANALYZE",
      message: `Synthetic patch action '${SYNTHETIC_ACTION}' not found during parsing`,
      location: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
    });
    trace.push({ phase: "analyze", durationMs: performance.now() - analyzeStart });
    return { ops: [], trace, warnings, errors };
  }

  const patchStatements = collectPatchStatements(action.body, errors);
  trace.push({ phase: "analyze", durationMs: performance.now() - analyzeStart, details: { count: patchStatements.length } });

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
          location: patchStatement.location,
        });
      } else if (error instanceof Error) {
        errors.push({
          severity: "error",
          code: "E_LOWER",
          message: error.message,
          location: patchStatement.location,
        });
      } else {
        errors.push({
          severity: "error",
          code: "E_LOWER",
          message: "Unknown lowering failure",
          location: patchStatement.location,
        });
      }
    }
  }

  trace.push({ phase: "lower", durationMs: performance.now() - lowerStart, details: { count: loweredOps.length } });

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
    .map((line) => `      ${line}`)
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

function collectPatchStatements(
  stmts: GuardedStmtNode[] | InnerStmtNode[],
  errors: Diagnostic[]
): PatchStmtNode[] {
  const patchStatements: PatchStmtNode[] = [];

  for (const stmt of stmts) {
    if (stmt.kind === "patch") {
      patchStatements.push(stmt);
      continue;
    }

    if (stmt.kind === "when" || stmt.kind === "once" || stmt.kind === "onceIntent") {
      patchStatements.push(...collectPatchStatements(stmt.body, errors));
      continue;
    }

    errors.push({
      severity: "error",
      code: "E_UNSUPPORTED_STMT",
      message: `Unsupported statement '${stmt.kind}' in patch text. Only patch statements are allowed.`,
      location: stmt.location,
    });
  }

  return patchStatements;
}

function compilePatchStmtToMelRuntime(
  stmt: PatchStmtNode
): { op: "set" | "unset" | "merge"; path: string; value?: MelExprNode; condition?: undefined } {
  return {
    op: stmt.op,
    path: toRuntimePatchPath(stmt.path),
    ...(stmt.value ? { value: toMelExpr(stmt.value) } : undefined),
  };
}

function toRuntimePatchPath(path: PathNode): string {
  const parts: string[] = [];

  for (const segment of path.segments) {
    if (segment.kind === "propertySegment") {
      parts.push(segment.name);
      continue;
    }

    const literalValue = toPathSegmentLiteral(segment);
    parts.push(literalValue ?? "*");
  }

  return parts.join(".");
}

function toPathSegmentLiteral(segment: PathSegmentNode): string | null {
  if (segment.kind === "indexSegment" && segment.index.kind === "literal") {
    return String(segment.index.value);
  }

  return null;
}

function toMelExpr(input: ExprNode): MelExprNode {
  switch (input.kind) {
    case "literal":
      return { kind: "lit", value: toMelPrimitive(input.value, input.literalType) };

    case "identifier":
      return {
        kind: "get",
        path: [{ kind: "prop", name: input.name }],
      };

    case "systemIdent":
      return { kind: "sys", path: input.path };

    case "iterationVar":
      return { kind: "var", name: input.name };

    case "propertyAccess": {
      const path = staticPathFromExpr(input);
      if (!path) {
        throw new Error("Dynamic property access is not supported in runtime patch compilation");
      }
      return path;
    }

    case "indexAccess": {
      const path = staticPathFromExpr(input);
      if (path) {
        return path;
      }
      return {
        kind: "call",
        fn: "at",
        args: [toMelExpr(input.object), toMelExpr(input.index)],
      };
    }

    case "functionCall":
      return {
        kind: "call",
        fn: input.name,
        args: input.args.map(toMelExpr),
      };

    case "unary":
      if (input.operator === "!") {
        return {
          kind: "call",
          fn: "not",
          args: [toMelExpr(input.operand)],
        };
      }
      return {
        kind: "call",
        fn: "neg",
        args: [toMelExpr(input.operand)],
      };

    case "binary":
      return {
        kind: "call",
        fn: toMelBinaryOp(input.operator),
        args: [toMelExpr(input.left), toMelExpr(input.right)],
      };

    case "ternary":
      return {
        kind: "call",
        fn: "if",
        args: [
          toMelExpr(input.condition),
          toMelExpr(input.consequent),
          toMelExpr(input.alternate),
        ],
      };

    case "objectLiteral":
      return {
        kind: "obj",
        fields: input.properties.map((property) => ({
          key: property.key,
          value: toMelExpr(property.value),
        })),
      };

    case "arrayLiteral":
      return {
        kind: "arr",
        elements: input.elements.map(toMelExpr),
      };

    default:
      throw new Error(`Unsupported expression kind '${(input as ExprNode).kind}'`);
  }
}

function toMelPrimitive(value: unknown, literalType: "number" | "string" | "boolean" | "null"): null | boolean | number | string {
  if (literalType === "null") {
    return null;
  }

  if (literalType === "number") {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "bigint") {
      return Number(value);
    }
    if (typeof value === "string" && value.length > 0) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    throw new Error("Invalid number literal");
  }

  if (literalType === "string") {
    if (typeof value === "string") {
      return value;
    }
    throw new Error("Invalid string literal");
  }

  if (literalType === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }
    throw new Error("Invalid boolean literal");
  }

  throw new Error("Unsupported literal type");
}

function staticPathFromExpr(expr: ExprNode): MelExprNode | null {
  const path = collectStaticPath(expr);
  if (!path) {
    return null;
  }
  return {
    kind: "get",
    base: path.base,
    path: path.segments,
  };
}

function collectStaticPath(
  expr: ExprNode
): { base?: MelExprNode; segments: MelPathSegment[] } | null {
  if (expr.kind === "identifier") {
    return { segments: [{ kind: "prop", name: expr.name }] };
  }

  if (expr.kind === "iterationVar") {
    if (expr.name !== "item") {
      return null;
    }
    return { base: { kind: "var", name: "item" }, segments: [] };
  }

  if (expr.kind === "propertyAccess") {
    const basePath = collectStaticPath(expr.object);
    if (!basePath) {
      return null;
    }
    return {
      base: basePath.base,
      segments: [...basePath.segments, { kind: "prop", name: expr.property }],
    };
  }

  if (expr.kind === "indexAccess") {
    const basePath = collectStaticPath(expr.object);
    if (!basePath || expr.index.kind !== "literal") {
      return null;
    }
    return {
      base: basePath.base,
      segments: [...basePath.segments, { kind: "prop", name: String(expr.index.value) }],
    };
  }

  return null;
}

function toMelBinaryOp(op: BinaryOperator): string {
  switch (op) {
    case "+":
      return "add";
    case "-":
      return "sub";
    case "*":
      return "mul";
    case "/":
      return "div";
    case "%":
      return "mod";
    case "==":
      return "eq";
    case "!=":
      return "neq";
    case "<":
      return "lt";
    case "<=":
      return "lte";
    case ">":
      return "gt";
    case ">=":
      return "gte";
    case "&&":
      return "and";
    case "||":
      return "or";
    case "??":
      return "coalesce";
    default:
      throw new Error(`Unsupported binary operator '${op}'`);
  }
}
