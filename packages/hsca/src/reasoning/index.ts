/**
 * HSCA Reasoning Module
 *
 * "Explainable Ignorance" 구현을 위한 추론 모듈
 *
 * 핵심 개념:
 * - reasoningPath: 모든 추론 시도를 기록
 * - isInformationNotFound: 시스템이 구조적으로 "모른다" 판정
 * - concludeNotFound: LLM 호출 없이 시스템이 결론
 *
 * @example
 * ```typescript
 * import {
 *   createReasoningState,
 *   addReasoningStep,
 *   isInformationNotFound,
 *   concludeNotFound,
 *   buildNotFoundExplanation
 * } from '@manifesto-ai/hsca';
 *
 * // 1. 질의 시작
 * let state = createReasoningState("2024년 3분기 매출은?");
 *
 * // 2. 추론 경로에 시도 기록
 * state = addReasoningStep(state, {
 *   step: 1, type: 'retrieve', target: 'finance.revenue.q3.2024',
 *   relevance: 0.12, result: 'no_match', evidence: []
 * });
 *
 * state = addReasoningStep(state, {
 *   step: 2, type: 'expand', target: 'finance.*',
 *   relevance: 0.15, result: 'no_relevant_children', evidence: []
 * });
 *
 * // 3. 시스템이 구조적으로 "모른다" 판정
 * if (isInformationNotFound(state)) {
 *   // 4. LLM 호출 없이 결론
 *   state = concludeNotFound.execute(state);
 *
 *   // 5. "왜 모르는지" 설명
 *   const explanation = buildNotFoundExplanation(state.reasoningPath);
 * }
 * ```
 */

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

export type {
  // Query types
  QueryIntent,
  QueryConstraint,
  QueryConstraintOperator,
  ParsedQuery,
  QueryStatus,
  CurrentQuery,
  // Node types
  RetrievedNode,
  // Reasoning types
  ReasoningStepType,
  ReasoningStep,
  // Conclusion types
  ConclusionType,
  Conclusion,
} from './types.js';

export {
  // Schemas
  QueryIntentSchema,
  QueryConstraintOperatorSchema,
  QueryConstraintSchema,
  ParsedQuerySchema,
  QueryStatusSchema,
  CurrentQuerySchema,
  RetrievedNodeSchema,
  ReasoningStepTypeSchema,
  ReasoningStepSchema,
  ConclusionTypeSchema,
  ConclusionSchema,
} from './types.js';

// ═══════════════════════════════════════════════════════
// State Management
// ═══════════════════════════════════════════════════════

export type { ReasoningState } from './state.js';

export {
  // Constants
  INITIAL_REASONING_STATE,
  // State creation
  createReasoningState,
  resetReasoningState,
  // State mutation helpers
  addReasoningStep,
  setRetrievedContext,
  addRetrievedNodes,
  setQueryStatus,
  setParsedQuery,
  setConclusion,
  // State query helpers
  getAttemptCount,
  getMaxRelevance,
  getSearchedTargets,
} from './state.js';

// ═══════════════════════════════════════════════════════
// Derived Values
// ═══════════════════════════════════════════════════════

export type { DerivedConfig, DerivedValues } from './derived.js';

export {
  // Config
  DEFAULT_DERIVED_CONFIG,
  // Token-related
  getCurrentContextTokens,
  isWithinTokenBudget,
  // Relevance-related
  getAvgRelevance,
  getMaxRelevanceFromPath,
  // ★ Core: Information not found detection
  getAttemptCount as getDerivedAttemptCount,
  isInformationNotFound,
  isInformationNotFoundWithConfig,
  // Expansion detection
  needsExpansion,
  // Answer detection
  canAnswer,
  // All derived values
  computeDerivedValues,
} from './derived.js';

// ═══════════════════════════════════════════════════════
// Actions
// ═══════════════════════════════════════════════════════

export type {
  ActionMeta,
  ActionDefinition,
  ExpandContextInput,
  ConcludeWithAnswerInput,
  ConcludeUncertainInput,
  HSCAActionName,
} from './actions.js';

export {
  // Individual actions
  analyzeQuery,
  setQueryStatusAction,
  addReasoningStepAction,
  expandContext,
  // ★ Core: conclude actions
  concludeNotFound,
  concludeWithAnswer,
  concludeUncertain,
  // Action registry
  HSCA_ACTIONS,
} from './actions.js';

// ═══════════════════════════════════════════════════════
// Explanation Generation
// ═══════════════════════════════════════════════════════

export type { ExplanationConfig, StructuredExplanation } from './explanation.js';

export {
  // Config
  DEFAULT_EXPLANATION_CONFIG,
  // ★ Core: "Why don't know" explanation
  buildNotFoundExplanation,
  // Other explanations
  buildConclusionExplanation,
  formatReasoningPath,
  summarizeReasoning,
  buildStructuredExplanation,
} from './explanation.js';
