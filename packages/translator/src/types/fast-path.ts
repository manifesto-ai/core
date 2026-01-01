/**
 * Fast path result types
 */

import type { PatchFragment } from "./fragment.js";

/** Fast path pattern names */
export type FastPathPatternName =
  | "comparator"
  | "range"
  | "length"
  | "inclusion"
  | "required"
  | "boolean";

/** Result of fast path matching */
export interface FastPathResult {
  /** Whether a pattern was matched */
  readonly matched: boolean;
  /** Name of matched pattern (null if not matched) */
  readonly pattern: FastPathPatternName | null;
  /** Generated fragment (null if not matched) */
  readonly fragment: PatchFragment | null;
  /** Confidence (1.0 for fast path matches, 0.0 otherwise) */
  readonly confidence: number;
}
