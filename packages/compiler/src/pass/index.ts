/**
 * Pass Module
 *
 * Pass 시스템의 핵심 구성 요소를 export 합니다.
 */

// Base types and interfaces
export {
  // Finding types
  type FindingKind,
  type Finding,
  type FindingData,
  type VariableDeclarationData,
  type FunctionDeclarationData,
  type FunctionCallData,
  type AssignmentData,
  type IfStatementData,
  type BinaryExpressionData,
  type TypeAnnotationData,
  type NLEntityData,
  type NLActionData,
  type NLConditionData,
  type UnknownData,
  // Context
  type PassContext,
  // Pass interfaces
  type Pass,
  type NLPass,
  type PassResult,
  // Helpers
  isNLPass,
  createFindingId,
  createPassContext,
} from './base.js';

// Registry and Executor
export {
  PassRegistry,
  PassExecutor,
  type ExecutePassOptions,
  type ExecuteResult,
  createPassRegistry,
  createPassExecutor,
} from './registry.js';

// Built-in Passes
export { codeAstExtractorPass } from './code-ast-extractor.js';
export { schemaPass, determineSchemaFieldType } from './schema-pass.js';
export {
  expressionLoweringPass,
  convertToExpressionDSL,
  inferSemanticPath,
} from './expression-lowering.js';
export {
  effectLoweringPass,
  convertAssignment,
  convertFunctionCall,
  determineRisk,
  extractEffectRequires,
  isEmitPattern,
  isApiPattern,
} from './effect-lowering.js';
export {
  policyLoweringPass,
  detectEarlyReturnGuard,
  extractConditionRef,
  extractPathFromCondition,
  extractActionVerb,
  invertExpectation,
} from './policy-lowering.js';
export {
  actionPass,
  isActionHandler,
  extractActionId,
  extractSemanticVerb,
  findRelatedEffects,
  findRelatedPolicies,
  collectPreconditions,
  determineMaxRisk,
} from './action-pass.js';
export {
  nlExtractorPass,
  createNLExtractorPass,
  MockLLMAdapter,
  type LLMAdapter,
  type LLMContext,
  type NLPassConfig,
} from './nl-extractor-pass.js';
export {
  lowerDraft,
  lowerDrafts,
  validateDraft,
  validateExpression,
  validateEffect,
} from './draft-lowering.js';
