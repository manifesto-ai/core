import type { Diagnostic } from "../diagnostics/types.js";
import type { MelExprNode } from "../lowering/lower-expr.js";
import type { MelIRPatchPath } from "../lowering/lower-runtime-patch.js";
import type {
  ExprNode,
  GuardedStmtNode,
  InnerStmtNode,
  PathNode,
  PatchStmtNode,
} from "../parser/ast.js";
import {
  classifySpreadOperandType,
  classifyComparableExpr,
  inferExprType,
  mayYieldArrayExpr,
  resolveType,
  type DomainTypeSymbols,
} from "../analyzer/expr-type-surface.js";
import { toMelExpr } from "./compile-mel-patch-expr.js";

export interface PatchCollectContext {
  readonly actionName: string;
}

type AllowedSysPrefix = "input" | "runtime" | "context";

export type ConditionedPatchStatement = {
  patch: PatchStmtNode;
  condition?: MelExprNode;
};

export interface PatchCollectorDeps {
  toMelExpr: (expr: Parameters<typeof toMelExpr>[0]) => MelExprNode;
  mapLocation: (location: Diagnostic["location"]) => Diagnostic["location"];
}

export class PatchStatementCollector {
  private readonly exprValidator: PatchExprValidator;

  constructor(
    private readonly deps: PatchCollectorDeps,
    allowSysPrefixes: readonly AllowedSysPrefix[] = ["input", "runtime", "context"],
  ) {
    this.exprValidator = new PatchExprValidator(deps.mapLocation, allowSysPrefixes);
  }

  collect(
    stmts: GuardedStmtNode[] | InnerStmtNode[],
    errors: Diagnostic[],
    context: PatchCollectContext,
    parentCondition: MelExprNode | undefined
  ): ConditionedPatchStatement[] {
    return this.collectPatchStatements(stmts, errors, context, parentCondition);
  }

  private collectPatchStatements(
    stmts: GuardedStmtNode[] | InnerStmtNode[],
    errors: Diagnostic[],
    context: PatchCollectContext,
    parentCondition: MelExprNode | undefined
  ): ConditionedPatchStatement[] {
    void context;
    const patchStatements: ConditionedPatchStatement[] = [];

    for (const stmt of stmts) {
      if (stmt.kind === "patch") {
        this.exprValidator.validatePath(stmt.path, errors);
        if (stmt.value) {
          this.exprValidator.validateExpr(stmt.value, errors);
        }
        patchStatements.push({
          patch: stmt,
          condition: parentCondition,
        });
        continue;
      }

      if (stmt.kind === "when") {
        this.pushUnsupportedControlError(stmt.kind, stmt.location, errors);
        continue;
      }

      if (stmt.kind === "once") {
        this.pushUnsupportedControlError(stmt.kind, stmt.location, errors);
        continue;
      }

      if (stmt.kind === "onceIntent") {
        this.pushUnsupportedControlError(stmt.kind, stmt.location, errors);
        continue;
      }

      errors.push({
        severity: "error",
        code: "E_UNSUPPORTED_STMT",
        message: `Unsupported statement '${stmt.kind}' in patch text. Only patch statements are allowed.`,
        location: this.deps.mapLocation(stmt.location),
      });
    }

    return patchStatements;
  }

  private pushUnsupportedControlError(
    kind: "when" | "once" | "onceIntent",
    location: Diagnostic["location"],
    errors: Diagnostic[]
  ): void {
    errors.push({
      severity: "error",
      code: "E_UNSUPPORTED_CONTROL",
      message:
        `compileMelPatch() does not support '${kind}' in v5. Compile a full MEL domain so Core can lower guarded control through the current runtime channels.`,
      location: this.deps.mapLocation(location),
    });
  }
}

export function compilePatchStmtToMelRuntime(
  patchStatement: ConditionedPatchStatement
): { op: "set" | "unset" | "merge"; path: MelIRPatchPath; value?: MelExprNode; condition?: MelExprNode } {
  return {
    op: patchStatement.patch.op,
    path: toRuntimePatchPath(patchStatement.patch.path),
    ...(patchStatement.condition ? { condition: patchStatement.condition } : undefined),
    ...(patchStatement.patch.value
      ? { value: toMelExpr(patchStatement.patch.value) }
      : undefined),
  };
}

function toRuntimePatchPath(path: PathNode): MelIRPatchPath {
  return path.segments.map((segment) => {
    if (segment.kind === "propertySegment") {
      return { kind: "prop" as const, name: segment.name };
    }

    return { kind: "expr" as const, expr: toMelExpr(segment.index) };
  });
}

class PatchExprValidator {
  private static readonly VALID_RUNTIME_PATHS = new Set([
    "intent.id",
    "intent.action",
    "time.timestamp",
    "time.iso",
    "random.seed",
    "random.uuid",
  ]);

  private readonly symbols: DomainTypeSymbols = {
    stateTypes: new Map(),
    contextTypes: new Map(),
    computedDecls: new Map(),
    typeDefs: new Map(),
    computedTypeCache: new Map(),
    computedTypeInFlight: new Set(),
  };

  constructor(
    private readonly mapLocation: (location: Diagnostic["location"]) => Diagnostic["location"],
    private readonly allowSysPrefixes: readonly AllowedSysPrefix[],
  ) {}

  validatePath(path: PathNode, errors: Diagnostic[]): void {
    for (const segment of path.segments) {
      if (segment.kind === "indexSegment") {
        this.validateExpr(segment.index, errors);
      }
    }
  }

  validateExpr(expr: ExprNode, errors: Diagnostic[]): void {
    switch (expr.kind) {
      case "functionCall":
        if ((expr.name === "eq" || expr.name === "neq") && expr.args.length >= 2) {
          this.validatePrimitiveEquality(expr.args[0], expr.args[1], expr.location, errors);
        }
        for (const arg of expr.args) {
          this.validateExpr(arg, errors);
        }
        if (expr.name === "merge") {
          for (const arg of expr.args) {
            this.validateSpreadOperand(arg, arg.location, errors);
          }
        }
        return;

      case "binary":
        if (expr.operator === "==" || expr.operator === "!=") {
          this.validatePrimitiveEquality(expr.left, expr.right, expr.location, errors);
        }
        this.validateExpr(expr.left, errors);
        this.validateExpr(expr.right, errors);
        return;

      case "unary":
        this.validateExpr(expr.operand, errors);
        return;

      case "ternary":
        this.validateExpr(expr.condition, errors);
        this.validateExpr(expr.consequent, errors);
        this.validateExpr(expr.alternate, errors);
        return;

      case "propertyAccess":
        this.validateExpr(expr.object, errors);
        return;

      case "indexAccess":
        this.validateExpr(expr.object, errors);
        this.validateExpr(expr.index, errors);
        return;

      case "objectLiteral":
        for (const property of expr.properties) {
          if (property.kind === "objectProperty") {
            this.validateExpr(property.value, errors);
            continue;
          }

          this.validateExpr(property.expr, errors);
          this.validateSpreadOperand(property.expr, property.location, errors);
        }
        return;

      case "arrayLiteral":
        for (const element of expr.elements) {
          this.validateExpr(element, errors);
        }
        return;

      case "literal":
      case "identifier":
      case "iterationVar":
        return;

      case "systemIdent":
        this.validateSystemIdent(expr, errors);
        return;
    }
  }

  private validateSystemIdent(expr: Extract<ExprNode, { kind: "systemIdent" }>, errors: Diagnostic[]): void {
    const [namespace, ...rest] = expr.path;

    if (namespace === "system" || namespace === "meta") {
      this.pushInvalidSysPath(
        `$${namespace}.* is retired in v5 MEL; use $runtime.* or declared $context.* where action-flow context is available`,
        expr.location,
        errors,
      );
      return;
    }

    if (namespace !== "input" && namespace !== "runtime" && namespace !== "context") {
      this.pushInvalidSysPath(
        `Invalid dollar identifier namespace '$${namespace ?? ""}'. Valid namespaces: $runtime, $context, $input, $item`,
        expr.location,
        errors,
      );
      return;
    }

    if (!this.allowSysPrefixes.includes(namespace)) {
      this.pushInvalidSysPath(
        `Dollar namespace path '${expr.path.join(".")}' is not allowed in this lowering context`,
        expr.location,
        errors,
      );
      return;
    }

    if (namespace === "runtime") {
      const key = rest.join(".");
      if (!PatchExprValidator.VALID_RUNTIME_PATHS.has(key)) {
        this.pushInvalidSysPath(
          `Invalid runtime value '$runtime.${key}'. Valid values: ${[...PatchExprValidator.VALID_RUNTIME_PATHS].join(", ")}`,
          expr.location,
          errors,
        );
      }
      return;
    }

    if (namespace === "context") {
      this.pushInvalidSysPath(
        "Cannot use $context.* without a domain context declaration",
        expr.location,
        errors,
      );
    }
  }

  private pushInvalidSysPath(
    message: string,
    location: Diagnostic["location"],
    errors: Diagnostic[],
  ): void {
    errors.push({
      severity: "error",
      code: "E003",
      message,
      location: this.mapLocation(location),
    });
  }

  private validatePrimitiveEquality(
    left: ExprNode,
    right: ExprNode,
    location: Diagnostic["location"],
    errors: Diagnostic[]
  ): void {
    const leftClass = classifyComparableExpr(left, new Map(), this.symbols);
    const rightClass = classifyComparableExpr(right, new Map(), this.symbols);
    if (leftClass !== "nonprimitive" && rightClass !== "nonprimitive") {
      return;
    }

    errors.push({
      severity: "error",
      code: "E_TYPE_MISMATCH",
      message: "eq/neq operands must be primitive types (null, boolean, number, string)",
      location: this.mapLocation(location),
      });
  }

  private validateSpreadOperand(
    expr: ExprNode,
    location: Diagnostic["location"],
    errors: Diagnostic[]
  ): void {
    const inferred = inferExprType(expr, new Map(), this.symbols);
    const mayYieldInvalidSpread = mayYieldArrayExpr(expr, {
      env: new Map(),
      symbols: this.symbols,
      inferExprType,
      resolveType,
    });

    if (!inferred) {
      if (!mayYieldInvalidSpread) {
        return;
      }
    }

    const classification = mayYieldInvalidSpread
      ? "invalid"
      : inferred
      ? classifySpreadOperandType(inferred, this.symbols)
      : "unknown";

    if (classification !== "invalid") {
      return;
    }

    errors.push({
      severity: "error",
      code: "E_TYPE_MISMATCH",
      message: "Object spread operands must be object-shaped or T | null where T is object-shaped",
      location: this.mapLocation(location),
    });
  }
}
