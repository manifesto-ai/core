import { z } from "zod";

/**
 * Compiler context schema
 */
export const CompilerContextSchema = z.object({
  domainName: z.string().optional(),
  existingActions: z.array(z.string()).optional(),
  glossary: z.record(z.string(), z.string()).optional(),
});

/**
 * Normalized intent schema
 */
export const NormalizedIntentSchema = z.object({
  kind: z.enum(["state", "computed", "action", "constraint"]),
  description: z.string(),
  confidence: z.number().min(0).max(1),
});

/**
 * Compiler diagnostic schema
 */
export const CompilerDiagnosticSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.string().optional(),
  suggestion: z.string().optional(),
});

/**
 * Compiler diagnostics schema
 */
export const CompilerDiagnosticsSchema = z.object({
  valid: z.boolean(),
  errors: z.array(CompilerDiagnosticSchema),
  warnings: z.array(CompilerDiagnosticSchema),
});

/**
 * Attempt record schema
 */
export const AttemptRecordSchema = z.object({
  attemptNumber: z.number(),
  draftHash: z.string(),
  diagnostics: CompilerDiagnosticsSchema.nullable(),
  timestamp: z.number(),
});

/**
 * Resolution option schema
 */
export const ResolutionOptionSchema = z.object({
  id: z.string(),
  description: z.string(),
  preview: z.string().optional(),
});

/**
 * Discard reason schema
 */
export const DiscardReasonSchema = z.enum([
  "RESOLUTION_REQUIRED_BUT_DISABLED",
  "MAX_RETRIES_EXCEEDED",
  "EMPTY_INPUT",
  "SEGMENTATION_FAILED",
]);

/**
 * Compiler status schema
 */
export const CompilerStatusSchema = z.enum([
  "idle",
  "segmenting",
  "normalizing",
  "proposing",
  "validating",
  "awaiting_resolution",
  "success",
  "discarded",
]);

/**
 * CompilerState schema - the complete state for CompilerDomain
 *
 * Per SPEC.md §4.2
 */
export const CompilerStateSchema = z.object({
  // ─── Input ───
  input: z.string().nullable(),
  targetSchema: z.unknown().nullable(),
  context: CompilerContextSchema.nullable(),

  // ─── Configuration ───
  maxRetries: z.number(),
  traceDrafts: z.boolean(),

  // ─── Pipeline State ───
  segments: z.array(z.string()),
  intents: z.array(NormalizedIntentSchema),
  currentDraft: z.unknown().nullable(),

  // ─── Validation State ───
  diagnostics: CompilerDiagnosticsSchema.nullable(),

  // ─── Loop Control ───
  attemptCount: z.number(),

  // ─── History (when traceDrafts: true) ───
  attempts: z.array(AttemptRecordSchema),

  // ─── Resolution State ───
  resolutionOptions: z.array(ResolutionOptionSchema),
  resolutionReason: z.string().nullable(),

  // ─── Status ───
  status: CompilerStatusSchema,

  // ─── Output ───
  result: z.unknown().nullable(),
  resultHash: z.string().nullable(),
  discardReason: DiscardReasonSchema.nullable(),
});

export type CompilerStateSchemaType = z.infer<typeof CompilerStateSchema>;

/**
 * Initial state for the compiler
 *
 * Per SPEC.md §4.3
 */
export const INITIAL_STATE: CompilerStateSchemaType = {
  input: null,
  targetSchema: null,
  context: null,
  maxRetries: 5,
  traceDrafts: false,
  segments: [],
  intents: [],
  currentDraft: null,
  diagnostics: null,
  attemptCount: 0,
  attempts: [],
  resolutionOptions: [],
  resolutionReason: null,
  status: "idle",
  result: null,
  resultHash: null,
  discardReason: null,
};
