import type { FieldSpec } from "@manifesto-ai/core";

export type DomainPrimitive = "string" | "number" | "boolean" | "null";

export type DomainTypeField = {
  readonly type: DomainType;
  readonly optional: boolean;
};

export type DomainType =
  | { readonly kind: "unknown" }
  | { readonly kind: "primitive"; readonly type: DomainPrimitive }
  | { readonly kind: "literal"; readonly value: string | number | boolean | null }
  | { readonly kind: "array"; readonly element: DomainType }
  | { readonly kind: "tuple"; readonly elements: readonly DomainType[] }
  | { readonly kind: "object"; readonly fields: Readonly<Record<string, DomainTypeField>> }
  | { readonly kind: "record"; readonly key: DomainType; readonly value: DomainType }
  | { readonly kind: "union"; readonly types: readonly DomainType[] };

const UNKNOWN_TYPE: DomainType = { kind: "unknown" };
const NULL_TYPE: DomainType = { kind: "primitive", type: "null" };

export function unknownType(): DomainType {
  return UNKNOWN_TYPE;
}

export function primitiveType(type: DomainPrimitive): DomainType {
  return type === "null" ? NULL_TYPE : { kind: "primitive", type };
}

export function literalType(
  value: string | number | boolean | null
): DomainType {
  return value === null ? NULL_TYPE : { kind: "literal", value };
}

export function arrayType(element: DomainType): DomainType {
  return { kind: "array", element };
}

export function tupleType(elements: readonly DomainType[]): DomainType {
  return { kind: "tuple", elements };
}

export function objectType(fields: Record<string, DomainTypeField>): DomainType {
  return { kind: "object", fields };
}

export function recordType(key: DomainType, value: DomainType): DomainType {
  return { kind: "record", key, value };
}

export function fieldSpecToDomainField(spec: FieldSpec): DomainTypeField {
  return {
    type: fieldSpecToDomainType(spec),
    optional: !spec.required,
  };
}

export function fieldSpecToDomainType(spec: FieldSpec): DomainType {
  let base: DomainType;

  if (typeof spec.type === "object" && "enum" in spec.type) {
    base = unionOf(
      spec.type.enum.map((value) => literalValueToType(value))
    );
  } else {
    switch (spec.type) {
      case "string":
        base = primitiveType("string");
        break;
      case "number":
        base = primitiveType("number");
        break;
      case "boolean":
        base = primitiveType("boolean");
        break;
      case "null":
        base = NULL_TYPE;
        break;
      case "object":
        if (spec.fields) {
          const fields: Record<string, DomainTypeField> = {};
          for (const name of Object.keys(spec.fields)) {
            fields[name] = fieldSpecToDomainField(spec.fields[name]);
          }
          base = objectType(fields);
          break;
        }
        base = recordType(primitiveType("string"), unknownType());
        break;
      case "array":
        base = arrayType(
          spec.items ? fieldSpecToDomainType(spec.items) : unknownType()
        );
        break;
      default:
        base = unknownType();
        break;
    }
  }

  return spec.required ? base : unionOf([base, NULL_TYPE]);
}

export function literalValueToType(value: unknown): DomainType {
  if (value === null) {
    return NULL_TYPE;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return literalType(value);
  }

  if (Array.isArray(value)) {
    return arrayType(
      value.length === 0
        ? unknownType()
        : unionOf(value.map((item) => literalValueToType(item)))
    );
  }

  if (isPlainObject(value)) {
    const fields: Record<string, DomainTypeField> = {};
    for (const name of Object.keys(value)) {
      fields[name] = {
        type: literalValueToType(value[name]),
        optional: false,
      };
    }
    return objectType(fields);
  }

  return unknownType();
}

export function unionOf(types: readonly DomainType[]): DomainType {
  const flattened: DomainType[] = [];

  for (const type of types) {
    if (type.kind === "unknown") {
      return type;
    }
    if (type.kind === "union") {
      flattened.push(...type.types);
      continue;
    }
    flattened.push(type);
  }

  const unique = new Map<string, DomainType>();
  for (const type of flattened) {
    unique.set(stableTypeKey(type), type);
  }

  const deduped = Array.from(unique.values());
  if (deduped.length === 0) {
    return unknownType();
  }
  if (deduped.length === 1) {
    return deduped[0];
  }
  return { kind: "union", types: deduped };
}

export function removeNullType(type: DomainType): DomainType[] {
  switch (type.kind) {
    case "primitive":
      return type.type === "null" ? [] : [type];
    case "literal":
      return type.value === null ? [] : [type];
    case "union":
      return type.types.flatMap((member) => removeNullType(member));
    default:
      return [type];
  }
}

export function renderDomainType(type: DomainType): string {
  switch (type.kind) {
    case "unknown":
      return "unknown";
    case "primitive":
      return type.type;
    case "literal":
      return renderLiteral(type.value);
    case "array":
      return `${wrapArrayElement(renderDomainType(type.element), type.element)}[]`;
    case "tuple":
      return `[${type.elements.map((element) => renderDomainType(element)).join(", ")}]`;
    case "object": {
      const fieldNames = Object.keys(type.fields).sort();
      if (fieldNames.length === 0) {
        return "{}";
      }
      const parts = fieldNames.map((name) => {
        const field = type.fields[name];
        const optional = field.optional ? "?" : "";
        return `${name}${optional}: ${renderDomainType(field.type)}`;
      });
      return `{ ${parts.join("; ")} }`;
    }
    case "record":
      return `Record<${renderDomainType(type.key)}, ${renderDomainType(type.value)}>`;
    case "union":
      return type.types.map((member) => renderDomainType(member)).join(" | ");
  }
}

function wrapArrayElement(rendered: string, type: DomainType): string {
  if (type.kind === "union") {
    return `(${rendered})`;
  }
  return rendered;
}

function renderLiteral(value: string | number | boolean | null): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return String(value);
}

function stableTypeKey(type: DomainType): string {
  switch (type.kind) {
    case "unknown":
      return "unknown";
    case "primitive":
      return `primitive:${type.type}`;
    case "literal":
      return `literal:${JSON.stringify(type.value)}`;
    case "array":
      return `array:${stableTypeKey(type.element)}`;
    case "tuple":
      return `tuple:${type.elements.map((element) => stableTypeKey(element)).join(",")}`;
    case "object": {
      const keys = Object.keys(type.fields).sort();
      const fields = keys.map((name) => {
        const field = type.fields[name];
        return `${name}:${field.optional ? "?" : ""}${stableTypeKey(field.type)}`;
      });
      return `object:${fields.join(",")}`;
    }
    case "record":
      return `record:${stableTypeKey(type.key)}:${stableTypeKey(type.value)}`;
    case "union":
      return `union:${type.types.map((member) => stableTypeKey(member)).sort().join("|")}`;
  }
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
