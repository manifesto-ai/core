/**
 * Glossary types for semantic mapping
 */

import type { LanguageCode, SemanticPath } from "./common.js";
import type { TypeExpr } from "./type-system.js";

/** Glossary entry for semantic mapping across languages */
export interface GlossaryEntry {
  /** Stable semantic identifier (e.g., "op.gte", "constraint.required") */
  readonly semanticId: string;
  /** Canonical English form */
  readonly canonical: string;
  /** Aliases by language code */
  readonly aliases: Readonly<Record<LanguageCode, readonly string[]>>;
  /** Optional type hint for validation */
  readonly typeHint?: TypeExpr;
  /** Optional anchor hints for retrieval */
  readonly anchorHints?: readonly SemanticPath[];
}

/** Matched glossary entry from normalization */
export interface GlossaryHit {
  /** Semantic ID that was matched */
  readonly semanticId: string;
  /** Canonical form */
  readonly canonical: string;
  /** The alias that matched */
  readonly matchedAlias: string;
  /** Match confidence (0.0 - 1.0) */
  readonly confidence: number;
}
