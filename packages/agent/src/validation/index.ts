/**
 * @manifesto-ai/agent - Validation Index
 *
 * 모든 검증 모듈 재내보내기
 */

// ACL validation
export type { AclValidationResult } from './acl.js';
export {
  FORBIDDEN_PATH_PREFIXES,
  validatePathAcl,
  validatePathsAcl,
  isDerivedPath,
  isDataPath,
  isStatePath,
} from './acl.js';

// Bounds validation
export type { BoundsValidationResult } from './bounds.js';
export {
  parsePath,
  validatePathBounds,
  validateAppendBounds,
} from './bounds.js';

// Type rules validation
export type { TypeValidationResult } from './type-rules.js';
export {
  getValueType,
  validateType,
  validateTypeRule,
  validateTypeRules,
  matchPathPattern,
} from './type-rules.js';

// Invariant validation
export type { InvariantValidationResult } from './invariant.js';
export {
  validateInvariant,
  validateInvariants,
  requiredFieldInvariant,
  rangeInvariant,
  arrayLengthInvariant,
  customInvariant,
} from './invariant.js';

// Patch validation pipeline
export type { PatchValidationResult } from './patch.js';
export {
  validatePatchOpSchema,
  validatePatchOp,
  validatePatchOps,
  validatePostPatchInvariants,
  validatePatchPipeline,
} from './patch.js';
