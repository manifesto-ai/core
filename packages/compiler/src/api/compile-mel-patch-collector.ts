import { joinPath, sha256Sync } from "@manifesto-ai/core";

import type { Diagnostic } from "../diagnostics/types.js";
import type { MelExprNode } from "../lowering/lower-expr.js";
import type {
  GuardedStmtNode,
  InnerStmtNode,
  PathNode,
  PatchStmtNode,
} from "../parser/ast.js";
import { toMelExpr } from "./compile-mel-patch-expr.js";

export interface PatchCollectContext {
  actionName: string;
  onceIntentCounter: number;
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

  constructor(private readonly deps: PatchCollectorDeps) {}

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
        const dynamicIndexSegment = stmt.path.segments.find(
          (segment) => segment.kind === "indexSegment" && segment.index.kind !== "literal"
        );

        if (dynamicIndexSegment) {
          errors.push({
            severity: "error",
            code: "E_DYNAMIC_PATCH_PATH",
            message: "Dynamic patch path indexes are not supported. Use a literal index.",
            location: this.deps.mapLocation(dynamicIndexSegment.location),
          });
          continue;
        }

        patchStatements.push({
          patch: stmt,
          condition: parentCondition,
        });
        continue;
      }

      if (stmt.kind === "when") {
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
        patchStatements.push(
          ...this.collectPatchStatements(
            stmt.body,
            errors,
            context,
            condition
          )
        );
        continue;
      }

      if (stmt.kind === "once") {
        let condition = parentCondition;
        const markerExpr = pathToMelExpr(stmt.marker);
        let onceCondition: MelExprNode = {
          kind: "call",
          fn: "neq",
          args: [markerExpr, { kind: "sys", path: ["meta", "intentId"] }],
        };

        if (stmt.condition) {
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
        patchStatements.push(
          ...this.collectPatchStatements(
            stmt.body,
            errors,
            context,
            condition
          )
        );
        continue;
      }

      if (stmt.kind === "onceIntent") {
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

        const bodyPatchStatements = this.collectPatchStatements(
          stmt.body,
          errors,
          context,
          condition
        );

        patchStatements.push(
          ...bodyPatchStatements,
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
): { op: "set" | "unset" | "merge"; path: string; value?: MelExprNode; condition?: MelExprNode } {
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

function toRuntimePatchPath(path: PathNode): string {
  const parts: string[] = [];

  for (const segment of path.segments) {
    if (segment.kind === "propertySegment") {
      parts.push(segment.name);
      continue;
    }

    const literalValue = toPathSegmentLiteral(segment);
    if (literalValue === null) {
      throw new Error("Dynamic patch path indexes are not supported.");
    }

    parts.push(literalValue);
  }

  return joinPath(...parts);
}

function toPathSegmentLiteral(segment: PathNode["segments"][number]): string | null {
  if (segment.kind === "indexSegment" && segment.index.kind === "literal") {
    return String(segment.index.value);
  }

  return null;
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
