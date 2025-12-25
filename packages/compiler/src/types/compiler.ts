/**
 * Compiler Types - Main compiler interface and session types
 *
 * Defines the primary API surface for the @manifesto-ai/compiler package.
 * Implements PRD 8.1 (상위 API) and PRD 6.8 (Compiler Runtime 투명성).
 *
 * INVARIANTS (from AGENT_README):
 * - Deterministic core: linking, verification are reproducible
 * - LLM is untrusted proposal generator
 * - Effects are descriptions, never executed
 * - Conflicts are surfaced, never auto-resolved
 */

import type { SemanticPath, DomainRuntime } from '@manifesto-ai/core';
import type { ArtifactSelection, CompileInput } from './artifact.js';
import type { Fragment, FragmentId } from './fragment.js';
import type { Patch, PatchHint, PatchOp, ApplyPatchResult } from './patch.js';
import type { Conflict } from './conflict.js';
import type { Issue } from './issue.js';
import type { Codebook } from './codebook.js';

// Re-export ApplyPatchResult from patch.ts (canonical definition)
export type { ApplyPatchResult } from './patch.js';
import type {
  CompilerConfig,
  CompilerPhase,
  CompilerSessionSnapshot,
  CompileOptions,
  CompileResult,
  LinkResult,
  DomainDraft,
  ExplainCompilerValueResult,
  CompilerImpactAnalysis,
  CompilerAgentContext,
  IssueExplanation,
  ConflictExplanation,
} from './session.js';
import type { VerifyResult } from '../verifier/index.js';

// ============================================================================
// Compiler Interface
// ============================================================================

/**
 * Compiler instance - main entry point for the compilation pipeline
 *
 * The Compiler orchestrates the full compilation pipeline:
 * Artifacts -> Fragments -> Link -> Verify
 *
 * INVARIANTS (from AGENT_README):
 * - Deterministic core: linking, verification are reproducible (#1)
 * - LLM is untrusted proposal generator (#2)
 * - Effects are descriptions, never executed (#5)
 * - Conflicts are surfaced, never auto-resolved (#6)
 */
export interface Compiler {
  /**
   * Full compilation pipeline: Artifacts -> Fragments -> Link -> Verify
   *
   * @param input - Artifacts to compile (code, text, or manifesto)
   * @param options - Compilation options
   * @returns CompileResult with fragments, domain, issues, conflicts
   */
  compile(input: CompileInput, options?: CompileOptions): Promise<CompileResult>;

  /**
   * Compile artifacts to fragments only (no linking/verification)
   *
   * Useful for incremental compilation where only fragment generation is needed.
   *
   * @param input - Artifacts to compile
   * @param selection - Optional selection for partial compilation
   * @returns Array of generated fragments
   */
  compileFragments(
    input: CompileInput,
    selection?: ArtifactSelection
  ): Promise<Fragment[]>;

  /**
   * Link fragments into a domain draft
   *
   * Deterministic operation (AGENT_README Invariant #1)
   * - Normalizes paths
   * - Analyzes dependencies
   * - Detects conflicts (never auto-resolves)
   * - Merges fragments
   * - Builds domain draft
   *
   * @param fragments - Fragments to link
   * @param patches - Optional patches to apply during linking
   * @returns LinkResult with domain, conflicts, issues
   */
  link(fragments: Fragment[], patches?: Patch[]): LinkResult;

  /**
   * Verify a domain or link result
   *
   * Deterministic operation (AGENT_README Invariant #1)
   * - DAG validation (cycles, missing deps)
   * - Static validation (paths, types, policies, effects)
   *
   * @param target - DomainDraft or LinkResult to verify
   * @returns VerifyResult with validity and issues
   */
  verify(target: DomainDraft | LinkResult): VerifyResult;

  /**
   * Generate patch hints from issues/conflicts
   *
   * Hints are suggestions only (AGENT_README Invariant #2)
   * User/agent must explicitly apply them via applyPatch.
   *
   * @param issues - Issues to generate hints for
   * @param conflicts - Conflicts to generate hints for
   * @returns Array of patch hints
   */
  suggestPatches(issues?: Issue[], conflicts?: Conflict[]): PatchHint[];

  /**
   * Apply a patch to fragments
   *
   * Patch-first editing (AGENT_README Invariant #9)
   * All changes are representable as patch operations.
   *
   * @param fragments - Current fragments
   * @param patch - Patch to apply
   * @returns Result with updated fragments and status
   */
  applyPatch(fragments: Fragment[], patch: Patch): ApplyPatchResult;

  /**
   * Create a runtime session for observable compilation
   *
   * Session provides real-time observability (AGENT_README Invariant #10)
   * - Progress tracking
   * - Phase transitions
   * - Blockers and next steps
   * - Manifesto Runtime based subscription
   *
   * @returns CompilerSession for tracking compilation progress
   */
  createSession(): CompilerSession;

  /** Compiler configuration */
  readonly config: CompilerConfig;

  /** Codebook for semantic path aliasing (mutable during compilation) */
  readonly codebook: Codebook | undefined;
}

// ============================================================================
// Compiler Session Interface
// ============================================================================

/**
 * Path listener for subscribePath
 */
export type PathListener<T = unknown> = (value: T, prevValue: T) => void;

/**
 * Event listener for subscribeEvents
 */
export type EventListener = (event: CompilerEvent) => void;

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

/**
 * Compiler event (emitted via subscribeEvents)
 */
export interface CompilerEvent {
  type: string;
  payload: unknown;
  timestamp: number;
}

/**
 * Compiler session for observable compilation
 *
 * Provides real-time tracking of compilation progress.
 * Built on Manifesto Runtime for consistent subscription semantics.
 *
 * PRD 6.8: Compiler Runtime 투명성
 */
export interface CompilerSession {
  /**
   * Get current session state as snapshot
   */
  getSnapshot(): CompilerSessionSnapshot;

  /**
   * Subscribe to phase changes
   *
   * @param callback - Called when phase changes
   * @returns Unsubscribe function
   */
  onPhaseChange(callback: (phase: CompilerPhase) => void): Unsubscribe;

  /**
   * Subscribe to all snapshot updates
   *
   * @param callback - Called on any snapshot change
   * @returns Unsubscribe function
   */
  onSnapshotChange(callback: (snapshot: CompilerSessionSnapshot) => void): Unsubscribe;

  /**
   * Run compilation within session context
   *
   * Updates session state as compilation progresses.
   *
   * @param input - Compile input
   * @param options - Compile options
   * @returns CompileResult
   */
  compile(input: CompileInput, options?: CompileOptions): Promise<CompileResult>;

  /**
   * Subscribe to a specific path in the compiler state
   *
   * Manifesto Runtime based subscription.
   *
   * @param path - SemanticPath to subscribe (e.g., 'state.phase', 'derived.blockers')
   * @param listener - Called when path value changes
   * @returns Unsubscribe function
   */
  subscribePath<T = unknown>(path: SemanticPath, listener: PathListener<T>): Unsubscribe;

  /**
   * Subscribe to events on a channel
   *
   * Manifesto Runtime based subscription.
   *
   * @param channel - Event channel (e.g., 'log', 'progress')
   * @param listener - Called when event is emitted
   * @returns Unsubscribe function
   */
  subscribeEvents(channel: string, listener: EventListener): Unsubscribe;

  /**
   * Get the underlying Manifesto Runtime (advanced usage)
   *
   * Provides direct access to the compiler domain runtime.
   */
  getRuntime(): CompilerDomainRuntime;

  /**
   * Update progress manually
   *
   * @param stage - Current stage number
   * @param total - Total stages
   * @param message - Progress message
   */
  updateProgress(stage: number, total: number, message: string): void;

  /**
   * Log to session
   *
   * @param level - Log level
   * @param message - Log message
   * @param data - Optional additional data
   */
  log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: unknown
  ): void;

  // ==========================================================================
  // Runtime-aided Verification Methods (P1-A)
  // ==========================================================================

  /**
   * Explain why a path has its current value
   *
   * Uses the compiler domain runtime's explain() method.
   * Includes fragment provenance information.
   *
   * @param path - SemanticPath to explain
   * @returns Explanation result with contributing fragments
   */
  explainPath(path: SemanticPath): ExplainCompilerValueResult;

  /**
   * Get impact of changing a fragment
   *
   * Shows what would be affected if this fragment is modified.
   * Uses DAG analysis to compute direct and transitive impact.
   *
   * @param fragmentId - Fragment to analyze
   * @returns Impact analysis with affected paths and fragments
   */
  getChangeImpact(fragmentId: FragmentId): CompilerImpactAnalysis;

  /**
   * Get impact of changing a path
   *
   * Shows what would be affected if this path's value changes.
   *
   * @param path - SemanticPath to analyze
   * @returns Impact analysis with affected paths and fragments
   */
  getPathImpact(path: SemanticPath): CompilerImpactAnalysis;

  /**
   * Get AI-friendly context for decision making
   *
   * Projects current compiler state into a format optimized for AI agents.
   * Includes action explanations, blocker details, and fragment summary.
   *
   * @returns Agent context with all relevant information
   */
  getAgentContext(): CompilerAgentContext;

  /**
   * Explain why an issue exists
   *
   * Traces the reasoning chain through fragment provenance.
   * Includes suggested fixes when available.
   *
   * @param issueId - Issue ID to explain
   * @returns Issue explanation with reasoning chain
   */
  explainIssue(issueId: string): IssueExplanation;

  /**
   * Explain why a conflict exists
   *
   * Details the competing fragments and their origins.
   * Includes resolution options with trade-offs.
   *
   * @param conflictId - Conflict ID to explain
   * @returns Conflict explanation with resolution options
   */
  explainConflict(conflictId: string): ConflictExplanation;
}

/**
 * Compiler domain runtime type
 *
 * The compiler state modeled as a Manifesto domain.
 */
export type CompilerDomainRuntime = DomainRuntime<CompilerDomainData, CompilerDomainState>;

/**
 * Compiler domain data shape
 */
export interface CompilerDomainData {
  /** Input artifacts */
  artifacts: unknown[];
  /** Generated fragments */
  fragments: Fragment[];
  /** Applied patches */
  patches: Patch[];
  /** Link issues */
  issues: Issue[];
  /** Detected conflicts */
  conflicts: Conflict[];
  /** Domain draft (if generated) */
  domain: DomainDraft | null;
}

/**
 * Compiler domain state shape
 */
export interface CompilerDomainState {
  /** Current phase */
  phase: CompilerPhase;
  /** Progress info */
  progress: {
    stage: number;
    total: number;
    message: string;
  };
  /** Error message (if phase is 'error') */
  error: string | null;
}

// ============================================================================
// Extended Compiler Config
// ============================================================================

import type { Pass, NLPass } from '../pass/base.js';
import type { LinkOptions } from '../linker/index.js';
import type { VerifyOptions } from '../verifier/index.js';

/**
 * Extended compiler configuration with pass and module options
 */
export interface ExtendedCompilerConfig extends CompilerConfig {
  /** Pass registry configuration */
  passes?: {
    /** Custom passes to register */
    custom?: (Pass | NLPass)[];
    /** Pass names to disable */
    disabled?: string[];
    /** Use default passes (default: true) */
    useDefaults?: boolean;
  };

  /** Linker options */
  linker?: LinkOptions;

  /** Verifier options */
  verifier?: VerifyOptions;

  /** Initial codebook for alias management */
  codebook?: Codebook;

  /** Enable session by default (default: false) */
  enableSession?: boolean;
}
