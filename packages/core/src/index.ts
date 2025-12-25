/**
 * @manifesto-ai/core
 *
 * AI Native Semantic Layer for SaaS Business Logic
 *
 * Manifesto is an AI Native Semantic Layer that declares SaaS business logic
 * in a Semantic Path Space, enabling AI Agents to understand and safely
 * manipulate UI state.
 *
 * @packageDocumentation
 */

// Domain - Domain definitions and types
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

// Expression - DSL expressions
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

// Effect - Side effect system
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
  type HandlerError, // P0-1: EffectHandler 실행 에러
  type PropagationError, // P0-1: DAG 전파 에러
  ok,
  err,
  effectError,
  handlerError, // P0-1: HandlerError 생성
  propagationError, // P0-1: PropagationError 생성
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
  resultFrom, // P0-1: throw 기반 async 함수를 Result 패턴으로 변환
  resultFromFetch, // P0-1: fetch Response를 Result 패턴으로 변환 (HTTP 에러 자동 처리)
  type HttpErrorInfo, // P0-1: HTTP 에러 정보 타입
  // Runner
  type ApiCallRequest, // P0-1: API 호출 요청 타입
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

// DAG - Dependency graph
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

// Runtime - Domain execution engine
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
  type SetError, // P0-1: set/setMany 에러 타입 (ValidationError | PropagationError)
  type CreateRuntimeOptions,
  createRuntime,
} from './runtime/index.js';

// Policy - Policy evaluation
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

// Schema - Zod integration
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

// Projection - Agent Context Projection
export {
  // Types
  type ProjectedSnapshot,
  type AgentContext,
  type AgentContextMetadata,
  type AgentActionInfo,
  type UnavailableAction,
  type BlockedReason,
  type FieldInfo,
  type ExplainValueResult,
  type ExplainActionResult,
  type ExplainFieldResult,
  type ImpactAnalysis,
  type ActionImpactAnalysis,
  // Agent Context
  projectSnapshot,
  projectAgentContext,
  type ProjectAgentContextOptions,
  // Explain
  explainValue,
  explainAction,
  explainField,
  // Impact
  analyzeValueImpact,
  analyzeActionImpact,
  getImpactMap,
} from './projection/index.js';

// Agent - AI Agent Types (implementation in Phase 3)
export {
  // Decision types
  type AgentDecision,
  type DecisionResult,
  type DecisionSuccess,
  type DecisionFailure,
  type DecisionFailureType,
  type ValidationFailureDetails,
  type UnavailableActionDetails,
  // Feedback types
  type DecisionFeedback,
  type ActionSuccessFeedback,
  type ActionFailureFeedback,
  type UnavailableActionFeedback,
  type ValidationFailureFeedback,
  // Loop types
  type AgentDecisionLoop,
  type AgentLoopConfig,
  // Session types
  type AgentCapabilities,
  type AgentSession,
} from './agent/index.js';

// Re-export Zod for convenience
export { z } from 'zod';
