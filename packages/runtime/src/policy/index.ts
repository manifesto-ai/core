/**
 * Policy Module
 *
 * @module
 */

export {
  type PolicyService,
  type ExecutionKeyPolicy,
  type Proposal,
  type ApprovedScope,
  type AuthorityDecision,
  type ValidationResult,
  type AuthorityHandler,
  type ScopeValidator,
  type ResultScopeValidator,
  type DefaultPolicyServiceOptions,
} from "./types.js";

export {
  defaultPolicy,
  actorSerialPolicy,
  baseSerialPolicy,
  globalSerialPolicy,
  branchSerialPolicy,
  intentTypePolicy,
  builtInPolicies,
  getBuiltInPolicy,
} from "./execution-key.js";

export {
  validateProposalScope,
  validateResultScope,
  pathMatches,
  createPermissiveScope,
  createRestrictedScope,
} from "./approved-scope.js";

export {
  DefaultPolicyService,
  createDefaultPolicyService,
  createSilentPolicyService,
  createStrictPolicyService,
} from "./service.js";
