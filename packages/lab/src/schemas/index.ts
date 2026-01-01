/**
 * Lab Schemas
 *
 * Zod schemas for Necessity Level state extensions.
 */

// Base schemas
export {
  NecessityBaseSchema,
  LevelDetectionSchema,
  LLMTraceEntrySchema,
  computeEffectiveLevel,
  type LevelDetection,
  type LLMTraceEntry,
  type NecessityBase,
} from "./necessity-base.js";

// Level 1 schemas
export {
  HypothesisSchema,
  RefutingConditionSchema,
  ObservationSchema,
  BeliefStateSchema,
  Level1Schema,
  type RefutingCondition,
  type Observation,
  type Hypothesis,
  type BeliefState,
  type Level1State,
} from "./level-1.js";

// Level 2 schemas
export {
  AssumptionSchema,
  ValidationStatusSchema,
  InterpretedRuleSchema,
  Level2Schema,
  type Assumption,
  type ValidationStatus,
  type InterpretedRule,
  type Level2State,
} from "./level-2.js";

// Level 3 schemas
export {
  ReferenceResolutionSchema,
  AmbiguitySchema,
  ConfirmationStatusSchema,
  GroundingStateSchema,
  Level3Schema,
  type ReferenceResolution,
  type Ambiguity,
  type ConfirmationStatus,
  type GroundingState,
  type Level3State,
} from "./level-3.js";
