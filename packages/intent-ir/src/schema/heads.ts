/**
 * @fileoverview Functional Head Schemas (SPEC Section 6)
 *
 * Intent IR uses a fixed hierarchy of functional heads derived from linguistic theory.
 * All head values are enumerated and finite per AD-INT-002.
 */

import { z } from "zod";

// =============================================================================
// Force (Illocutionary Force)
// =============================================================================

/**
 * Force represents the illocutionary force of the utterance.
 * What the speaker intends to accomplish.
 */
export const ForceSchema = z.enum([
  "ASK", // Request information
  "DO", // Request action execution
  "VERIFY", // Request verification/validation
  "CONFIRM", // Request confirmation before proceeding
  "CLARIFY", // Indicate need for clarification (system-generated)
]);

export type Force = z.infer<typeof ForceSchema>;

// =============================================================================
// EventClass
// =============================================================================

/**
 * EventClass provides coarse-grained categorization of the event/operation type.
 */
export const EventClassSchema = z.enum([
  "OBSERVE", // Read/query/inspect (GET, LIST, SHOW, DESCRIBE)
  "TRANSFORM", // Modify existing entity (UPDATE, CHANGE, EDIT, MODIFY)
  "SOLVE", // Compute/derive/prove (CALCULATE, SOLVE, PROVE, DERIVE)
  "CREATE", // Generate new entity (CREATE, ADD, WRITE, GENERATE)
  "DECIDE", // Make choice/judgment (SELECT, CHOOSE, APPROVE, REJECT)
  "CONTROL", // Lifecycle/state control (START, STOP, CANCEL, ARCHIVE)
]);

export type EventClass = z.infer<typeof EventClassSchema>;

// =============================================================================
// Role (Theta-roles)
// =============================================================================

/**
 * Roles represent thematic relations between the event and its arguments.
 */
export const RoleSchema = z.enum([
  "TARGET", // Entity directly affected by action
  "THEME", // Content/subject matter
  "SOURCE", // Origin point
  "DEST", // Destination point
  "INSTRUMENT", // Means/tool used
  "BENEFICIARY", // Entity that benefits
]);

export type Role = z.infer<typeof RoleSchema>;

// =============================================================================
// Modality
// =============================================================================

/**
 * Modality expresses deontic force - obligation, permission, prohibition.
 */
export const ModalitySchema = z.enum([
  "MUST", // Obligatory (required, no alternative)
  "SHOULD", // Recommended (preferred but not required)
  "MAY", // Permitted (optional, allowed)
  "FORBID", // Prohibited (must not occur)
]);

export type Modality = z.infer<typeof ModalitySchema>;

// =============================================================================
// TimeKind
// =============================================================================

/**
 * Time specifies temporal constraints on the event.
 */
export const TimeKindSchema = z.enum([
  "NOW", // Immediate execution
  "AT", // Specific point in time
  "BEFORE", // Must complete before deadline
  "AFTER", // Must start after prerequisite
  "WITHIN", // Duration constraint
]);

export type TimeKind = z.infer<typeof TimeKindSchema>;

// =============================================================================
// VerifyMode
// =============================================================================

/**
 * VerifyMode specifies the verification contract for the output.
 */
export const VerifyModeSchema = z.enum([
  "NONE", // No verification required
  "TEST", // Automated test verification
  "PROOF", // Formal proof required
  "CITATION", // Source citation required
  "RUBRIC", // Criteria-based evaluation
  "POLICY", // Policy compliance check
]);

export type VerifyMode = z.infer<typeof VerifyModeSchema>;

// =============================================================================
// OutputType
// =============================================================================

/**
 * OutputType specifies the expected output format.
 */
export const OutputTypeSchema = z.enum([
  "number", // Numeric result
  "expression", // Mathematical/logical expression
  "proof", // Formal proof structure
  "explanation", // Natural language explanation
  "summary", // Condensed summary
  "plan", // Action plan/steps
  "code", // Executable code
  "text", // General text
  "artifactRef", // Reference to external artifact
]);

export type OutputType = z.infer<typeof OutputTypeSchema>;

// =============================================================================
// OutputFormat
// =============================================================================

/**
 * OutputFormat specifies the serialization format.
 */
export const OutputFormatSchema = z.enum([
  "markdown",
  "json",
  "latex",
  "text",
]);

export type OutputFormat = z.infer<typeof OutputFormatSchema>;
