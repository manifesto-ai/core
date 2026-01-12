/**
 * @fileoverview Schema Module Exports
 *
 * All Zod schemas and derived types for Intent IR v0.1.
 */

// Functional Heads
export {
  ForceSchema,
  type Force,
  EventClassSchema,
  type EventClass,
  RoleSchema,
  type Role,
  ModalitySchema,
  type Modality,
  TimeKindSchema,
  type TimeKind,
  VerifyModeSchema,
  type VerifyMode,
  OutputTypeSchema,
  type OutputType,
  OutputFormatSchema,
  type OutputFormat,
} from "./heads.js";

// Event
export { EventSchema, type Event } from "./event.js";

// Terms
export {
  EntityRefKindSchema,
  type EntityRefKind,
  EntityRefSchema,
  type EntityRef,
  EntityRefTermSchema,
  type EntityRefTerm,
  PathRefTermSchema,
  type PathRefTerm,
  ArtifactTypeSchema,
  type ArtifactType,
  ArtifactRefSchema,
  type ArtifactRef,
  ArtifactRefTermSchema,
  type ArtifactRefTerm,
  ValueTypeSchema,
  type ValueType,
  ValueTermSchema,
  type ValueTerm,
  ExprTypeSchema,
  type ExprType,
  ExprTermSchema,
  type ExprTerm,
  TermSchema,
  type Term,
} from "./term.js";

// Predicates
export {
  PredOpSchema,
  type PredOp,
  LHSSchema,
  type LHS,
  PredSchema,
  type Pred,
} from "./pred.js";

// Auxiliary Specs
export {
  TimeSpecSchema,
  type TimeSpec,
  VerifySpecSchema,
  type VerifySpec,
  OutputSpecSchema,
  type OutputSpec,
} from "./specs.js";

// IntentIR
export {
  IntentIRVersionSchema,
  type IntentIRVersion,
  ArgsSchema,
  type Args,
  IntentIRSchema,
  type IntentIR,
  parseIntentIR,
  safeParseIntentIR,
  validateIntentIR,
  type ValidationResult,
  type ValidationError,
} from "./intent-ir.js";

// Resolved Types
export {
  ResolvedEntityRefSchema,
  type ResolvedEntityRef,
  ResolvedEntityRefTermSchema,
  type ResolvedEntityRefTerm,
  ResolvedTermSchema,
  type ResolvedTerm,
  ResolvedArgsSchema,
  type ResolvedArgs,
  ResolvedIntentIRSchema,
  type ResolvedIntentIR,
} from "./resolved.js";
