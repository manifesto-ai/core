import type { TypeDefinition } from "@manifesto-ai/core";
import type { Diagnostic } from "../types.js";
import {
  arrayType,
  literalType,
  objectType,
  primitiveType,
  recordType,
  refType,
  unionOf,
  unknownType,
  type DomainPrimitive,
  type DomainType,
  type DomainTypeField,
} from "./domain-type-model.js";

export type TypeDefinitionDiagnosticOptions = {
  readonly diagnostics?: Diagnostic[];
  readonly plugin?: string;
  readonly path?: string;
  readonly resolveRef?: (name: string) => boolean;
};

export function typeDefinitionToDomainType(
  def: TypeDefinition,
  options: TypeDefinitionDiagnosticOptions = {}
): DomainType {
  switch (def.kind) {
    case "primitive":
      if (isDomainPrimitive(def.type)) {
        return primitiveType(def.type);
      }
      if (def.type === "object") {
        return recordType(primitiveType("string"), unknownType());
      }
      if (def.type === "array") {
        return arrayType(unknownType());
      }
      warnUnknownTypeDefinition(
        options,
        `Unsupported TypeDefinition primitive "${def.type}". Emitting "unknown".`
      );
      return unknownType();
    case "literal":
      return literalType(def.value);
    case "array":
      return arrayType(
        typeDefinitionToDomainType(def.element, childOptions(options, "element"))
      );
    case "record":
      return recordType(
        typeDefinitionToDomainType(def.key, childOptions(options, "key")),
        typeDefinitionToDomainType(def.value, childOptions(options, "value"))
      );
    case "object": {
      const fields: Record<string, DomainTypeField> = {};
      for (const name of Object.keys(def.fields)) {
        const field = def.fields[name];
        fields[name] = {
          type: typeDefinitionToDomainType(
            field.type,
            childOptions(options, `fields.${name}`)
          ),
          optional: field.optional,
        };
      }
      return objectType(fields);
    }
    case "union":
      return unionOf(
        def.types.map((type, index) =>
          typeDefinitionToDomainType(
            type,
            childOptions(options, `types.${index}`)
          )
        )
      );
    case "ref":
      if (options.resolveRef && !options.resolveRef(def.name)) {
        warnUnknownTypeDefinition(
          options,
          `Unresolved TypeDefinition ref "${def.name}". Emitting "unknown".`
        );
        return unknownType();
      }
      return refType(def.name);
    default: {
      const unknownKind = (def as { readonly kind?: unknown }).kind;
      warnUnknownTypeDefinition(
        options,
        `Unknown TypeDefinition kind "${String(unknownKind)}". Emitting "unknown".`
      );
      return unknownType();
    }
  }
}

function isDomainPrimitive(value: string): value is DomainPrimitive {
  return value === "string"
    || value === "number"
    || value === "boolean"
    || value === "null";
}

function childOptions(
  options: TypeDefinitionDiagnosticOptions,
  segment: string
): TypeDefinitionDiagnosticOptions {
  if (!options.path) {
    return { ...options, path: segment };
  }
  return { ...options, path: `${options.path}.${segment}` };
}

function warnUnknownTypeDefinition(
  options: TypeDefinitionDiagnosticOptions,
  message: string
): void {
  if (!options.diagnostics || !options.plugin) {
    return;
  }

  options.diagnostics.push({
    level: "warn",
    plugin: options.plugin,
    message: options.path ? `${message} Path: ${options.path}.` : message,
  });
}
