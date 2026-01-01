/**
 * Normalization result types
 */

import type { LanguageCode } from "./common.js";
import type { GlossaryHit } from "./glossary.js";
import type { Token } from "./token.js";

/** Protected span kind */
export type ProtectedSpanKind = "identifier" | "number" | "literal" | "operator";

/** Protected span in normalized text (identifiers, numbers, etc.) */
export interface ProtectedSpan {
  /** Start index in canonical text */
  readonly start: number;
  /** End index in canonical text */
  readonly end: number;
  /** Kind of protected span */
  readonly kind: ProtectedSpanKind;
  /** Original value */
  readonly value: string;
}

/** Result of normalization stage */
export interface NormalizationResult {
  /** Canonical English form */
  readonly canonical: string;
  /** Detected source language */
  readonly language: LanguageCode;
  /** Tokenized form */
  readonly tokens: readonly Token[];
  /** Matched glossary entries */
  readonly glossaryHits: readonly GlossaryHit[];
  /** Protected spans */
  readonly protected: readonly ProtectedSpan[];
}
