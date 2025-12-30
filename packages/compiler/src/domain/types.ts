import type { DomainSchema as CoreDomainSchema } from "@manifesto-ai/core";

/**
 * Compiler context for additional information
 */
export interface CompilerContext {
  /**
   * Name of the domain being compiled
   */
  domainName?: string;

  /**
   * List of existing action names (for context)
   */
  existingActions?: string[];

  /**
   * Glossary of domain-specific terms
   */
  glossary?: Record<string, string>;
}

/**
 * Normalized intent - structured representation of a requirement
 */
export interface NormalizedIntent {
  /**
   * Intent kind
   */
  kind: "state" | "computed" | "action" | "constraint";

  /**
   * Human-readable description
   */
  description: string;

  /**
   * Confidence level (0.0 - 1.0)
   */
  confidence: number;
}

/**
 * Attempt record - tracks validation attempts
 */
export interface AttemptRecord {
  /**
   * Attempt number (0-indexed)
   */
  attemptNumber: number;

  /**
   * Hash of the draft for correlation
   */
  draftHash: string;

  /**
   * Validation diagnostics from this attempt
   */
  diagnostics: CompilerDiagnostics | null;

  /**
   * Timestamp of the attempt (from effect handler)
   */
  timestamp: number;
}

/**
 * Resolution option - choice for ambiguity resolution
 */
export interface ResolutionOption {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Human-readable description
   */
  description: string;

  /**
   * Optional preview of what this option produces
   */
  preview?: string;
}

/**
 * Discard reason codes
 */
export type DiscardReason =
  | "RESOLUTION_REQUIRED_BUT_DISABLED"
  | "MAX_RETRIES_EXCEEDED"
  | "EMPTY_INPUT"
  | "SEGMENTATION_FAILED"
  | "USER_CANCELLED";

/**
 * Compilation status
 */
export type CompilerStatus =
  | "idle"
  | "segmenting"
  | "normalizing"
  | "proposing"
  | "validating"
  | "awaiting_resolution"
  | "success"
  | "discarded";

/**
 * Resolution policy
 */
export interface CompilerResolutionPolicy {
  /**
   * What to do when resolution is required
   */
  onResolutionRequired: "await" | "discard";
}

/**
 * Simplified diagnostics for compiler use
 */
export interface CompilerDiagnostics {
  valid: boolean;
  errors: CompilerDiagnostic[];
  warnings: CompilerDiagnostic[];
}

export interface CompilerDiagnostic {
  code: string;
  message: string;
  path?: string;
  suggestion?: string;
}

/**
 * Compiler state - full state of the compiler domain
 */
export interface CompilerState {
  // ─── Input ───
  input: string | null;
  targetSchema: unknown | null;
  context: CompilerContext | null;

  // ─── Configuration ───
  maxRetries: number;
  traceDrafts: boolean;

  // ─── Pipeline State ───
  segments: string[];
  intents: NormalizedIntent[];
  currentDraft: unknown | null;

  // ─── Validation State ───
  diagnostics: CompilerDiagnostics | null;

  // ─── Loop Control ───
  attemptCount: number;

  // ─── History (when traceDrafts: true) ───
  attempts: AttemptRecord[];

  // ─── Resolution State ───
  resolutionOptions: ResolutionOption[];
  resolutionReason: string | null;

  // ─── Status ───
  status: CompilerStatus;

  // ─── Output ───
  result: CoreDomainSchema | null;
  resultHash: string | null;
  discardReason: DiscardReason | null;
}

/**
 * Compiler snapshot - exposed state with computed values
 */
export interface CompilerSnapshot extends CompilerState {
  // Computed values
  isIdle: boolean;
  isSegmenting: boolean;
  isNormalizing: boolean;
  isProposing: boolean;
  isValidating: boolean;
  isAwaitingResolution: boolean;
  isTerminal: boolean;
  canRetry: boolean;
}

/**
 * Compiler options
 */
export interface CompilerOptions {
  /**
   * LLM adapter for text processing.
   * If provided, takes precedence over anthropic/openai options.
   */
  llmAdapter?: LLMAdapter;

  /**
   * Anthropic adapter options.
   * Used if llmAdapter is not provided and openai is not specified.
   */
  anthropic?: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
  };

  /**
   * OpenAI adapter options.
   * Used if llmAdapter is not provided. Takes precedence over anthropic.
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
   * Resolution policy (default: 'discard')
   */
  resolutionPolicy?: CompilerResolutionPolicy;

  /**
   * Maximum retries (default: 5)
   */
  maxRetries?: number;

  /**
   * Whether to trace drafts (default: false)
   */
  traceDrafts?: boolean;

  /**
   * Telemetry hook for monitoring compilation (optional)
   * Per SPEC §15.2
   */
  telemetry?: CompilerTelemetry;
}

/**
 * Compile input
 */
export interface CompileInput {
  /**
   * Natural language text to compile
   */
  text: string;

  /**
   * Target schema (optional)
   */
  schema?: unknown;

  /**
   * Additional context
   */
  context?: CompilerContext;

  /**
   * Override max retries
   */
  maxRetries?: number;

  /**
   * Override trace drafts
   */
  traceDrafts?: boolean;
}

/**
 * LLM Result types
 */
export type LLMResult<T> =
  | { ok: true; data: T }
  | { ok: "resolution"; reason: string; options: ResolutionOption[] }
  | { ok: false; error: string };

export type SegmentResult = LLMResult<{ segments: string[] }>;
export type NormalizeResult = LLMResult<{ intents: NormalizedIntent[] }>;
export type ProposeResult = LLMResult<{ draft: unknown }>;

/**
 * LLM Adapter interface
 */
export interface LLMAdapter {
  /**
   * Segment natural language text into requirement segments
   */
  segment(params: { text: string }): Promise<SegmentResult>;

  /**
   * Normalize segments into structured intents
   */
  normalize(params: {
    segments: string[];
    schema: unknown;
    context?: CompilerContext;
  }): Promise<NormalizeResult>;

  /**
   * Propose a DomainDraft from intents
   */
  propose(params: {
    schema: unknown;
    intents: NormalizedIntent[];
    history: AttemptRecord[];
    context?: CompilerContext;
    resolution?: string;
  }): Promise<ProposeResult>;
}

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

/**
 * Compiler interface
 */
export interface Compiler {
  /**
   * Start compilation
   */
  start(input: CompileInput): Promise<void>;

  /**
   * Get current state
   */
  getSnapshot(): Promise<CompilerSnapshot>;

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: CompilerSnapshot) => void): Unsubscribe;

  /**
   * Dispatch an action
   */
  dispatch(action: string, input?: unknown): Promise<void>;

  /**
   * Resolve ambiguity
   */
  resolve(selectedOptionId: string): Promise<void>;

  /**
   * Discard compilation
   */
  discard(reason?: DiscardReason): Promise<void>;

  /**
   * Reset to idle
   */
  reset(): Promise<void>;
}

/**
 * Effect handler result - returned by effect handlers
 */
export interface EffectHandlerResult {
  action: string;
  input: Record<string, unknown>;
}

/**
 * Telemetry hook for monitoring compiler execution
 *
 * Per SPEC §15.2: Allows external systems to observe compilation progress
 * for debugging, monitoring, and analytics purposes.
 */
export interface CompilerTelemetry {
  /**
   * Called when compilation phase changes
   * @param from - Previous status
   * @param to - New status
   */
  onPhaseChange?(from: CompilerStatus, to: CompilerStatus): void;

  /**
   * Called when a validation attempt is recorded (when traceDrafts is true)
   * @param attempt - The recorded attempt
   */
  onAttempt?(attempt: AttemptRecord): void;

  /**
   * Called when resolution is requested from external system
   * @param reason - Why resolution is needed
   * @param options - Available resolution options
   */
  onResolutionRequested?(reason: string, options: ResolutionOption[]): void;

  /**
   * Called when compilation completes (success or discarded)
   * @param result - Final compiler snapshot
   */
  onComplete?(result: CompilerSnapshot): void;

  /**
   * Called when an effect is about to be executed
   * @param effectType - Type of effect (e.g., 'llm:segment')
   * @param params - Effect parameters
   */
  onEffectStart?(effectType: string, params: Record<string, unknown>): void;

  /**
   * Called when an effect completes
   * @param effectType - Type of effect
   * @param result - Effect handler result
   */
  onEffectEnd?(effectType: string, result: EffectHandlerResult): void;

  /**
   * Called on any error during compilation
   * @param error - The error that occurred
   * @param context - Context where error occurred (e.g., 'effect:llm:segment')
   */
  onError?(error: Error, context: string): void;
}
