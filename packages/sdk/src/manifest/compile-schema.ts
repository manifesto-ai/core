import {
  compileMelModule,
  parse as parseMel,
  tokenize as tokenizeMel,
  type AnnotationIndex,
} from "@manifesto-ai/compiler";
import {
  hashSchemaSync,
  type DomainSchema,
} from "@manifesto-ai/core";

import {
  CompileError,
  ManifestoError,
} from "../errors.js";
import type {
  ActionParamMetadata,
  ActionAnnotationMap,
  ActionSingleParamObjectValueMetadata,
  CompiledSchema,
} from "./shared.js";

export function compileSchema(source: string): CompiledSchema {
  const result = compileMelModule(source, { mode: "module" });

  if (result.errors.length > 0) {
    const formatted = result.errors.map((diagnostic) => {
      const loc = diagnostic.location;
      if (!loc || (loc.start.line === 0 && loc.start.column === 0)) {
        return `[${diagnostic.code}] ${diagnostic.message}`;
      }

      const header = `[${diagnostic.code}] ${diagnostic.message} (${loc.start.line}:${loc.start.column})`;
      const line = source.split("\n")[loc.start.line - 1];
      if (!line) {
        return header;
      }

      const lineNum = String(loc.start.line).padStart(4, " ");
      const underlineLen = Math.max(
        1,
        loc.end.line === loc.start.line
          ? Math.min(loc.end.column - loc.start.column, Math.max(1, line.length - loc.start.column + 1))
          : 1,
      );
      const padding = " ".repeat(lineNum.length + 3 + loc.start.column - 1);
      return `${header}\n${lineNum} | ${line}\n${padding}${"^".repeat(underlineLen)}`;
    }).join("\n\n");

    throw new CompileError(result.errors, `MEL compilation failed:\n${formatted}`);
  }

  if (!result.module) {
    throw new ManifestoError("COMPILE_ERROR", "MEL compilation produced no schema");
  }

  const schema = result.module.schema as DomainSchema;
  return {
    schema,
    actionParamMetadata: deriveActionParamMetadata(
      schema,
      extractActionParamOrderFromMel(source),
    ),
    actionSingleParamObjectValueMetadata: deriveSingleParamObjectValueMetadata(schema),
    actionAnnotations: deriveActionAnnotations(result.module.annotations),
  };
}

export function deriveActionAnnotations(
  annotations?: AnnotationIndex | null,
): ActionAnnotationMap {
  if (!annotations) {
    return Object.freeze({});
  }

  return Object.freeze(Object.fromEntries(
    Object.entries(annotations.entries)
      .filter(([target]) => target.startsWith("action:"))
      .map(([target, entries]) => {
        const actionName = target.slice("action:".length);
        return [actionName, Object.freeze(Object.fromEntries(
          entries.map((entry) => [entry.tag, entry.payload ?? true]),
        ))];
      }),
  ));
}

export function deriveActionParamMetadata(
  schema: DomainSchema,
  actionParamOrder?: Readonly<Record<string, readonly string[]>>,
): Readonly<Record<string, ActionParamMetadata>> {
  return Object.freeze(Object.fromEntries(
    (Object.entries(schema.actions) as [string, DomainSchema["actions"][string]][]).map(([name, action]) => {
      const preferredOrder = actionParamOrder?.[name];
      if (preferredOrder && preferredOrder.length > 0) {
        return [name, Object.freeze([...preferredOrder])];
      }

      if (action.params && action.params.length > 0) {
        const params = Object.freeze([...action.params]);
        return [name, params];
      }

      if (!action.input || action.input.type !== "object" || !action.input.fields) {
        return [name, []];
      }

      const fieldNames = getActionParamNames(action.input);
      return [name, fieldNames.length <= 1 ? fieldNames : null];
    }),
  ));
}

export function deriveSingleParamObjectValueMetadata(
  schema: DomainSchema,
): Readonly<Record<string, ActionSingleParamObjectValueMetadata>> {
  return Object.freeze(Object.fromEntries(
    (Object.entries(schema.actions) as [string, DomainSchema["actions"][string]][])
      .map(([name, action]) => [name, isSingleParamObjectValued(schema, action)]),
  ));
}

function getActionParamNames(input: DomainSchema["actions"][string]["input"]): readonly string[] {
  if (!input || input.type !== "object" || !input.fields) {
    return [];
  }

  return Object.keys(input.fields);
}

function isSingleParamObjectValued(
  schema: DomainSchema,
  action: DomainSchema["actions"][string],
): boolean {
  if (action.params?.length === 1 && action.inputType) {
    const fieldType = getObjectFieldTypeDefinition(
      action.inputType,
      action.params[0] ?? "",
      schema.types,
    );
    return fieldType ? isPlainObjectLikeTypeDefinition(fieldType, schema.types) : false;
  }

  if (
    action.input?.type === "object"
    && action.input.fields
    && Object.keys(action.input.fields).length === 1
  ) {
    const [fieldName] = Object.keys(action.input.fields);
    const field = fieldName ? action.input.fields[fieldName] : undefined;
    return field?.type === "object";
  }

  return false;
}

function getObjectFieldTypeDefinition(
  definition: DomainSchema["types"][string]["definition"],
  fieldName: string,
  types: DomainSchema["types"],
  seenRefs: readonly string[] = [],
): DomainSchema["types"][string]["definition"] | null {
  if (definition.kind === "ref") {
    if (seenRefs.includes(definition.name)) {
      return null;
    }

    const next = types[definition.name];
    return next
      ? getObjectFieldTypeDefinition(next.definition, fieldName, types, [...seenRefs, definition.name])
      : null;
  }

  if (definition.kind === "union") {
    const nonNullTypes = definition.types.filter((candidate: typeof definition.types[number]) =>
      !isNullLikeTypeDefinition(candidate, types, seenRefs)
    );
    return nonNullTypes.length === 1
      ? getObjectFieldTypeDefinition(nonNullTypes[0], fieldName, types, seenRefs)
      : null;
  }

  if (definition.kind !== "object") {
    return null;
  }

  return definition.fields[fieldName]?.type ?? null;
}

function isPlainObjectLikeTypeDefinition(
  definition: DomainSchema["types"][string]["definition"],
  types: DomainSchema["types"],
  seenRefs: readonly string[] = [],
): boolean {
  if (definition.kind === "ref") {
    if (seenRefs.includes(definition.name)) {
      return false;
    }

    const next = types[definition.name];
    return next
      ? isPlainObjectLikeTypeDefinition(next.definition, types, [...seenRefs, definition.name])
      : false;
  }

  if (definition.kind === "union") {
    const nonNullTypes = definition.types.filter((candidate: typeof definition.types[number]) =>
      !isNullLikeTypeDefinition(candidate, types, seenRefs)
    );
    return nonNullTypes.length === 1
      ? isPlainObjectLikeTypeDefinition(nonNullTypes[0], types, seenRefs)
      : false;
  }

  return (
    definition.kind === "object"
    || definition.kind === "record"
    || (definition.kind === "primitive" && definition.type === "object")
  );
}

function isNullLikeTypeDefinition(
  definition: DomainSchema["types"][string]["definition"],
  types: DomainSchema["types"],
  seenRefs: readonly string[] = [],
): boolean {
  if (definition.kind === "ref") {
    if (seenRefs.includes(definition.name)) {
      return false;
    }

    const next = types[definition.name];
    return next
      ? isNullLikeTypeDefinition(next.definition, types, [...seenRefs, definition.name])
      : false;
  }

  return (
    (definition.kind === "primitive" && definition.type === "null")
    || (definition.kind === "literal" && definition.value === null)
  );
}

function extractActionParamOrderFromMel(
  source: string,
): Readonly<Record<string, readonly string[]>> | undefined {
  const lexed = tokenizeMel(source);
  if (lexed.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return undefined;
  }

  const parsed = parseMel(lexed.tokens);
  if (!parsed.program) {
    return undefined;
  }

  return Object.freeze(Object.fromEntries(
    parsed.program.domain.members
      .filter((member) => member.kind === "action")
      .map((action) => [action.name, Object.freeze(action.params.map((param) => param.name))]),
  ));
}
