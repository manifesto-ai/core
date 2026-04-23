import { createError, type Diagnostic } from "./diagnostics/types.js";
import type { DomainSchema } from "./generator/ir.js";
import type {
  ActionNode,
  AnnotationNode,
  ExprNode,
  ParamNode,
  ProgramNode,
  TypeExprNode,
} from "./parser/ast.js";
import type { SchemaGraph } from "./schema-graph.js";
import type { SourceMapIndex } from "./source-map.js";

export type JsonLiteral =
  | string
  | number
  | boolean
  | null
  | readonly JsonLiteral[]
  | { readonly [key: string]: JsonLiteral };

export interface Annotation {
  readonly tag: string;
  readonly payload?: JsonLiteral;
}

export type LocalTargetKey =
  | `domain:${string}`
  | `type:${string}`
  | `type_field:${string}.${string}`
  | `state_field:${string}`
  | `computed:${string}`
  | `action:${string}`;

export interface AnnotationIndex {
  readonly schemaHash: string;
  readonly entries: Record<LocalTargetKey, readonly Annotation[]>;
}

export interface DomainModule {
  readonly schema: DomainSchema;
  readonly graph: SchemaGraph;
  readonly annotations: AnnotationIndex;
  readonly sourceMap: SourceMapIndex;
}

export interface AnnotationExtractionResult {
  annotations: AnnotationIndex;
  diagnostics: Diagnostic[];
}

const INVALID_ATTACHMENT_MESSAGE =
  "@meta can attach only to domain, type, type field, state field, computed, or action declarations.";
const INVALID_PARAM_MESSAGE =
  "Action-parameter annotations are not part of the current MEL syntax.";
const INVALID_PAYLOAD_MESSAGE =
  "Annotation payloads must be JSON-like literals. MEL expressions are not allowed in @meta payloads.";
const PAYLOAD_DEPTH_MESSAGE =
  "Annotation payload nesting exceeds the current MEL limit of 2 levels.";
const DANGLING_TARGET_MESSAGE =
  "Annotation target does not map to the emitted DomainSchema.";
const MAX_PAYLOAD_DEPTH = 2;

type EntryMap = Map<LocalTargetKey, Annotation[]>;

export function buildAnnotationIndex(
  program: ProgramNode,
  schema: DomainSchema,
): AnnotationExtractionResult {
  const diagnostics: Diagnostic[] = [];
  const entries: EntryMap = new Map();
  const domain = program.domain;

  collectAnnotationsForTarget(domain.annotations, `domain:${domain.name}`, diagnostics, entries);

  for (const typeDecl of domain.types) {
    collectAnnotationsForTarget(typeDecl.annotations, `type:${typeDecl.name}`, diagnostics, entries);
    collectTypeFieldAnnotations(typeDecl.typeExpr, typeDecl.name, 0, diagnostics, entries);
  }

  for (const member of domain.members) {
    switch (member.kind) {
      case "state":
        for (const field of member.fields) {
          collectAnnotationsForTarget(field.annotations, `state_field:${field.name}`, diagnostics, entries);
          collectUnsupportedTypeFieldAnnotations(field.typeExpr, diagnostics);
        }
        break;

      case "computed":
        collectAnnotationsForTarget(member.annotations, `computed:${member.name}`, diagnostics, entries);
        break;

      case "action":
        collectAnnotationsForTarget(member.annotations, `action:${member.name}`, diagnostics, entries);
        collectActionParamAnnotationDiagnostics(member, diagnostics);
        for (const param of member.params) {
          collectUnsupportedTypeFieldAnnotations(param.typeExpr, diagnostics);
        }
        break;

      case "flow":
        break;
    }
  }

  const sortedEntries = {} as Record<LocalTargetKey, readonly Annotation[]>;
  for (const key of [...entries.keys()].sort()) {
    if (!hasSchemaTarget(schema, key)) {
      diagnostics.push(createError("E057", DANGLING_TARGET_MESSAGE, inferTargetLocation(program, key) ?? domain.location));
      continue;
    }
    const targetAnnotations = entries.get(key);
    if (targetAnnotations && targetAnnotations.length > 0) {
      sortedEntries[key] = Object.freeze(
        targetAnnotations.map((annotation) => freezeAnnotation(annotation)),
      );
    }
  }

  return {
    annotations: Object.freeze({
      schemaHash: schema.hash,
      entries: Object.freeze(sortedEntries),
    }),
    diagnostics,
  };
}

function collectAnnotationsForTarget(
  annotations: readonly AnnotationNode[] | undefined,
  targetKey: LocalTargetKey,
  diagnostics: Diagnostic[],
  entries: EntryMap,
): void {
  if (!annotations || annotations.length === 0) {
    return;
  }

  const emitted: Annotation[] = [];
  for (const annotation of annotations) {
    const payloadResult = annotation.payload === undefined
      ? { ok: true as const, value: undefined }
      : exprToJsonLiteral(annotation.payload, 0, diagnostics);

    if (!payloadResult.ok) {
      continue;
    }

    emitted.push({
      tag: annotation.tag,
      ...(payloadResult.value === undefined ? {} : { payload: payloadResult.value }),
    });
  }

  if (emitted.length === 0) {
    return;
  }

  const existing = entries.get(targetKey);
  if (existing) {
    existing.push(...emitted);
    return;
  }

  entries.set(targetKey, emitted);
}

function collectTypeFieldAnnotations(
  typeExpr: TypeExprNode,
  typeName: string,
  depth: number,
  diagnostics: Diagnostic[],
  entries: EntryMap,
): void {
  switch (typeExpr.kind) {
    case "objectType":
      for (const field of typeExpr.fields) {
        if (field.annotations?.length) {
          if (depth === 0) {
            collectAnnotationsForTarget(
              field.annotations,
              `type_field:${typeName}.${field.name}`,
              diagnostics,
              entries,
            );
          } else {
            pushInvalidAttachmentDiagnostics(field.annotations, diagnostics);
          }
        }
        collectTypeFieldAnnotations(field.typeExpr, typeName, depth + 1, diagnostics, entries);
      }
      return;

    case "arrayType":
      collectTypeFieldAnnotations(typeExpr.elementType, typeName, depth, diagnostics, entries);
      return;

    case "recordType":
      collectTypeFieldAnnotations(typeExpr.keyType, typeName, depth, diagnostics, entries);
      collectTypeFieldAnnotations(typeExpr.valueType, typeName, depth, diagnostics, entries);
      return;

    case "unionType":
      for (const member of typeExpr.types) {
        collectTypeFieldAnnotations(member, typeName, depth, diagnostics, entries);
      }
      return;

    case "simpleType":
    case "literalType":
      return;
  }
}

function collectUnsupportedTypeFieldAnnotations(
  typeExpr: TypeExprNode,
  diagnostics: Diagnostic[],
): void {
  switch (typeExpr.kind) {
    case "objectType":
      for (const field of typeExpr.fields) {
        pushInvalidAttachmentDiagnostics(field.annotations, diagnostics);
        collectUnsupportedTypeFieldAnnotations(field.typeExpr, diagnostics);
      }
      return;

    case "arrayType":
      collectUnsupportedTypeFieldAnnotations(typeExpr.elementType, diagnostics);
      return;

    case "recordType":
      collectUnsupportedTypeFieldAnnotations(typeExpr.keyType, diagnostics);
      collectUnsupportedTypeFieldAnnotations(typeExpr.valueType, diagnostics);
      return;

    case "unionType":
      for (const member of typeExpr.types) {
        collectUnsupportedTypeFieldAnnotations(member, diagnostics);
      }
      return;

    case "simpleType":
    case "literalType":
      return;
  }
}

function collectActionParamAnnotationDiagnostics(
  action: ActionNode,
  diagnostics: Diagnostic[],
): void {
  for (const param of action.params) {
    pushActionParamDiagnostics(param, diagnostics);
  }
}

function pushActionParamDiagnostics(
  param: ParamNode,
  diagnostics: Diagnostic[],
): void {
  if (!param.annotations) {
    return;
  }

  for (const annotation of param.annotations) {
    diagnostics.push(createError("E054", INVALID_PARAM_MESSAGE, annotation.location));
  }
}

function pushInvalidAttachmentDiagnostics(
  annotations: readonly AnnotationNode[] | undefined,
  diagnostics: Diagnostic[],
): void {
  if (!annotations) {
    return;
  }

  for (const annotation of annotations) {
    diagnostics.push(createError("E053", INVALID_ATTACHMENT_MESSAGE, annotation.location));
  }
}

function exprToJsonLiteral(
  expr: ExprNode,
  depth: number,
  diagnostics: Diagnostic[],
): { ok: true; value: JsonLiteral } | { ok: false } {
  switch (expr.kind) {
    case "literal":
      if (
        expr.literalType === "string"
        || expr.literalType === "number"
        || expr.literalType === "boolean"
        || expr.literalType === "null"
      ) {
        return { ok: true, value: expr.value as JsonLiteral };
      }
      diagnostics.push(createError("E055", INVALID_PAYLOAD_MESSAGE, expr.location));
      return { ok: false };

    case "arrayLiteral": {
      if (depth + 1 > MAX_PAYLOAD_DEPTH) {
        diagnostics.push(createError("E056", PAYLOAD_DEPTH_MESSAGE, expr.location));
        return { ok: false };
      }

      const elements: JsonLiteral[] = [];
      for (const element of expr.elements) {
        const result = exprToJsonLiteral(element, depth + 1, diagnostics);
        if (!result.ok) {
          return { ok: false };
        }
        elements.push(result.value);
      }

      return { ok: true, value: elements };
    }

    case "objectLiteral": {
      if (depth + 1 > MAX_PAYLOAD_DEPTH) {
        diagnostics.push(createError("E056", PAYLOAD_DEPTH_MESSAGE, expr.location));
        return { ok: false };
      }

      const objectValue: Record<string, JsonLiteral> = {};
      for (const property of expr.properties) {
        if (property.kind !== "objectProperty") {
          diagnostics.push(createError("E055", INVALID_PAYLOAD_MESSAGE, property.location));
          return { ok: false };
        }
        const result = exprToJsonLiteral(property.value, depth + 1, diagnostics);
        if (!result.ok) {
          return { ok: false };
        }
        objectValue[property.key] = result.value;
      }

      return { ok: true, value: objectValue };
    }

    default:
      diagnostics.push(createError("E055", INVALID_PAYLOAD_MESSAGE, expr.location));
      return { ok: false };
  }
}

function freezeAnnotation(annotation: Annotation): Annotation {
  if (annotation.payload === undefined) {
    return Object.freeze({ tag: annotation.tag });
  }

  return Object.freeze({
    tag: annotation.tag,
    payload: freezeJsonLiteral(annotation.payload),
  });
}

function freezeJsonLiteral(value: JsonLiteral): JsonLiteral {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => freezeJsonLiteral(entry)));
  }

  if (value !== null && typeof value === "object") {
    const frozenObject: Record<string, JsonLiteral> = {};
    for (const [key, entry] of Object.entries(value)) {
      frozenObject[key] = freezeJsonLiteral(entry);
    }
    return Object.freeze(frozenObject);
  }

  return value;
}

function hasSchemaTarget(schema: DomainSchema, targetKey: LocalTargetKey): boolean {
  const separator = targetKey.indexOf(":");
  if (separator < 0) {
    return false;
  }

  const kind = targetKey.slice(0, separator);
  const name = targetKey.slice(separator + 1);

  switch (kind) {
    case "domain":
      return schema.meta?.name === name || schema.id === `mel:${name.toLowerCase()}`;

    case "type":
      return Object.hasOwn(schema.types, name);

    case "type_field": {
      const dotIndex = name.indexOf(".");
      if (dotIndex <= 0 || dotIndex !== name.lastIndexOf(".")) {
        return false;
      }

      const typeName = name.slice(0, dotIndex);
      const fieldName = name.slice(dotIndex + 1);
      const typeSpec = schema.types[typeName];
      if (!typeSpec || typeSpec.definition.kind !== "object") {
        return false;
      }

      return Object.hasOwn(typeSpec.definition.fields, fieldName);
    }

    case "state_field":
      return Object.hasOwn(schema.state.fields, name);

    case "computed":
      return Object.hasOwn(schema.computed.fields, name);

    case "action":
      return Object.hasOwn(schema.actions, name);

    default:
      return false;
  }
}

function inferTargetLocation(
  program: ProgramNode,
  targetKey: LocalTargetKey,
): ProgramNode["location"] | null {
  const separator = targetKey.indexOf(":");
  if (separator < 0) {
    return null;
  }

  const kind = targetKey.slice(0, separator);
  const name = targetKey.slice(separator + 1);
  const domain = program.domain;

  if (kind === "domain" && domain.name === name) {
    return domain.location;
  }

  if (kind === "type") {
    return domain.types.find((typeDecl) => typeDecl.name === name)?.location ?? null;
  }

  if (kind === "type_field") {
    const dotIndex = name.indexOf(".");
    if (dotIndex <= 0) {
      return null;
    }
    const typeName = name.slice(0, dotIndex);
    const fieldName = name.slice(dotIndex + 1);
    const typeDecl = domain.types.find((candidate) => candidate.name === typeName);
    if (!typeDecl || typeDecl.typeExpr.kind !== "objectType") {
      return typeDecl?.location ?? null;
    }
    return typeDecl.typeExpr.fields.find((field) => field.name === fieldName)?.location ?? typeDecl.location;
  }

  if (kind === "state_field") {
    for (const member of domain.members) {
      if (member.kind !== "state") continue;
      const field = member.fields.find((candidate) => candidate.name === name);
      if (field) return field.location;
    }
    return null;
  }

  if (kind === "computed") {
    return domain.members.find((member) => member.kind === "computed" && member.name === name)?.location ?? null;
  }

  if (kind === "action") {
    return domain.members.find((member) => member.kind === "action" && member.name === name)?.location ?? null;
  }

  return null;
}
