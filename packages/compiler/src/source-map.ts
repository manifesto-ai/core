import { createError, type Diagnostic } from "./diagnostics/types.js";
import type { DomainSchema } from "./generator/ir.js";
import type { ProgramNode, TypeExprNode } from "./parser/ast.js";
import type { LocalTargetKey } from "./annotations.js";

export interface SourcePoint {
  readonly line: number;
  readonly column: number;
  readonly offset?: number;
}

export interface SourceSpan {
  readonly start: SourcePoint;
  readonly end: SourcePoint;
}

export type SourceMapPath =
  | { readonly kind: "domain"; readonly domain: { readonly name: string } }
  | { readonly kind: "type"; readonly type: { readonly name: string } }
  | {
      readonly kind: "type_field";
      readonly type: { readonly name: string };
      readonly field: { readonly name: string };
    }
  | { readonly kind: "state_field"; readonly field: { readonly name: string } }
  | { readonly kind: "computed"; readonly computed: { readonly name: string } }
  | { readonly kind: "action"; readonly action: { readonly name: string } };

export interface SourceMapEntry {
  readonly target: SourceMapPath;
  readonly span: SourceSpan;
}

export interface SourceMapIndex {
  readonly schemaHash: string;
  readonly sourceHash: string;
  readonly format: "manifesto/source-map-v1";
  readonly coordinateUnit: "utf16" | "bytes";
  readonly emissionFingerprint: string;
  readonly entries: Record<LocalTargetKey, SourceMapEntry>;
}

export interface SourceMapEmissionContext {
  readonly coordinateUnit: "utf16" | "bytes";
  readonly compilerVersion: string;
  readonly emissionOptionsFingerprint: string;
}

export interface SourceMapExtractionResult {
  readonly sourceMap: SourceMapIndex;
  readonly diagnostics: Diagnostic[];
}

const DANGLING_TARGET_MESSAGE =
  "Source-map target does not map to the emitted DomainSchema.";
const MISSING_TARGET_MESSAGE =
  "Source-map entry missing for emitted DomainSchema target.";

type EntryMap = Map<LocalTargetKey, SourceMapEntry>;
type SourceSpanConverter = (location: ProgramNode["location"]) => SourceSpan;

const UTF8_ENCODER = new TextEncoder();

export function createDefaultSourceMapEmissionContext(
  compilerVersion: string,
): SourceMapEmissionContext {
  return Object.freeze({
    coordinateUnit: "utf16" as const,
    compilerVersion,
    emissionOptionsFingerprint: "default",
  });
}

export function extractSourceMap(
  program: ProgramNode,
  sourceText: string,
  schema: DomainSchema,
  ctx: SourceMapEmissionContext,
): SourceMapExtractionResult {
  const diagnostics: Diagnostic[] = [];
  const entries: EntryMap = new Map();
  const domain = program.domain;
  const toSpan = createSourceSpanConverter(sourceText, ctx.coordinateUnit);

  entries.set(
    `domain:${domain.name}`,
    freezeEntry({
      target: { kind: "domain", domain: { name: domain.name } },
      span: toSpan(domain.location),
    }),
  );

  for (const typeDecl of domain.types) {
    entries.set(
      `type:${typeDecl.name}`,
      freezeEntry({
        target: { kind: "type", type: { name: typeDecl.name } },
        span: toSpan(typeDecl.location),
      }),
    );
    collectTypeFieldEntries(typeDecl.typeExpr, typeDecl.name, 0, entries, toSpan);
  }

  for (const member of domain.members) {
    switch (member.kind) {
      case "state":
        for (const field of member.fields) {
          entries.set(
            `state_field:${field.name}`,
            freezeEntry({
              target: { kind: "state_field", field: { name: field.name } },
              span: toSpan(field.location),
            }),
          );
        }
        break;

      case "computed":
        entries.set(
          `computed:${member.name}`,
          freezeEntry({
            target: { kind: "computed", computed: { name: member.name } },
            span: toSpan(member.location),
          }),
        );
        break;

      case "action":
        entries.set(
          `action:${member.name}`,
          freezeEntry({
            target: { kind: "action", action: { name: member.name } },
            span: toSpan(member.location),
          }),
        );
        break;

      case "flow":
        break;
    }
  }

  const sortedEntries = {} as Record<LocalTargetKey, SourceMapEntry>;
  for (const key of [...entries.keys()].sort()) {
    if (!hasSchemaTarget(schema, key)) {
      diagnostics.push(
        createError(
          "E058",
          DANGLING_TARGET_MESSAGE,
          inferTargetLocation(program, key) ?? domain.location,
        ),
      );
      continue;
    }

    const entry = entries.get(key);
    if (entry) {
      sortedEntries[key] = entry;
    }
  }

  for (const key of expectedTargetKeys(program, schema)) {
    if (!Object.hasOwn(sortedEntries, key)) {
      diagnostics.push(
        createError(
          "E058",
          MISSING_TARGET_MESSAGE,
          inferTargetLocation(program, key) ?? domain.location,
        ),
      );
    }
  }

  return {
    sourceMap: Object.freeze({
      schemaHash: schema.hash,
      sourceHash: stableHashString(sourceText),
      format: "manifesto/source-map-v1",
      coordinateUnit: ctx.coordinateUnit,
      emissionFingerprint: stableHashString(
        `${ctx.coordinateUnit}\u0000${ctx.compilerVersion}\u0000${ctx.emissionOptionsFingerprint}`,
      ),
      entries: Object.freeze(sortedEntries),
    }),
    diagnostics,
  };
}

function collectTypeFieldEntries(
  typeExpr: TypeExprNode,
  typeName: string,
  depth: number,
  entries: EntryMap,
  toSpan: SourceSpanConverter,
): void {
  switch (typeExpr.kind) {
    case "objectType":
      for (const field of typeExpr.fields) {
        if (depth === 0) {
          entries.set(
            `type_field:${typeName}.${field.name}`,
            freezeEntry({
              target: {
                kind: "type_field",
                type: { name: typeName },
                field: { name: field.name },
              },
              span: toSpan(field.location),
            }),
          );
        }

        collectTypeFieldEntries(field.typeExpr, typeName, depth + 1, entries, toSpan);
      }
      return;

    case "arrayType":
      collectTypeFieldEntries(typeExpr.elementType, typeName, depth + 1, entries, toSpan);
      return;

    case "recordType":
      collectTypeFieldEntries(typeExpr.keyType, typeName, depth + 1, entries, toSpan);
      collectTypeFieldEntries(typeExpr.valueType, typeName, depth + 1, entries, toSpan);
      return;

    case "unionType":
      for (const member of typeExpr.types) {
        collectTypeFieldEntries(member, typeName, depth + 1, entries, toSpan);
      }
      return;

    case "simpleType":
    case "literalType":
      return;
  }
}

function expectedTargetKeys(
  program: ProgramNode,
  schema: DomainSchema,
): readonly LocalTargetKey[] {
  const keys = new Set<LocalTargetKey>();

  keys.add(`domain:${program.domain.name}`);

  for (const [typeName, typeSpec] of Object.entries(schema.types)) {
    keys.add(`type:${typeName}`);
    if (typeSpec.definition.kind === "object") {
      for (const fieldName of Object.keys(typeSpec.definition.fields)) {
        keys.add(`type_field:${typeName}.${fieldName}`);
      }
    }
  }

  for (const fieldName of Object.keys(schema.state.fields)) {
    keys.add(`state_field:${fieldName}`);
  }

  for (const computedName of Object.keys(schema.computed.fields)) {
    keys.add(`computed:${computedName}`);
  }

  for (const actionName of Object.keys(schema.actions)) {
    keys.add(`action:${actionName}`);
  }

  return [...keys].sort();
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

  switch (kind) {
    case "domain":
      return program.domain.name === name ? program.domain.location : null;

    case "type":
      return program.domain.types.find((typeDecl) => typeDecl.name === name)?.location ?? null;

    case "type_field": {
      const dotIndex = name.indexOf(".");
      if (dotIndex <= 0 || dotIndex !== name.lastIndexOf(".")) {
        return null;
      }

      const typeName = name.slice(0, dotIndex);
      const fieldName = name.slice(dotIndex + 1);
      const typeDecl = program.domain.types.find((candidate) => candidate.name === typeName);
      return typeDecl ? findTypeFieldLocation(typeDecl.typeExpr, fieldName, 0) : null;
    }

    case "state_field":
      for (const member of program.domain.members) {
        if (member.kind !== "state") {
          continue;
        }

        const field = member.fields.find((candidate) => candidate.name === name);
        if (field) {
          return field.location;
        }
      }
      return null;

    case "computed":
      return program.domain.members.find(
        (member) => member.kind === "computed" && member.name === name,
      )?.location ?? null;

    case "action":
      return program.domain.members.find(
        (member) => member.kind === "action" && member.name === name,
      )?.location ?? null;

    default:
      return null;
  }
}

function findTypeFieldLocation(
  typeExpr: TypeExprNode,
  fieldName: string,
  depth: number,
): ProgramNode["location"] | null {
  switch (typeExpr.kind) {
    case "objectType":
      for (const field of typeExpr.fields) {
        if (depth === 0 && field.name === fieldName) {
          return field.location;
        }

        const nested = findTypeFieldLocation(field.typeExpr, fieldName, depth + 1);
        if (nested) {
          return nested;
        }
      }
      return null;

    case "arrayType":
      return findTypeFieldLocation(typeExpr.elementType, fieldName, depth + 1);

    case "recordType":
      return (
        findTypeFieldLocation(typeExpr.keyType, fieldName, depth + 1)
        ?? findTypeFieldLocation(typeExpr.valueType, fieldName, depth + 1)
      );

    case "unionType":
      for (const member of typeExpr.types) {
        const nested = findTypeFieldLocation(member, fieldName, depth + 1);
        if (nested) {
          return nested;
        }
      }
      return null;

    case "simpleType":
    case "literalType":
      return null;
  }
}

function createSourceSpanConverter(
  sourceText: string,
  coordinateUnit: SourceMapEmissionContext["coordinateUnit"],
): SourceSpanConverter {
  if (coordinateUnit === "utf16") {
    return (location) => toUtf16SourceSpan(location);
  }

  return (location) => toByteSourceSpan(location, sourceText);
}

function toUtf16SourceSpan(location: ProgramNode["location"]): SourceSpan {
  return Object.freeze({
    start: Object.freeze({
      line: location.start.line,
      column: location.start.column,
    }),
    end: Object.freeze({
      line: location.end.line,
      column: location.end.column,
    }),
  });
}

function toByteSourceSpan(location: ProgramNode["location"], sourceText: string): SourceSpan {
  return Object.freeze({
    start: toByteSourcePoint(location.start, sourceText),
    end: toByteSourcePoint(location.end, sourceText),
  });
}

function toByteSourcePoint(
  position: ProgramNode["location"]["start"],
  sourceText: string,
): SourcePoint {
  const byteOffset = utf8ByteLength(sourceText.slice(0, position.offset));
  const lineStartOffset = position.offset - (position.column - 1);
  const lineStartByteOffset = utf8ByteLength(sourceText.slice(0, lineStartOffset));

  return Object.freeze({
    line: position.line,
    column: byteOffset - lineStartByteOffset + 1,
  });
}

function freezeEntry(entry: SourceMapEntry): SourceMapEntry {
  return Object.freeze({
    target: freezePath(entry.target),
    span: Object.freeze({
      start: Object.freeze({ ...entry.span.start }),
      end: Object.freeze({ ...entry.span.end }),
    }),
  });
}

function freezePath(path: SourceMapPath): SourceMapPath {
  switch (path.kind) {
    case "domain":
      return Object.freeze({
        kind: path.kind,
        domain: Object.freeze({ ...path.domain }),
      });

    case "type":
      return Object.freeze({
        kind: path.kind,
        type: Object.freeze({ ...path.type }),
      });

    case "type_field":
      return Object.freeze({
        kind: path.kind,
        type: Object.freeze({ ...path.type }),
        field: Object.freeze({ ...path.field }),
      });

    case "state_field":
      return Object.freeze({
        kind: path.kind,
        field: Object.freeze({ ...path.field }),
      });

    case "computed":
      return Object.freeze({
        kind: path.kind,
        computed: Object.freeze({ ...path.computed }),
      });

    case "action":
      return Object.freeze({
        kind: path.kind,
        action: Object.freeze({ ...path.action }),
      });
  }
}

function stableHashString(input: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}

function utf8ByteLength(input: string): number {
  return UTF8_ENCODER.encode(input).length;
}
