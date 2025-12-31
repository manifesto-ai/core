/**
 * useCompiler Hook (v1.1)
 *
 * Integrates the Manifesto Compiler with React/Ink UI state management.
 * Handles telemetry callbacks to update UI in real-time.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createCompiler } from "../../api/factory.js";
import type {
  Compiler,
  CompilerTelemetry,
  CompilerStatus,
  ResolutionRequest,
  Plan,
  FragmentDraft,
  Fragment,
  Conflict,
} from "../../domain/types.js";
import type {
  Provider,
  Verbosity,
  CompilerUIState,
  CompilerMetrics,
} from "../types.js";

export interface UseCompilerOptions {
  provider: Provider;
  apiKey: string;
  model?: string;
  verbosity: Verbosity;
}

interface UseCompilerReturn {
  state: CompilerUIState;
  start: (text: string) => Promise<void>;
  acceptPlan: () => Promise<void>;
  rejectPlan: (reason: string) => Promise<void>;
  acceptDraft: (draftId: string) => Promise<void>;
  rejectDraft: (draftId: string, reason: string) => Promise<void>;
  resolveConflict: (resolutionId: string, optionId: string) => Promise<void>;
  reset: () => Promise<void>;
}

function createInitialMetrics(): CompilerMetrics {
  return {
    startTime: 0,
    phaseTimings: {},
    effectTimings: [],
    planAttempts: 0,
    draftAttempts: {},
  };
}

function createInitialState(): CompilerUIState {
  return {
    status: "idle",
    phase: "idle",
    progress: 0,
    metrics: createInitialMetrics(),
    result: null,
    error: null,
    resolutionPending: null,
  };
}

/**
 * Calculate progress percentage based on current status (v1.1)
 */
function calculateProgress(status: CompilerStatus): number {
  const progressMap: Record<CompilerStatus, number> = {
    idle: 0,
    planning: 10,
    awaiting_plan_decision: 15,
    generating: 30,
    awaiting_draft_decision: 45,
    lowering: 55,
    linking: 65,
    awaiting_conflict_resolution: 70,
    verifying: 80,
    emitting: 90,
    success: 100,
    failed: 100,
  };
  return progressMap[status] ?? 0;
}

export function useCompiler(options: UseCompilerOptions): UseCompilerReturn {
  const [state, setState] = useState<CompilerUIState>(createInitialState);
  const compilerRef = useRef<Compiler | null>(null);
  const effectStartTimes = useRef<Map<string, number>>(new Map());
  const phaseStartTimes = useRef<Map<string, number>>(new Map());

  // Initialize compiler with telemetry
  useEffect(() => {
    const telemetry: CompilerTelemetry = {
      onPhaseChange: (from: CompilerStatus, to: CompilerStatus) => {
        const now = Date.now();

        // Record phase end time
        if (from !== "idle" && phaseStartTimes.current.has(from)) {
          const startTime = phaseStartTimes.current.get(from)!;
          setState((s) => ({
            ...s,
            metrics: {
              ...s.metrics,
              phaseTimings: {
                ...s.metrics.phaseTimings,
                [from]: now - startTime,
              },
            },
          }));
        }

        // Record phase start time
        phaseStartTimes.current.set(to, now);

        // Don't update status for terminal states - let onComplete handle it
        if (to !== "success" && to !== "failed") {
          setState((s) => ({
            ...s,
            status: to,
            phase: to,
            progress: calculateProgress(to),
          }));
        }
      },

      onPlanReceived: (plan: Plan) => {
        setState((s) => ({
          ...s,
          metrics: {
            ...s.metrics,
            chunkCount: plan.chunks.length,
          },
        }));
      },

      onDraftReceived: (_draft: FragmentDraft) => {
        // Could track draft count here if needed
      },

      onFragmentLowered: (_fragment: Fragment) => {
        setState((s) => ({
          ...s,
          metrics: {
            ...s.metrics,
            fragmentCount: (s.metrics.fragmentCount ?? 0) + 1,
          },
        }));
      },

      onConflictsDetected: (conflicts: Conflict[]) => {
        // Conflicts are handled via onResolutionRequested
        if (conflicts.length > 0) {
          setState((s) => ({
            ...s,
            error: `${conflicts.length} conflict(s) detected`,
          }));
        }
      },

      onResolutionRequested: (request: ResolutionRequest) => {
        setState((s) => ({
          ...s,
          resolutionPending: {
            reason: request.reason,
            options: request.options,
          },
        }));
      },

      onEffectStart: (effectType, _params) => {
        effectStartTimes.current.set(effectType, Date.now());

        setState((s) => ({
          ...s,
          metrics: {
            ...s.metrics,
            effectTimings: [
              ...s.metrics.effectTimings,
              {
                type: effectType,
                startTime: Date.now(),
              },
            ],
          },
        }));
      },

      onEffectEnd: (effectType, result) => {
        const startTime = effectStartTimes.current.get(effectType);
        const endTime = Date.now();
        const duration = startTime ? endTime - startTime : 0;

        setState((s) => {
          // Update the effect timing with end time and duration
          const effectTimings = s.metrics.effectTimings.map((et) =>
            et.type === effectType && !et.endTime
              ? { ...et, endTime, duration, details: result as unknown as Record<string, unknown> }
              : et
          );

          return {
            ...s,
            metrics: {
              ...s.metrics,
              effectTimings,
            },
          };
        });
      },

      onComplete: (snapshot) => {
        // Set all terminal state values in a single update
        setState((s) => ({
          ...s,
          status: snapshot.status,
          phase: snapshot.status,
          progress: calculateProgress(snapshot.status),
          result: snapshot.domainSpec,
          error: snapshot.failureReason ?? null,
          metrics: {
            ...s.metrics,
            endTime: Date.now(),
            planAttempts: snapshot.planAttempts,
            draftAttempts: snapshot.draftAttempts,
          },
        }));
      },

      onError: (error: Error, context: string) => {
        setState((s) => ({
          ...s,
          error: `${context}: ${error.message}`,
        }));
      },
    };

    const providerOptions =
      options.provider === "anthropic"
        ? { anthropic: { apiKey: options.apiKey, model: options.model } }
        : { openai: { apiKey: options.apiKey, model: options.model } };

    const compiler = createCompiler({
      ...providerOptions,
      telemetry,
      resolutionPolicy: {
        onPlanDecision: "await",
        onDraftDecision: "auto-accept", // Auto-accept drafts by default
        onConflictResolution: "await",
      },
    });

    compilerRef.current = compiler;

    return () => {
      compilerRef.current = null;
    };
  }, [options.apiKey, options.provider, options.model, options.verbosity]);

  const start = useCallback(async (text: string) => {
    if (!compilerRef.current) return;

    // Reset state
    setState({
      ...createInitialState(),
      status: "idle",
      metrics: {
        ...createInitialMetrics(),
        startTime: Date.now(),
      },
    });

    // Clear timing maps
    effectStartTimes.current.clear();
    phaseStartTimes.current.clear();

    await compilerRef.current.start({ text });
  }, []);

  const acceptPlan = useCallback(async () => {
    if (!compilerRef.current) return;
    setState((s) => ({ ...s, resolutionPending: null }));
    await compilerRef.current.acceptPlan();
  }, []);

  const rejectPlan = useCallback(async (reason: string) => {
    if (!compilerRef.current) return;
    setState((s) => ({ ...s, resolutionPending: null }));
    await compilerRef.current.rejectPlan(reason);
  }, []);

  const acceptDraft = useCallback(async (draftId: string) => {
    if (!compilerRef.current) return;
    setState((s) => ({ ...s, resolutionPending: null }));
    await compilerRef.current.acceptDraft(draftId);
  }, []);

  const rejectDraft = useCallback(async (draftId: string, reason: string) => {
    if (!compilerRef.current) return;
    setState((s) => ({ ...s, resolutionPending: null }));
    await compilerRef.current.rejectDraft(draftId, reason);
  }, []);

  const resolveConflict = useCallback(async (resolutionId: string, optionId: string) => {
    if (!compilerRef.current) return;
    setState((s) => ({ ...s, resolutionPending: null }));
    await compilerRef.current.resolveConflict(resolutionId, optionId);
  }, []);

  const reset = useCallback(async () => {
    if (!compilerRef.current) return;
    setState(createInitialState());
    await compilerRef.current.reset();
  }, []);

  return {
    state,
    start,
    acceptPlan,
    rejectPlan,
    acceptDraft,
    rejectDraft,
    resolveConflict,
    reset,
  };
}
