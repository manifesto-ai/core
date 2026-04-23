import type {
  ComputedNode,
  DomainNode,
  ExprNode,
  ParamNode,
  TypeDeclNode,
  TypeExprNode,
} from "../parser/ast.js";
import {
  classifySpreadOperandType as classifySpreadOperandTypeWithResolver,
  inferMergeContributionType,
  inferObjectLiteralContributionType,
} from "./object-contribution-types.js";
import type { SpreadOperandClassification } from "./object-contribution-types.js";
export type {
  SpreadOperandClassification,
} from "./object-contribution-types.js";

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
      return inferObjectLiteralContributionType(expr, env, symbols, inferExprType, resolveType);

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
    if (!field) {
      return null;
    }
    if (!field.optional) {
      return field.typeExpr;
    }
    return joinTypeCandidates(
      [field.typeExpr, simpleType("null", field.location)],
      field.location
    );
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

export function classifySpreadOperandType(
  typeExpr: TypeExprNode | null,
  symbols: DomainTypeSymbols
): SpreadOperandClassification {
  return classifySpreadOperandTypeWithResolver(typeExpr, symbols, resolveType);
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

  if (expr.name === "idiv") {
    return joinTypeCandidates(
      [simpleType("number", expr.location), simpleType("null", expr.location)],
      expr.location
    );
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
    return inferCoalesceType(expr, env, symbols);
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

  if (expr.name === "values" && expr.args.length >= 1) {
    return inferValuesType(expr, env, symbols);
  }

  if (expr.name === "merge") {
    return inferMergeContributionType(expr, env, symbols, inferExprType, resolveType);
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
  const present = candidates
    .filter((candidate): candidate is TypeExprNode => candidate !== null)
    .flatMap((candidate) => {
      const flattened = candidate.kind === "unionType" ? candidate.types : [candidate];
      return flattened;
    });
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

  if (hasExhaustiveArgSelectionCoverage(expr, env, symbols)) {
    return labelType;
  }

  return joinTypeCandidates([labelType, simpleType("null", expr.location)], expr.location);
}

const OTHER_STRING = Symbol("arg-selection:other-string");
const OTHER_NUMBER = Symbol("arg-selection:other-number");

type AbstractPrimitiveValue = string | number | boolean | null | typeof OTHER_STRING | typeof OTHER_NUMBER;

interface EligibilityAtom {
  key: string;
  typeExpr: TypeExprNode;
  comparedLiterals: Array<string | number | boolean | null>;
}

// Conservatively prove that at least one arg-selection candidate is eligible for every
// abstract assignment of the boolean/comparable atoms referenced by candidate predicates.
// If the proof cannot be completed cheaply, we keep the existing nullable result surface.
function hasExhaustiveArgSelectionCoverage(
  expr: Extract<ExprNode, { kind: "functionCall" }>,
  env: TypeEnv,
  symbols: DomainTypeSymbols
): boolean {
  const eligibleExprs: ExprNode[] = [];
  for (let index = 0; index < expr.args.length - 1; index += 1) {
    const candidate = expr.args[index];
    if (candidate.kind !== "arrayLiteral" || candidate.elements.length !== 3) {
      return false;
    }
    eligibleExprs.push(candidate.elements[1]);
  }

  const atoms = new Map<string, EligibilityAtom>();
  for (const eligibleExpr of eligibleExprs) {
    if (!collectEligibilityAtoms(eligibleExpr, env, symbols, atoms)) {
      return false;
    }
  }

  const domains = [...atoms.values()].map((atom) => ({
    key: atom.key,
    values: buildEligibilityAtomDomain(atom, symbols),
  }));
  if (domains.some((entry) => entry.values === null || entry.values.length === 0)) {
    return false;
  }

  let combinationCount = 1;
  for (const entry of domains) {
    combinationCount *= entry.values!.length;
    if (combinationCount > 256) {
      // Keep compile-time proof bounded; larger domains remain conservatively nullable.
      return false;
    }
  }

  const assignment = new Map<string, AbstractPrimitiveValue>();
  return enumerateEligibilityAssignments(domains as Array<{ key: string; values: AbstractPrimitiveValue[] }>, 0, assignment, () =>
    eligibleExprs.some((eligibleExpr) => evaluateEligibilityExpr(eligibleExpr, assignment) === true)
  );
}

function enumerateEligibilityAssignments(
  domains: Array<{ key: string; values: AbstractPrimitiveValue[] }>,
  index: number,
  assignment: Map<string, AbstractPrimitiveValue>,
  predicate: () => boolean
): boolean {
  if (index >= domains.length) {
    return predicate();
  }

  const domain = domains[index]!;
  for (const value of domain.values) {
    assignment.set(domain.key, value);
    if (!enumerateEligibilityAssignments(domains, index + 1, assignment, predicate)) {
      assignment.delete(domain.key);
      return false;
    }
  }

  assignment.delete(domain.key);
  return true;
}

function collectEligibilityAtoms(
  expr: ExprNode,
  env: TypeEnv,
  symbols: DomainTypeSymbols,
  atoms: Map<string, EligibilityAtom>
): boolean {
  switch (expr.kind) {
    case "literal":
      return expr.literalType === "boolean";

    case "identifier":
    case "iterationVar":
    case "propertyAccess":
    case "indexAccess":
      return registerBooleanEligibilityAtom(expr, env, symbols, atoms);

    case "unary":
      return expr.operator === "!" && collectEligibilityAtoms(expr.operand, env, symbols, atoms);

    case "binary":
      if (expr.operator === "&&" || expr.operator === "||") {
        return collectEligibilityAtoms(expr.left, env, symbols, atoms)
          && collectEligibilityAtoms(expr.right, env, symbols, atoms);
      }
      if (expr.operator === "==" || expr.operator === "!=") {
        return registerComparisonEligibilityAtoms(expr.left, expr.right, env, symbols, atoms);
      }
      return false;

    case "functionCall":
      switch (expr.name) {
        case "and":
        case "or":
          return expr.args.every((arg) => collectEligibilityAtoms(arg, env, symbols, atoms));
        case "not":
          return expr.args.length === 1 && collectEligibilityAtoms(expr.args[0], env, symbols, atoms);
        case "eq":
        case "neq":
          return expr.args.length === 2
            && registerComparisonEligibilityAtoms(expr.args[0], expr.args[1], env, symbols, atoms);
        case "isNull":
        case "isNotNull":
          return expr.args.length === 1 && registerComparableEligibilityAtom(expr.args[0], env, symbols, atoms, null);
        default:
          return false;
      }

    default:
      return false;
  }
}

function registerBooleanEligibilityAtom(
  expr: ExprNode,
  env: TypeEnv,
  symbols: DomainTypeSymbols,
  atoms: Map<string, EligibilityAtom>
): boolean {
  const key = getEligibilityAtomKey(expr);
  const typeExpr = inferExprType(expr, env, symbols);
  if (!key || !typeExpr || !isStrictBooleanType(typeExpr, symbols) || hasNullableEligibilityPath(expr, env, symbols)) {
    return false;
  }

  const existing = atoms.get(key);
  if (existing) {
    return true;
  }

  atoms.set(key, {
    key,
    typeExpr,
    comparedLiterals: [],
  });
  return true;
}

function registerComparisonEligibilityAtoms(
  left: ExprNode,
  right: ExprNode,
  env: TypeEnv,
  symbols: DomainTypeSymbols,
  atoms: Map<string, EligibilityAtom>
): boolean {
  const leftLiteral = getLiteralPrimitiveValue(left);
  const rightLiteral = getLiteralPrimitiveValue(right);

  if (leftLiteral !== undefined && rightLiteral !== undefined) {
    return true;
  }

  if (rightLiteral !== undefined) {
    return registerComparableEligibilityAtom(left, env, symbols, atoms, rightLiteral);
  }
  if (leftLiteral !== undefined) {
    return registerComparableEligibilityAtom(right, env, symbols, atoms, leftLiteral);
  }

  return false;
}

function registerComparableEligibilityAtom(
  expr: ExprNode,
  env: TypeEnv,
  symbols: DomainTypeSymbols,
  atoms: Map<string, EligibilityAtom>,
  comparedLiteral: string | number | boolean | null
): boolean {
  const key = getEligibilityAtomKey(expr);
  const typeExpr = inferExprType(expr, env, symbols);
  if (!key || !typeExpr || !isPrimitiveComparableType(typeExpr, symbols) || hasNullableEligibilityPath(expr, env, symbols)) {
    return false;
  }

  const existing = atoms.get(key);
  if (existing) {
    if (!existing.comparedLiterals.some((candidate) => Object.is(candidate, comparedLiteral))) {
      existing.comparedLiterals.push(comparedLiteral);
    }
    return true;
  }

  atoms.set(key, {
    key,
    typeExpr,
    comparedLiterals: [comparedLiteral],
  });
  return true;
}

function buildEligibilityAtomDomain(
  atom: EligibilityAtom,
  symbols: DomainTypeSymbols
): AbstractPrimitiveValue[] | null {
  const values: AbstractPrimitiveValue[] = [];
  let invalid = false;

  const addValue = (value: AbstractPrimitiveValue) => {
    if (!values.some((candidate) => Object.is(candidate, value))) {
      values.push(value);
    }
  };

  const visit = (typeExpr: TypeExprNode | null) => {
    const resolved = resolveType(typeExpr, symbols);
    if (!resolved || invalid) {
      invalid = true;
      return;
    }

    switch (resolved.kind) {
      case "literalType":
        addValue(resolved.value);
        return;

      case "simpleType":
        switch (resolved.name) {
          case "boolean":
            addValue(true);
            addValue(false);
            return;
          case "string":
            for (const literal of atom.comparedLiterals) {
              if (typeof literal === "string") {
                addValue(literal);
              }
            }
            addValue(OTHER_STRING);
            return;
          case "number":
            for (const literal of atom.comparedLiterals) {
              if (typeof literal === "number") {
                addValue(literal);
              }
            }
            addValue(OTHER_NUMBER);
            return;
          case "null":
            addValue(null);
            return;
          default:
            invalid = true;
            return;
        }

      case "unionType":
        for (const member of resolved.types) {
          visit(member);
        }
        return;

      default:
        invalid = true;
    }
  };

  visit(atom.typeExpr);
  if (invalid || values.length === 0) {
    return null;
  }

  return values;
}

function evaluateEligibilityExpr(
  expr: ExprNode,
  assignment: Map<string, AbstractPrimitiveValue>
): AbstractPrimitiveValue | undefined {
  switch (expr.kind) {
    case "literal":
      return expr.literalType === "null"
        ? null
        : typeof expr.value === "string" || typeof expr.value === "number" || typeof expr.value === "boolean"
        ? expr.value
        : undefined;

    case "identifier":
    case "iterationVar":
    case "propertyAccess":
    case "indexAccess": {
      const key = getEligibilityAtomKey(expr);
      return key ? assignment.get(key) : undefined;
    }

    case "unary": {
      const operand = evaluateEligibilityExpr(expr.operand, assignment);
      return expr.operator === "!" && typeof operand === "boolean" ? !operand : undefined;
    }

    case "binary": {
      const left = evaluateEligibilityExpr(expr.left, assignment);
      const right = evaluateEligibilityExpr(expr.right, assignment);
      switch (expr.operator) {
        case "&&":
          return typeof left === "boolean" && typeof right === "boolean" ? left && right : undefined;
        case "||":
          return typeof left === "boolean" && typeof right === "boolean" ? left || right : undefined;
        case "==":
          return left !== undefined && right !== undefined ? Object.is(left, right) : undefined;
        case "!=":
          return left !== undefined && right !== undefined ? !Object.is(left, right) : undefined;
        default:
          return undefined;
      }
    }

    case "functionCall":
      switch (expr.name) {
        case "and": {
          const values = expr.args.map((arg) => evaluateEligibilityExpr(arg, assignment));
          return values.every((value) => typeof value === "boolean")
            ? (values as boolean[]).every(Boolean)
            : undefined;
        }
        case "or": {
          const values = expr.args.map((arg) => evaluateEligibilityExpr(arg, assignment));
          return values.every((value) => typeof value === "boolean")
            ? (values as boolean[]).some(Boolean)
            : undefined;
        }
        case "not": {
          const value = expr.args.length === 1 ? evaluateEligibilityExpr(expr.args[0], assignment) : undefined;
          return typeof value === "boolean" ? !value : undefined;
        }
        case "eq":
        case "neq": {
          if (expr.args.length !== 2) {
            return undefined;
          }
          const left = evaluateEligibilityExpr(expr.args[0], assignment);
          const right = evaluateEligibilityExpr(expr.args[1], assignment);
          if (left === undefined || right === undefined) {
            return undefined;
          }
          return expr.name === "eq" ? Object.is(left, right) : !Object.is(left, right);
        }
        case "isNull": {
          if (expr.args.length !== 1) {
            return undefined;
          }
          const value = evaluateEligibilityExpr(expr.args[0], assignment);
          return value === undefined ? undefined : value === null;
        }
        case "isNotNull": {
          if (expr.args.length !== 1) {
            return undefined;
          }
          const value = evaluateEligibilityExpr(expr.args[0], assignment);
          return value === undefined ? undefined : value !== null;
        }
        case "cond":
        case "if": {
          if (expr.args.length !== 3) {
            return undefined;
          }
          const condition = evaluateEligibilityExpr(expr.args[0], assignment);
          if (typeof condition !== "boolean") {
            return undefined;
          }
          return evaluateEligibilityExpr(condition ? expr.args[1] : expr.args[2], assignment);
        }
        default:
          return undefined;
      }

    default:
      return undefined;
  }
}

function getEligibilityAtomKey(expr: ExprNode): string | null {
  switch (expr.kind) {
    case "identifier":
      return `id:${expr.name}`;
    case "iterationVar":
      return "$item";
    case "propertyAccess": {
      const parent = getEligibilityAtomKey(expr.object);
      return parent ? `${parent}.${expr.property}` : null;
    }
    case "indexAccess": {
      const parent = getEligibilityAtomKey(expr.object);
      const index = getLiteralPrimitiveValue(expr.index);
      return parent && index !== undefined ? `${parent}[${JSON.stringify(index)}]` : null;
    }
    default:
      return null;
  }
}

function hasNullableEligibilityPath(
  expr: ExprNode,
  env: TypeEnv,
  symbols: DomainTypeSymbols
): boolean {
  switch (expr.kind) {
    case "propertyAccess":
      return canTypeIncludeNull(inferExprType(expr.object, env, symbols), symbols)
        || canPropertyAccessBeMissing(expr.object, expr.property, env, symbols)
        || hasNullableEligibilityPath(expr.object, env, symbols);

    case "indexAccess":
      return true;

    default:
      return false;
  }
}

function canPropertyAccessBeMissing(
  objectExpr: ExprNode,
  property: string,
  env: TypeEnv,
  symbols: DomainTypeSymbols
): boolean {
  return canPropertyTypeBeMissing(inferExprType(objectExpr, env, symbols), property, symbols);
}

function canPropertyTypeBeMissing(
  typeExpr: TypeExprNode | null,
  property: string,
  symbols: DomainTypeSymbols
): boolean {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return true;
  }

  if (resolved.kind === "objectType") {
    const field = resolved.fields.find((candidate) => candidate.name === property);
    return !field || field.optional;
  }

  if (resolved.kind === "unionType") {
    const members = resolved.types.filter((member) => !isNullType(member));
    return members.length === 0 || members.some((member) => canPropertyTypeBeMissing(member, property, symbols));
  }

  return true;
}

function isStrictBooleanType(typeExpr: TypeExprNode | null, symbols: DomainTypeSymbols): boolean {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return false;
  }

  switch (resolved.kind) {
    case "simpleType":
      return resolved.name === "boolean";
    case "literalType":
      return typeof resolved.value === "boolean";
    case "unionType":
      return resolved.types.length > 0 && resolved.types.every((member) => isStrictBooleanType(member, symbols));
    default:
      return false;
  }
}

function isPrimitiveComparableType(typeExpr: TypeExprNode | null, symbols: DomainTypeSymbols): boolean {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return false;
  }

  switch (resolved.kind) {
    case "simpleType":
      return resolved.name === "string"
        || resolved.name === "number"
        || resolved.name === "boolean"
        || resolved.name === "null";
    case "literalType":
      return typeof resolved.value === "string"
        || typeof resolved.value === "number"
        || typeof resolved.value === "boolean"
        || resolved.value === null;
    case "unionType":
      return resolved.types.length > 0 && resolved.types.every((member) => isPrimitiveComparableType(member, symbols));
    default:
      return false;
  }
}

function getLiteralPrimitiveValue(expr: ExprNode): string | number | boolean | null | undefined {
  if (expr.kind !== "literal") {
    return undefined;
  }
  if (expr.literalType === "null") {
    return null;
  }
  return typeof expr.value === "string" || typeof expr.value === "number" || typeof expr.value === "boolean"
    ? expr.value
    : undefined;
}

function inferCoalesceType(
  expr: Extract<ExprNode, { kind: "functionCall" }>,
  env: TypeEnv,
  symbols: DomainTypeSymbols
): TypeExprNode | null {
  const argTypes = expr.args.map((arg) => inferExprType(arg, env, symbols));
  if (argTypes.some((typeExpr) => typeExpr === null)) {
    return joinTypeCandidates(argTypes, expr.location);
  }

  const nonNullCandidates = argTypes
    .map((typeExpr) => stripNullBranches(typeExpr, symbols))
    .filter((typeExpr): typeExpr is TypeExprNode => typeExpr !== null);

  if (nonNullCandidates.length === 0) {
    return joinTypeCandidates(argTypes, expr.location);
  }

  const resultCandidates: Array<TypeExprNode | null> = [...nonNullCandidates];
  if (argTypes.every((typeExpr) => typeExpr !== null && canTypeIncludeNull(typeExpr, symbols))) {
    resultCandidates.push(simpleType("null", expr.location));
  }

  return joinTypeCandidates(resultCandidates, expr.location);
}

function inferValuesType(
  expr: Extract<ExprNode, { kind: "functionCall" }>,
  env: TypeEnv,
  symbols: DomainTypeSymbols
): TypeExprNode | null {
  if (expr.args.length < 1) {
    return null;
  }

  const elementType = getValuesElementType(inferExprType(expr.args[0], env, symbols), symbols);
  if (!elementType) {
    return null;
  }

  return {
    kind: "arrayType",
    elementType,
    location: expr.location,
  };
}

function getValuesElementType(
  typeExpr: TypeExprNode | null,
  symbols: DomainTypeSymbols
): TypeExprNode | null {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return null;
  }

  if (resolved.kind === "recordType") {
    return resolved.valueType;
  }

  if (resolved.kind === "objectType") {
    return joinTypeCandidates(
      resolved.fields.map((field) => field.typeExpr),
      resolved.location
    );
  }

  if (resolved.kind === "unionType") {
    return joinTypeCandidates(
      resolved.types
        .filter((member) => !isNullType(member))
        .map((member) => getValuesElementType(member, symbols)),
      resolved.location
    );
  }

  return null;
}

function stripNullBranches(
  typeExpr: TypeExprNode | null,
  symbols: DomainTypeSymbols
): TypeExprNode | null {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved || isNullType(resolved)) {
    return null;
  }

  if (resolved.kind !== "unionType") {
    return resolved;
  }

  const members = resolved.types
    .map((member) => stripNullBranches(member, symbols))
    .filter((member): member is TypeExprNode => member !== null);
  if (members.length === 0) {
    return null;
  }
  return joinTypeCandidates(members, resolved.location);
}

function canTypeIncludeNull(
  typeExpr: TypeExprNode | null,
  symbols: DomainTypeSymbols
): boolean {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return true;
  }

  if (isNullType(resolved)) {
    return true;
  }

  if (resolved.kind !== "unionType") {
    return false;
  }

  return resolved.types.some((member) => canTypeIncludeNull(member, symbols));
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
