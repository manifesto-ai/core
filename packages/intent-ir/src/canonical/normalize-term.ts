/**
 * @fileoverview Term Normalization (SPEC Section 11.4.2)
 *
 * Term-specific normalization rules for canonicalization.
 */

import { toJcs } from "@manifesto-ai/core";
import type {
  Term,
  ValueTerm,
  EntityRefTerm,
  ArtifactRefTerm,
  PathRefTerm,
  ExprTerm,
  ResolvedTerm,
  ListTerm,
  NonListTerm,
  QuantitySpec,
} from "../schema/index.js";

// =============================================================================
// Semantic Mode (raw removed)
// =============================================================================

/**
 * Normalize term for semantic canonicalization.
 * Removes ValueTerm.raw and all term-level ext.
 */
export function normalizeTermSemantic(term: Term): Term {
  switch (term.kind) {
    case "entity":
      return normalizeEntityRefTerm(term, "semantic");
    case "artifact":
      return normalizeArtifactRefTerm(term, "semantic");
    case "value":
      return normalizeValueTermSemantic(term);
    case "path":
      return normalizePathRefTerm(term, "semantic");
    case "expr":
      return normalizeExprTerm(term, "semantic");
    case "list":
      return normalizeListTerm(term, "semantic") as Term;
  }
}

// =============================================================================
// Strict Mode (raw normalized)
// =============================================================================

/**
 * Normalize term for strict canonicalization.
 * Preserves and normalizes ValueTerm.raw and preserves ext.
 */
export function normalizeTermStrict(term: Term | ResolvedTerm): Term | ResolvedTerm {
  switch (term.kind) {
    case "entity":
      return normalizeEntityRefTerm(term, "strict");
    case "artifact":
      return normalizeArtifactRefTerm(term, "strict");
    case "value":
      return normalizeValueTermStrict(term);
    case "path":
      return normalizePathRefTerm(term, "strict");
    case "expr":
      return normalizeExprTerm(term, "strict");
    case "list":
      return normalizeListTerm(term, "strict") as Term | ResolvedTerm;
  }
}

// =============================================================================
// EntityRefTerm
// =============================================================================

function normalizeEntityRefTerm(
  term: EntityRefTerm,
  mode: "semantic" | "strict"
): EntityRefTerm {
  const result: EntityRefTerm = {
    kind: "entity",
    entityType: term.entityType,
  };

  if (term.ref) {
    if (term.ref.kind === "id") {
      result.ref = { kind: "id", id: term.ref.id };
    } else {
      result.ref = { kind: term.ref.kind } as EntityRefTerm["ref"];
    }
  }

  if (term.quant) {
    const quant: QuantitySpec = {
      kind: "quantity",
      value: term.quant.value,
      ...(term.quant.comparator && term.quant.comparator !== "eq"
        ? { comparator: term.quant.comparator }
        : null),
      ...(term.quant.unit ? { unit: term.quant.unit } : null),
      ...(mode === "strict" && term.quant.ext ? { ext: term.quant.ext } : null),
    };
    result.quant = quant;
  }

  if (term.orderBy) {
    const trimmed = term.orderBy.path.trim();
    result.orderBy = {
      kind: "path",
      path: trimmed,
      ...(mode === "strict" && term.orderBy.ext ? { ext: term.orderBy.ext } : null),
    };
  }

  if (term.orderDir && term.orderBy && term.orderDir !== "ASC") {
    result.orderDir = term.orderDir;
  }

  if (mode === "strict" && term.ext) {
    result.ext = term.ext;
  }

  return result;
}

// =============================================================================
// ArtifactRefTerm
// =============================================================================

function normalizeArtifactRefTerm(
  term: ArtifactRefTerm,
  mode: "semantic" | "strict"
): ArtifactRefTerm {
  const base: ArtifactRefTerm = {
    kind: "artifact",
    artifactType: term.artifactType,
    ref: { kind: term.ref.kind } as ArtifactRefTerm["ref"],
    ...(mode === "strict" && term.ext ? { ext: term.ext } : null),
  };

  if (term.ref.kind === "id" && term.ref.id) {
    base.ref = { kind: "id", id: term.ref.id };
  }

  if (term.ref.kind === "inline" && term.content !== undefined) {
    base.content = term.content;
  }

  return base;
}

// =============================================================================
// ValueTerm
// =============================================================================

function normalizeValueTermSemantic(term: ValueTerm): ValueTerm {
  const { raw: _raw, ext: _ext, ...termWithoutRaw } = term;
  return termWithoutRaw as ValueTerm;
}

/**
 * Normalize ValueTerm.raw according to SPEC Section 11.4.2.
 */
function normalizeValueTermStrict(term: ValueTerm): ValueTerm {
  if (term.raw === undefined) {
    return term;
  }

  const normalizedRaw = normalizeRawValue(term.valueType, term.raw);
  return { ...term, raw: normalizedRaw };
}

// =============================================================================
// PathRefTerm
// =============================================================================

function normalizePathRefTerm(
  term: PathRefTerm,
  mode: "semantic" | "strict"
): PathRefTerm {
  const trimmed = term.path.trim();
  const base: PathRefTerm = {
    kind: "path",
    path: trimmed,
    ...(mode === "strict" && term.ext ? { ext: term.ext } : null),
  };
  return base;
}

// =============================================================================
// ExprTerm
// =============================================================================

function normalizeExprTerm(
  term: ExprTerm,
  mode: "semantic" | "strict"
): ExprTerm {
  if (typeof term.expr === "string") {
    return mode === "strict" ? term : ({ ...term, ext: undefined } as ExprTerm);
  }

  const normalizedExpr = sortObjectKeys(term.expr);
  return {
    ...term,
    expr: normalizedExpr as ExprTerm["expr"],
    ...(mode === "semantic" ? { ext: undefined } : null),
  };
}

// =============================================================================
// ListTerm
// =============================================================================

function normalizeListTerm(
  term: ListTerm | ResolvedTerm,
  mode: "semantic" | "strict"
): ListTerm | ResolvedTerm {
  if (term.kind !== "list") {
    return term;
  }

  const normalizeItem =
    mode === "semantic" ? normalizeTermSemantic : normalizeTermStrict;
  const items = term.items.map(
    (item) => normalizeItem(item as Term) as NonListTerm
  );

  if (term.ordered === true) {
    return {
      kind: "list",
      items,
      ordered: true,
      ...(mode === "strict" && term.ext ? { ext: term.ext } : null),
    };
  }

  const withKeys = items.map((item) => ({
    item,
    key: toJcs(item),
  }));

  withKeys.sort((a, b) => a.key.localeCompare(b.key));

  const deduped: NonListTerm[] = [];
  let lastKey: string | null = null;
  for (const entry of withKeys) {
    if (entry.key !== lastKey) {
      deduped.push(entry.item);
      lastKey = entry.key;
    }
  }

  const result: ListTerm = {
    kind: "list",
    items: deduped,
  };

  if (mode === "strict" && term.ext) {
    result.ext = term.ext;
  }

  return result;
}

// =============================================================================
// Helpers
// =============================================================================

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortObjectKeys(record[key]);
    }
    return sorted;
  }

  return value;
}

function normalizeRawValue(valueType: ValueTerm["valueType"], raw: unknown): unknown {
  switch (valueType) {
    case "string":
      return typeof raw === "string" ? raw.trim() : raw;

    case "number":
      if (typeof raw === "number") {
        return raw;
      }
      if (typeof raw === "string") {
        const parsed = parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : raw;
      }
      return raw;

    case "boolean":
      if (typeof raw === "boolean") {
        return raw;
      }
      if (raw === "true") return true;
      if (raw === "false") return false;
      return raw;

    case "date":
      if (raw instanceof Date) {
        return raw.toISOString();
      }
      if (typeof raw === "string") {
        const date = new Date(raw);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
      return raw;

    case "enum":
      return raw;

    case "id":
      return typeof raw === "string" ? raw.trim() : raw;

    default:
      return raw;
  }
}
