import type { ExprNode, TypeExprNode } from "../parser/ast.js";

export type SpreadOperandClassification = "object" | "nullable-object" | "invalid" | "unknown";

type InferExprType<Env, Symbols> = (
  expr: ExprNode,
  env: Env,
  symbols: Symbols
) => TypeExprNode | null;

type ResolveType<Symbols> = (
  typeExpr: TypeExprNode | null,
  symbols: Symbols
) => TypeExprNode | null;

export function inferObjectLiteralContributionType<Env, Symbols>(
  expr: Extract<ExprNode, { kind: "objectLiteral" }>,
  env: Env,
  symbols: Symbols,
  inferExprType: InferExprType<Env, Symbols>,
  resolveType: ResolveType<Symbols>
): TypeExprNode | null {
  const contributors: TypeExprNode[] = [];
  let bufferedFields: Extract<TypeExprNode, { kind: "objectType" }>["fields"] = [];

  const flushBufferedFields = () => {
    if (bufferedFields.length === 0) {
      return;
    }

    contributors.push({
      kind: "objectType",
      fields: bufferedFields,
      location: expr.location,
    });
    bufferedFields = [];
  };

  for (const property of expr.properties) {
    if (property.kind === "objectProperty") {
      const propertyType = inferExprType(property.value, env, symbols);
      if (!propertyType) {
        return null;
      }

      bufferedFields.push({
        kind: "typeField",
        name: property.key,
        typeExpr: propertyType,
        optional: false,
        location: property.location,
      });
      continue;
    }

    flushBufferedFields();
    const spreadType = inferExprType(property.expr, env, symbols);
    if (!spreadType) {
      return null;
    }
    contributors.push(spreadType);
  }

  flushBufferedFields();

  if (contributors.length === 0) {
    return {
      kind: "objectType",
      fields: [],
      location: expr.location,
    };
  }

  return mergeObjectContributionTypes(contributors, expr.location, symbols, resolveType);
}

export function inferMergeContributionType<Env, Symbols>(
  expr: Extract<ExprNode, { kind: "functionCall" }>,
  env: Env,
  symbols: Symbols,
  inferExprType: InferExprType<Env, Symbols>,
  resolveType: ResolveType<Symbols>
): TypeExprNode | null {
  const contributors = expr.args.map((arg) => inferExprType(arg, env, symbols));
  if (contributors.some((typeExpr) => typeExpr === null)) {
    return null;
  }

  return mergeObjectContributionTypes(contributors as TypeExprNode[], expr.location, symbols, resolveType);
}

export function classifySpreadOperandType<Symbols>(
  typeExpr: TypeExprNode | null,
  symbols: Symbols,
  resolveType: ResolveType<Symbols>
): SpreadOperandClassification {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return "unknown";
  }

  if (resolved.kind === "objectType") {
    return "object";
  }

  if (resolved.kind !== "unionType") {
    return "invalid";
  }

  const resolvedMembers = resolved.types
    .map((member) => resolveType(member, symbols))
    .filter((member): member is TypeExprNode => member !== null);
  const nonNullMembers = resolvedMembers.filter((member) => !isNullType(member));
  const hasNullBranch = resolvedMembers.some((member) => isNullType(member));
  if (hasNullBranch && nonNullMembers.length === 1 && nonNullMembers[0].kind === "objectType") {
    return "nullable-object";
  }

  return "invalid";
}

export function mayYieldArrayExpr(expr: ExprNode | undefined): boolean {
  if (!expr) {
    return false;
  }

  if (expr.kind === "arrayLiteral") {
    return true;
  }

  if (expr.kind === "ternary") {
    return mayYieldArrayExpr(expr.consequent) || mayYieldArrayExpr(expr.alternate);
  }

  if (expr.kind !== "functionCall") {
    return false;
  }

  if (expr.name === "coalesce") {
    for (const arg of expr.args) {
      if (isDefinitelyNullExpr(arg)) {
        continue;
      }

      if (mayYieldArrayExpr(arg)) {
        return true;
      }

      if (isDefinitelyNonNullExpr(arg)) {
        return false;
      }
    }

    return false;
  }

  if ((expr.name === "cond" || expr.name === "if") && expr.args.length >= 3) {
    return mayYieldArrayExpr(expr.args[1]) || mayYieldArrayExpr(expr.args[2]);
  }

  return false;
}

function isDefinitelyNullExpr(expr: ExprNode): boolean {
  if (expr.kind === "literal") {
    return expr.value === null;
  }

  if (expr.kind === "ternary") {
    return isDefinitelyNullExpr(expr.consequent) && isDefinitelyNullExpr(expr.alternate);
  }

  if (expr.kind !== "functionCall") {
    return false;
  }

  if (expr.name === "coalesce") {
    return expr.args.length > 0 && expr.args.every((arg) => isDefinitelyNullExpr(arg));
  }

  if ((expr.name === "cond" || expr.name === "if") && expr.args.length >= 3) {
    return isDefinitelyNullExpr(expr.args[1]) && isDefinitelyNullExpr(expr.args[2]);
  }

  return false;
}

function isDefinitelyNonNullExpr(expr: ExprNode): boolean {
  if (expr.kind === "literal") {
    return expr.value !== null;
  }

  if (expr.kind === "arrayLiteral" || expr.kind === "objectLiteral") {
    return true;
  }

  if (expr.kind === "ternary") {
    return isDefinitelyNonNullExpr(expr.consequent) && isDefinitelyNonNullExpr(expr.alternate);
  }

  if (expr.kind !== "functionCall") {
    return false;
  }

  if (expr.name === "coalesce") {
    return expr.args.some((arg) => isDefinitelyNonNullExpr(arg));
  }

  if ((expr.name === "cond" || expr.name === "if") && expr.args.length >= 3) {
    return isDefinitelyNonNullExpr(expr.args[1]) && isDefinitelyNonNullExpr(expr.args[2]);
  }

  return false;
}

function mergeObjectContributionTypes<Symbols>(
  contributors: TypeExprNode[],
  location: TypeExprNode["location"],
  symbols: Symbols,
  resolveType: ResolveType<Symbols>
): TypeExprNode | null {
  const mergedFields = new Map<string, Extract<TypeExprNode, { kind: "objectType" }>["fields"][number]>();

  for (const contributor of contributors) {
    const contributionFields = getContributionFields(contributor, symbols, resolveType);
    if (!contributionFields) {
      return null;
    }

    for (const field of contributionFields) {
      const existing = mergedFields.get(field.name);
      if (!existing) {
        mergedFields.set(field.name, field);
        continue;
      }

      if (!field.optional) {
        mergedFields.set(field.name, field);
        continue;
      }

      const mergedType = joinTypeCandidates([existing.typeExpr, field.typeExpr], field.location);
      if (!mergedType) {
        return null;
      }

      mergedFields.set(field.name, {
        kind: "typeField",
        name: field.name,
        typeExpr: mergedType,
        optional: existing.optional,
        location: field.location,
      });
    }
  }

  return {
    kind: "objectType",
    fields: [...mergedFields.values()],
    location,
  };
}

function getContributionFields<Symbols>(
  typeExpr: TypeExprNode,
  symbols: Symbols,
  resolveType: ResolveType<Symbols>
): Extract<TypeExprNode, { kind: "objectType" }>["fields"] | null {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return null;
  }

  if (resolved.kind === "objectType") {
    return resolved.fields.map((field) => ({
      ...field,
      optional: field.optional,
    }));
  }

  if (resolved.kind !== "unionType") {
    return null;
  }

  const resolvedMembers = resolved.types
    .map((member) => resolveType(member, symbols))
    .filter((member): member is TypeExprNode => member !== null);
  const nonNullMembers = resolvedMembers.filter((member) => !isNullType(member));
  const hasNullBranch = resolvedMembers.some((member) => isNullType(member));
  if (!hasNullBranch || nonNullMembers.length !== 1) {
    return null;
  }

  const onlyMember = nonNullMembers[0];
  if (onlyMember.kind !== "objectType") {
    return null;
  }

  return onlyMember.fields.map((field) => ({
    ...field,
    optional: true,
  }));
}

function isNullType(typeExpr: TypeExprNode): boolean {
  return (
    (typeExpr.kind === "simpleType" && typeExpr.name === "null") ||
    (typeExpr.kind === "literalType" && typeExpr.value === null)
  );
}

function joinTypeCandidates(
  candidates: Array<TypeExprNode | null>,
  location: TypeExprNode["location"]
): TypeExprNode | null {
  const present = candidates
    .filter((candidate): candidate is TypeExprNode => candidate !== null)
    .flatMap((candidate) => candidate.kind === "unionType" ? candidate.types : [candidate]);
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
