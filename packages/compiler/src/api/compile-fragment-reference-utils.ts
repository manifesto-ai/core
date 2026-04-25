import type { LocalTargetKey } from "../annotations.js";
import type { SourceLocation } from "../lexer/source-location.js";
import { tokenize } from "../lexer/index.js";
import type {
  ActionNode,
  AnnotationNode,
  ComputedNode,
  ProgramNode,
  StateFieldNode,
  TypeDeclNode,
  TypeFieldNode,
} from "../parser/index.js";
import {
  findAction,
  findComputed,
  findStateField,
  findTypeDecl,
  findTypeField,
  parseTypeFieldTarget,
  requiredOffset,
  sortTargets,
  textEdit,
} from "./compile-fragment-source-utils.js";
import { collectTargetReferences } from "./compile-fragment-reference-collector.js";
import type {
  DeclarationEditFailureCode,
  DeclarationEditPlan,
  OffsetRange,
  TargetInfo,
} from "./compile-fragment-reference-types.js";
import { targetKind } from "./compile-fragment-validation.js";

type DeclarationTarget = {
  readonly info: TargetInfo;
  readonly node: TypeDeclNode | StateFieldNode | ComputedNode | ActionNode | TypeFieldNode;
  readonly range: OffsetRange;
  readonly nameRange: OffsetRange;
  readonly affectedTargets: readonly LocalTargetKey[];
};

export function planRemoveDeclaration(
  source: string,
  program: ProgramNode,
  target: LocalTargetKey,
): DeclarationEditPlan {
  const declaration = findDeclarationTarget(source, program, target);
  if (!declaration) {
    return targetFailure(program, "E_TARGET_NOT_FOUND", `Target ${target} does not exist.`);
  }

  const removalRange = expandRemovalRange(source, declaration.range, declaration.info.kind === "type_field");
  const references = collectTargetReferences(source, program, declaration.info, removalRange);
  if (references.length > 0) {
    return targetFailureAt(
      references[0]!.location,
      "E_REMOVE_BLOCKED_BY_REFERENCES",
      "removeDeclaration is blocked because references to the target remain.",
    );
  }

  return {
    ok: true,
    edits: [textEdit(source, removalRange.start, removalRange.end, "")],
    changedTargets: declaration.affectedTargets,
  };
}

export function planRenameDeclaration(
  source: string,
  program: ProgramNode,
  target: LocalTargetKey,
  newName: string,
): DeclarationEditPlan {
  const declaration = findDeclarationTarget(source, program, target);
  if (!declaration) {
    return targetFailure(program, "E_TARGET_NOT_FOUND", `Target ${target} does not exist.`);
  }

  const oldName = targetName(declaration.info);
  if (oldName === newName) {
    return targetFailureAt(
      declaration.node.location,
      "E_FRAGMENT_SCOPE_VIOLATION",
      "renameDeclaration newName must differ from the current declaration name.",
    );
  }

  const references = collectTargetReferences(source, program, declaration.info);
  const blocked = references.filter((reference) => !reference.rewrite);
  if (blocked.length > 0) {
    return targetFailureAt(
      blocked[0]!.location,
      "E_UNSAFE_RENAME_AMBIGUOUS",
      "renameDeclaration is blocked because at least one reference cannot be rewritten safely.",
    );
  }

  const ranges = dedupeRanges([declaration.nameRange, ...references.map((reference) => reference.range)]);
  return {
    ok: true,
    edits: ranges.map((range) => textEdit(source, range.start, range.end, newName)),
    changedTargets: renamedTargets(program, declaration, newName),
  };
}

function findDeclarationTarget(
  source: string,
  program: ProgramNode,
  target: LocalTargetKey,
): DeclarationTarget | null {
  const kind = targetKind(target);
  if (kind === "type") {
    const name = target.slice("type:".length);
    const node = findTypeDecl(program, name);
    if (!node) return null;
    return declarationTarget(source, program, { kind, name }, node, node.annotations, findKeywordNameRange(source, node.location, "TYPE", name));
  }
  if (kind === "state_field") {
    const name = target.slice("state_field:".length);
    const node = findStateField(program, name);
    if (!node) return null;
    return declarationTarget(source, program, { kind, name }, node, node.annotations, rangeAtStart(node.location, name));
  }
  if (kind === "computed") {
    const name = target.slice("computed:".length);
    const node = findComputed(program, name);
    if (!node) return null;
    return declarationTarget(source, program, { kind, name }, node, node.annotations, findKeywordNameRange(source, node.location, "COMPUTED", name));
  }
  if (kind === "action") {
    const name = target.slice("action:".length);
    const node = findAction(program, name);
    if (!node) return null;
    return declarationTarget(source, program, { kind, name }, node, node.annotations, findKeywordNameRange(source, node.location, "ACTION", name));
  }
  if (kind === "type_field") {
    const parsed = parseTypeFieldTarget(target as `type_field:${string}.${string}`);
    if (!parsed) return null;
    const node = findTypeField(program, parsed.typeName, parsed.fieldName);
    if (!node) return null;
    return declarationTarget(
      source,
      program,
      { kind, typeName: parsed.typeName, fieldName: parsed.fieldName },
      node,
      node.annotations,
      rangeAtStart(node.location, parsed.fieldName),
    );
  }
  return null;
}

function declarationTarget(
  source: string,
  program: ProgramNode,
  info: TargetInfo,
  node: DeclarationTarget["node"],
  annotations: readonly AnnotationNode[] | undefined,
  nameRange: OffsetRange | null,
): DeclarationTarget | null {
  if (!nameRange) {
    return null;
  }
  const range = includeAttachedAnnotations(locationRange(node.location), annotations);
  return {
    info,
    node,
    range,
    nameRange,
    affectedTargets: affectedTargets(program, info),
  };
}

function affectedTargets(program: ProgramNode, target: TargetInfo): readonly LocalTargetKey[] {
  if (target.kind !== "type") {
    return [targetKey(target)];
  }
  const targets: LocalTargetKey[] = [`type:${target.name}`];
  const typeDecl = findTypeDecl(program, target.name);
  if (typeDecl?.typeExpr.kind === "objectType") {
    for (const field of typeDecl.typeExpr.fields) {
      targets.push(`type_field:${target.name}.${field.name}`);
    }
  }
  return sortTargets(targets);
}

function renamedTargets(program: ProgramNode, declaration: DeclarationTarget, newName: string): readonly LocalTargetKey[] {
  if (declaration.info.kind === "type") {
    const targets: LocalTargetKey[] = [`type:${declaration.info.name}`, `type:${newName}`];
    const typeDecl = findTypeDecl(program, declaration.info.name);
    if (typeDecl?.typeExpr.kind === "objectType") {
      for (const field of typeDecl.typeExpr.fields) {
        targets.push(`type_field:${declaration.info.name}.${field.name}`);
        targets.push(`type_field:${newName}.${field.name}`);
      }
    }
    return sortTargets(targets);
  }
  if (declaration.info.kind === "type_field") {
    return sortTargets([
      `type_field:${declaration.info.typeName}.${declaration.info.fieldName}`,
      `type_field:${declaration.info.typeName}.${newName}`,
    ]);
  }
  return sortTargets([targetKey(declaration.info), renamedTargetKey(declaration.info, newName)]);
}

function targetKey(target: TargetInfo): LocalTargetKey {
  switch (target.kind) {
    case "type":
      return `type:${target.name}`;
    case "state_field":
      return `state_field:${target.name}`;
    case "computed":
      return `computed:${target.name}`;
    case "action":
      return `action:${target.name}`;
    case "type_field":
      return `type_field:${target.typeName}.${target.fieldName}`;
  }
}

function renamedTargetKey(target: Exclude<TargetInfo, { readonly kind: "type_field" }>, newName: string): LocalTargetKey {
  switch (target.kind) {
    case "type":
      return `type:${newName}`;
    case "state_field":
      return `state_field:${newName}`;
    case "computed":
      return `computed:${newName}`;
    case "action":
      return `action:${newName}`;
  }
}

function targetName(target: TargetInfo): string {
  return target.kind === "type_field" ? target.fieldName : target.name;
}

function findKeywordNameRange(
  source: string,
  location: SourceLocation,
  keyword: "TYPE" | "COMPUTED" | "ACTION",
  name: string,
): OffsetRange | null {
  const range = locationRange(location);
  const tokens = tokenize(source).tokens.filter((token) =>
    token.location.start.offset >= range.start
    && token.location.end.offset <= range.end
    && token.kind !== "EOF");
  const keywordIndex = tokens.findIndex((token) => token.kind === keyword);
  if (keywordIndex < 0) {
    return null;
  }
  const nameToken = tokens.slice(keywordIndex + 1).find((token) => token.kind === "IDENTIFIER" && token.lexeme === name);
  return nameToken ? locationRange(nameToken.location) : null;
}

function rangeAtStart(location: SourceLocation, name: string): OffsetRange {
  const start = requiredOffset(location.start);
  return { start, end: start + name.length };
}

function includeAttachedAnnotations(
  range: OffsetRange,
  annotations: readonly AnnotationNode[] | undefined,
): OffsetRange {
  if (!annotations || annotations.length === 0) {
    return range;
  }
  const annotationStart = Math.min(...annotations.map((annotation) => requiredOffset(annotation.location.start)));
  return { start: Math.min(range.start, annotationStart), end: range.end };
}

function expandRemovalRange(source: string, range: OffsetRange, commaSeparated: boolean): OffsetRange {
  let start = range.start;
  let end = range.end;

  while (end < source.length && /[ \t]/.test(source[end]!)) {
    end += 1;
  }

  if (commaSeparated && source[end] === ",") {
    end += 1;
    while (end < source.length && /[ \t]/.test(source[end]!)) {
      end += 1;
    }
  } else if (commaSeparated) {
    let before = start - 1;
    while (before >= 0 && /[ \t]/.test(source[before]!)) {
      before -= 1;
    }
    if (source[before] === ",") {
      start = before;
      while (start > 0 && /[ \t]/.test(source[start - 1]!)) {
        start -= 1;
      }
    }
  }

  const lineStart = lineStartAt(source, start);
  const lineEnd = lineEndAt(source, end);
  const beforeOnLine = source.slice(lineStart, start);
  const afterOnLine = source.slice(end, lineEnd);
  if (/^[ \t]*$/.test(beforeOnLine) && /^[ \t,]*$/.test(afterOnLine)) {
    return { start: lineStart, end: lineEnd < source.length ? lineEnd + 1 : lineEnd };
  }

  return { start, end };
}

function locationRange(location: SourceLocation): OffsetRange {
  return {
    start: requiredOffset(location.start),
    end: requiredOffset(location.end),
  };
}

function dedupeRanges(ranges: readonly OffsetRange[]): OffsetRange[] {
  const seen = new Set<string>();
  return [...ranges]
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .filter((range) => {
      const key = `${range.start}:${range.end}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function lineStartAt(source: string, offset: number): number {
  return source.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
}

function lineEndAt(source: string, offset: number): number {
  const next = source.indexOf("\n", offset);
  return next === -1 ? source.length : next;
}

function targetFailure(
  program: ProgramNode,
  code: DeclarationEditFailureCode,
  message: string,
): DeclarationEditPlan {
  return { ok: false, code, message, location: program.domain.location };
}

function targetFailureAt(
  location: ProgramNode["location"],
  code: DeclarationEditFailureCode,
  message: string,
): DeclarationEditPlan {
  return { ok: false, code, message, location };
}
