import { createError, type Diagnostic } from "../diagnostics/types.js";
import type {
  ActionNode,
  DomainNode,
  ExprNode,
  GuardedStmtNode,
  InnerStmtNode,
  ParamNode,
  ProgramNode,
  StateFieldNode,
  TypeDeclNode,
  TypeExprNode,
} from "../parser/ast.js";

const ENTITY_LOOKUP_FNS = new Set(["findById", "existsById"]);
const ENTITY_TRANSFORM_FNS = new Set(["updateById", "removeById"]);
const ENTITY_PRIMITIVE_FNS = new Set([
  ...ENTITY_LOOKUP_FNS,
  ...ENTITY_TRANSFORM_FNS,
]);

interface EntitySymbols {
  stateTypes: Map<string, TypeExprNode>;
  computedNames: Set<string>;
  typeDefs: Map<string, TypeDeclNode>;
}

type ExprContext = "computed" | "action" | "guard" | "available" | "patch";
type TypeEnv = Map<string, TypeExprNode>;

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

function collectSymbols(domain: DomainNode): EntitySymbols {
  const stateTypes = new Map<string, TypeExprNode>();
  const computedNames = new Set<string>();
  const typeDefs = new Map<string, TypeDeclNode>();

  for (const typeDecl of domain.types) {
    typeDefs.set(typeDecl.name, typeDecl);
  }

  for (const member of domain.members) {
    if (member.kind === "state") {
      for (const field of member.fields) {
        stateTypes.set(field.name, field.typeExpr);
      }
    } else if (member.kind === "computed") {
      computedNames.add(member.name);
    }
  }

  return { stateTypes, computedNames, typeDefs };
}

function createActionParamEnv(params: readonly ParamNode[]): TypeEnv {
  const env = new Map<string, TypeExprNode>();
  for (const param of params) {
    env.set(param.name, param.typeExpr);
  }
  return env;
}

export function validateEntityPrimitives(program: ProgramNode): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const dedupe = new Set<string>();
  const symbols = collectSymbols(program.domain);

  validateInitializerUniqueness(program.domain, symbols, diagnostics, dedupe);

  for (const member of program.domain.members) {
    switch (member.kind) {
      case "computed":
        validateExpr(member.expression, "computed", new Map(), symbols, diagnostics, dedupe, 0);
        break;

      case "action": {
        const params = createActionParamEnv(member.params);
        validateAction(member, params, symbols, diagnostics, dedupe);
        break;
      }

      case "state":
      case "flow":
        break;
    }
  }

  return diagnostics;
}

function validateAction(
  action: ActionNode,
  params: TypeEnv,
  symbols: EntitySymbols,
  diagnostics: Diagnostic[],
  dedupe: Set<string>
): void {
  if (action.available) {
    validateExpr(action.available, "available", params, symbols, diagnostics, dedupe, 0);
  }

  for (const stmt of action.body) {
    validateGuardedStmt(stmt, params, symbols, diagnostics, dedupe);
  }
}

function validateGuardedStmt(
  stmt: GuardedStmtNode,
  params: TypeEnv,
  symbols: EntitySymbols,
  diagnostics: Diagnostic[],
  dedupe: Set<string>
): void {
  switch (stmt.kind) {
    case "when":
      validateExpr(stmt.condition, "guard", params, symbols, diagnostics, dedupe, 0);
      for (const inner of stmt.body) {
        validateInnerStmt(inner, params, symbols, diagnostics, dedupe);
      }
      break;

    case "once":
      if (stmt.condition) {
        validateExpr(stmt.condition, "guard", params, symbols, diagnostics, dedupe, 0);
      }
      for (const inner of stmt.body) {
        validateInnerStmt(inner, params, symbols, diagnostics, dedupe);
      }
      break;

    case "onceIntent":
      if (stmt.condition) {
        validateExpr(stmt.condition, "guard", params, symbols, diagnostics, dedupe, 0);
      }
      for (const inner of stmt.body) {
        validateInnerStmt(inner, params, symbols, diagnostics, dedupe);
      }
      break;

    case "include":
      break;
  }
}

function validateInnerStmt(
  stmt: InnerStmtNode,
  params: TypeEnv,
  symbols: EntitySymbols,
  diagnostics: Diagnostic[],
  dedupe: Set<string>
): void {
  switch (stmt.kind) {
    case "when":
      validateExpr(stmt.condition, "guard", params, symbols, diagnostics, dedupe, 0);
      for (const inner of stmt.body) {
        validateInnerStmt(inner, params, symbols, diagnostics, dedupe);
      }
      break;

    case "once":
      if (stmt.condition) {
        validateExpr(stmt.condition, "guard", params, symbols, diagnostics, dedupe, 0);
      }
      for (const inner of stmt.body) {
        validateInnerStmt(inner, params, symbols, diagnostics, dedupe);
      }
      break;

    case "onceIntent":
      if (stmt.condition) {
        validateExpr(stmt.condition, "guard", params, symbols, diagnostics, dedupe, 0);
      }
      for (const inner of stmt.body) {
        validateInnerStmt(inner, params, symbols, diagnostics, dedupe);
      }
      break;

    case "patch":
      if (stmt.value) {
        validateExpr(stmt.value, "patch", params, symbols, diagnostics, dedupe, 0);
      }
      break;

    case "effect":
      for (const arg of stmt.args) {
        if (!arg.isPath) {
          validateExpr(arg.value as ExprNode, "action", params, symbols, diagnostics, dedupe, 0);
        }
      }
      break;

    case "fail":
      if (stmt.message) {
        validateExpr(stmt.message, "action", params, symbols, diagnostics, dedupe, 0);
      }
      break;

    case "include":
    case "stop":
      break;
  }
}

function validateExpr(
  expr: ExprNode,
  context: ExprContext,
  env: TypeEnv,
  symbols: EntitySymbols,
  diagnostics: Diagnostic[],
  dedupe: Set<string>,
  transformDepth: number
): void {
  switch (expr.kind) {
    case "functionCall": {
      validateEntityCall(expr, context, env, symbols, diagnostics, dedupe, transformDepth);
      const nextTransformDepth =
        transformDepth + (ENTITY_TRANSFORM_FNS.has(expr.name) ? 1 : 0);
      for (const arg of expr.args) {
        validateExpr(arg, context, env, symbols, diagnostics, dedupe, nextTransformDepth);
      }
      break;
    }

    case "binary":
      validateExpr(expr.left, context, env, symbols, diagnostics, dedupe, transformDepth);
      validateExpr(expr.right, context, env, symbols, diagnostics, dedupe, transformDepth);
      break;

    case "unary":
      validateExpr(expr.operand, context, env, symbols, diagnostics, dedupe, transformDepth);
      break;

    case "ternary":
      validateExpr(expr.condition, context, env, symbols, diagnostics, dedupe, transformDepth);
      validateExpr(expr.consequent, context, env, symbols, diagnostics, dedupe, transformDepth);
      validateExpr(expr.alternate, context, env, symbols, diagnostics, dedupe, transformDepth);
      break;

    case "propertyAccess":
      validateExpr(expr.object, context, env, symbols, diagnostics, dedupe, transformDepth);
      break;

    case "indexAccess":
      validateExpr(expr.object, context, env, symbols, diagnostics, dedupe, transformDepth);
      validateExpr(expr.index, context, env, symbols, diagnostics, dedupe, transformDepth);
      break;

    case "objectLiteral":
      for (const property of expr.properties) {
        validateExpr(property.value, context, env, symbols, diagnostics, dedupe, transformDepth);
      }
      break;

    case "arrayLiteral":
      for (const element of expr.elements) {
        validateExpr(element, context, env, symbols, diagnostics, dedupe, transformDepth);
      }
      break;

    case "literal":
    case "identifier":
    case "systemIdent":
    case "iterationVar":
      break;
  }
}

function validateEntityCall(
  expr: { kind: "functionCall"; name: string; args: ExprNode[]; location: Diagnostic["location"] },
  context: ExprContext,
  env: TypeEnv,
  symbols: EntitySymbols,
  diagnostics: Diagnostic[],
  dedupe: Set<string>,
  transformDepth: number
): void {
  if (!ENTITY_PRIMITIVE_FNS.has(expr.name) || expr.args.length === 0) {
    return;
  }

  if (ENTITY_TRANSFORM_FNS.has(expr.name)) {
    if (context === "available") {
      addDiagnostic(
        diagnostics,
        dedupe,
        "E035",
        "updateById/removeById are not allowed in available conditions.",
        expr.location
      );
    } else if (context === "guard") {
      addDiagnostic(
        diagnostics,
        dedupe,
        "E034",
        "updateById/removeById are not allowed in guard conditions.",
        expr.location
      );
    } else if (context !== "patch") {
      addDiagnostic(
        diagnostics,
        dedupe,
        "E031",
        "updateById/removeById are only allowed in patch RHS.",
        expr.location
      );
    }

    if (transformDepth > 0) {
      addDiagnostic(
        diagnostics,
        dedupe,
        "E032",
        "Nested transform primitives are not allowed.",
        expr.location
      );
    }

    if (context === "patch" && !isStatePathExpr(expr.args[0], symbols)) {
      addDiagnostic(
        diagnostics,
        dedupe,
        "E033",
        "Transform primitive collection argument must resolve to a state path.",
        expr.args[0].location
      );
    }
  }

  const elementType = getCollectionElementType(expr.args[0], env, symbols);
  if (!elementType) {
    return;
  }

  const idType = getEntityIdType(elementType, symbols);
  if (!idType) {
    addDiagnostic(
      diagnostics,
      dedupe,
      "E030",
      "Collection element type must declare an 'id' field for entity primitives.",
      expr.args[0].location
    );
    return;
  }

  if (!isPrimitiveEntityIdType(idType, symbols)) {
    addDiagnostic(
      diagnostics,
      dedupe,
      "E030a",
      "Entity 'id' field must be string or number.",
      expr.args[0].location
    );
  }
}

function validateInitializerUniqueness(
  domain: DomainNode,
  symbols: EntitySymbols,
  diagnostics: Diagnostic[],
  dedupe: Set<string>
): void {
  for (const member of domain.members) {
    if (member.kind !== "state") {
      continue;
    }

    for (const field of member.fields) {
      validateFieldInitializerUniqueness(field, symbols, diagnostics, dedupe);
    }
  }
}

function validateFieldInitializerUniqueness(
  field: StateFieldNode,
  symbols: EntitySymbols,
  diagnostics: Diagnostic[],
  dedupe: Set<string>
): void {
  if (!field.initializer || field.initializer.kind !== "arrayLiteral") {
    return;
  }

  const elementType = getArrayElementType(field.typeExpr, symbols);
  if (!elementType) {
    return;
  }

  const idType = getEntityIdType(elementType, symbols);
  if (!idType || !isPrimitiveEntityIdType(idType, symbols)) {
    return;
  }

  const seen = new Map<string, Diagnostic["location"]>();
  for (const element of field.initializer.elements) {
    if (element.kind !== "objectLiteral") {
      continue;
    }

    const idProp = element.properties.find((property) => property.key === "id");
    if (!idProp || idProp.value.kind !== "literal") {
      continue;
    }

    if (
      typeof idProp.value.value !== "string" &&
      typeof idProp.value.value !== "number"
    ) {
      continue;
    }

    const key = `${typeof idProp.value.value}:${String(idProp.value.value)}`;
    const previous = seen.get(key);
    if (previous) {
      addDiagnostic(
        diagnostics,
        dedupe,
        "E030b",
        "Duplicate '.id' values detected in state initializer.",
        idProp.value.location
      );
      continue;
    }
    seen.set(key, idProp.value.location);
  }
}

function getCollectionElementType(
  expr: ExprNode,
  env: TypeEnv,
  symbols: EntitySymbols
): TypeExprNode | null {
  return getArrayElementType(inferExprType(expr, env, symbols), symbols);
}

function getArrayElementType(
  typeExpr: TypeExprNode | null,
  symbols: EntitySymbols
): TypeExprNode | null {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return null;
  }

  if (resolved.kind === "arrayType") {
    return resolved.elementType;
  }

  if (resolved.kind === "unionType") {
    const candidates = resolved.types
      .filter((member) => !isNullType(member))
      .map((member) => getArrayElementType(member, symbols))
      .filter((member): member is TypeExprNode => member !== null);
    return candidates[0] ?? null;
  }

  return null;
}

function inferExprType(
  expr: ExprNode,
  env: TypeEnv,
  symbols: EntitySymbols
): TypeExprNode | null {
  switch (expr.kind) {
    case "literal":
      return {
        kind: "literalType",
        value: expr.value as string | number | boolean | null,
        location: expr.location,
      };

    case "identifier":
      return env.get(expr.name) ?? symbols.stateTypes.get(expr.name) ?? null;

    case "propertyAccess":
      return getPropertyType(inferExprType(expr.object, env, symbols), expr.property, symbols);

    case "indexAccess":
      return getIndexType(inferExprType(expr.object, env, symbols), symbols);

    case "objectLiteral":
      return {
        kind: "objectType",
        fields: expr.properties
          .map((property) => {
            const propertyType = inferExprType(property.value, env, symbols);
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
      const firstElementType = inferExprType(expr.elements[0], env, symbols);
      if (!firstElementType) {
        return null;
      }
      return {
        kind: "arrayType",
        elementType: firstElementType,
        location: expr.location,
      };
    }

    case "functionCall":
      if (expr.name === "findById" && expr.args.length >= 1) {
        const elementType = getCollectionElementType(expr.args[0], env, symbols);
        if (!elementType) {
          return null;
        }
        return {
          kind: "unionType",
          types: [
            elementType,
            {
              kind: "simpleType",
              name: "null",
              location: expr.location,
            },
          ],
          location: expr.location,
        };
      }

      if (expr.name === "existsById") {
        return {
          kind: "simpleType",
          name: "boolean",
          location: expr.location,
        };
      }

      if (ENTITY_TRANSFORM_FNS.has(expr.name) && expr.args.length >= 1) {
        return inferExprType(expr.args[0], env, symbols);
      }

      return null;

    case "systemIdent":
    case "binary":
    case "unary":
    case "ternary":
    case "iterationVar":
      return null;
  }
}

function resolveType(
  typeExpr: TypeExprNode | null,
  symbols: EntitySymbols,
  seen = new Set<string>()
): TypeExprNode | null {
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

function getPropertyType(
  typeExpr: TypeExprNode | null,
  property: string,
  symbols: EntitySymbols
): TypeExprNode | null {
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
      if (isNullType(member)) {
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

function getIndexType(typeExpr: TypeExprNode | null, symbols: EntitySymbols): TypeExprNode | null {
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
      if (isNullType(member)) {
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

function getEntityIdType(
  elementType: TypeExprNode,
  symbols: EntitySymbols
): TypeExprNode | null {
  return getPropertyType(elementType, "id", symbols);
}

function isPrimitiveEntityIdType(typeExpr: TypeExprNode, symbols: EntitySymbols): boolean {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return false;
  }

  switch (resolved.kind) {
    case "simpleType":
      return resolved.name === "string" || resolved.name === "number";

    case "literalType":
      return typeof resolved.value === "string" || typeof resolved.value === "number";

    case "unionType":
      return resolved.types.length > 0 && resolved.types.every((member) => isPrimitiveEntityIdType(member, symbols));

    default:
      return false;
  }
}

function isNullType(typeExpr: TypeExprNode): boolean {
  return (
    (typeExpr.kind === "simpleType" && typeExpr.name === "null") ||
    (typeExpr.kind === "literalType" && typeExpr.value === null)
  );
}

function isStatePathExpr(expr: ExprNode, symbols: EntitySymbols): boolean {
  switch (expr.kind) {
    case "identifier":
      return symbols.stateTypes.has(expr.name);

    case "propertyAccess":
      return isStatePathExpr(expr.object, symbols);

    case "indexAccess":
      return isStatePathExpr(expr.object, symbols);

    default:
      return false;
  }
}
