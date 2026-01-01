/**
 * @manifesto-ai/compiler v1.1 Types
 *
 * TypeScript types extracted from Zod schemas.
 * Per SPEC_1.1v.md: Fragment Pipeline architecture types.
 */

import type { z } from "zod";
import type { DomainSchema as CoreDomainSchema } from "@manifesto-ai/core";
import type {
  SourceInputTypeSchema,
  SourceInputSchema,
  PlanStrategySchema,
  PlanStatusSchema,
  FragmentTypeSchema,
  ChunkDependencySchema,
  ChunkSchema,
  PlanSchema,
  FragmentDraftStatusSchema,
  FragmentInterpretationSchema,
  FragmentDraftSchema,
  StateFragmentContentSchema,
  ComputedFragmentContentSchema,
  ActionFragmentContentSchema,
  ConstraintFragmentContentSchema,
  EffectFragmentContentSchema,
  FlowFragmentContentSchema,
  FragmentContentSchema,
  ProvenanceSchema,
  FragmentSchema,
  DependencyEdgeSchema,
  DependencyGraphSchema,
  DomainDraftSchema,
  IssueSeveritySchema,
  IssueSchema,
  DomainSpecProvenanceSchema,
  DomainSpecVerificationSchema,
  DomainSpecSchema,
  ConflictTypeSchema,
  ConflictSchema,
  ResolutionStageSchema,
  ResolutionImpactSchema,
  ResolutionOptionSchema,
  ResolutionRequestSchema,
  ResolutionResponseSchema,
  ResolutionRecordSchema,
  CompilerStatusSchema,
  FailureReasonSchema,
  CompilerConfigSchema,
  CompilerStateSchema,
} from "./schema.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §3.1 SourceInput
// ═══════════════════════════════════════════════════════════════════════════════

export type SourceInputType = z.infer<typeof SourceInputTypeSchema>;
export type SourceInput = z.infer<typeof SourceInputSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// §3.2 Plan & Chunk
// ═══════════════════════════════════════════════════════════════════════════════

export type PlanStrategy = z.infer<typeof PlanStrategySchema>;
export type PlanStatus = z.infer<typeof PlanStatusSchema>;
export type FragmentType = z.infer<typeof FragmentTypeSchema>;
export type ChunkDependency = z.infer<typeof ChunkDependencySchema>;
export type Chunk = z.infer<typeof ChunkSchema>;
export type Plan = z.infer<typeof PlanSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// §3.3 FragmentDraft (UNTRUSTED)
// ═══════════════════════════════════════════════════════════════════════════════

export type FragmentDraftStatus = z.infer<typeof FragmentDraftStatusSchema>;
export type FragmentInterpretation = z.infer<typeof FragmentInterpretationSchema>;
export type FragmentDraft = z.infer<typeof FragmentDraftSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// §3.4 Fragment (VERIFIED)
// ═══════════════════════════════════════════════════════════════════════════════

export type StateFragmentContent = z.infer<typeof StateFragmentContentSchema>;
export type ComputedFragmentContent = z.infer<typeof ComputedFragmentContentSchema>;
export type ActionFragmentContent = z.infer<typeof ActionFragmentContentSchema>;
export type ConstraintFragmentContent = z.infer<typeof ConstraintFragmentContentSchema>;
export type EffectFragmentContent = z.infer<typeof EffectFragmentContentSchema>;
export type FlowFragmentContent = z.infer<typeof FlowFragmentContentSchema>;
export type FragmentContent = z.infer<typeof FragmentContentSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// §3.5 Provenance
// ═══════════════════════════════════════════════════════════════════════════════

export type Provenance = z.infer<typeof ProvenanceSchema>;
export type Fragment = z.infer<typeof FragmentSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// §3.6 DomainDraft
// ═══════════════════════════════════════════════════════════════════════════════

export type DependencyEdge = z.infer<typeof DependencyEdgeSchema>;
export type DependencyGraph = z.infer<typeof DependencyGraphSchema>;
export type DomainDraft = z.infer<typeof DomainDraftSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// §3.7 DomainSpec
// ═══════════════════════════════════════════════════════════════════════════════

export type IssueSeverity = z.infer<typeof IssueSeveritySchema>;
export type Issue = z.infer<typeof IssueSchema>;
export type DomainSpecProvenance = z.infer<typeof DomainSpecProvenanceSchema>;
export type DomainSpecVerification = z.infer<typeof DomainSpecVerificationSchema>;
export type DomainSpec = z.infer<typeof DomainSpecSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// §3.8 Conflicts
// ═══════════════════════════════════════════════════════════════════════════════

export type ConflictType = z.infer<typeof ConflictTypeSchema>;
export type Conflict = z.infer<typeof ConflictSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// §6 Resolution Contract
// ═══════════════════════════════════════════════════════════════════════════════

export type ResolutionStage = z.infer<typeof ResolutionStageSchema>;
export type ResolutionImpact = z.infer<typeof ResolutionImpactSchema>;
export type ResolutionOption = z.infer<typeof ResolutionOptionSchema>;
export type ResolutionRequest = z.infer<typeof ResolutionRequestSchema>;
export type ResolutionResponse = z.infer<typeof ResolutionResponseSchema>;
export type ResolutionRecord = z.infer<typeof ResolutionRecordSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// §7 Compiler State Machine
// ═══════════════════════════════════════════════════════════════════════════════

export type CompilerStatus = z.infer<typeof CompilerStatusSchema>;
export type FailureReason = z.infer<typeof FailureReasonSchema>;
export type CompilerConfig = z.infer<typeof CompilerConfigSchema>;
export type CompilerState = z.infer<typeof CompilerStateSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// §8 Compiler Snapshot (Extended State with Computed Values)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compiler snapshot - exposed state with computed values
 *
 * Per SPEC §7.4: Computed values derived from status.
 */
export interface CompilerSnapshot extends CompilerState {
  // ─── Computed: Status Helpers ───
  isIdle: boolean;
  isPlanning: boolean;
  isAwaitingPlanDecision: boolean;
  isGenerating: boolean;
  isAwaitingDraftDecision: boolean;
  isLowering: boolean;
  isLinking: boolean;
  isAwaitingConflictResolution: boolean;
  isVerifying: boolean;
  isEmitting: boolean;
  isSuccess: boolean;
  isFailed: boolean;

  // ─── Computed: Aggregate Helpers ───
  isTerminal: boolean;
  isProcessing: boolean;
  isAwaitingDecision: boolean;
  canRetry: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §9 Compiler Options & Input
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolution policy - what to do when resolution is required
 */
export interface ResolutionPolicy {
  /**
   * Policy for plan decision
   */
  onPlanDecision: "auto-accept" | "await" | "discard";

  /**
   * Policy for draft decision
   */
  onDraftDecision: "auto-accept" | "await" | "discard";

  /**
   * Policy for conflict resolution
   */
  onConflictResolution: "await" | "discard";
}

/**
 * Compiler options - configuration for compiler instance
 */
export interface CompilerOptions {
  /**
   * LLM adapter for text processing
   */
  llmAdapter?: LLMAdapter;

  /**
   * Anthropic adapter options
   */
  anthropic?: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
  };

  /**
   * OpenAI adapter options
   */
  openai?: {
    apiKey?: string;
    baseURL?: string;
    organization?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
  };

  /**
   * Resolution policy
   */
  resolutionPolicy?: Partial<ResolutionPolicy>;

  /**
   * Compiler config overrides
   */
  config?: Partial<CompilerConfig>;

  /**
   * Telemetry hook
   */
  telemetry?: CompilerTelemetry;
}

/**
 * Compile input - input for starting compilation
 */
export interface CompileInput {
  /**
   * Natural language text to compile
   */
  text: string;

  /**
   * Input type
   */
  type?: SourceInputType;

  /**
   * Override config for this compilation
   */
  config?: Partial<CompilerConfig>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §10 LLM Adapter Interface
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Raw chunk output from LLM (before ID assignment)
 */
export interface RawChunkOutput {
  content: string;
  expectedType: FragmentType;
  dependencies: Array<{
    kind: "requires";
    targetChunkId: string;
    reason?: string;
  }>;
  sourceSpan?: { start: number; end: number };
}

/**
 * Raw plan output from LLM (before ID assignment)
 */
export interface RawPlanOutput {
  strategy: PlanStrategy;
  chunks: RawChunkOutput[];
  rationale?: string;
}

/**
 * Raw interpretation output from LLM
 */
export interface RawInterpretationOutput {
  raw: unknown;
  description?: string;
}

/**
 * Raw draft output from LLM (before ID assignment)
 */
export interface RawDraftOutput {
  type: FragmentType;
  interpretation: RawInterpretationOutput;
  confidence?: number;
  alternatives?: RawInterpretationOutput[];
}

/**
 * LLM Result type
 */
export type LLMResult<T> =
  | { ok: true; data: T }
  | { ok: "ambiguous"; reason: string; alternatives: T[] }
  | { ok: false; error: string };

/**
 * LLM Adapter interface
 *
 * Per SPEC §10: LLM Actors are untrusted proposers.
 * Returns raw types without IDs - IDs are assigned by handlers.
 */
export interface LLMAdapter {
  /**
   * Generate a Plan from SourceInput
   */
  plan(request: {
    sourceInput: SourceInput;
    hints?: {
      preferredStrategy?: PlanStrategy;
      maxChunks?: number;
    };
  }): Promise<LLMResult<{ plan: RawPlanOutput }>>;

  /**
   * Generate a FragmentDraft from a Chunk
   */
  generate(request: {
    chunk: Chunk;
    plan: Plan;
    existingFragments: Fragment[];
    retryContext?: {
      previousDraft: FragmentDraft;
      issues: Issue[];
      attemptNumber: number;
    };
  }): Promise<LLMResult<{ draft: RawDraftOutput }>>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §11 Compiler Interface
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

/**
 * Compiler interface - main API for the compiler
 */
export interface Compiler {
  /**
   * Start compilation with input text
   */
  start(input: CompileInput): Promise<void>;

  /**
   * Get current compiler snapshot
   */
  getSnapshot(): Promise<CompilerSnapshot>;

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: CompilerSnapshot) => void): Unsubscribe;

  /**
   * Dispatch an action to the compiler domain
   */
  dispatch(action: string, input?: unknown): Promise<void>;

  // ─── Plan Phase ───

  /**
   * Accept the current plan and proceed to generation
   */
  acceptPlan(): Promise<void>;

  /**
   * Reject the current plan with reason
   */
  rejectPlan(reason: string): Promise<void>;

  // ─── Generate Phase ───

  /**
   * Accept a fragment draft
   */
  acceptDraft(draftId: string): Promise<void>;

  /**
   * Reject a fragment draft with reason
   */
  rejectDraft(draftId: string, reason: string): Promise<void>;

  // ─── Conflict Resolution ───

  /**
   * Resolve a conflict by selecting an option
   */
  resolveConflict(resolutionId: string, selectedOptionId: string): Promise<void>;

  // ─── Terminal ───

  /**
   * Fail the compilation with a reason
   */
  fail(reason: FailureReason): Promise<void>;

  /**
   * Reset to idle state
   */
  reset(): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §12 Effect Handler Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Effect handler result
 */
export interface EffectHandlerResult {
  action: string;
  input: Record<string, unknown>;
}

/**
 * Compiler effect types (v1.1)
 */
export type CompilerEffectType =
  | "llm:plan"
  | "llm:generate"
  | "pass:lower"
  | "linker:link"
  | "verifier:verify"
  | "emitter:emit";

// ═══════════════════════════════════════════════════════════════════════════════
// §13 Telemetry
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Telemetry hook for monitoring compiler execution
 */
export interface CompilerTelemetry {
  /**
   * Called when compilation phase changes
   */
  onPhaseChange?(from: CompilerStatus, to: CompilerStatus): void;

  /**
   * Called when a plan is received
   */
  onPlanReceived?(plan: Plan): void;

  /**
   * Called when a fragment draft is received
   */
  onDraftReceived?(draft: FragmentDraft): void;

  /**
   * Called when a fragment is lowered
   */
  onFragmentLowered?(fragment: Fragment): void;

  /**
   * Called when conflicts are detected
   */
  onConflictsDetected?(conflicts: Conflict[]): void;

  /**
   * Called when resolution is requested
   */
  onResolutionRequested?(request: ResolutionRequest): void;

  /**
   * Called when compilation completes (success or failed)
   */
  onComplete?(result: CompilerSnapshot): void;

  /**
   * Called when an effect is about to be executed
   */
  onEffectStart?(effectType: CompilerEffectType, params: Record<string, unknown>): void;

  /**
   * Called when an effect completes
   */
  onEffectEnd?(effectType: CompilerEffectType, result: EffectHandlerResult): void;

  /**
   * Called on any error during compilation
   */
  onError?(error: Error, context: string): void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §14 Re-exports for convenience
// ═══════════════════════════════════════════════════════════════════════════════

// Re-export core domain schema type
export type { CoreDomainSchema };
