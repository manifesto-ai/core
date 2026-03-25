import { createError, type Diagnostic } from "../diagnostics/types.js";
import type {
  ActionNode,
  DomainMember,
  DomainNode,
  EffectStmtNode,
  ExprNode,
  FailStmtNode,
  FlowDeclNode,
  FlowStmtNode,
  GuardedStmtNode,
  IncludeStmtNode,
  InnerStmtNode,
  OnceIntentStmtNode,
  OnceStmtNode,
  PatchStmtNode,
  ProgramNode,
  StateNode,
  StopStmtNode,
  TypeDeclNode,
  TypeExprNode,
  WhenStmtNode,
} from "../parser/ast.js";

const MAX_INCLUDE_DEPTH = 16;

export interface FlowExpansionResult {
  program: ProgramNode;
  diagnostics: Diagnostic[];
}

interface FlowSymbols {
  stateTypes: Map<string, TypeExprNode>;
  computedNames: Set<string>;
  typeDefs: Map<string, TypeDeclNode>;
  actionNames: Set<string>;
  flows: Map<string, FlowDeclNode>;
}

type TypeEnv = Map<string, TypeExprNode>;
type ValueBindings = Map<string, ExprNode>;

interface FlowEdge {
  target: string;
  location: IncludeStmtNode["location"];
}

function cloneNode<T>(value: T): T {
  return structuredClone(value);
}

function addDiagnostic(
  diagnostics: Diagnostic[],
  dedupe: Set<string>,
  code: string,
  message: string,
  location: Diagnostic["location"]
): void {
  const key = `${code}:${location.start.offset}:${location.end.offset}:${message}`;
  if (dedupe.has(key)) {
    return;
  }
  dedupe.add(key);
  diagnostics.push(createError(code, message, location));
}

function collectSymbols(domain: DomainNode): FlowSymbols {
  const stateTypes = new Map<string, TypeExprNode>();
  const computedNames = new Set<string>();
  const typeDefs = new Map<string, TypeDeclNode>();
  const actionNames = new Set<string>();
  const flows = new Map<string, FlowDeclNode>();

  for (const typeDecl of domain.types) {
    typeDefs.set(typeDecl.name, typeDecl);
  }

  for (const member of domain.members) {
    switch (member.kind) {
      case "state":
        for (const field of member.fields) {
          stateTypes.set(field.name, field.typeExpr);
        }
        break;
      case "computed":
        computedNames.add(member.name);
        break;
      case "action":
        actionNames.add(member.name);
        break;
      case "flow":
        if (!flows.has(member.name)) {
          flows.set(member.name, member);
        }
        break;
    }
  }

  return {
    stateTypes,
    computedNames,
    typeDefs,
    actionNames,
    flows,
  };
}

function createFlowParamEnv(flow: FlowDeclNode): TypeEnv {
  const env = new Map<string, TypeExprNode>();
  for (const param of flow.params) {
    env.set(param.name, param.typeExpr);
  }
  return env;
}

function createActionParamEnv(action: ActionNode): TypeEnv {
  const env = new Map<string, TypeExprNode>();
  for (const param of action.params) {
    env.set(param.name, param.typeExpr);
  }
  return env;
}

function collectFlowValidationDiagnostics(
  domain: DomainNode,
  symbols: FlowSymbols,
  diagnostics: Diagnostic[],
  dedupe: Set<string>
): Map<string, FlowEdge[]> {
  const graph = new Map<string, FlowEdge[]>();

  for (const flow of symbols.flows.values()) {
    graph.set(flow.name, []);

    if (symbols.actionNames.has(flow.name)) {
      addDiagnostic(
        diagnostics,
        dedupe,
        "E022",
        `Flow '${flow.name}' conflicts with action '${flow.name}'.`,
        flow.location
      );
    }

    for (const param of flow.params) {
      if (
        symbols.stateTypes.has(param.name) ||
        symbols.computedNames.has(param.name) ||
        symbols.typeDefs.has(param.name)
      ) {
        addDiagnostic(
          diagnostics,
          dedupe,
          "E021",
          `Flow parameter '${param.name}' conflicts with a top-level identifier.`,
          param.location
        );
      }
    }

    const paramEnv = createFlowParamEnv(flow);
    for (const stmt of flow.body) {
      validateFlowStmt(stmt, flow.name, paramEnv, symbols, diagnostics, dedupe, graph.get(flow.name)!);
    }
  }

  for (const member of domain.members) {
    if (member.kind === "action") {
      const paramEnv = createActionParamEnv(member);
      for (const stmt of member.body) {
        validateActionStmt(stmt, paramEnv, symbols, diagnostics, dedupe);
      }
    }
  }

  return graph;
}

function validateActionStmt(
  stmt: GuardedStmtNode,
  typeEnv: TypeEnv,
  symbols: FlowSymbols,
  diagnostics: Diagnostic[],
  dedupe: Set<string>
): void {
  switch (stmt.kind) {
    case "include":
      validateInclude(stmt, typeEnv, symbols, diagnostics, dedupe);
      break;

    case "when":
      for (const inner of stmt.body) {
        validateActionInnerStmt(inner, typeEnv, symbols, diagnostics, dedupe);
      }
      break;

    case "once":
      for (const inner of stmt.body) {
        validateActionInnerStmt(inner, typeEnv, symbols, diagnostics, dedupe);
      }
      break;

    case "onceIntent":
      for (const inner of stmt.body) {
        validateActionInnerStmt(inner, typeEnv, symbols, diagnostics, dedupe);
      }
      break;
  }
}

function validateActionInnerStmt(
  stmt: InnerStmtNode,
  typeEnv: TypeEnv,
  symbols: FlowSymbols,
  diagnostics: Diagnostic[],
  dedupe: Set<string>
): void {
  switch (stmt.kind) {
    case "include":
      addDiagnostic(
        diagnostics,
        dedupe,
        "E016",
        "include is only allowed at action or flow body top-level.",
        stmt.location
      );
      validateInclude(stmt, typeEnv, symbols, diagnostics, dedupe);
      break;

    case "when":
      for (const inner of stmt.body) {
        validateActionInnerStmt(inner, typeEnv, symbols, diagnostics, dedupe);
      }
      break;

    case "once":
      for (const inner of stmt.body) {
        validateActionInnerStmt(inner, typeEnv, symbols, diagnostics, dedupe);
      }
      break;

    case "onceIntent":
      for (const inner of stmt.body) {
        validateActionInnerStmt(inner, typeEnv, symbols, diagnostics, dedupe);
      }
      break;

    case "patch":
    case "effect":
    case "fail":
    case "stop":
      break;
  }
}

function validateFlowStmt(
  stmt: FlowStmtNode,
  flowName: string,
  typeEnv: TypeEnv,
  symbols: FlowSymbols,
  diagnostics: Diagnostic[],
  dedupe: Set<string>,
  edges: FlowEdge[]
): void {
  switch (stmt.kind) {
    case "include":
      if (validateInclude(stmt, typeEnv, symbols, diagnostics, dedupe)) {
        edges.push({ target: stmt.flowName, location: stmt.location });
      }
      break;

    case "when":
      for (const inner of stmt.body) {
        validateFlowInnerStmt(inner, flowName, typeEnv, symbols, diagnostics, dedupe);
      }
      break;

    case "once":
      addDiagnostic(diagnostics, dedupe, "E017", "once() is not allowed in flow bodies.", stmt.location);
      break;

    case "onceIntent":
      addDiagnostic(diagnostics, dedupe, "E018", "onceIntent is not allowed in flow bodies.", stmt.location);
      break;

    case "patch":
      addDiagnostic(diagnostics, dedupe, "E019", "patch is not allowed in flow bodies.", stmt.location);
      break;

    case "effect":
      addDiagnostic(diagnostics, dedupe, "E020", "effect is not allowed in flow bodies.", stmt.location);
      break;
  }
}

function validateFlowInnerStmt(
  stmt: InnerStmtNode,
  flowName: string,
  typeEnv: TypeEnv,
  symbols: FlowSymbols,
  diagnostics: Diagnostic[],
  dedupe: Set<string>
): void {
  switch (stmt.kind) {
    case "include":
      addDiagnostic(
        diagnostics,
        dedupe,
        "E016",
        "include is only allowed at action or flow body top-level.",
        stmt.location
      );
      validateInclude(stmt, typeEnv, symbols, diagnostics, dedupe);
      break;

    case "when":
      for (const inner of stmt.body) {
        validateFlowInnerStmt(inner, flowName, typeEnv, symbols, diagnostics, dedupe);
      }
      break;

    case "once":
      addDiagnostic(diagnostics, dedupe, "E017", "once() is not allowed in flow bodies.", stmt.location);
      for (const inner of stmt.body) {
        validateFlowInnerStmt(inner, flowName, typeEnv, symbols, diagnostics, dedupe);
      }
      break;

    case "onceIntent":
      addDiagnostic(diagnostics, dedupe, "E018", "onceIntent is not allowed in flow bodies.", stmt.location);
      for (const inner of stmt.body) {
        validateFlowInnerStmt(inner, flowName, typeEnv, symbols, diagnostics, dedupe);
      }
      break;

    case "patch":
      addDiagnostic(diagnostics, dedupe, "E019", "patch is not allowed in flow bodies.", stmt.location);
      break;

    case "effect":
      addDiagnostic(diagnostics, dedupe, "E020", "effect is not allowed in flow bodies.", stmt.location);
      break;

    case "fail":
    case "stop":
      break;
  }
}

function validateInclude(
  stmt: IncludeStmtNode,
  typeEnv: TypeEnv,
  symbols: FlowSymbols,
  diagnostics: Diagnostic[],
  dedupe: Set<string>
): boolean {
  const targetFlow = symbols.flows.get(stmt.flowName);
  if (!targetFlow) {
    addDiagnostic(
      diagnostics,
      dedupe,
      "E015",
      `'${stmt.flowName}' is not a declared flow.`,
      stmt.location
    );
    return false;
  }

  if (stmt.args.length !== targetFlow.params.length) {
    addDiagnostic(
      diagnostics,
      dedupe,
      "E023",
      `include '${stmt.flowName}' expected ${targetFlow.params.length} argument(s), got ${stmt.args.length}.`,
      stmt.location
    );
    return true;
  }

  for (let index = 0; index < stmt.args.length; index += 1) {
    const arg = stmt.args[index];
    const param = targetFlow.params[index];
    const argType = inferExprType(arg, typeEnv, symbols);
    if (!argType) {
      continue;
    }

    const assignable = isAssignable(argType, param.typeExpr, symbols);
    if (assignable === false) {
      addDiagnostic(
        diagnostics,
        dedupe,
        "E024",
        `include '${stmt.flowName}' argument ${index + 1} is not assignable to parameter '${param.name}'.`,
        arg.location
      );
    }
  }

  return true;
}

function detectFlowGraphIssues(
  graph: Map<string, FlowEdge[]>,
  symbols: FlowSymbols,
  diagnostics: Diagnostic[],
  dedupe: Set<string>
): void {
  function walk(flowName: string, depth: number, stack: Set<string>): void {
    stack.add(flowName);

    for (const edge of graph.get(flowName) ?? []) {
      if (depth + 1 > MAX_INCLUDE_DEPTH) {
        addDiagnostic(
          diagnostics,
          dedupe,
          "E014",
          `Include expansion depth exceeds limit (${MAX_INCLUDE_DEPTH}).`,
          edge.location
        );
        continue;
      }

      if (stack.has(edge.target)) {
        addDiagnostic(
          diagnostics,
          dedupe,
          "E013",
          "Circular include detected.",
          edge.location
        );
        continue;
      }

      walk(edge.target, depth + 1, new Set(stack));
    }
  }

  for (const flowName of symbols.flows.keys()) {
    walk(flowName, 1, new Set<string>());
  }
}

function cloneExprWithBindings(expr: ExprNode, bindings: ValueBindings): ExprNode {
  switch (expr.kind) {
    case "identifier":
      return bindings.has(expr.name) ? cloneNode(bindings.get(expr.name)!) : cloneNode(expr);

    case "systemIdent":
    case "literal":
    case "iterationVar":
      return cloneNode(expr);

    case "functionCall":
      return {
        ...cloneNode(expr),
        args: expr.args.map((arg) => cloneExprWithBindings(arg, bindings)),
      };

    case "binary":
      return {
        ...cloneNode(expr),
        left: cloneExprWithBindings(expr.left, bindings),
        right: cloneExprWithBindings(expr.right, bindings),
      };

    case "unary":
      return {
        ...cloneNode(expr),
        operand: cloneExprWithBindings(expr.operand, bindings),
      };

    case "ternary":
      return {
        ...cloneNode(expr),
        condition: cloneExprWithBindings(expr.condition, bindings),
        consequent: cloneExprWithBindings(expr.consequent, bindings),
        alternate: cloneExprWithBindings(expr.alternate, bindings),
      };

    case "propertyAccess":
      return {
        ...cloneNode(expr),
        object: cloneExprWithBindings(expr.object, bindings),
      };

    case "indexAccess":
      return {
        ...cloneNode(expr),
        object: cloneExprWithBindings(expr.object, bindings),
        index: cloneExprWithBindings(expr.index, bindings),
      };

    case "objectLiteral":
      return {
        ...cloneNode(expr),
        properties: expr.properties.map((property) => ({
          ...cloneNode(property),
          value: cloneExprWithBindings(property.value, bindings),
        })),
      };

    case "arrayLiteral":
      return {
        ...cloneNode(expr),
        elements: expr.elements.map((element) => cloneExprWithBindings(element, bindings)),
      };
  }
}

function cloneInnerStmtWithBindings(stmt: InnerStmtNode, bindings: ValueBindings): InnerStmtNode[] {
  switch (stmt.kind) {
    case "when":
      return [cloneWhenWithBindings(stmt, bindings)];

    case "fail":
      return [{
        ...cloneNode(stmt),
        message: stmt.message ? cloneExprWithBindings(stmt.message, bindings) : undefined,
      }];

    case "stop":
      return [cloneNode(stmt)];

    case "patch":
    case "effect":
    case "once":
    case "onceIntent":
    case "include":
      return [];
  }
}

function cloneWhenWithBindings(stmt: WhenStmtNode, bindings: ValueBindings): WhenStmtNode {
  return {
    ...cloneNode(stmt),
    condition: cloneExprWithBindings(stmt.condition, bindings),
    body: stmt.body.flatMap((inner) => cloneInnerStmtWithBindings(inner, bindings)),
  };
}

function buildIncludeBindings(
  targetFlow: FlowDeclNode,
  includeStmt: IncludeStmtNode,
  bindings: ValueBindings
): ValueBindings {
  const nextBindings = new Map<string, ExprNode>();
  for (let index = 0; index < targetFlow.params.length; index += 1) {
    nextBindings.set(targetFlow.params[index].name, cloneExprWithBindings(includeStmt.args[index], bindings));
  }
  return nextBindings;
}

function expandFlowStmt(
  stmt: FlowStmtNode,
  symbols: FlowSymbols,
  bindings: ValueBindings,
  depth: number,
  stack: string[]
): GuardedStmtNode[] {
  switch (stmt.kind) {
    case "when":
      return [cloneWhenWithBindings(stmt, bindings)];

    case "include":
      return expandInclude(stmt, symbols, bindings, depth, stack);

    case "once":
    case "onceIntent":
    case "patch":
    case "effect":
      return [];
  }
}

function expandInclude(
  stmt: IncludeStmtNode,
  symbols: FlowSymbols,
  bindings: ValueBindings,
  depth: number,
  stack: string[]
): GuardedStmtNode[] {
  const targetFlow = symbols.flows.get(stmt.flowName);
  if (
    !targetFlow ||
    stmt.args.length !== targetFlow.params.length ||
    depth > MAX_INCLUDE_DEPTH ||
    stack.includes(stmt.flowName)
  ) {
    return [];
  }

  const nextBindings = buildIncludeBindings(targetFlow, stmt, bindings);
  const nextStack = [...stack, stmt.flowName];

  return targetFlow.body.flatMap((flowStmt) =>
    expandFlowStmt(flowStmt, symbols, nextBindings, depth + 1, nextStack)
  );
}

function cloneActionInnerStmt(stmt: InnerStmtNode): InnerStmtNode[] {
  switch (stmt.kind) {
    case "when":
      return [{
        ...cloneNode(stmt),
        body: stmt.body.flatMap((inner) => cloneActionInnerStmt(inner)),
      }];

    case "once":
      return [{
        ...cloneNode(stmt),
        body: stmt.body.flatMap((inner) => cloneActionInnerStmt(inner)),
      }];

    case "onceIntent":
      return [{
        ...cloneNode(stmt),
        body: stmt.body.flatMap((inner) => cloneActionInnerStmt(inner)),
      }];

    case "include":
      return [];

    case "patch":
    case "effect":
    case "fail":
    case "stop":
      return [cloneNode(stmt)];
  }
}

function expandActionStmt(
  stmt: GuardedStmtNode,
  symbols: FlowSymbols,
  depth: number
): GuardedStmtNode[] {
  switch (stmt.kind) {
    case "include":
      return expandInclude(stmt, symbols, new Map(), depth, []);

    case "when":
      return [{
        ...cloneNode(stmt),
        body: stmt.body.flatMap((inner) => cloneActionInnerStmt(inner)),
      }];

    case "once":
      return [{
        ...cloneNode(stmt),
        body: stmt.body.flatMap((inner) => cloneActionInnerStmt(inner)),
      }];

    case "onceIntent":
      return [{
        ...cloneNode(stmt),
        body: stmt.body.flatMap((inner) => cloneActionInnerStmt(inner)),
      }];
  }
}

function expandProgram(program: ProgramNode, symbols: FlowSymbols): ProgramNode {
  const domainMembers: DomainMember[] = [];

  for (const member of program.domain.members) {
    switch (member.kind) {
      case "state":
      case "computed":
        domainMembers.push(cloneNode(member));
        break;

      case "action":
        domainMembers.push({
          ...cloneNode(member),
          body: member.body.flatMap((stmt) => expandActionStmt(stmt, symbols, 1)),
        });
        break;

      case "flow":
        break;
    }
  }

  return {
    ...cloneNode(program),
    domain: {
      ...cloneNode(program.domain),
      types: program.domain.types.map((typeDecl) => cloneNode(typeDecl)),
      members: domainMembers,
    },
  };
}

function inferExprType(expr: ExprNode, typeEnv: TypeEnv, symbols: FlowSymbols): TypeExprNode | null {
  switch (expr.kind) {
    case "literal":
      return {
        kind: "literalType",
        value: expr.value as string | number | boolean | null,
        location: expr.location,
      };

    case "identifier":
      return typeEnv.get(expr.name) ?? symbols.stateTypes.get(expr.name) ?? null;

    case "propertyAccess": {
      const objectType = inferExprType(expr.object, typeEnv, symbols);
      return getPropertyType(objectType, expr.property, symbols);
    }

    case "indexAccess": {
      const objectType = inferExprType(expr.object, typeEnv, symbols);
      return getIndexType(objectType, symbols);
    }

    case "objectLiteral":
      return {
        kind: "objectType",
        fields: expr.properties
          .map((property) => {
            const propertyType = inferExprType(property.value, typeEnv, symbols);
            if (!propertyType) {
              return null;
            }
            return {
              kind: "typeField" as const,
              name: property.key,
              typeExpr: propertyType,
              optional: false,
              location: property.location,
            };
          })
          .filter((field): field is NonNullable<typeof field> => field !== null),
        location: expr.location,
      };

    case "arrayLiteral": {
      if (expr.elements.length === 0) {
        return null;
      }
      const firstElementType = inferExprType(expr.elements[0], typeEnv, symbols);
      if (!firstElementType) {
        return null;
      }
      return {
        kind: "arrayType",
        elementType: firstElementType,
        location: expr.location,
      };
    }

    case "systemIdent":
    case "functionCall":
    case "binary":
    case "unary":
    case "ternary":
    case "iterationVar":
      return null;
  }
}

function resolveType(typeExpr: TypeExprNode | null, symbols: FlowSymbols, seen = new Set<string>()): TypeExprNode | null {
  if (!typeExpr) {
    return null;
  }

  if (typeExpr.kind === "simpleType" && symbols.typeDefs.has(typeExpr.name)) {
    if (seen.has(typeExpr.name)) {
      return null;
    }
    seen.add(typeExpr.name);
    return resolveType(symbols.typeDefs.get(typeExpr.name)!.typeExpr, symbols, seen);
  }

  return typeExpr;
}

function getPropertyType(typeExpr: TypeExprNode | null, property: string, symbols: FlowSymbols): TypeExprNode | null {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return null;
  }

  if (resolved.kind === "objectType") {
    const field = resolved.fields.find((candidate) => candidate.name === property);
    return field?.typeExpr ?? null;
  }

  if (resolved.kind === "unionType") {
    for (const member of resolved.types) {
      if (member.kind === "simpleType" && member.name === "null") {
        continue;
      }
      const memberType = getPropertyType(member, property, symbols);
      if (memberType) {
        return memberType;
      }
    }
  }

  return null;
}

function getIndexType(typeExpr: TypeExprNode | null, symbols: FlowSymbols): TypeExprNode | null {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return null;
  }

  if (resolved.kind === "arrayType") {
    return resolved.elementType;
  }

  if (resolved.kind === "recordType") {
    return resolved.valueType;
  }

  if (resolved.kind === "unionType") {
    for (const member of resolved.types) {
      if (member.kind === "simpleType" && member.name === "null") {
        continue;
      }
      const memberType = getIndexType(member, symbols);
      if (memberType) {
        return memberType;
      }
    }
  }

  return null;
}

function isAssignable(sourceType: TypeExprNode, targetType: TypeExprNode, symbols: FlowSymbols): boolean | null {
  const resolvedSource = resolveType(sourceType, symbols);
  const resolvedTarget = resolveType(targetType, symbols);
  if (!resolvedSource || !resolvedTarget) {
    return null;
  }

  if (resolvedTarget.kind === "unionType") {
    const outcomes = resolvedTarget.types.map((candidate) => isAssignable(resolvedSource, candidate, symbols));
    if (outcomes.includes(true)) {
      return true;
    }
    return outcomes.every((outcome) => outcome === false) ? false : null;
  }

  if (resolvedSource.kind === "unionType") {
    const outcomes = resolvedSource.types.map((candidate) => isAssignable(candidate, resolvedTarget, symbols));
    if (outcomes.every((outcome) => outcome === true)) {
      return true;
    }
    return outcomes.some((outcome) => outcome === false) ? false : null;
  }

  if (resolvedTarget.kind === "simpleType") {
    if (resolvedSource.kind === "simpleType") {
      return resolvedSource.name === resolvedTarget.name;
    }
    if (resolvedSource.kind === "literalType") {
      if (resolvedTarget.name === "null") {
        return resolvedSource.value === null;
      }
      return typeof resolvedSource.value === resolvedTarget.name;
    }
  }

  if (resolvedTarget.kind === "literalType") {
    if (resolvedSource.kind !== "literalType") {
      return false;
    }
    return resolvedSource.value === resolvedTarget.value;
  }

  if (resolvedTarget.kind === "arrayType") {
    if (resolvedSource.kind !== "arrayType") {
      return false;
    }
    return isAssignable(resolvedSource.elementType, resolvedTarget.elementType, symbols);
  }

  if (resolvedTarget.kind === "objectType") {
    if (resolvedSource.kind !== "objectType") {
      return false;
    }

    for (const targetField of resolvedTarget.fields) {
      const sourceField = resolvedSource.fields.find((candidate) => candidate.name === targetField.name);
      if (!sourceField) {
        if (targetField.optional) {
          continue;
        }
        return false;
      }
      const fieldAssignable = isAssignable(sourceField.typeExpr, targetField.typeExpr, symbols);
      if (fieldAssignable !== true) {
        return fieldAssignable;
      }
    }

    return true;
  }

  if (resolvedTarget.kind === "recordType") {
    if (resolvedSource.kind !== "recordType") {
      return null;
    }
    return isAssignable(resolvedSource.valueType, resolvedTarget.valueType, symbols);
  }

  return null;
}

export function validateAndExpandFlows(program: ProgramNode): FlowExpansionResult {
  const symbols = collectSymbols(program.domain);
  const diagnostics: Diagnostic[] = [];
  const dedupe = new Set<string>();
  const graph = collectFlowValidationDiagnostics(program.domain, symbols, diagnostics, dedupe);

  detectFlowGraphIssues(graph, symbols, diagnostics, dedupe);

  return {
    program: expandProgram(program, symbols),
    diagnostics,
  };
}
