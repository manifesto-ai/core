/**
 * @module loop
 *
 * 추론 루프 모듈
 *
 * 핵심 기능:
 * - ReasoningLoop: 질의에 대한 반복적 추론 실행
 * - ActionSelector: 상태 기반 다음 액션 선택
 * - Prompts: LLM 프롬프트 템플릿
 */

// Types
export type {
  LoopConfig,
  LoopResult,
  LoopErrorCode,
  LoopError,
  IReasoningLoop,
  LoopDependencies,
  SelectedAction,
} from './types.js';

export { DEFAULT_LOOP_CONFIG } from './types.js';

// Selector
export {
  isTerminalState,
  selectNodeToExpand,
  selectNextAction,
  diagnoseActionConditions,
  describeAction,
} from './selector.js';

// Prompts
export {
  PARSED_QUERY_SCHEMA,
  EXPAND_DECISION_SCHEMA,
  buildAnalyzePrompt,
  buildExpandDecisionPrompt,
  buildAnswerPrompt,
  buildUncertainPrompt,
  formatReasoningPath,
  formatContextAsMarkdown,
  getSystemMessage,
} from './prompts.js';

// Loop Implementation
export { ReasoningLoop, createReasoningLoop } from './loop.js';
