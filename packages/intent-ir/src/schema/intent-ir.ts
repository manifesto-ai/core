/**
 * @fileoverview IntentIR Root Schema (SPEC Section 7)
 *
 * IntentIR is the root structure representing a complete semantic intent.
 */

import { z } from "zod";
import {
  ForceSchema,
  ModalitySchema,
  RoleSchema,
  type Role,
} from "./heads.js";
import { EventSchema } from "./event.js";
import { TermSchema, type Term } from "./term.js";
import { PredSchema } from "./pred.js";
import { TimeSpecSchema, VerifySpecSchema, OutputSpecSchema } from "./specs.js";

// =============================================================================
// Version
// =============================================================================

/**
 * Intent IR version identifier.
 * Wire version uses "MAJOR.MINOR" format.
 */
export const IntentIRVersionSchema = z.literal("0.1");

export type IntentIRVersion = z.infer<typeof IntentIRVersionSchema>;

// =============================================================================
// Args
// =============================================================================

/**
 * Args schema: each role maps to at most one Term (v0.1).
 *
 * Per FDR-INT-006, single Term per Role in v0.1.
 * Multiple terms per role deferred to v0.2+ (requires ListTerm).
 */
export const ArgsSchema = z
  .object({
    TARGET: TermSchema,
    THEME: TermSchema,
    SOURCE: TermSchema,
    DEST: TermSchema,
    INSTRUMENT: TermSchema,
    BENEFICIARY: TermSchema,
  })
  .partial();

export type Args = z.infer<typeof ArgsSchema>;

// =============================================================================
// IntentIR
// =============================================================================

/**
 * IntentIR root schema.
 *
 * Represents a complete semantic intent in Chomskyan LF form.
 *
 * @example
 * {
 *   v: "0.1",
 *   force: "DO",
 *   event: { lemma: "CANCEL", class: "CONTROL" },
 *   args: {
 *     TARGET: { kind: "entity", entityType: "Order", ref: { kind: "last" } }
 *   },
 *   mod: "MUST",
 *   time: { kind: "NOW" }
 * }
 */
export const IntentIRSchema = z.object({
  /** Version identifier. MUST be "0.1" for this specification. */
  v: IntentIRVersionSchema,

  /** Illocutionary force. REQUIRED. */
  force: ForceSchema,

  /** Event specification. REQUIRED. */
  event: EventSchema,

  /** Theta-role arguments. REQUIRED (may be empty object). */
  args: ArgsSchema,

  /** Condition predicates. OPTIONAL. AND-conjunction in v0.1. */
  cond: z.array(PredSchema).optional(),

  /** Modality. OPTIONAL. Default: MAY. */
  mod: ModalitySchema.optional(),

  /** Temporal specification. OPTIONAL. Default: NOW or context. */
  time: TimeSpecSchema.optional(),

  /** Verification contract. OPTIONAL. Default: system-determined. */
  verify: VerifySpecSchema.optional(),

  /** Output specification. OPTIONAL. */
  out: OutputSpecSchema.optional(),

  /** Extension point. OPTIONAL. Keys SHOULD be namespaced. */
  ext: z.record(z.string(), z.unknown()).optional(),
});

export type IntentIR = z.infer<typeof IntentIRSchema>;

// =============================================================================
// Validation API
// =============================================================================

/**
 * Parse and validate IntentIR.
 * @throws ZodError on validation failure
 */
export function parseIntentIR(data: unknown): IntentIR {
  return IntentIRSchema.parse(data);
}

/**
 * Safe parse IntentIR without throwing.
 */
export function safeParseIntentIR(data: unknown) {
  return IntentIRSchema.safeParse(data);
}

/**
 * Validation result type.
 */
export type ValidationResult =
  | { valid: true; data: IntentIR; errors: [] }
  | { valid: false; data: null; errors: ValidationError[] };

export type ValidationError = {
  path: string;
  message: string;
  code: string;
};

/**
 * Validate IntentIR and return diagnostics.
 */
export function validateIntentIR(data: unknown): ValidationResult {
  const result = IntentIRSchema.safeParse(data);

  if (result.success) {
    return {
      valid: true,
      data: result.data,
      errors: [],
    };
  }

  return {
    valid: false,
    data: null,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    })),
  };
}
