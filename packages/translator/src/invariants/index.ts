/**
 * @fileoverview Invariants Module Exports
 *
 * Graph-level invariant checks (I1-I4) and constraints (C-ABS-1).
 *
 * Per SPEC Section 8.1, Translator MUST enforce these invariants:
 * - I1: Causal Integrity - Graph is acyclic
 * - I2: Referential Identity - Entity refs maintain identity
 * - I3: Conceptual Completeness - Missing args explicitly recorded
 * - I4: Intent Statefulness - Every node has resolution.status
 *
 * Per SPEC Section 11.5, Translator MUST enforce these constraints:
 * - C-ABS-1: Non-Abstract nodes cannot depend on Abstract nodes
 */

// I1: Causal Integrity
export {
  checkCausalIntegrity,
  hasCycle,
  type CycleCheckResult,
} from "./causal-integrity.js";

// I2: Referential Identity
export {
  checkReferentialIdentity,
  isReferentialIdentityValid,
  checkEntityTypeConsistency,
  type ReferentialIdentityCheckResult,
  type EntityTypeConflict,
  type EntityTypeConsistencyResult,
} from "./referential-identity.js";

// I3: Conceptual Completeness
export {
  checkCompleteness,
  isCompletenessValid,
  type CompletenessCheckResult,
} from "./completeness.js";

// I4: Intent Statefulness
export {
  checkStatefulness,
  isStatefulnessValid,
  type StatefulnessCheckResult,
  type StatefulnessWarning,
} from "./statefulness.js";

// C-ABS-1: Abstract Dependency Constraint
export {
  checkAbstractDependency,
  isAbstractDependencyValid,
  type AbstractDependencyCheckResult,
} from "./abstract-dependency.js";
