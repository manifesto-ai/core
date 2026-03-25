import type { ExprNode } from "../parser/ast.js";
import type { MelExprNode } from "../lowering/lower-expr.js";
import { toMelExpr as sharedToMelExpr } from "../lowering/to-mel-expr.js";

export function isSyntheticPatchCondition(
  condition: ExprNode
): condition is (ExprNode & { kind: "literal"; literalType: "boolean"; value: true }) {
  return (
    condition.kind === "literal" &&
    condition.literalType === "boolean" &&
    condition.value === true
  );
}

export function toMelExpr(input: ExprNode): MelExprNode {
  return sharedToMelExpr(input);
}
