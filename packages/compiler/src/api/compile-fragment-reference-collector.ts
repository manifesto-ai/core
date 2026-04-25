import type { SourceLocation } from "../lexer/source-location.js";
import { tokenize } from "../lexer/index.js";
import type {
  ActionNode,
  DomainMember,
  EffectArgNode,
  ExprNode,
  FlowDeclNode,
  FlowStmtNode,
  GuardedStmtNode,
  ImportNode,
  InnerStmtNode,
  ParamNode,
  PathNode,
  ProgramNode,
  TypeExprNode,
} from "../parser/index.js";
import { requiredOffset } from "./compile-fragment-source-utils.js";
import type { OffsetRange, ReferenceSpan, TargetInfo } from "./compile-fragment-reference-types.js";

type ExprVisitContext = {
  readonly preferActionParams?: boolean;
  readonly actionParams?: ReadonlySet<string>;
};

export function collectTargetReferences(
  source: string,
  program: ProgramNode,
  target: TargetInfo,
  ignoreRange?: OffsetRange,
): ReferenceSpan[] {
  const refs: ReferenceSpan[] = [];
  const push = (location: SourceLocation, rewrite: boolean): void => {
    const range = locationRange(location);
    if (ignoreRange && containsRange(ignoreRange, range)) {
      return;
    }
    refs.push({ range, location, rewrite });
  };
  const pushNamedToken = (location: SourceLocation, name: string, rewrite: boolean): void => {
    const range = findTokenRange(source, location, name) ?? locationRange(location);
    if (ignoreRange && containsRange(ignoreRange, range)) {
      return;
    }
    refs.push({ range, location, rewrite });
  };

  const visitType = (typeExpr: TypeExprNode): void => {
    switch (typeExpr.kind) {
      case "simpleType":
        if (target.kind === "type" && typeExpr.name === target.name) {
          push(typeExpr.location, true);
        }
        return;
      case "unionType":
        typeExpr.types.forEach(visitType);
        return;
      case "arrayType":
        visitType(typeExpr.elementType);
        return;
      case "recordType":
        visitType(typeExpr.keyType);
        visitType(typeExpr.valueType);
        return;
      case "objectType":
        for (const field of typeExpr.fields) {
          visitType(field.typeExpr);
        }
        return;
      case "literalType":
        return;
    }
  };

  const visitExpr = (expr: ExprNode, ctx: ExprVisitContext = {}): void => {
    switch (expr.kind) {
      case "identifier":
        if (target.kind === "state_field" && expr.name === target.name && !isActionParamPreferred(expr.name, ctx)) {
          push(expr.location, true);
        } else if (target.kind === "computed" && expr.name === target.name && !isActionParamPreferred(expr.name, ctx)) {
          push(expr.location, true);
        }
        return;
      case "propertyAccess":
        visitExpr(expr.object, ctx);
        if (target.kind === "type_field" && expr.property === target.fieldName) {
          pushNamedToken(expr.location, expr.property, false);
        }
        return;
      case "indexAccess":
        visitExpr(expr.object, ctx);
        visitExpr(expr.index, ctx);
        return;
      case "functionCall":
        expr.args.forEach((arg) => visitExpr(arg, ctx));
        return;
      case "unary":
        visitExpr(expr.operand, ctx);
        return;
      case "binary":
        visitExpr(expr.left, ctx);
        visitExpr(expr.right, ctx);
        return;
      case "ternary":
        visitExpr(expr.condition, ctx);
        visitExpr(expr.consequent, ctx);
        visitExpr(expr.alternate, ctx);
        return;
      case "objectLiteral":
        for (const property of expr.properties) {
          if (property.kind === "objectProperty") {
            if (target.kind === "type_field" && property.key === target.fieldName) {
              pushNamedToken(property.location, property.key, false);
            }
            visitExpr(property.value, ctx);
          } else {
            visitExpr(property.expr, ctx);
          }
        }
        return;
      case "arrayLiteral":
        expr.elements.forEach((element) => visitExpr(element, ctx));
        return;
      case "literal":
      case "systemIdent":
      case "iterationVar":
        return;
    }
  };

  const visitPath = (path: PathNode, rewriteRoot: boolean): void => {
    const [first, ...rest] = path.segments;
    if (first?.kind === "propertySegment" && target.kind === "state_field" && first.name === target.name) {
      push(first.location, rewriteRoot);
    }
    for (const segment of rest) {
      if (segment.kind === "propertySegment") {
        if (target.kind === "type_field" && segment.name === target.fieldName) {
          push(segment.location, false);
        }
      } else {
        visitExpr(segment.index);
      }
    }
  };

  const visitEffectArg = (arg: EffectArgNode, ctx: ExprVisitContext): void => {
    if (arg.isPath) {
      visitPath(arg.value as PathNode, true);
    } else {
      visitExpr(arg.value as ExprNode, ctx);
    }
  };

  const visitInnerStmt = (stmt: InnerStmtNode, ctx: ExprVisitContext): void => {
    switch (stmt.kind) {
      case "when":
        visitExpr(stmt.condition, ctx);
        stmt.body.forEach((inner) => visitInnerStmt(inner, ctx));
        return;
      case "once":
        visitPath(stmt.marker, true);
        if (stmt.condition) visitExpr(stmt.condition, ctx);
        stmt.body.forEach((inner) => visitInnerStmt(inner, ctx));
        return;
      case "onceIntent":
        if (stmt.condition) visitExpr(stmt.condition, ctx);
        stmt.body.forEach((inner) => visitInnerStmt(inner, ctx));
        return;
      case "include":
        stmt.args.forEach((arg) => visitExpr(arg, ctx));
        return;
      case "patch":
        visitPath(stmt.path, true);
        if (stmt.value) visitExpr(stmt.value, ctx);
        return;
      case "effect":
        stmt.args.forEach((arg) => visitEffectArg(arg, ctx));
        return;
      case "fail":
        if (stmt.message) visitExpr(stmt.message, ctx);
        return;
      case "stop":
        return;
    }
  };

  const visitGuardedStmt = (stmt: GuardedStmtNode, ctx: ExprVisitContext): void => {
    visitInnerStmt(stmt, ctx);
  };

  const visitFlowStmt = (stmt: FlowStmtNode): void => {
    visitInnerStmt(stmt, {});
  };

  const visitAction = (action: ActionNode): void => {
    const actionParams = new Set(action.params.map((param) => param.name));
    action.params.forEach((param) => visitParam(param));
    if (action.available) visitExpr(action.available, { actionParams });
    if (action.dispatchable) visitExpr(action.dispatchable, { actionParams, preferActionParams: true });
    action.body.forEach((stmt) => visitGuardedStmt(stmt, { actionParams, preferActionParams: true }));
  };

  const visitParam = (param: ParamNode): void => {
    visitType(param.typeExpr);
  };

  const visitFlow = (flow: FlowDeclNode): void => {
    flow.params.forEach((param) => visitType(param.typeExpr));
    flow.body.forEach(visitFlowStmt);
  };

  for (const importNode of program.imports) {
    visitImport(importNode);
  }
  for (const typeDecl of program.domain.types) {
    visitType(typeDecl.typeExpr);
  }
  for (const member of program.domain.members) {
    visitMember(member, visitType, visitExpr, visitAction, visitFlow);
  }

  return dedupeReferences(refs);
}

function visitImport(_importNode: ImportNode): void {
  return;
}

function visitMember(
  member: DomainMember,
  visitType: (typeExpr: TypeExprNode) => void,
  visitExpr: (expr: ExprNode) => void,
  visitAction: (action: ActionNode) => void,
  visitFlow: (flow: FlowDeclNode) => void,
): void {
  switch (member.kind) {
    case "state":
      for (const field of member.fields) {
        visitType(field.typeExpr);
        if (field.initializer) visitExpr(field.initializer);
      }
      return;
    case "computed":
      visitExpr(member.expression);
      return;
    case "action":
      visitAction(member);
      return;
    case "flow":
      visitFlow(member);
      return;
  }
}

function isActionParamPreferred(
  name: string,
  ctx: ExprVisitContext,
): boolean {
  return ctx.preferActionParams === true && ctx.actionParams?.has(name) === true;
}

function findTokenRange(source: string, location: SourceLocation, name: string): OffsetRange | null {
  const range = locationRange(location);
  const tokens = tokenize(source).tokens.filter((token) =>
    token.location.start.offset >= range.start
    && token.location.end.offset <= range.end
    && token.kind === "IDENTIFIER"
    && token.lexeme === name);
  const token = tokens[tokens.length - 1];
  return token ? locationRange(token.location) : null;
}

function locationRange(location: SourceLocation): OffsetRange {
  return {
    start: requiredOffset(location.start),
    end: requiredOffset(location.end),
  };
}

function containsRange(outer: OffsetRange, inner: OffsetRange): boolean {
  return inner.start >= outer.start && inner.end <= outer.end;
}

function dedupeReferences(refs: readonly ReferenceSpan[]): ReferenceSpan[] {
  const deduped = new Map<string, ReferenceSpan>();
  for (const ref of refs) {
    const key = `${ref.range.start}:${ref.range.end}`;
    const existing = deduped.get(key);
    if (!existing || (existing.rewrite && !ref.rewrite)) {
      deduped.set(key, ref);
    }
  }
  return [...deduped.values()].sort((left, right) => left.range.start - right.range.start || left.range.end - right.range.end);
}
