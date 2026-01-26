/**
 * @fileoverview Auxiliary Specifications Schema (SPEC Section 10)
 *
 * TimeSpec, VerifySpec, OutputSpec for optional intent metadata.
 */

import { z } from "zod";
import {
  TimeKindSchema,
  VerifyModeSchema,
  OutputTypeSchema,
  OutputFormatSchema,
} from "./heads.js";

// =============================================================================
// TimeSpec
// =============================================================================

/**
 * Temporal specification for the intent.
 *
 * @example
 * { kind: "NOW" }
 * { kind: "AT", value: "2024-01-15T10:00:00Z" }
 * { kind: "WITHIN", value: "1h" }
 */
export const TimeSpecSchema = z.object({
  kind: TimeKindSchema,
  /**
   * Time value. Interpretation depends on kind.
   * - AT: ISO 8601 datetime or relative reference
   * - BEFORE/AFTER: reference point
   * - WITHIN: duration (e.g., "1h", "30m", "7d")
   */
  value: z.unknown().optional(),
}).strict();

export type TimeSpec = z.infer<typeof TimeSpecSchema>;

// =============================================================================
// VerifySpec
// =============================================================================

/**
 * Verification contract for the output.
 *
 * @example
 * { mode: "TEST", spec: { numericCheck: true } }
 * { mode: "RUBRIC", spec: { lines: 14, rhymeScheme: "shakespearean" } }
 */
export const VerifySpecSchema = z.object({
  mode: VerifyModeSchema,
  /** Mode-specific parameters. Schema varies by mode. */
  spec: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type VerifySpec = z.infer<typeof VerifySpecSchema>;

// =============================================================================
// OutputSpec
// =============================================================================

/**
 * Output specification for the intent.
 *
 * @example
 * { type: "code", format: "text" }
 * { type: "expression", format: "latex" }
 */
export const OutputSpecSchema = z.object({
  type: OutputTypeSchema,
  /** Serialization format. */
  format: OutputFormatSchema.optional(),
  /** Additional constraints (length, tone, style, etc.). */
  constraints: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type OutputSpec = z.infer<typeof OutputSpecSchema>;
