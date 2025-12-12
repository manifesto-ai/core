/**
 * @manifesto-ai/agent
 *
 * Manifesto Snapshot을 입력으로 받아 LLM을 "순수 정책 함수"로 실행하고,
 * 모든 부작용을 Effect로 표준화해 Runtime이 통제하는 세션 레이어.
 *
 * 핵심 원칙:
 * - LLM을 부품으로 격하: f(snapshot) → effects[]
 * - 제어권은 Runtime이 소유: step/run, budget, stop
 * - 스키마를 "주입"하지 않고 집행: Schema → Constraints 컴파일 + Validator Gatekeeping
 * - derived.*는 Runtime만 쓴다 — LLM은 절대 직접 수정 불가
 * - 모든 실패는 상태가 된다 — 예외로 crash하지 않음
 * - 순차 실행 + 즉시 중단 — 부분 실패 시 나머지 폐기
 *
 * @version 0.1.0
 */

// ============================================================================
// Types
// ============================================================================

// Effect types
export type {
  PatchOp,
  Effect,
  ToolCallEffect,
  SnapshotPatchEffect,
  LogEmitEffect,
  HumanAskEffect,
} from './types/index.js';
export {
  isToolCallEffect,
  isSnapshotPatchEffect,
  isLogEmitEffect,
  generateEffectId,
} from './types/index.js';

// Constraints types
export type {
  Constraints,
  TypeRule,
  Invariant,
} from './types/index.js';
export {
  createDefaultConstraints,
  addTypeRule,
  addInvariant,
  mergeConstraints,
} from './types/index.js';

// Error types
export type {
  PatchErrorState,
  EffectErrorState,
  HandlerErrorState,
  ErrorState,
} from './types/index.js';
export {
  isPatchErrorState,
  isEffectErrorState,
  isHandlerErrorState,
  createPatchError,
  createEffectError,
  createHandlerError,
  formatErrorForLLM,
} from './types/index.js';

// Policy types
export type { Policy } from './types/index.js';
export {
  createDefaultPolicy,
  mergePolicy,
  validatePolicy,
} from './types/index.js';

// Observation types
export type { Observation } from './types/index.js';
export {
  generateObservationId,
  createObservation,
  createToolObservation,
} from './types/index.js';

// Client types
export type {
  AgentDecision,
  AgentClientInput,
  AgentClient,
} from './types/index.js';
export {
  createMockClient,
  createFixedClient,
} from './types/index.js';

// Projection types (v0.1.x)
export type {
  ProjectedSnapshot,
  ProjectionMetadata,
  ProjectionResult,
  CompressionStrategy,
  ProjectionProviderConfig,
  ProjectionProvider,
  CreateProjectionProviderOptions,
} from './projection/index.js';
export {
  createSimpleProjectionProvider,
  createIdentityProjectionProvider,
  createDynamicProjectionProvider,
} from './projection/index.js';

// Session types
export type {
  StepResult,
  RunResult,
  AgentSession,
  ApplyResult,
  AgentRuntime,
  /** @deprecated Use AgentRuntime instead */
  ManifestoCoreLike,
  DoneChecker,
} from './types/index.js';
export {
  defaultDoneChecker,
  phaseDoneChecker,
} from './types/index.js';

// ============================================================================
// Validation
// ============================================================================

export type {
  AclValidationResult,
  BoundsValidationResult,
  TypeValidationResult,
  InvariantValidationResult,
  PatchValidationResult,
} from './validation/index.js';

export {
  // ACL
  FORBIDDEN_PATH_PREFIXES,
  validatePathAcl,
  validatePathsAcl,
  isDerivedPath,
  isDataPath,
  isStatePath,
  // Bounds
  parsePath,
  validatePathBounds,
  validateAppendBounds,
  // Type rules
  getValueType,
  validateType,
  validateTypeRule,
  validateTypeRules,
  matchPathPattern,
  // Invariant
  validateInvariant,
  validateInvariants,
  requiredFieldInvariant,
  rangeInvariant,
  arrayLengthInvariant,
  customInvariant,
  // Patch pipeline
  validatePatchOpSchema,
  validatePatchOp,
  validatePatchOps,
  validatePostPatchInvariants,
  validatePatchPipeline,
} from './validation/index.js';

// ============================================================================
// Handlers
// ============================================================================

export type {
  HandlerContext,
  Tool,
  ToolRegistry,
  EffectHandler,
  EffectHandlerRegistry,
  ToolCallResult,
  PatchResult,
  LogEntry,
  LogCollector,
  ConsoleLogOptions,
  DefaultHandlersOptions,
} from './handlers/index.js';

export {
  // Registry
  createEffectHandlerRegistry,
  createToolRegistry,
  defineTool,
  // Tool call
  createToolCallHandler,
  executeToolCall,
  // Patch
  createSnapshotPatchHandler,
  PatchValidationError,
  applyPatch,
  applyPatchOpToObject,
  // Log
  createLogCollector,
  defaultLogFormatter,
  createLogEmitHandler,
  getGlobalLogCollector,
  resetGlobalLogCollector,
  // Default handlers
  createDefaultHandlerRegistry,
} from './handlers/index.js';

// ============================================================================
// Prompt
// ============================================================================

export type {
  SystemPromptOptions,
  StepPromptInput,
  StepPromptOptions,
  LLMMessage,
} from './prompt/index.js';

export {
  SYSTEM_PROMPT,
  EFFECT_ID_GUIDANCE,
  buildSystemPrompt,
  getFullSystemPrompt,
  buildStepPrompt,
  summarizeSnapshot,
  createSnapshotFilter,
  buildLLMMessages,
} from './prompt/index.js';

// ============================================================================
// Session
// ============================================================================

export type {
  ExecutorContext,
  EffectValidationResult,
  CreateAgentSessionOptions,
  SimpleSessionOptions,
  DomainRuntimeLike,
  CreateAgentRuntimeOptions,
  ProjectionConfig,
} from './session/index.js';

export {
  executeStep,
  executeRun,
  validateEffectStructure,
  validateAgentDecision,
  createAgentSession,
  createSimpleSession,
  createAgentRuntime,
} from './session/index.js';
