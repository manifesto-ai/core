/**
 * @manifesto-ai/core
 *
 * AI Native Semantic Layer for SaaS Business Logic
 *
 * Manifesto는 SaaS 비즈니스 로직을 의미론적 주소 공간(Semantic Path Space)으로 선언하여,
 * AI Agent가 UI를 이해하고 안전하게 조작할 수 있게 하는 AI Native Semantic Layer입니다.
 */

// Domain - 도메인 정의 및 타입
export {
  // Types
  type SemanticPath,
  type SemanticMeta,
  type ConditionRef,
  type FieldPolicy,
  type SourceDefinition,
  type DerivedDefinition,
  type AsyncDefinition,
  type ActionDefinition,
  type ActionSemanticMeta,
  type PathDefinitions,
  type DomainMeta,
  type ManifestoDomain,
  type ValidationIssue,
  type ValidationResult,
  // Helpers
  defineDomain,
  defineSource,
  defineDerived,
  defineAsync,
  defineAction,
  fieldPolicy,
  condition,
  // Validation
  validateDomain,
} from './domain/index.js';

// Expression - DSL 표현식
export {
  // Types
  type Expression,
  type EvaluationContext,
  type LiteralExpr,
  type GetExpr,
  type ComparisonExpr,
  type LogicalExpr,
  type ArithmeticExpr,
  type ConditionalExpr,
  type StringFn,
  type ArrayFn,
  type NumberFn,
  type ObjectFn,
  type TypeFn,
  type DateFn,
  // Parser
  isValidExpression,
  isGetExpr,
  extractPaths,
  stringifyExpression,
  parseExpression,
  expressionToString,
  // Evaluator
  evaluate,
  type EvalResult,
  // Analyzer
  analyzeExpression,
  isPureExpression,
  isConstantExpression,
  areExpressionsEqual,
  optimizeExpression,
  substitutePathWithValue,
  type DependencyAnalysis,
} from './expression/index.js';

// Effect - 부수효과 시스템
export {
  // Types
  type Effect,
  type SetValueEffect,
  type SetStateEffect,
  type ApiCallEffect,
  type NavigateEffect,
  type DelayEffect,
  type SequenceEffect,
  type ParallelEffect,
  type ConditionalEffect,
  type CatchEffect,
  type EmitEventEffect,
  type EffectTag,
  isEffect,
  isEffectOfType,
  // Result
  type Result,
  type EffectError,
  ok,
  err,
  effectError,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  unwrapErr,
  map,
  mapErr,
  flatMap,
  flatten,
  all,
  any,
  fromPromise,
  tryCatch,
  // Runner
  runEffect,
  setValue,
  setState,
  apiCall,
  navigate,
  delay,
  sequence,
  parallel,
  conditional,
  catchEffect,
  emitEvent,
  type EffectHandler,
  type EffectRunnerConfig,
  type EffectResult,
} from './effect/index.js';

// DAG - 의존성 그래프
export {
  // Types
  type DependencyGraph,
  type DagNode,
  type SourceNode,
  type DerivedNode,
  type AsyncNode,
  // Graph
  buildDependencyGraph,
  getDirectDependencies,
  getDirectDependents,
  getAllDependencies,
  getAllDependents,
  hasCycle,
  findPath,
  // Topological
  topologicalSortWithCycleDetection,
  getLevelOrder,
  reverseTopologicalSort,
  partialTopologicalSort,
  getAffectedOrder,
  type TopologicalSortResult,
  // Propagation
  propagate,
  propagateAsyncResult,
  analyzeImpact,
  createDebouncedPropagator,
  type PropagationResult,
  type SnapshotLike,
} from './dag/index.js';

// Runtime - 도메인 실행 엔진
export {
  // Snapshot
  type DomainSnapshot,
  createSnapshot,
  cloneSnapshot,
  getValueByPath,
  setValueByPath,
  diffSnapshots,
  // Subscription
  type SnapshotListener,
  type PathListener,
  type EventListener,
  type DomainEvent,
  type Unsubscribe,
  SubscriptionManager,
  createBatchNotifier,
  // Runtime
  type DomainRuntime,
  type PreconditionStatus,
  type ResolvedFieldPolicy,
  type ExplanationTree,
  type ValidationError,
  type CreateRuntimeOptions,
  createRuntime,
} from './runtime/index.js';

// Policy - 정책 평가
export {
  // Precondition
  evaluatePrecondition,
  evaluateAllPreconditions,
  checkActionAvailability,
  extractPreconditionDependencies,
  analyzePreconditionRequirements,
  type PreconditionEvaluationResult,
  type ActionAvailability,
  // Field Policy
  evaluateFieldPolicy,
  policyToUIState,
  extractFieldPolicyDependencies,
  evaluateMultipleFieldPolicies,
  explainFieldPolicy,
  type FieldPolicyEvaluation,
  type ConditionEvaluationDetail,
  type FieldUIState,
} from './policy/index.js';

// Schema - Zod 통합
export {
  // Integration
  schemaToSource,
  CommonSchemas,
  SchemaUtils,
  getSchemaDefault,
  getSchemaMetadata,
  toJsonSchema,
  // Validation
  zodErrorToValidationResult,
  validateValue,
  validatePartial,
  validateDomainData,
  validateFields,
  validateAsync,
  mergeValidationResults,
  groupValidationByPath,
  filterBySeverity,
  getErrors,
  getWarnings,
  getSuggestions,
} from './schema/index.js';

// Re-export Zod for convenience
export { z } from 'zod';
