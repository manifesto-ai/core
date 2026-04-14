import type {
  ComputedNode,
  DomainNode,
  ExprNode,
  ParamNode,
  TypeDeclNode,
  TypeExprNode,
} from "../parser/ast.js";

export type TypeEnv = Map<string, TypeExprNode>;
export type ComparableSurfaceClass = "primitive" | "nonprimitive" | "unknown";

export interface DomainTypeSymbols {
  stateTypes: Map<string, TypeExprNode>;
  computedDecls: Map<string, ComputedNode>;
  typeDefs: Map<string, TypeDeclNode>;
  computedTypeCache: Map<string, TypeExprNode | null>;
  computedTypeInFlight: Set<string>;
}

const PRIMITIVE_BOOLEAN_CALLS = new Set([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "and",
  "or",
  "not",
  "isNull",
  "isNotNull",
  "hasKey",
  "startsWith",
  "endsWith",
  "strIncludes",
  "includes",
  "every",
  "some",
  "existsById",
]);

const PRIMITIVE_NUMBER_CALLS = new Set([
  "add",
  "sub",
  "mul",
  "div",
  "mod",
  "absDiff",
  "abs",
  "clamp",
  "floor",
  "ceil",
  "idiv",
  "round",
  "sqrt",
  "pow",
  "len",
  "strlen",
  "indexOf",
  "streak",
  "sum",
  "min",
  "max",
  "toNumber",
]);

const PRIMITIVE_STRING_CALLS = new Set([
  "trim",
  "lower",
  "upper",
  "concat",
  "typeof",
  "toString",
  "substring",
  "substr",
  "replace",
]);

const NONPRIMITIVE_CALLS = new Set([
  "keys",
  "values",
  "entries",
  "merge",
  "filter",
  "map",
  "append",
  "reverse",
  "unique",
  "flat",
  "split",
  "fromEntries",
]);

const ENTITY_TRANSFORM_CALLS = new Set(["updateById", "removeById"]);

export function collectDomainTypeSymbols(domain: DomainNode): DomainTypeSymbols {
  const stateTypes = new Map<string, TypeExprNode>();
  const computedDecls = new Map<string, ComputedNode>();
  const typeDefs = new Map<string, TypeDeclNode>();

  for (const typeDecl of domain.types) {
    typeDefs.set(typeDecl.name, typeDecl);
  }

  for (const member of domain.members) {
    if (member.kind === "state") {
      for (const field of member.fields) {
        stateTypes.set(field.name, field.typeExpr);
      }
      continue;
    }

    if (member.kind === "computed") {
      computedDecls.set(member.name, member);
    }
  }

  return {
    stateTypes,
    computedDecls,
    typeDefs,
    computedTypeCache: new Map(),
    computedTypeInFlight: new Set(),
  };
}

export function createActionTypeEnv(params: readonly ParamNode[]): TypeEnv {
  const env = new Map<string, TypeExprNode>();
  for (const param of params) {
    env.set(param.name, param.typeExpr);
  }
  return env;
}

export function inferExprType(
  expr: ExprNode,
  env: TypeEnv,
  symbols: DomainTypeSymbols
): TypeExprNode | null {
  switch (expr.kind) {
    case "literal":
      return literalTypeFromValue(expr.value, expr.location);

    case "identifier":
      return env.get(expr.name) ?? symbols.stateTypes.get(expr.name) ?? inferComputedType(expr.name, symbols);

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
      const elementType = joinTypeCandidates(
        expr.elements.map((element) => inferExprType(element, env, symbols)),
        expr.location
      );
      if (!elementType) {
        return null;
      }
      return {
        kind: "arrayType",
        elementType,
        location: expr.location,
      };
    }

    case "unary":
      return inferUnaryType(expr);

    case "binary":
      return inferBinaryType(expr, env, symbols);

    case "ternary":
      return joinTypeCandidates(
        [
          inferExprType(expr.consequent, env, symbols),
          inferExprType(expr.alternate, env, symbols),
        ],
        expr.location
      );

    case "functionCall":
      return inferFunctionCallType(expr, env, symbols);

    case "systemIdent":
      return null;

    case "iterationVar":
      return env.get("$item") ?? null;
  }
}

export function classifyComparableExpr(
  expr: ExprNode,
  env: TypeEnv,
  symbols: DomainTypeSymbols
): ComparableSurfaceClass {
  const inferred = inferExprType(expr, env, symbols);
  if (inferred) {
    return classifyComparableType(inferred, symbols);
  }

  switch (expr.kind) {
    case "literal":
      return "primitive";

    case "objectLiteral":
    case "arrayLiteral":
      return "nonprimitive";

    case "binary":
      if (expr.operator === "??") {
        return joinComparableClasses([
          classifyComparableExpr(expr.left, env, symbols),
          classifyComparableExpr(expr.right, env, symbols),
        ]);
      }
      if (expr.operator === "==" || expr.operator === "!=") {
        return "primitive";
      }
      if (
        expr.operator === "+" ||
        expr.operator === "-" ||
        expr.operator === "*" ||
        expr.operator === "/" ||
        expr.operator === "%" ||
        expr.operator === "<" ||
        expr.operator === "<=" ||
        expr.operator === ">" ||
        expr.operator === ">=" ||
        expr.operator === "&&" ||
        expr.operator === "||"
      ) {
        return "primitive";
      }
      return "unknown";

    case "unary":
      return "primitive";

    case "ternary":
      return joinComparableClasses([
        classifyComparableExpr(expr.consequent, env, symbols),
        classifyComparableExpr(expr.alternate, env, symbols),
      ]);

    case "functionCall":
      if (NONPRIMITIVE_CALLS.has(expr.name)) {
        return "nonprimitive";
      }

      if (
        PRIMITIVE_BOOLEAN_CALLS.has(expr.name) ||
        PRIMITIVE_NUMBER_CALLS.has(expr.name) ||
        PRIMITIVE_STRING_CALLS.has(expr.name) ||
        expr.name === "toBoolean"
      ) {
        return "primitive";
      }

      if ((expr.name === "cond" || expr.name === "if") && expr.args.length >= 3) {
        return joinComparableClasses([
          classifyComparableExpr(expr.args[1], env, symbols),
          classifyComparableExpr(expr.args[2], env, symbols),
        ]);
      }

      if (expr.name === "coalesce") {
        return joinComparableClasses(
          expr.args.map((arg) => classifyComparableExpr(arg, env, symbols))
        );
      }

      return "unknown";

    case "identifier":
    case "propertyAccess":
    case "indexAccess":
    case "systemIdent":
    case "iterationVar":
      return "unknown";
  }
}

export function classifyComparableType(
  typeExpr: TypeExprNode | null,
  symbols: DomainTypeSymbols
): ComparableSurfaceClass {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return "unknown";
  }

  switch (resolved.kind) {
    case "simpleType":
      return resolved.name === "object"
        ? "nonprimitive"
        : resolved.name === "string" ||
        resolved.name === "number" ||
        resolved.name === "boolean" ||
        resolved.name === "null"
        ? "primitive"
        : "unknown";

    case "literalType":
      return "primitive";

    case "arrayType":
    case "recordType":
    case "objectType":
      return "nonprimitive";

    case "unionType":
      return joinComparableClasses(
        resolved.types.map((member) => classifyComparableType(member, symbols))
      );
  }
}

export function resolveType(
  typeExpr: TypeExprNode | null,
  symbols: DomainTypeSymbols,
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

export function getPropertyType(
  typeExpr: TypeExprNode | null,
  property: string,
  symbols: DomainTypeSymbols
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
    const memberTypes = resolved.types
      .filter((member) => !isNullType(member))
      .map((member) => getPropertyType(member, property, symbols))
      .filter((member): member is TypeExprNode => member !== null);

    return joinTypeCandidates(memberTypes, resolved.location);
  }

  return null;
}

export function getIndexType(
  typeExpr: TypeExprNode | null,
  symbols: DomainTypeSymbols
): TypeExprNode | null {
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
    const memberTypes = resolved.types
      .filter((member) => !isNullType(member))
      .map((member) => getIndexType(member, symbols))
      .filter((member): member is TypeExprNode => member !== null);

    return joinTypeCandidates(memberTypes, resolved.location);
  }

  return null;
}

export function getArrayElementType(
  typeExpr: TypeExprNode | null,
  symbols: DomainTypeSymbols
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

    return joinTypeCandidates(candidates, resolved.location);
  }

  return null;
}

export function isPrimitiveEntityIdType(typeExpr: TypeExprNode, symbols: DomainTypeSymbols): boolean {
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

export function isNullType(typeExpr: TypeExprNode): boolean {
  return (
    (typeExpr.kind === "simpleType" && typeExpr.name === "null") ||
    (typeExpr.kind === "literalType" && typeExpr.value === null)
  );
}

function inferComputedType(name: string, symbols: DomainTypeSymbols): TypeExprNode | null {
  if (symbols.computedTypeCache.has(name)) {
    return symbols.computedTypeCache.get(name) ?? null;
  }

  const computed = symbols.computedDecls.get(name);
  if (!computed) {
    return null;
  }

  if (symbols.computedTypeInFlight.has(name)) {
    return null;
  }

  symbols.computedTypeInFlight.add(name);
  const inferred = inferExprType(computed.expression, new Map(), symbols);
  symbols.computedTypeInFlight.delete(name);
  symbols.computedTypeCache.set(name, inferred);
  return inferred;
}

function inferUnaryType(expr: Extract<ExprNode, { kind: "unary" }>): TypeExprNode {
  return expr.operator === "!"
    ? simpleType("boolean", expr.location)
    : simpleType("number", expr.location);
}

function inferBinaryType(
  expr: Extract<ExprNode, { kind: "binary" }>,
  env: TypeEnv,
  symbols: DomainTypeSymbols
): TypeExprNode | null {
  switch (expr.operator) {
    case "==":
    case "!=":
    case "<":
    case "<=":
    case ">":
    case ">=":
    case "&&":
    case "||":
      return simpleType("boolean", expr.location);

    case "+":
    case "-":
    case "*":
    case "/":
    case "%":
      return simpleType("number", expr.location);

    case "??":
      return joinTypeCandidates(
        [
          inferExprType(expr.left, env, symbols),
          inferExprType(expr.right, env, symbols),
        ],
        expr.location
      );
  }
}

function inferFunctionCallType(
  expr: Extract<ExprNode, { kind: "functionCall" }>,
  env: TypeEnv,
  symbols: DomainTypeSymbols
): TypeExprNode | null {
  if (PRIMITIVE_BOOLEAN_CALLS.has(expr.name)) {
    return simpleType("boolean", expr.location);
  }

  if (PRIMITIVE_NUMBER_CALLS.has(expr.name)) {
    return simpleType("number", expr.location);
  }

  if (PRIMITIVE_STRING_CALLS.has(expr.name)) {
    return simpleType("string", expr.location);
  }

  if (expr.name === "toBoolean") {
    return simpleType("boolean", expr.location);
  }

  if (expr.name === "findById" && expr.args.length >= 1) {
    const elementType = getArrayElementType(inferExprType(expr.args[0], env, symbols), symbols);
    if (!elementType) {
      return null;
    }
    return joinTypeCandidates([elementType, simpleType("null", expr.location)], expr.location);
  }

  if (expr.name === "find" && expr.args.length >= 1) {
    const elementType = getArrayElementType(inferExprType(expr.args[0], env, symbols), symbols);
    if (!elementType) {
      return null;
    }
    return joinTypeCandidates([elementType, simpleType("null", expr.location)], expr.location);
  }

  if (expr.name === "filter" && expr.args.length >= 1) {
    return inferExprType(expr.args[0], env, symbols);
  }

  if (expr.name === "map" && expr.args.length >= 2) {
    const arrayType = inferExprType(expr.args[0], env, symbols);
    const elementType = getArrayElementType(arrayType, symbols);
    if (!elementType) {
      return null;
    }

    const mapperType = inferExprType(
      expr.args[1],
      extendCollectionEnv(env, elementType),
      symbols
    );
    if (!mapperType) {
      return null;
    }

    return {
      kind: "arrayType",
      elementType: mapperType,
      location: expr.location,
    };
  }

  if ((expr.name === "first" || expr.name === "last") && expr.args.length >= 1) {
    return getArrayElementType(inferExprType(expr.args[0], env, symbols), symbols);
  }

  if (expr.name === "at" && expr.args.length >= 1) {
    return getIndexType(inferExprType(expr.args[0], env, symbols), symbols);
  }

  if (expr.name === "field" && expr.args.length >= 2) {
    const property = getStaticPropertyName(expr.args[1]);
    if (!property) {
      return null;
    }
    return getPropertyType(inferExprType(expr.args[0], env, symbols), property, symbols);
  }

  if (ENTITY_TRANSFORM_CALLS.has(expr.name) && expr.args.length >= 1) {
    return inferExprType(expr.args[0], env, symbols);
  }

  if ((expr.name === "cond" || expr.name === "if") && expr.args.length >= 3) {
    return joinTypeCandidates(
      [
        inferExprType(expr.args[1], env, symbols),
        inferExprType(expr.args[2], env, symbols),
      ],
      expr.location
    );
  }

  if (expr.name === "coalesce") {
    return joinTypeCandidates(
      expr.args.map((arg) => inferExprType(arg, env, symbols)),
      expr.location
    );
  }

  if (expr.name === "match") {
    return inferMatchType(expr, env, symbols);
  }

  if (expr.name === "argmax" || expr.name === "argmin") {
    return inferArgSelectionType(expr, env, symbols);
  }

  if (expr.name === "slice" && expr.args.length >= 1) {
    return inferExprType(expr.args[0], env, symbols);
  }

  if (expr.name === "split") {
    return {
      kind: "arrayType",
      elementType: simpleType("string", expr.location),
      location: expr.location,
    };
  }

  if (expr.name === "keys") {
    return {
      kind: "arrayType",
      elementType: simpleType("string", expr.location),
      location: expr.location,
    };
  }

  return null;
}

function joinComparableClasses(classes: ComparableSurfaceClass[]): ComparableSurfaceClass {
  let sawUnknown = false;

  for (const surfaceClass of classes) {
    if (surfaceClass === "nonprimitive") {
      return "nonprimitive";
    }
    if (surfaceClass === "unknown") {
      sawUnknown = true;
    }
  }

  return sawUnknown ? "unknown" : "primitive";
}

function joinTypeCandidates(
  candidates: Array<TypeExprNode | null>,
  location: TypeExprNode["location"]
): TypeExprNode | null {
  const present = candidates.filter((candidate): candidate is TypeExprNode => candidate !== null);
  if (present.length === 0) {
    return null;
  }
  if (present.length === 1) {
    return present[0];
  }

  const deduped: TypeExprNode[] = [];
  const seen = new Set<string>();
  for (const candidate of present) {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(candidate);
  }

  if (deduped.length === 1) {
    return deduped[0];
  }

  return {
    kind: "unionType",
    types: deduped,
    location,
  };
}

function inferMatchType(
  expr: Extract<ExprNode, { kind: "functionCall" }>,
  env: TypeEnv,
  symbols: DomainTypeSymbols
): TypeExprNode | null {
  if (expr.args.length < 3) {
    return null;
  }

  const valueTypes: Array<TypeExprNode | null> = [];
  for (let index = 1; index < expr.args.length - 1; index += 1) {
    const arm = expr.args[index];
    if (arm.kind !== "arrayLiteral" || arm.elements.length !== 2) {
      return null;
    }
    valueTypes.push(inferExprType(arm.elements[1], env, symbols));
  }
  valueTypes.push(inferExprType(expr.args[expr.args.length - 1], env, symbols));
  return joinTypeCandidates(valueTypes, expr.location);
}

function inferArgSelectionType(
  expr: Extract<ExprNode, { kind: "functionCall" }>,
  env: TypeEnv,
  symbols: DomainTypeSymbols
): TypeExprNode | null {
  if (expr.args.length < 2) {
    return null;
  }

  const labelTypes: Array<TypeExprNode | null> = [];
  for (let index = 0; index < expr.args.length - 1; index += 1) {
    const candidate = expr.args[index];
    if (candidate.kind !== "arrayLiteral" || candidate.elements.length !== 3) {
      return null;
    }
    labelTypes.push(inferExprType(candidate.elements[0], env, symbols));
  }

  const labelType = joinTypeCandidates(labelTypes, expr.location);
  if (!labelType) {
    return null;
  }

  return joinTypeCandidates([labelType, simpleType("null", expr.location)], expr.location);
}

function literalTypeFromValue(
  value: unknown,
  location: TypeExprNode["location"]
): TypeExprNode {
  return {
    kind: "literalType",
    value: value as string | number | boolean | null,
    location,
  };
}

function simpleType(name: string, location: TypeExprNode["location"]): TypeExprNode {
  return {
    kind: "simpleType",
    name,
    location,
  };
}

function getStaticPropertyName(expr: ExprNode): string | null {
  if (expr.kind === "literal" && typeof expr.value === "string") {
    return expr.value;
  }

  return null;
}

function extendCollectionEnv(env: TypeEnv, itemType: TypeExprNode): TypeEnv {
  const next = new Map(env);
  next.set("$item", itemType);
  return next;
}
