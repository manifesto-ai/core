/**
 * Compiler Session - Observable Compilation with Manifesto Runtime
 *
 * Provides real-time observability of compilation progress using
 * Manifesto Runtime subscription semantics.
 *
 * PRD 6.8: Compiler Runtime 투명성
 *
 * Features:
 * - Phase tracking (idle → parsing → extracting → ... → done/error)
 * - Path subscription for reactive UI updates
 * - Event subscription for logging
 * - Snapshot-based state access
 */

import {
  createRuntime,
  type DomainRuntime,
  type SemanticPath,
  isOk,
} from '@manifesto-ai/core';

import type { CompileInput } from '../types/artifact.js';
import type { Fragment, FragmentId } from '../types/fragment.js';
import type { Issue } from '../types/issue.js';
import type { Conflict } from '../types/conflict.js';
import type { Patch } from '../types/patch.js';
import type {
  CompilerPhase,
  CompileOptions,
  CompileResult,
  CompilerSessionSnapshot,
  Blocker,
  NextStep,
  LogEntry,
  DomainDraft,
  LinkResult,
  ExplainCompilerValueResult,
  CompilerImpactAnalysis,
  CompilerAgentContext,
  IssueExplanation,
  ConflictExplanation,
} from '../types/session.js';
import { createInitialSnapshot, createLogEntry } from '../types/session.js';
import type {
  Compiler,
  CompilerSession,
  CompilerDomainRuntime,
  PathListener,
  EventListener,
  Unsubscribe,
  CompilerEvent,
} from '../types/compiler.js';

import {
  compilerDomain,
  getInitialCompilerData,
  getInitialCompilerState,
  type CompilerData,
  type CompilerState,
} from '../runtime/domain.js';

import {
  findFragmentsForPath,
  getFragmentById,
  generatePathSummary,
  generateStepExplanation,
  estimateStepImpact,
  generateBlockerExplanation,
  generateBlockerResolutions,
  computeFragmentImpact,
  findAffectedConflicts,
  analyzeIssueImpact,
  buildIssueExplanation,
  buildConflictExplanation,
  computeFragmentSummary,
  estimateContextTokens,
} from '../runtime/explain-helpers.js';

// ============================================================================
// Event Types
// ============================================================================

const LOG_CHANNEL = 'compiler:log';
const PROGRESS_CHANNEL = 'compiler:progress';

// ============================================================================
// createCompilerSession
// ============================================================================

/**
 * Create a compiler session for observable compilation
 *
 * @param compiler - Compiler instance to wrap
 * @returns CompilerSession with Manifesto Runtime based subscription
 */
export function createCompilerSession(compiler: Compiler): CompilerSession {
  // Create Manifesto Runtime for compiler state
  const runtime = createRuntime<CompilerData, CompilerState>({
    domain: compilerDomain,
    initialData: getInitialCompilerData(),
  });

  // Phase change listeners
  const phaseListeners: Array<(phase: CompilerPhase) => void> = [];

  // Snapshot change listeners
  const snapshotListeners: Array<(snapshot: CompilerSessionSnapshot) => void> = [];

  // Event listeners by channel
  const eventListeners: Map<string, Set<EventListener>> = new Map();

  // Subscribe to phase changes in runtime
  runtime.subscribePath('state.phase', (newPhase: unknown, oldPhase: unknown) => {
    const phase = newPhase as CompilerPhase;
    for (const listener of phaseListeners) {
      listener(phase);
    }
    // Also notify snapshot listeners
    notifySnapshotListeners();
  });

  // Subscribe to any data changes for snapshot updates
  runtime.subscribe(() => {
    notifySnapshotListeners();
  });

  /**
   * Notify all snapshot listeners
   */
  function notifySnapshotListeners(): void {
    const snapshot = buildSnapshot();
    for (const listener of snapshotListeners) {
      listener(snapshot);
    }
  }

  /**
   * Build current snapshot from runtime state
   */
  function buildSnapshot(): CompilerSessionSnapshot {
    const data = runtime.getSnapshot().data;
    const state = runtime.getSnapshot().state;

    // Compute blockers
    const blockers: Blocker[] = [];
    for (const issue of data.issues) {
      if (issue.severity === 'error') {
        blockers.push({
          kind: 'issue',
          id: issue.id,
          message: issue.message,
        });
      }
    }
    for (const conflict of data.conflicts) {
      blockers.push({
        kind: 'conflict',
        id: conflict.id,
        message: conflict.message,
      });
    }

    // Compute next steps
    const nextSteps = computeNextSteps(data, state);

    return {
      phase: state.phase,
      progress: state.progress,
      artifacts: data.artifacts.map((a) => a.id),
      fragmentsCount: data.fragments.length,
      conflictsCount: data.conflicts.length,
      blockingIssuesCount: data.issues.filter((i) => i.severity === 'error').length,
      blockers,
      nextSteps,
      timestamp: Date.now(),
    };
  }

  /**
   * Emit an event to a channel
   */
  function emitEvent(channel: string, type: string, payload: unknown): void {
    const event: CompilerEvent = {
      type,
      payload,
      timestamp: Date.now(),
    };

    const listeners = eventListeners.get(channel);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }

  /**
   * Set phase in runtime
   */
  function setPhase(phase: CompilerPhase): void {
    const result = runtime.set('state.phase' as SemanticPath, phase);
    if (!isOk(result)) {
      console.warn('[CompilerSession] Failed to set phase:', phase);
    }
  }

  /**
   * Update progress in runtime
   */
  function setProgress(stage: number, total: number, message: string): void {
    const result = runtime.set('state.progress' as SemanticPath, { stage, total, message });
    if (!isOk(result)) {
      console.warn('[CompilerSession] Failed to set progress');
    }
  }

  /**
   * Set error in runtime
   */
  function setError(error: string | null): void {
    runtime.set('state.error' as SemanticPath, error);
  }

  /**
   * Update data in runtime
   */
  function setData<K extends keyof CompilerData>(
    key: K,
    value: CompilerData[K]
  ): void {
    const path = `data.${key}` as SemanticPath;
    runtime.set(path, value);
  }

  // ============================================================================
  // Session Implementation
  // ============================================================================

  const session: CompilerSession = {
    getSnapshot(): CompilerSessionSnapshot {
      return buildSnapshot();
    },

    onPhaseChange(callback: (phase: CompilerPhase) => void): Unsubscribe {
      phaseListeners.push(callback);
      return () => {
        const index = phaseListeners.indexOf(callback);
        if (index >= 0) phaseListeners.splice(index, 1);
      };
    },

    onSnapshotChange(
      callback: (snapshot: CompilerSessionSnapshot) => void
    ): Unsubscribe {
      snapshotListeners.push(callback);
      return () => {
        const index = snapshotListeners.indexOf(callback);
        if (index >= 0) snapshotListeners.splice(index, 1);
      };
    },

    async compile(
      input: CompileInput,
      options?: CompileOptions
    ): Promise<CompileResult> {
      try {
        // Initialize
        setData('artifacts', input.artifacts as any);
        setPhase('parsing');
        setProgress(0, 4, 'Starting compilation...');

        // Step 1: Extract fragments
        setPhase('extracting');
        setProgress(1, 4, 'Extracting fragments...');
        session.log('info', `Processing ${input.artifacts.length} artifact(s)`);

        const fragments = await compiler.compileFragments(input, input.selection);
        setData('fragments', fragments as any);
        session.log('info', `Generated ${fragments.length} fragment(s)`);

        // Step 2: Link
        setPhase('linking');
        setProgress(2, 4, 'Linking fragments...');

        const linkResult = compiler.link(fragments, options?.patches);
        setData('issues', linkResult.issues as any);
        setData('conflicts', linkResult.conflicts as any);
        setData('domain', linkResult.domain as any);

        if (linkResult.conflicts.length > 0) {
          session.log(
            'warn',
            `Detected ${linkResult.conflicts.length} conflict(s)`
          );
        }

        // Step 3: Verify
        if (!options?.skipVerification) {
          setPhase('verifying');
          setProgress(3, 4, 'Verifying domain...');

          const verifyResult = compiler.verify(linkResult);
          const allIssues = [...linkResult.issues, ...verifyResult.issues];
          setData('issues', allIssues as any);

          const errorCount = allIssues.filter((i) => i.severity === 'error').length;
          if (errorCount > 0) {
            session.log('error', `Found ${errorCount} error(s)`);
          }
        }

        // Done
        setPhase('done');
        setProgress(4, 4, 'Compilation complete');
        session.log('info', 'Compilation completed successfully');

        // Build result
        const provenance = new Map<FragmentId, any>();
        for (const fragment of linkResult.fragments) {
          provenance.set(fragment.id, fragment.origin);
        }

        return {
          fragments: linkResult.fragments,
          domain: linkResult.domain,
          issues: runtime.get('data.issues' as SemanticPath) as Issue[],
          conflicts: linkResult.conflicts,
          provenance,
        };
      } catch (error) {
        setPhase('error');
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        session.log('error', `Compilation failed: ${message}`);
        throw error;
      }
    },

    subscribePath<T = unknown>(
      path: SemanticPath,
      listener: PathListener<T>
    ): Unsubscribe {
      return runtime.subscribePath(path, listener as any);
    },

    subscribeEvents(channel: string, listener: EventListener): Unsubscribe {
      if (!eventListeners.has(channel)) {
        eventListeners.set(channel, new Set());
      }
      eventListeners.get(channel)!.add(listener);

      return () => {
        const listeners = eventListeners.get(channel);
        if (listeners) {
          listeners.delete(listener);
        }
      };
    },

    getRuntime(): CompilerDomainRuntime {
      return runtime as unknown as CompilerDomainRuntime;
    },

    updateProgress(stage: number, total: number, message: string): void {
      setProgress(stage, total, message);
      emitEvent(PROGRESS_CHANNEL, 'progress', { stage, total, message });
    },

    log(
      level: 'debug' | 'info' | 'warn' | 'error',
      message: string,
      data?: unknown
    ): void {
      const entry = createLogEntry(level, message, data);
      emitEvent(LOG_CHANNEL, level, entry);
    },

    // ==========================================================================
    // Runtime-aided Verification Methods (P1-A)
    // ==========================================================================

    explainPath(path: SemanticPath): ExplainCompilerValueResult {
      const data = runtime.getSnapshot().data;
      const fragments = data.fragments as unknown as Fragment[];

      // Get value at path from runtime
      let value: unknown;
      try {
        value = runtime.get(path);
      } catch {
        value = undefined;
      }

      // Find contributing fragments
      const contributingFragments = findFragmentsForPath(fragments, path);

      // Check if this is a derived path (has dependencies)
      const hasDependencies = contributingFragments.some((id) => {
        const frag = getFragmentById(fragments, id);
        return frag && frag.requires.length > 0;
      });

      // Build dependencies explanations recursively (limited depth)
      const dependencies: ExplainCompilerValueResult[] = [];
      if (hasDependencies) {
        for (const fragId of contributingFragments) {
          const frag = getFragmentById(fragments, fragId);
          if (frag) {
            for (const dep of frag.requires.slice(0, 5)) {
              // Limit recursion
              dependencies.push(session.explainPath(dep as SemanticPath));
            }
          }
        }
      }

      // Get expression from fragment if derived
      let expression: unknown;
      for (const fragId of contributingFragments) {
        const frag = getFragmentById(fragments, fragId);
        if (frag && 'expr' in frag) {
          expression = (frag as any).expr;
          break;
        }
      }

      return {
        path,
        value,
        contributingFragments,
        expression,
        dependencies,
        summary: generatePathSummary(path, value, contributingFragments, hasDependencies),
      };
    },

    getChangeImpact(fragmentId: FragmentId): CompilerImpactAnalysis {
      const data = runtime.getSnapshot().data;
      const fragments = data.fragments as unknown as Fragment[];
      const issues = data.issues as unknown as Issue[];
      const conflicts = data.conflicts as unknown as Conflict[];

      const fragment = getFragmentById(fragments, fragmentId);
      if (!fragment) {
        return {
          source: { kind: 'fragment', fragmentId },
          directImpact: [],
          transitiveImpact: [],
          affectedFragments: [],
          potentialIssueChanges: [],
          affectedConflicts: [],
        };
      }

      const { direct, transitive } = computeFragmentImpact(fragment, fragments);
      const allAffectedPaths = [...direct, ...transitive];

      // Find affected fragments (those that require any affected path)
      const affectedFragments = fragments
        .filter((f) => f.id !== fragmentId && f.requires.some((r) => allAffectedPaths.includes(r as SemanticPath)))
        .map((f) => f.id);

      return {
        source: { kind: 'fragment', fragmentId },
        directImpact: direct,
        transitiveImpact: transitive,
        affectedFragments,
        potentialIssueChanges: analyzeIssueImpact(issues, fragment, allAffectedPaths),
        affectedConflicts: findAffectedConflicts(conflicts, fragment.provides),
      };
    },

    getPathImpact(path: SemanticPath): CompilerImpactAnalysis {
      const data = runtime.getSnapshot().data;
      const fragments = data.fragments as unknown as Fragment[];
      const issues = data.issues as unknown as Issue[];
      const conflicts = data.conflicts as unknown as Conflict[];

      // Find fragments that provide this path
      const providers = findFragmentsForPath(fragments, path);

      if (providers.length === 0) {
        return {
          source: { kind: 'path', path },
          directImpact: [],
          transitiveImpact: [],
          affectedFragments: [],
          potentialIssueChanges: [],
          affectedConflicts: [],
        };
      }

      // Aggregate impact from all providers
      const allDirect: Set<SemanticPath> = new Set();
      const allTransitive: Set<SemanticPath> = new Set();
      const allAffectedFragments: Set<FragmentId> = new Set();

      for (const providerId of providers) {
        const fragment = getFragmentById(fragments, providerId);
        if (fragment) {
          const { direct, transitive } = computeFragmentImpact(fragment, fragments);
          direct.forEach((p) => allDirect.add(p));
          transitive.forEach((p) => allTransitive.add(p));

          fragments
            .filter((f) => f.id !== providerId && f.requires.some((r) => direct.includes(r as SemanticPath) || transitive.includes(r as SemanticPath)))
            .forEach((f) => allAffectedFragments.add(f.id));
        }
      }

      const allAffectedPaths = [...allDirect, ...allTransitive];

      return {
        source: { kind: 'path', path },
        directImpact: Array.from(allDirect),
        transitiveImpact: Array.from(allTransitive).filter((p) => !allDirect.has(p)),
        affectedFragments: Array.from(allAffectedFragments),
        potentialIssueChanges: [],
        affectedConflicts: findAffectedConflicts(conflicts, [path]),
      };
    },

    getAgentContext(): CompilerAgentContext {
      const snapshot = buildSnapshot();
      const data = runtime.getSnapshot().data;
      const fragments = data.fragments as unknown as Fragment[];
      const issues = data.issues as unknown as Issue[];
      const conflicts = data.conflicts as unknown as Conflict[];

      return {
        snapshot,
        availableActions: snapshot.nextSteps.map((step) => ({
          action: step,
          explanation: generateStepExplanation(step, fragments, issues, conflicts),
          estimatedImpact: estimateStepImpact(step, fragments),
        })),
        blockerDetails: snapshot.blockers.map((blocker) => ({
          blocker,
          explanation: generateBlockerExplanation(blocker, issues, conflicts),
          suggestedResolutions: generateBlockerResolutions(blocker, issues, conflicts),
        })),
        fragmentSummary: computeFragmentSummary(fragments),
        metadata: {
          projectedAt: Date.now(),
          estimatedTokens: estimateContextTokens(snapshot, fragments),
        },
      };
    },

    explainIssue(issueId: string): IssueExplanation {
      const data = runtime.getSnapshot().data;
      const fragments = data.fragments as unknown as Fragment[];
      const issues = data.issues as unknown as Issue[];

      const issue = issues.find((i) => i.id === issueId);
      if (!issue) {
        throw new Error(`Issue not found: ${issueId}`);
      }

      return buildIssueExplanation(issue, fragments);
    },

    explainConflict(conflictId: string): ConflictExplanation {
      const data = runtime.getSnapshot().data;
      const fragments = data.fragments as unknown as Fragment[];
      const conflicts = data.conflicts as unknown as Conflict[];

      const conflict = conflicts.find((c) => c.id === conflictId);
      if (!conflict) {
        throw new Error(`Conflict not found: ${conflictId}`);
      }

      return buildConflictExplanation(conflict, fragments);
    },
  };

  return session;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compute next steps from current state
 */
function computeNextSteps(
  data: CompilerData,
  state: CompilerState
): NextStep[] {
  const steps: NextStep[] = [];

  // If in error state, no next steps
  if (state.phase === 'error') {
    return steps;
  }

  // Add conflict resolution steps
  for (const conflict of data.conflicts) {
    steps.push({
      kind: 'resolveConflict',
      conflictId: conflict.id,
      candidates: conflict.candidates,
      rationale: `Resolve conflict: ${conflict.message}`,
    });
  }

  // Add issue fix steps
  for (const issue of data.issues) {
    if (issue.severity === 'error') {
      steps.push({
        kind: 'fixIssue',
        issueId: issue.id,
        fragmentId: '', // Would need relatedFragments
        rationale: issue.message,
      });
    }
  }

  // If no blockers and done, suggest confirming domain
  if (
    steps.length === 0 &&
    state.phase === 'done' &&
    data.domain
  ) {
    const warningCount = data.issues.filter((i) => i.severity === 'warning').length;
    steps.push({
      kind: 'confirmDomain',
      domainHash: `hash_${data.fragments.length}`,
      warningCount,
      rationale: 'Domain is ready for use',
    });
  }

  return steps;
}
