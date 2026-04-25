import type { JsonLiteral, LocalTargetKey } from "../annotations.js";
import type { DomainSchema } from "../generator/ir.js";
import { tokenize, type Token } from "../lexer/index.js";
import type {
  ActionNode,
  ComputedNode,
  ProgramNode,
  StateFieldNode,
  TypeDeclNode,
  TypeFieldNode,
} from "../parser/index.js";
import { stableHashString, type SourcePoint, type SourceSpan } from "../source-map.js";
import { compareUnicodeCodePoints } from "../utils/unicode-order.js";
import type { MelEditAddActionOp, MelTextEdit, SchemaDiff, SchemaModifiedTarget } from "./compile-fragment-types.js";
import { targetKind } from "./compile-fragment-validation.js";

export function findAction(program: ProgramNode, name: string): ActionNode | null {
  const member = program.domain.members.find((candidate) => candidate.kind === "action" && candidate.name === name);
  return member?.kind === "action" ? member : null;
}

export function findComputed(program: ProgramNode, name: string): ComputedNode | null {
  const member = program.domain.members.find((candidate) => candidate.kind === "computed" && candidate.name === name);
  return member?.kind === "computed" ? member : null;
}

export function findStateField(program: ProgramNode, name: string): StateFieldNode | null {
  for (const member of program.domain.members) {
    if (member.kind === "state") {
      const field = member.fields.find((candidate) => candidate.name === name);
      if (field) return field;
    }
  }
  return null;
}

export function findTypeDecl(program: ProgramNode, name: string): TypeDeclNode | null {
  return program.domain.types.find((candidate) => candidate.name === name) ?? null;
}

export function findTypeField(program: ProgramNode, typeName: string, fieldName: string): TypeFieldNode | null {
  const typeDecl = findTypeDecl(program, typeName);
  if (!typeDecl || typeDecl.typeExpr.kind !== "objectType") {
    return null;
  }
  return typeDecl.typeExpr.fields.find((field) => field.name === fieldName) ?? null;
}

export function parseTypeFieldTarget(target: `type_field:${string}.${string}`): { typeName: string; fieldName: string } | null {
  const value = target.slice("type_field:".length);
  const dot = value.indexOf(".");
  if (dot <= 0 || dot !== value.lastIndexOf(".")) {
    return null;
  }
  return { typeName: value.slice(0, dot), fieldName: value.slice(dot + 1) };
}

export function targetLocation(program: ProgramNode, target: LocalTargetKey): ProgramNode["location"] {
  const kind = targetKind(target);
  const name = target.slice(target.indexOf(":") + 1);
  if (kind === "type") return findTypeDecl(program, name)?.location ?? program.domain.location;
  if (kind === "state_field") return findStateField(program, name)?.location ?? program.domain.location;
  if (kind === "computed") return findComputed(program, name)?.location ?? program.domain.location;
  if (kind === "action") return findAction(program, name)?.location ?? program.domain.location;
  if (kind === "type_field") {
    const parsed = parseTypeFieldTarget(target as `type_field:${string}.${string}`);
    return parsed ? findTypeField(program, parsed.typeName, parsed.fieldName)?.location ?? program.domain.location : program.domain.location;
  }
  return program.domain.location;
}

export function findActionBodyBraces(source: string, action: ActionNode): { open: Token; close: Token } | null {
  const tokens = tokenize(source).tokens.filter((token) =>
    token.location.start.offset >= action.location.start.offset
    && token.location.end.offset <= action.location.end.offset
    && token.kind !== "EOF");
  const stack: Token[] = [];
  for (const token of tokens) {
    if (token.kind === "LBRACE") {
      stack.push(token);
    } else if (token.kind === "RBRACE") {
      const open = stack.pop();
      if (open && token.location.end.offset === action.location.end.offset) {
        return { open, close: token };
      }
    }
  }
  return null;
}

export function findActionToken(source: string, action: ActionNode, kind: Token["kind"]): Token | null {
  return tokenize(source).tokens.find((token) =>
    token.kind === kind
    && token.location.start.offset >= action.location.start.offset
    && token.location.end.offset <= action.location.end.offset) ?? null;
}

export function insertBeforeClosingLine(source: string, closeOffset: number, text: string): MelTextEdit {
  const lineStart = lineStartAt(source, closeOffset);
  const beforeCloseOnLine = source.slice(lineStart, closeOffset);
  if (/^[ \t]*$/.test(beforeCloseOnLine) && lineStart > 0) {
    return textEdit(source, lineStart, lineStart, `${text}\n`);
  }

  const closeIndent = beforeCloseOnLine.match(/^[ \t]*/)?.[0] ?? "";
  return textEdit(source, closeOffset, closeOffset, `\n${text}\n${closeIndent}`);
}

export function textEdit(source: string, start: number, end: number, replacement: string): MelTextEdit {
  return Object.freeze({
    range: spanFromOffsets(source, start, end),
    replacement,
  });
}

export function applyTextEdits(source: string, edits: readonly MelTextEdit[]): string {
  const sorted = [...edits].sort((a, b) => requiredOffset(a.range.start) - requiredOffset(b.range.start));
  let result = source;
  for (const edit of sorted.reverse()) {
    result = `${result.slice(0, requiredOffset(edit.range.start))}${edit.replacement}${result.slice(requiredOffset(edit.range.end))}`;
  }
  return result;
}

export function requiredOffset(point: SourcePoint): number {
  if (point.offset === undefined) {
    throw new Error("MelTextEdit range is missing offset.");
  }
  return point.offset;
}

export function lineIndentAt(source: string, offset: number): string {
  const lineStart = lineStartAt(source, offset);
  return source.slice(lineStart, offset).match(/^[ \t]*/)?.[0] ?? "";
}

export function indentLines(source: string, indent: string): string {
  return source
    .split(/\r?\n/)
    .map((line) => line.length > 0 ? `${indent}${line}` : line)
    .join("\n");
}

export function renderAction(op: MelEditAddActionOp): string {
  const params = op.params.map((param) => `${param.name}: ${param.type}`).join(", ");
  const body = indentLines(op.body.trim(), "  ");
  if (body.length === 0) {
    return `action ${op.name}(${params}) {\n}`;
  }
  return `action ${op.name}(${params}) {\n${body}\n}`;
}

export function renderBodyReplacement(body: string, bodyIndent: string, actionIndent: string): string {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return "";
  }
  return `\n${indentLines(trimmed, bodyIndent)}\n${actionIndent}`;
}

export function renderJsonLiteral(value: JsonLiteral): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map((item) => renderJsonLiteral(item)).join(", ")}]`;
  const objectValue = value as { readonly [key: string]: JsonLiteral };
  return `{ ${Object.keys(objectValue).sort(compareUnicodeCodePoints).map((key) => `${key}: ${renderJsonLiteral(objectValue[key]!)}`).join(", ")} }`;
}

export function diffSchemas(before: DomainSchema, after: DomainSchema): SchemaDiff {
  const beforeTargets = schemaTargetSummaries(before);
  const afterTargets = schemaTargetSummaries(after);
  const keys = sortTargets([...new Set([...Object.keys(beforeTargets), ...Object.keys(afterTargets)])] as LocalTargetKey[]);
  const addedTargets: LocalTargetKey[] = [];
  const removedTargets: LocalTargetKey[] = [];
  const modifiedTargets: SchemaModifiedTarget[] = [];

  for (const key of keys) {
    const beforeValue = beforeTargets[key];
    const afterValue = afterTargets[key];
    if (beforeValue === undefined && afterValue !== undefined) {
      addedTargets.push(key);
    } else if (beforeValue !== undefined && afterValue === undefined) {
      removedTargets.push(key);
    } else if (beforeValue !== undefined && afterValue !== undefined) {
      const beforeHash = hashSummary(beforeValue);
      const afterHash = hashSummary(afterValue);
      if (beforeHash !== afterHash) {
        modifiedTargets.push({ target: key, beforeHash, afterHash, before: beforeValue, after: afterValue });
      }
    }
  }

  return { addedTargets, removedTargets, modifiedTargets };
}

export function sortTargets(targets: readonly LocalTargetKey[]): LocalTargetKey[] {
  return [...new Set(targets)].sort(compareUnicodeCodePoints);
}

export function isEditObject(value: unknown): value is { readonly kind: string } {
  return value !== null && typeof value === "object" && !Array.isArray(value) && "kind" in value;
}

export function describeUnknown(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function spanFromOffsets(source: string, start: number, end: number): SourceSpan {
  return Object.freeze({
    start: Object.freeze(pointAt(source, start)),
    end: Object.freeze(pointAt(source, end)),
  });
}

function pointAt(source: string, offset: number): SourcePoint {
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < offset; index += 1) {
    if (source[index] === "\n") {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, column: offset - lineStart + 1, offset };
}

function lineStartAt(source: string, offset: number): number {
  return source.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
}

function schemaTargetSummaries(schema: DomainSchema): Partial<Record<LocalTargetKey, unknown>> {
  const targets: Partial<Record<LocalTargetKey, unknown>> = {};
  for (const [name, value] of Object.entries(schema.types)) {
    targets[`type:${name}`] = value;
    if (value.definition.kind === "object") {
      for (const [fieldName, field] of Object.entries(value.definition.fields)) {
        targets[`type_field:${name}.${fieldName}`] = field;
      }
    }
  }
  for (const [name, value] of Object.entries(schema.state.fields)) targets[`state_field:${name}`] = value;
  for (const [name, value] of Object.entries(schema.computed.fields)) targets[`computed:${name}`] = value;
  for (const [name, value] of Object.entries(schema.actions)) targets[`action:${name}`] = value;
  return targets;
}

function hashSummary(value: unknown): string {
  return stableHashString(stableStringify(value));
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => compareUnicodeCodePoints(a, b));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
}
