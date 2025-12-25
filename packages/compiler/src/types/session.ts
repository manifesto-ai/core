/**
 * Session Types - Compiler session state and results
 *
 * These types define the compiler's runtime state and output formats.
 * They enable observable compilation (AGENT_README Invariant #10).
 */

import type {
  SemanticPath,
  SourceDefinition,
  DerivedDefinition,
  ActionDefinition,
} from '@manifesto-ai/core';
import type { ArtifactId } from './artifact.js';
import type { Fragment, FragmentId } from './fragment.js';
import type { FragmentDraft } from './fragment-draft.js';
import type { Provenance } from './provenance.js';
import type { Conflict } from './conflict.js';
import type { Issue } from './issue.js';
import type { Patch, PatchHint } from './patch.js';

// ============================================================================
// Compiler Phases
// ============================================================================

/**
 * Compiler execution phases
 */
export type CompilerPhase =
  | 'idle' // Not started
  | 'parsing' // Parsing artifacts
  | 'extracting' // Extracting findings from artifacts
  | 'lowering' // Lowering findings to fragments
  | 'linking' // Linking fragments together
  | 'verifying' // Verifying linked result
  | 'repairing' // Applying patches to fix issues
  | 'done' // Compilation complete
  | 'error'; // Compilation failed

// ============================================================================
// Compiler Results
// ============================================================================

/**
 * Domain draft - intermediate representation before final domain
 *
 * Not the final runtime object; just structured output for generation.
 */
export interface DomainDraft {
  /** Domain ID */
  id?: string;
  /** Domain name */
  name?: string;
  /** Domain description */
  description?: string;

  /** Data schema (merged from SchemaFragments) */
  dataSchema: Record<string, unknown>;
  /** State schema (merged from SchemaFragments) */
  stateSchema: Record<string, unknown>;

  /** Source definitions (from SourceFragments) */
  sources: Record<SemanticPath, SourceDefinition>;
  /** Derived definitions (from DerivedFragments) */
  derived: Record<SemanticPath, DerivedDefinition>;
  /** Action definitions (from ActionFragments) */
  actions: Record<string, ActionDefinition>;

  /** Initial state values */
  initialState?: unknown;
}

/**
 * Result of linking fragments
 */
export interface LinkResult {
  /** All fragments (including resolved conflicts) */
  fragments: Fragment[];

  /** Generated domain draft (if no blocking conflicts) */
  domain?: DomainDraft;

  /** Detected conflicts */
  conflicts: Conflict[];

  /** Link-time issues */
  issues: Issue[];

  /** Version for incremental updates */
  version: string;
}

/**
 * Result of verifying a link result
 */
export interface VerifyResult {
  /** Whether verification passed */
  valid: boolean;

  /** Verification issues */
  issues: Issue[];
}

/**
 * Result of compiling input
 */
export interface CompileResult {
  /** Generated fragments */
  fragments: Fragment[];

  /** Generated domain draft (if successful) */
  domain?: DomainDraft;

  /** All issues (from linking and verification) */
  issues: Issue[];

  /** All conflicts (from linking) */
  conflicts: Conflict[];

  /** Runtime snapshot (if session was created) */
  runtimeSnapshot?: CompilerSessionSnapshot;

  /** Provenance map for all fragments */
  provenance: Map<FragmentId, Provenance>;
}

// ============================================================================
// Compiler Session (Observability)
// ============================================================================

/**
 * A blocker preventing compilation from completing
 */
export interface Blocker {
  /** Type of blocker */
  kind: 'conflict' | 'issue';
  /** ID of the conflict or issue */
  id: string;
  /** Human-readable message */
  message: string;
}

/**
 * NextStep - 다음 실행 가능한 작업
 *
 * 리뷰어 피드백 반영: 구체적인 discriminated union으로 정의
 * - 각 kind에 따라 필요한 파라미터가 명확히 정의됨
 * - UI/UX에서 직접 사용 가능한 형태
 */
export type NextStep =
  | NextStepApplyPatch
  | NextStepResolveConflict
  | NextStepFixIssue
  | NextStepAddFragment
  | NextStepRecompile
  | NextStepReviewDraft
  | NextStepConfirmDomain;

/**
 * PatchHint를 적용하여 Issue/Conflict 해결
 */
export interface NextStepApplyPatch {
  kind: 'applyPatch';
  /** 적용할 PatchHint의 ID */
  patchHintId: string;
  /** 대상 Fragment ID */
  targetFragmentId?: FragmentId;
  /** 해결할 Issue/Conflict ID */
  resolves: string;
  /** 사용자에게 표시할 설명 */
  rationale: string;
}

/**
 * Conflict 해결 (선택 필요)
 */
export interface NextStepResolveConflict {
  kind: 'resolveConflict';
  /** 해결할 Conflict ID */
  conflictId: string;
  /** 선택 가능한 Fragment ID 목록 */
  candidates: FragmentId[];
  /** 사용자에게 표시할 설명 */
  rationale: string;
}

/**
 * Issue 수정 (수동 수정 필요)
 */
export interface NextStepFixIssue {
  kind: 'fixIssue';
  /** 수정할 Issue ID */
  issueId: string;
  /** 관련 Fragment ID */
  fragmentId: FragmentId;
  /** 추천 수정 내용 */
  suggestion?: string;
  /** 사용자에게 표시할 설명 */
  rationale: string;
}

/**
 * 누락된 Fragment 추가
 */
export interface NextStepAddFragment {
  kind: 'addFragment';
  /** 필요한 path (누락된 의존성) */
  requiredPath: string;
  /** 추천 Fragment 종류 */
  suggestedKind: 'SchemaFragment' | 'SourceFragment' | 'DerivedFragment';
  /** 요청한 Fragment ID */
  requestedBy: FragmentId;
  /** 사용자에게 표시할 설명 */
  rationale: string;
}

/**
 * 변경된 Artifact 재컴파일
 */
export interface NextStepRecompile {
  kind: 'recompile';
  /** 재컴파일할 Artifact ID */
  artifactId: string;
  /** 영향받는 Fragment ID 목록 */
  affectedFragments: FragmentId[];
  /** 재컴파일 이유 */
  reason: 'modified' | 'dependencyChanged' | 'patchApplied';
  /** 사용자에게 표시할 설명 */
  rationale: string;
}

/**
 * FragmentDraft 검토 필요 (LLM 출력)
 */
export interface NextStepReviewDraft {
  kind: 'reviewDraft';
  /** 검토할 Draft 인덱스 */
  draftIndex: number;
  /** Draft confidence */
  confidence: number;
  /** 검토가 필요한 이유 */
  reason: 'lowConfidence' | 'ambiguousType' | 'manualReviewRequested';
  /** 사용자에게 표시할 설명 */
  rationale: string;
}

/**
 * Domain Draft 확정 (최종 단계)
 */
export interface NextStepConfirmDomain {
  kind: 'confirmDomain';
  /** Domain Draft 해시 (변경 감지용) */
  domainHash: string;
  /** 미해결 경고 수 */
  warningCount: number;
  /** 사용자에게 표시할 설명 */
  rationale: string;
}

/**
 * NextStep의 kind 추출 helper
 */
export type NextStepKind = NextStep['kind'];

/**
 * NextStep type guards
 */
export function isNextStepApplyPatch(step: NextStep): step is NextStepApplyPatch {
  return step.kind === 'applyPatch';
}

export function isNextStepResolveConflict(step: NextStep): step is NextStepResolveConflict {
  return step.kind === 'resolveConflict';
}

export function isNextStepFixIssue(step: NextStep): step is NextStepFixIssue {
  return step.kind === 'fixIssue';
}

export function isNextStepAddFragment(step: NextStep): step is NextStepAddFragment {
  return step.kind === 'addFragment';
}

export function isNextStepRecompile(step: NextStep): step is NextStepRecompile {
  return step.kind === 'recompile';
}

export function isNextStepReviewDraft(step: NextStep): step is NextStepReviewDraft {
  return step.kind === 'reviewDraft';
}

export function isNextStepConfirmDomain(step: NextStep): step is NextStepConfirmDomain {
  return step.kind === 'confirmDomain';
}

/**
 * Log entry
 */
export interface LogEntry {
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Log message */
  message: string;
  /** Timestamp */
  at: number;
  /** Additional data */
  data?: unknown;
}

/**
 * Compiler session snapshot
 *
 * Provides a complete view of the compiler's current state.
 * Used for observability and UI rendering.
 */
export interface CompilerSessionSnapshot {
  /** Current phase */
  phase: CompilerPhase;

  /** Progress within the current phase */
  progress: {
    stage: number;
    total: number;
    message: string;
  };

  /** Artifact IDs being compiled */
  artifacts: ArtifactId[];

  /** Number of fragments generated */
  fragmentsCount: number;

  /** Number of conflicts detected */
  conflictsCount: number;

  /** Number of blocking issues */
  blockingIssuesCount: number;

  /** Current blockers preventing completion */
  blockers: Blocker[];

  /** Suggested next steps */
  nextSteps: NextStep[];

  /** Recent log entries */
  logs?: LogEntry[];

  /** Timestamp of this snapshot */
  timestamp: number;
}

// ============================================================================
// Compiler Options
// ============================================================================

/**
 * Target output format
 */
export type CompileTarget = 'fragments' | 'domain' | 'both';

/**
 * Compile options
 */
export interface CompileOptions {
  /** Target output format */
  target?: CompileTarget;

  /** Enable incremental compilation */
  incremental?: boolean;

  /** Maximum effect risk level allowed */
  maxEffectRisk?: 'none' | 'low' | 'medium' | 'high' | 'critical';

  /** Skip verification step */
  skipVerification?: boolean;

  /** Patches to apply during compilation */
  patches?: Patch[];
}

// ============================================================================
// Compiler Configuration
// ============================================================================

/**
 * Effect risk levels
 */
export type EffectRisk = 'none' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Effect handler policy for safety gating
 */
export interface EffectPolicy {
  /** Maximum allowed effect risk level */
  maxRisk: EffectRisk;
  /** Allowed API endpoints (for apiCall effects) */
  allowedEndpoints?: string[];
  /** Allowed effect types */
  allowedEffectTypes?: string[];
  /** HITL configuration for human-in-the-loop approval */
  hitl?: HITLConfig;
}

// ============================================================================
// HITL (Human-in-the-Loop) Gate Types
// ============================================================================

/**
 * HITL configuration for high-risk effect approval
 *
 * Implements PRD 6.9 safety requirements.
 */
export interface HITLConfig {
  /** Risk levels that require human approval */
  requireApprovalFor: EffectRisk[];
  /** Callback to request approval (optional - if not provided, blocks by default) */
  onApprovalRequest?: (request: HITLApprovalRequest) => Promise<HITLApprovalResult>;
  /** Approval timeout in milliseconds (default: no timeout) */
  approvalTimeout?: number;
  /** Whether to allow auto-approval for previously approved patterns */
  allowPatternCache?: boolean;
}

/**
 * HITL approval request - sent to human reviewer
 */
export interface HITLApprovalRequest {
  /** Unique request ID */
  id: string;
  /** Fragment ID requiring approval */
  fragmentId: FragmentId;
  /** Type of effect (e.g., 'apiCall', 'storage', 'external') */
  effectType: string;
  /** Risk level of the effect */
  riskLevel: EffectRisk;
  /** Human-readable description of what the effect does */
  description: string;
  /** Additional context for the reviewer */
  context: Record<string, unknown>;
  /** Timestamp when the request was created */
  createdAt: number;
}

/**
 * HITL approval result - response from human reviewer
 */
export interface HITLApprovalResult {
  /** Whether the effect was approved */
  approved: boolean;
  /** Who approved/rejected (optional) */
  approvedBy?: string;
  /** Reason for approval/rejection */
  reason?: string;
  /** Timestamp when approved/rejected */
  approvedAt?: number;
  /** Whether to cache this decision for similar patterns */
  cacheDecision?: boolean;
}

/**
 * Create a unique HITL request ID
 */
export function createHITLRequestId(): string {
  return `hitl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a HITL approval request
 */
export function createHITLApprovalRequest(
  fragmentId: FragmentId,
  effectType: string,
  riskLevel: EffectRisk,
  description: string,
  context: Record<string, unknown> = {}
): HITLApprovalRequest {
  return {
    id: createHITLRequestId(),
    fragmentId,
    effectType,
    riskLevel,
    description,
    context,
    createdAt: Date.now(),
  };
}

/**
 * LLM adapter interface for NL pass
 *
 * IMPORTANT: LLM은 FragmentDraft만 생성 (AGENT_README Invariant #2: LLM은 비신뢰 제안자)
 * Fragment로의 변환은 Deterministic Lowering 단계에서 수행
 */
export interface LLMAdapter {
  /**
   * Generate fragment drafts from natural language input
   *
   * @param input - Natural language input
   * @param context - Additional context (existing fragments, schema, etc.)
   * @returns FragmentDraft[] - LLM이 생성한 draft (검증/변환 필요)
   */
  generateDrafts(input: string, context: LLMContext): Promise<FragmentDraft[]>;

  /** Model identifier for provenance tracking */
  modelId: string;

  /** Optional: Maximum confidence the model can report */
  maxConfidence?: number;
}

/**
 * LLM context for draft generation
 */
export interface LLMContext {
  /** Existing fragments for reference */
  existingFragments?: Fragment[];
  /** Current schema paths */
  existingPaths?: string[];
  /** Existing fragment kinds for consistency */
  existingFragmentKinds?: string[];
  /** Domain description/context */
  domainDescription?: string;
  /** Additional hints */
  hints?: Record<string, unknown>;
}

/**
 * Compiler configuration
 */
export interface CompilerConfig {
  /** Core version this compiler targets */
  coreVersion: string;

  /** Optional LLM adapter for NL pass */
  llmAdapter?: LLMAdapter;

  /** Effect policy for safety gating */
  effectPolicy?: EffectPolicy;

  /** Whether to require provenance on all fragments */
  requireProvenance?: boolean;

  /** Path normalization rules */
  pathNormalizationRules?: PathNormalizationRule[];
}

/**
 * Path normalization rule
 */
export interface PathNormalizationRule {
  /** Pattern to match */
  pattern: RegExp;
  /** Normalization function */
  normalize: (path: string) => SemanticPath;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an initial compiler session snapshot
 */
export function createInitialSnapshot(artifacts: ArtifactId[]): CompilerSessionSnapshot {
  return {
    phase: 'idle',
    progress: { stage: 0, total: 0, message: '' },
    artifacts,
    fragmentsCount: 0,
    conflictsCount: 0,
    blockingIssuesCount: 0,
    blockers: [],
    nextSteps: [],
    timestamp: Date.now(),
  };
}

/**
 * Create a log entry
 */
export function createLogEntry(
  level: LogEntry['level'],
  message: string,
  data?: unknown
): LogEntry {
  return { level, message, at: Date.now(), data };
}

/**
 * Generate a link result version
 */
export function generateLinkResultVersion(): string {
  return `link_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// Runtime-aided Verification Types (P1-A)
// ============================================================================

/**
 * Result of explaining a path value in the compiler context
 *
 * Provides compiler-specific explanation including contributing fragments.
 * Extends Core Runtime's explain() with fragment provenance.
 */
export interface ExplainCompilerValueResult {
  /** The path being explained */
  path: SemanticPath;
  /** Current value at the path */
  value: unknown;
  /** Fragment IDs that contributed to this value */
  contributingFragments: FragmentId[];
  /** Expression (if derived path) */
  expression?: unknown;
  /** Recursive explanations for dependencies */
  dependencies: ExplainCompilerValueResult[];
  /** Natural language summary */
  summary: string;
}

/**
 * Impact analysis for compiler changes
 *
 * Shows what would be affected by changing a fragment or path.
 */
export interface CompilerImpactAnalysis {
  /** What triggered the impact analysis */
  source:
    | { kind: 'fragment'; fragmentId: FragmentId }
    | { kind: 'path'; path: SemanticPath };
  /** Directly affected paths (one hop) */
  directImpact: SemanticPath[];
  /** Transitively affected paths (multiple hops) */
  transitiveImpact: SemanticPath[];
  /** Fragments that would need re-verification */
  affectedFragments: FragmentId[];
  /** Issues that might be resolved or created */
  potentialIssueChanges: Array<{
    issueId?: string;
    change: 'resolved' | 'created' | 'modified';
    reason: string;
  }>;
  /** Conflicts that might be affected */
  affectedConflicts: string[];
}

/**
 * AI-friendly compiler context
 *
 * Projects current compiler state into a format optimized for AI consumption.
 * Used by agents for decision making.
 */
export interface CompilerAgentContext {
  /** Current compilation snapshot */
  snapshot: CompilerSessionSnapshot;
  /** Available actions with explanations */
  availableActions: Array<{
    action: NextStep;
    explanation: string;
    estimatedImpact: string[];
  }>;
  /** Current blockers with detailed explanations */
  blockerDetails: Array<{
    blocker: Blocker;
    explanation: string;
    suggestedResolutions: string[];
  }>;
  /** Fragment summary for context */
  fragmentSummary: {
    byKind: Record<string, number>;
    byProvenance: Record<string, number>;
    totalPaths: number;
  };
  /** Metadata for token estimation */
  metadata: {
    projectedAt: number;
    estimatedTokens: number;
  };
}

/**
 * Explanation of why an issue exists
 *
 * Traces the reasoning chain back through fragment provenance.
 */
export interface IssueExplanation {
  /** The issue being explained */
  issue: Issue;
  /** Chain of reasoning steps */
  reasoningChain: Array<{
    step: string;
    evidence: string;
  }>;
  /** Related fragments and their roles */
  relatedFragments: Array<{
    fragmentId: FragmentId;
    role: 'cause' | 'affected' | 'related';
    explanation: string;
  }>;
  /** Suggested fix with explanation */
  suggestedFix?: {
    patch: PatchHint;
    explanation: string;
    confidence: number;
  };
  /** Natural language summary */
  summary: string;
}

/**
 * Explanation of why a conflict exists
 *
 * Details the competing fragments and their origins.
 */
export interface ConflictExplanation {
  /** The conflict being explained */
  conflict: Conflict;
  /** Details of each competing fragment */
  candidates: Array<{
    fragmentId: FragmentId;
    origin: Provenance;
    provides: string[];
    reasoning: string;
  }>;
  /** Why they conflict */
  conflictReason: string;
  /** Resolution options with explanations */
  resolutionOptions: Array<{
    resolution: PatchHint;
    explanation: string;
    tradeoffs: string[];
  }>;
  /** Natural language summary */
  summary: string;
}
