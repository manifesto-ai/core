import { sha256Sync } from "@manifesto-ai/core";

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
  actionName: string;
  onceCounter: number;
  onceIntentCounter: number;
  whenCounter: number;
}

export type ConditionedPatchStatement = {
  patch: PatchStmtNode;
  condition?: MelExprNode;
};

export interface PatchCollectorDeps {
  toMelExpr: (expr: Parameters<typeof toMelExpr>[0]) => MelExprNode;
  mapLocation: (location: Diagnostic["location"]) => Diagnostic["location"];
}

export class PatchStatementCollector {
  private readonly conditionComposer = new ConditionComposer();
  private readonly exprValidator: PatchExprValidator;

  constructor(private readonly deps: PatchCollectorDeps) {
    this.exprValidator = new PatchExprValidator(deps.mapLocation);
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
        this.exprValidator.validateExpr(stmt.condition, errors);
        let condition = parentCondition;
        try {
          condition = this.conditionComposer.and(
            parentCondition,
            this.deps.toMelExpr(stmt.condition)
          );
        } catch (error) {
          errors.push({
            severity: "error",
            code: "E_LOWER",
            message: (error as Error).message,
            location: this.deps.mapLocation(stmt.condition.location),
          });
        }
        const whenMarkerId = sha256Sync(
          `${context.actionName}:${context.whenCounter}:when`
        );
        context.whenCounter += 1;

        const whenMarkerPath = {
          kind: "path" as const,
          segments: [
            {
              kind: "propertySegment",
              name: "$mel",
              location: stmt.location,
            },
            {
              kind: "propertySegment",
              name: "__whenGuards",
              location: stmt.location,
            },
            {
              kind: "propertySegment",
              name: whenMarkerId,
              location: stmt.location,
            },
          ],
          location: stmt.location,
        } satisfies PathNode;

        const whenMarkerExpr = pathToMelExpr(whenMarkerPath);

        const guardedBody = this.collectPatchStatements(
          stmt.body,
          errors,
          context,
          undefined
        ).map((statement) => ({
          patch: statement.patch,
          condition: this.conditionComposer.and(whenMarkerExpr, statement.condition),
        }));

        patchStatements.push(
          {
            patch: {
              kind: "patch",
              op: "set",
              path: whenMarkerPath,
              value: {
                kind: "literal",
                literalType: "boolean",
                value: true,
                location: stmt.location,
              },
              location: stmt.location,
            },
            condition,
          },
          ...guardedBody,
          {
            patch: {
              kind: "patch",
              op: "unset",
              path: whenMarkerPath,
              location: stmt.location,
            },
          }
        );
        continue;
      }

      if (stmt.kind === "once") {
        this.exprValidator.validatePath(stmt.marker, errors);
        let condition = parentCondition;
        const markerExpr = pathToMelExpr(stmt.marker);
        const markerPath = stmt.marker;
        const markerLocation = stmt.location;
        let onceCondition: MelExprNode = {
          kind: "call",
          fn: "neq",
          args: [markerExpr, { kind: "sys", path: ["meta", "intentId"] }],
        };

        if (stmt.condition) {
          this.exprValidator.validateExpr(stmt.condition, errors);
          try {
            onceCondition = this.conditionComposer.and(
              onceCondition,
              this.deps.toMelExpr(stmt.condition)
            ) ?? onceCondition;
          } catch (error) {
            errors.push({
              severity: "error",
              code: "E_LOWER",
              message: (error as Error).message,
              location: this.deps.mapLocation(stmt.condition.location),
            });
          }
        }

        condition = this.conditionComposer.and(parentCondition, onceCondition);
        const onceScopeMarkerId = sha256Sync(
          `${context.actionName}:${context.onceCounter}:once`
        );
        context.onceCounter += 1;
        const onceScopeMarkerPath: PathNode = {
          kind: "path",
          segments: [
            {
              kind: "propertySegment",
              name: "$mel",
              location: markerLocation,
            },
            {
              kind: "propertySegment",
              name: "__onceScopeGuards",
              location: markerLocation,
            },
            {
              kind: "propertySegment",
              name: onceScopeMarkerId,
              location: markerLocation,
            },
          ],
          location: markerLocation,
        };
        const onceScopeMarkerExpr = pathToMelExpr(onceScopeMarkerPath);
        const scopedBodyPatchStatements = this.collectPatchStatements(
          stmt.body,
          errors,
          context,
          onceScopeMarkerExpr
        );
        patchStatements.push(
          {
            patch: {
              kind: "patch",
              op: "set",
              path: onceScopeMarkerPath,
              value: {
                kind: "literal",
                literalType: "boolean",
                value: true,
                location: markerLocation,
              },
              location: markerLocation,
            },
            condition,
          },
          {
            patch: {
              kind: "patch",
              op: "set",
              path: markerPath,
              value: {
                kind: "systemIdent",
                path: ["meta", "intentId"],
                location: markerLocation,
              },
              location: markerLocation,
            },
            condition: onceScopeMarkerExpr,
          },
          ...scopedBodyPatchStatements,
          {
            patch: {
              kind: "patch",
              op: "unset",
              path: onceScopeMarkerPath,
              location: markerLocation,
            },
            condition,
          }
        );
        continue;
      }

      if (stmt.kind === "onceIntent") {
        const markerScopeId = sha256Sync(
          `${context.actionName}:${context.onceCounter}:onceIntent`
        );
        context.onceCounter += 1;
        const markerScopePath: PathNode = {
          kind: "path" as const,
          segments: [
            {
              kind: "propertySegment",
              name: "$mel",
              location: stmt.location,
            },
            {
              kind: "propertySegment",
              name: "__onceScopeGuards",
              location: stmt.location,
            },
            {
              kind: "propertySegment",
              name: markerScopeId,
              location: stmt.location,
            },
          ],
          location: stmt.location,
        };
        const markerScopeExpr = pathToMelExpr(markerScopePath);
        const onceIntentGuardId = sha256Sync(
          `${context.actionName}:${context.onceIntentCounter}:intent`
        );
        context.onceIntentCounter += 1;

        const markerLocation = stmt.location;
        const onceIntentGuardPath = {
          kind: "path" as const,
          segments: [
            {
              kind: "propertySegment",
              name: "$mel",
              location: markerLocation,
            },
            {
              kind: "propertySegment",
              name: "guards",
              location: markerLocation,
            },
            {
              kind: "propertySegment",
              name: "intent",
              location: markerLocation,
            },
            {
              kind: "propertySegment",
              name: onceIntentGuardId,
              location: markerLocation,
            },
          ],
          location: markerLocation,
        } satisfies PathNode;

        let onceIntentCondition: MelExprNode = {
          kind: "call",
          fn: "neq",
          args: [
            pathToMelExpr(onceIntentGuardPath),
            { kind: "sys", path: ["meta", "intentId"] },
          ],
        };

        if (stmt.condition) {
          this.exprValidator.validateExpr(stmt.condition, errors);
          try {
            onceIntentCondition = this.conditionComposer.and(
              onceIntentCondition,
              this.deps.toMelExpr(stmt.condition)
            ) ?? onceIntentCondition;
          } catch (error) {
            errors.push({
              severity: "error",
              code: "E_LOWER",
              message: (error as Error).message,
              location: this.deps.mapLocation(stmt.condition.location),
            });
          }
        }

        const condition = this.conditionComposer.and(parentCondition, onceIntentCondition);

        const onceIntentGuardMapPath: PathNode = {
          kind: "path",
          segments: [
            {
              kind: "propertySegment",
              name: "$mel",
              location: markerLocation,
            },
            {
              kind: "propertySegment",
              name: "guards",
              location: markerLocation,
            },
            {
              kind: "propertySegment",
              name: "intent",
              location: markerLocation,
            },
          ],
          location: markerLocation,
        };

        const scopedBodyPatchStatements = this.collectPatchStatements(
          stmt.body,
          errors,
          context,
          markerScopeExpr
        );

        patchStatements.push(
          {
            patch: {
              kind: "patch",
              op: "set",
              path: markerScopePath,
              value: {
                kind: "literal",
                literalType: "boolean",
                value: true,
                location: markerLocation,
              },
              location: markerLocation,
            },
            condition,
          },
          {
            patch: {
              kind: "patch",
              op: "merge",
              path: onceIntentGuardMapPath,
              value: {
                kind: "objectLiteral",
                properties: [
                  {
                    kind: "objectProperty",
                    key: onceIntentGuardId,
                    value: {
                      kind: "systemIdent",
                      path: ["meta", "intentId"],
                      location: markerLocation,
                    },
                    location: markerLocation,
                  },
                ],
                location: markerLocation,
              },
              location: markerLocation,
            },
            condition: markerScopeExpr,
          },
          ...scopedBodyPatchStatements,
          {
            patch: {
              kind: "patch",
              op: "unset",
              path: markerScopePath,
              location: markerLocation,
            },
            condition,
          }
        );
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

function pathToMelExpr(path: PathNode): MelExprNode {
  const segments = path.segments;
  let result: MelExprNode | undefined;

  for (const segment of segments) {
    if (segment.kind === "propertySegment") {
      const prop = { kind: "prop", name: segment.name } as const;
      if (!result) {
        result = { kind: "get", path: [prop] };
      } else {
        result = {
          kind: "call",
          fn: "field",
          args: [result, { kind: "lit", value: segment.name }],
        };
      }
      continue;
    }

    if (!result) {
      throw new Error("Path cannot start with index access in compileMelPatch guard.");
    }

    result = {
      kind: "call",
      fn: "at",
      args: [result, toMelExpr(segment.index)],
    };
  }

  if (!result) {
    throw new Error("Empty patch guard path.");
  }

  return result;
}

function toRuntimePatchPath(path: PathNode): MelIRPatchPath {
  return path.segments.map((segment) => {
    if (segment.kind === "propertySegment") {
      return { kind: "prop" as const, name: segment.name };
    }

    return { kind: "expr" as const, expr: toMelExpr(segment.index) };
  });
}

class ConditionComposer {
  and(lhs: MelExprNode | undefined, rhs: MelExprNode | undefined): MelExprNode | undefined {
    if (!lhs) {
      return rhs;
    }

    if (!rhs) {
      return lhs;
    }

    return {
      kind: "call",
      fn: "and",
      args: [lhs, rhs],
    };
  }
}

class PatchExprValidator {
  private readonly symbols: DomainTypeSymbols = {
    stateTypes: new Map(),
    computedDecls: new Map(),
    typeDefs: new Map(),
    computedTypeCache: new Map(),
    computedTypeInFlight: new Set(),
  };

  constructor(private readonly mapLocation: (location: Diagnostic["location"]) => Diagnostic["location"]) {}

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
      case "systemIdent":
      case "iterationVar":
        return;
    }
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
