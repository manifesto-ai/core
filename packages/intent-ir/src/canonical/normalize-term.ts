/**
 * @fileoverview Term Normalization (SPEC Section 11.4.2)
 *
 * Term-specific normalization rules for canonicalization.
 */

import type {
  Term,
  ValueTerm,
  EntityRefTerm,
  ArtifactRefTerm,
  PathRefTerm,
  ExprTerm,
  ResolvedTerm,
} from "../schema/index.js";

// =============================================================================
// Semantic Mode (raw removed)
// =============================================================================

/**
 * Normalize term for semantic canonicalization.
 * Removes ValueTerm.raw for semantic equivalence (FDR-INT-CAN-002).
 */
export function normalizeTermSemantic(term: Term): Term {
  switch (term.kind) {
    case "entity":
      return normalizeEntityRefTermSemantic(term);
    case "artifact":
      return normalizeArtifactRefTermSemantic(term);
    case "value":
      return normalizeValueTermSemantic(term);
    case "path":
      return normalizePathRefTerm(term);
    case "expr":
      return normalizeExprTerm(term);
  }
}

function normalizeEntityRefTermSemantic(term: EntityRefTerm): EntityRefTerm {
  // If ref absent, preserve (collection scope)
  // If ref.kind !== "id", remove ref.id (symbolic refs don't need id)
  if (!term.ref) {
    return term;
  }

  if (term.ref.kind !== "id") {
    const { id: _id, ...refWithoutId } = term.ref;
    return { ...term, ref: refWithoutId as EntityRefTerm["ref"] };
  }

  return term;
}

function normalizeArtifactRefTermSemantic(
  term: ArtifactRefTerm
): ArtifactRefTerm {
  // If inline, remove ref.id
  // If id, remove content
  if (term.ref.kind === "inline") {
    const { id: _id, ...refWithoutId } = term.ref;
    return {
      kind: term.kind,
      artifactType: term.artifactType,
      ref: refWithoutId as ArtifactRefTerm["ref"],
      content: term.content,
    };
  }

  // id mode: remove content
  const { content: _content, ...termWithoutContent } = term;
  return termWithoutContent as ArtifactRefTerm;
}

function normalizeValueTermSemantic(term: ValueTerm): ValueTerm {
  // Remove raw for semantic mode (FDR-INT-CAN-002)
  const { raw: _raw, ...termWithoutRaw } = term;
  return termWithoutRaw as ValueTerm;
}

// =============================================================================
// Strict Mode (raw normalized)
// =============================================================================

/**
 * Normalize term for strict canonicalization.
 * Preserves and normalizes ValueTerm.raw.
 */
export function normalizeTermStrict(term: Term | ResolvedTerm): Term | ResolvedTerm {
  switch (term.kind) {
    case "entity":
      return normalizeEntityRefTermStrict(term);
    case "artifact":
      return normalizeArtifactRefTermStrict(term);
    case "value":
      return normalizeValueTermStrict(term);
    case "path":
      return normalizePathRefTerm(term);
    case "expr":
      return normalizeExprTerm(term);
  }
}

function normalizeEntityRefTermStrict(
  term: EntityRefTerm
): EntityRefTerm {
  // Same as semantic for entity refs
  return normalizeEntityRefTermSemantic(term);
}

function normalizeArtifactRefTermStrict(
  term: ArtifactRefTerm
): ArtifactRefTerm {
  // Same as semantic for artifact refs
  return normalizeArtifactRefTermSemantic(term);
}

/**
 * Normalize ValueTerm.raw according to SPEC Section 11.4.2.
 *
 * | valueType | Normalization Rule |
 * |-----------|-------------------|
 * | string    | Trim leading/trailing whitespace |
 * | number    | JSON number (not string); no trailing zeros |
 * | boolean   | JSON boolean (true/false) |
 * | date      | ISO 8601 string (YYYY-MM-DDTHH:mm:ss.sssZ) |
 * | enum      | Exact string match (case-sensitive) |
 * | id        | String, trimmed |
 */
function normalizeValueTermStrict(term: ValueTerm): ValueTerm {
  if (term.raw === undefined) {
    return term;
  }

  const normalizedRaw = normalizeRawValue(term.valueType, term.raw);
  return { ...term, raw: normalizedRaw };
}

function normalizePathRefTerm(term: PathRefTerm): PathRefTerm {
  const trimmed = term.path.trim();
  if (trimmed === term.path) {
    return term;
  }
  return { ...term, path: trimmed };
}

function normalizeExprTerm(term: ExprTerm): ExprTerm {
  if (typeof term.expr === "string") {
    return term;
  }

  const normalizedExpr = sortObjectKeys(term.expr);
  return { ...term, expr: normalizedExpr as ExprTerm["expr"] };
}

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
        // Try to parse and re-format to ISO
        const date = new Date(raw);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
      return raw;

    case "enum":
      // Exact string match, no normalization
      return raw;

    case "id":
      return typeof raw === "string" ? raw.trim() : raw;

    default:
      return raw;
  }
}
