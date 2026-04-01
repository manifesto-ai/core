import type { DomainSchema, ExprNode } from "@manifesto-ai/core";
import type { Diagnostic } from "../types.js";
import {
  arrayType,
  fieldSpecToDomainType,
  literalValueToType,
  objectType,
  primitiveType,
  recordType,
  removeNullType,
  tupleType,
  type DomainType,
  type DomainTypeField,
  unionOf,
  unknownType,
} from "./domain-type-model.js";

type InferenceEnv = ReadonlyMap<string, DomainType>;

type InferenceContext = {
  readonly schema: DomainSchema;
  readonly pluginName: string;
  readonly diagnostics: Diagnostic[];
  readonly warnedMessages: Set<string>;
  readonly computedCache: Map<string, DomainType>;
  readonly computedInFlight: Set<string>;
};

const META_TYPE = objectType({
  actionName: { type: primitiveType("string"), optional: false },
  intentId: { type: primitiveType("string"), optional: false },
  timestamp: { type: primitiveType("number"), optional: false },
});

export function createInferenceContext(
  schema: DomainSchema,
  diagnostics: Diagnostic[],
  pluginName: string
): InferenceContext {
  return {
    schema,
    pluginName,
    diagnostics,
    warnedMessages: new Set(),
    computedCache: new Map(),
    computedInFlight: new Set(),
  };
}

export function inferComputedType(
  name: string,
  ctx: InferenceContext
): DomainType {
  if (ctx.computedCache.has(name)) {
    return ctx.computedCache.get(name) ?? unknownType();
  }

  const spec = ctx.schema.computed.fields[name];
  if (!spec) {
    warn(ctx, `Unknown computed field "${name}". Emitting "unknown".`);
    return unknownType();
  }

  if (ctx.computedInFlight.has(name)) {
    warn(ctx, `Recursive computed field "${name}" could not be inferred. Emitting "unknown".`);
    return unknownType();
  }

  ctx.computedInFlight.add(name);
  const inferred = inferExprType(spec.expr, ctx, new Map());
  ctx.computedInFlight.delete(name);
  ctx.computedCache.set(name, inferred);
  return inferred;
}

export function inferExprType(
  expr: ExprNode,
  ctx: InferenceContext,
  env: InferenceEnv = new Map()
): DomainType {
  switch (expr.kind) {
    case "lit":
      return literalValueToType(expr.value);

    case "get":
      return inferPathType(expr.path, ctx, env);

    case "eq":
    case "neq":
    case "gt":
    case "gte":
    case "lt":
    case "lte":
    case "and":
    case "or":
    case "not":
    case "startsWith":
    case "endsWith":
    case "strIncludes":
    case "includes":
    case "every":
    case "some":
    case "hasKey":
    case "isNull":
    case "toBoolean":
      return primitiveType("boolean");

    case "add":
    case "sub":
    case "mul":
    case "div":
    case "mod":
    case "min":
    case "max":
    case "abs":
    case "neg":
    case "floor":
    case "ceil":
    case "round":
    case "sqrt":
    case "pow":
    case "sumArray":
    case "strLen":
    case "len":
    case "indexOf":
    case "toNumber":
      return primitiveType("number");

    case "concat":
    case "substring":
    case "trim":
    case "toLowerCase":
    case "toUpperCase":
    case "replace":
    case "typeof":
    case "toString":
      return primitiveType("string");

    case "if":
      return unionOf([
        inferExprType(expr.then, ctx, env),
        inferExprType(expr.else, ctx, env),
      ]);

    case "split":
      return arrayType(primitiveType("string"));

    case "at":
      return unionOf([inferIndexedAccessType(expr.array, ctx, env), primitiveType("null")]);

    case "first":
    case "last":
    case "minArray":
    case "maxArray":
      return unionOf([inferCollectionElementType(expr.array, ctx, env), primitiveType("null")]);

    case "slice":
    case "reverse":
    case "unique":
      return inferArrayLikeType(expr.array, ctx, env);

    case "filter": {
      const elementType = inferCollectionElementType(expr.array, ctx, env);
      const nextEnv = withCollectionEnv(env, elementType);
      inferExprType(expr.predicate, ctx, nextEnv);
      return arrayType(elementType);
    }

    case "map": {
      const elementType = inferCollectionElementType(expr.array, ctx, env);
      const nextEnv = withCollectionEnv(env, elementType);
      return arrayType(inferExprType(expr.mapper, ctx, nextEnv));
    }

    case "find": {
      const elementType = inferCollectionElementType(expr.array, ctx, env);
      const nextEnv = withCollectionEnv(env, elementType);
      inferExprType(expr.predicate, ctx, nextEnv);
      return unionOf([elementType, primitiveType("null")]);
    }

    case "append": {
      const baseArray = inferArrayLikeType(expr.array, ctx, env);
      const baseElement = getArrayElementType(baseArray);
      const itemTypes = expr.items.map((item) => inferExprType(item, ctx, env));
      return arrayType(unionOf([baseElement, ...itemTypes]));
    }

    case "flat":
      return inferFlatType(expr.array, ctx, env);

    case "object": {
      const fields: Record<string, DomainTypeField> = {};
      for (const name of Object.keys(expr.fields)) {
        fields[name] = {
          type: inferExprType(expr.fields[name], ctx, env),
          optional: false,
        };
      }
      return objectType(fields);
    }

    case "field":
      return inferFieldType(inferExprType(expr.object, ctx, env), expr.property);

    case "keys":
      return arrayType(primitiveType("string"));

    case "values":
      return arrayType(inferObjectValueType(inferExprType(expr.obj, ctx, env)));

    case "entries":
      return arrayType(
        tupleType([
          primitiveType("string"),
          inferObjectValueType(inferExprType(expr.obj, ctx, env)),
        ])
      );

    case "merge":
      return inferMergeType(
        expr.objects.map((objectExpr) => inferExprType(objectExpr, ctx, env))
      );

    case "pick":
      return inferPickLikeType(expr.obj, expr.keys, false, ctx, env);

    case "omit":
      return inferPickLikeType(expr.obj, expr.keys, true, ctx, env);

    case "fromEntries":
      return inferFromEntriesType(expr.entries, ctx, env);

    case "coalesce": {
      const members = expr.args.flatMap((arg) =>
        removeNullType(inferExprType(arg, ctx, env))
      );
      return members.length === 0 ? primitiveType("null") : unionOf(members);
    }

    default:
      warn(ctx, `Unsupported expression kind "${(expr as { kind: string }).kind}". Emitting "unknown".`);
      return unknownType();
  }
}

function inferPathType(
  path: string,
  ctx: InferenceContext,
  env: InferenceEnv
): DomainType {
  const [head, ...tail] = path.split(".");
  if (!head) {
    warn(ctx, `Empty get() path encountered. Emitting "unknown".`);
    return unknownType();
  }

  let base: DomainType | undefined = env.get(head);

  if (!base) {
    if (head === "meta") {
      base = META_TYPE;
    } else if (Object.hasOwn(ctx.schema.state.fields, head)) {
      base = fieldSpecToDomainType(ctx.schema.state.fields[head]);
    } else if (Object.hasOwn(ctx.schema.computed.fields, head)) {
      base = inferComputedType(head, ctx);
    }
  }

  if (!base) {
    warn(ctx, `Unknown get() path "${path}". Emitting "unknown".`);
    return unknownType();
  }

  return walkPathType(base, tail);
}

function walkPathType(base: DomainType, segments: readonly string[]): DomainType {
  let current = base;
  for (const segment of segments) {
    current = accessSegmentType(current, segment);
  }
  return current;
}

function accessSegmentType(
  base: DomainType,
  segment: string
): DomainType {
  switch (base.kind) {
    case "object":
      return Object.hasOwn(base.fields, segment)
        ? base.fields[segment].type
        : unknownType();
    case "record":
      return unionOf([base.value, primitiveType("null")]);
    case "array":
      return isNumericSegment(segment)
        ? unionOf([base.element, primitiveType("null")])
        : unknownType();
    case "tuple":
      return isNumericSegment(segment)
        ? base.elements[Number(segment)] ?? unknownType()
        : unknownType();
    case "union":
      return unionIgnoringUnknown(
        base.types.map((member) => accessSegmentType(member, segment))
      );
    default:
      return unknownType();
  }
}

function inferIndexedAccessType(
  expr: ExprNode,
  ctx: InferenceContext,
  env: InferenceEnv
): DomainType {
  const base = inferExprType(expr, ctx, env);
  switch (base.kind) {
    case "array":
      return base.element;
    case "tuple":
      return unionOf(base.elements);
    case "record":
      return base.value;
    case "union":
      return unionOf(base.types.map((member) => inferIndexedAccessFromType(member)));
    default:
      return unknownType();
  }
}

function inferIndexedAccessFromType(type: DomainType): DomainType {
  switch (type.kind) {
    case "array":
      return type.element;
    case "tuple":
      return unionOf(type.elements);
    case "record":
      return type.value;
    default:
      return unknownType();
  }
}

function inferCollectionElementType(
  expr: ExprNode,
  ctx: InferenceContext,
  env: InferenceEnv
): DomainType {
  return getArrayElementType(inferExprType(expr, ctx, env));
}

function getArrayElementType(type: DomainType): DomainType {
  switch (type.kind) {
    case "array":
      return type.element;
    case "tuple":
      return unionOf(type.elements);
    case "union":
      return unionOf(type.types.map((member) => getArrayElementType(member)));
    default:
      return unknownType();
  }
}

function inferArrayLikeType(
  expr: ExprNode,
  ctx: InferenceContext,
  env: InferenceEnv
): DomainType {
  const inferred = inferExprType(expr, ctx, env);
  switch (inferred.kind) {
    case "array":
      return inferred;
    case "tuple":
      return arrayType(unionOf(inferred.elements));
    case "union": {
      const arrays = inferred.types
        .map((member) => inferArrayLikeFromType(member))
        .filter((member): member is DomainType => member.kind !== "unknown");
      return arrays.length === 0 ? arrayType(unknownType()) : unionOf(arrays);
    }
    default:
      return arrayType(unknownType());
  }
}

function inferArrayLikeFromType(type: DomainType): DomainType {
  switch (type.kind) {
    case "array":
      return type;
    case "tuple":
      return arrayType(unionOf(type.elements));
    default:
      return unknownType();
  }
}

function inferFlatType(
  expr: ExprNode,
  ctx: InferenceContext,
  env: InferenceEnv
): DomainType {
  const outer = inferArrayLikeType(expr, ctx, env);
  const outerElement = getArrayElementType(outer);

  switch (outerElement.kind) {
    case "array":
      return arrayType(outerElement.element);
    case "tuple":
      return arrayType(unionOf(outerElement.elements));
    case "union": {
      const flatMembers: DomainType[] = [];
      for (const member of outerElement.types) {
        if (member.kind === "array") {
          flatMembers.push(member.element);
          continue;
        }
        if (member.kind === "tuple") {
          flatMembers.push(unionOf(member.elements));
          continue;
        }
        flatMembers.push(member);
      }
      return arrayType(unionOf(flatMembers));
    }
    default:
      return arrayType(outerElement);
  }
}

function inferFieldType(base: DomainType, property: string): DomainType {
  switch (base.kind) {
    case "object":
      return Object.hasOwn(base.fields, property)
        ? base.fields[property].type
        : primitiveType("null");
    case "record":
      return unionOf([base.value, primitiveType("null")]);
    case "union":
      return unionOf(base.types.map((member) => inferFieldType(member, property)));
    default:
      return primitiveType("null");
  }
}

function inferObjectValueType(type: DomainType): DomainType {
  switch (type.kind) {
    case "object": {
      const values = Object.keys(type.fields).map((name) => type.fields[name].type);
      return values.length === 0 ? unknownType() : unionOf(values);
    }
    case "record":
      return type.value;
    case "union":
      return unionOf(type.types.map((member) => inferObjectValueType(member)));
    default:
      return unknownType();
  }
}

function inferMergeType(types: readonly DomainType[]): DomainType {
  const fields: Record<string, DomainTypeField> = {};
  let sawObject = false;

  for (const type of types) {
    if (type.kind !== "object") {
      continue;
    }
    sawObject = true;
    for (const name of Object.keys(type.fields)) {
      fields[name] = type.fields[name];
    }
  }

  return sawObject ? objectType(fields) : objectType({});
}

function inferPickLikeType(
  objectExpr: ExprNode,
  keysExpr: ExprNode,
  omit: boolean,
  ctx: InferenceContext,
  env: InferenceEnv
): DomainType {
  const base = inferExprType(objectExpr, ctx, env);
  if (base.kind !== "object") {
    return objectType({});
  }

  const keys = readStringArrayLiteral(keysExpr);
  if (!keys) {
    return base;
  }

  const selected = new Set(keys);
  const fields: Record<string, DomainTypeField> = {};

  for (const name of Object.keys(base.fields)) {
    const shouldInclude = omit ? !selected.has(name) : selected.has(name);
    if (shouldInclude) {
      fields[name] = base.fields[name];
    }
  }

  return objectType(fields);
}

function inferFromEntriesType(
  entriesExpr: ExprNode,
  ctx: InferenceContext,
  env: InferenceEnv
): DomainType {
  const literalEntries = readLiteralEntries(entriesExpr);
  if (literalEntries) {
    const valueTypes = literalEntries.map(([, value]) => literalValueToType(value));
    return recordType(primitiveType("string"), unionOf(valueTypes));
  }

  const entriesType = inferExprType(entriesExpr, ctx, env);
  const elementType = getArrayElementType(entriesType);

  if (elementType.kind === "tuple" && elementType.elements.length >= 2) {
    return recordType(primitiveType("string"), elementType.elements[1]);
  }

  return recordType(primitiveType("string"), unknownType());
}

function withCollectionEnv(
  env: InferenceEnv,
  itemType: DomainType
): Map<string, DomainType> {
  const next = new Map(env);
  next.set("$index", primitiveType("number"));
  next.set("$item", itemType);
  return next;
}

function readStringArrayLiteral(expr: ExprNode): string[] | null {
  if (expr.kind !== "lit" || !Array.isArray(expr.value)) {
    return null;
  }

  const values: string[] = [];
  for (const item of expr.value) {
    if (typeof item !== "string") {
      return null;
    }
    values.push(item);
  }
  return values;
}

function readLiteralEntries(
  expr: ExprNode
): Array<[string, unknown]> | null {
  if (expr.kind !== "lit" || !Array.isArray(expr.value)) {
    return null;
  }

  const entries: Array<[string, unknown]> = [];
  for (const item of expr.value) {
    if (!Array.isArray(item) || item.length !== 2 || typeof item[0] !== "string") {
      return null;
    }
    entries.push([item[0], item[1]]);
  }
  return entries;
}

function unionIgnoringUnknown(types: readonly DomainType[]): DomainType {
  const filtered = types.filter((type) => type.kind !== "unknown");
  return filtered.length === 0 ? unknownType() : unionOf(filtered);
}

function isNumericSegment(segment: string): boolean {
  return /^\d+$/.test(segment);
}

function warn(ctx: InferenceContext, message: string): void {
  if (ctx.warnedMessages.has(message)) {
    return;
  }
  ctx.warnedMessages.add(message);
  ctx.diagnostics.push({
    level: "warn",
    plugin: ctx.pluginName,
    message,
  });
}
