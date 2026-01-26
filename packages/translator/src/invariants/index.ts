/**
 * @fileoverview Invariants Module Exports
 *
 * Graph-level invariant checks (I1-I4).
 *
 * Per SPEC Section 8.1, Translator MUST enforce these invariants:
 * - I1: Causal Integrity - Graph is acyclic
 * - I2: Referential Identity - Entity refs maintain identity
 * - I3: Conceptual Completeness - Missing args explicitly recorded
 * - I4: Intent Statefulness - Every node has resolution.status
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
  type ReferentialIdentityCheckResult,
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
