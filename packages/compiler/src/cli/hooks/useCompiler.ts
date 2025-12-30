/**
 * useCompiler Hook
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
  ResolutionOption,
} from "../../domain/types.js";
import type {
  Provider,
  Verbosity,
  CompilerUIState,
  CompilerMetrics,
  EffectTiming,
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
  resolve: (optionId: string) => Promise<void>;
  discard: () => Promise<void>;
}

function createInitialMetrics(): CompilerMetrics {
  return {
    startTime: 0,
    phaseTimings: {},
    effectTimings: [],
    attemptCount: 0,
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
 * Calculate progress percentage based on current status
 */
function calculateProgress(status: CompilerStatus): number {
  const progressMap: Record<CompilerStatus, number> = {
    idle: 0,
    segmenting: 20,
    normalizing: 40,
    proposing: 60,
    validating: 80,
    awaiting_resolution: 50,
    success: 100,
    discarded: 100,
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

        // Don't update status for terminal states - let onComplete handle it with result
        if (to !== "success" && to !== "discarded") {
          setState((s) => ({
            ...s,
            status: to,
            phase: to,
            progress: calculateProgress(to),
          }));
        }
      },

      onEffectStart: (type: string, _params: Record<string, unknown>) => {
        effectStartTimes.current.set(type, Date.now());

        setState((s) => ({
          ...s,
          metrics: {
            ...s.metrics,
            effectTimings: [
              ...s.metrics.effectTimings,
              {
                type,
                startTime: Date.now(),
              },
            ],
          },
        }));
      },

      onEffectEnd: (type: string, result: unknown) => {
        const startTime = effectStartTimes.current.get(type);
        const endTime = Date.now();
        const duration = startTime ? endTime - startTime : 0;

        setState((s) => {
          // Update the effect timing with end time and duration
          const effectTimings = s.metrics.effectTimings.map((et) =>
            et.type === type && !et.endTime
              ? { ...et, endTime, duration, details: result as Record<string, unknown> }
              : et
          );

          // Extract segment/intent counts if available
          let segmentCount = s.metrics.segmentCount;
          let intentCount = s.metrics.intentCount;

          if (type === "llm:segment" && result && typeof result === "object") {
            const res = result as { segments?: unknown[] };
            if (res.segments) {
              segmentCount = res.segments.length;
            }
          }
          if (type === "llm:normalize" && result && typeof result === "object") {
            const res = result as { intents?: unknown[] };
            if (res.intents) {
              intentCount = res.intents.length;
            }
          }

          return {
            ...s,
            metrics: {
              ...s.metrics,
              effectTimings,
              segmentCount,
              intentCount,
            },
          };
        });
      },

      onResolutionRequested: (reason: string, options: ResolutionOption[]) => {
        setState((s) => ({
          ...s,
          resolutionPending: { reason, options },
        }));
      },

      onComplete: (snapshot) => {
        // Set all terminal state values in a single update to avoid race conditions
        setState((s) => ({
          ...s,
          status: snapshot.status,
          phase: snapshot.status,
          progress: calculateProgress(snapshot.status),
          result: snapshot.result,
          error: snapshot.discardReason ?? null,
          metrics: {
            ...s.metrics,
            endTime: Date.now(),
            attemptCount: snapshot.attemptCount,
          },
        }));
      },

      onAttempt: (_attempt) => {
        setState((s) => ({
          ...s,
          metrics: {
            ...s.metrics,
            attemptCount: s.metrics.attemptCount + 1,
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
      resolutionPolicy: { onResolutionRequired: "await" }, // Always await for CLI
      traceDrafts: options.verbosity === "full",
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

  const resolve = useCallback(async (optionId: string) => {
    if (!compilerRef.current) return;
    setState((s) => ({ ...s, resolutionPending: null }));
    await compilerRef.current.resolve(optionId);
  }, []);

  const discard = useCallback(async () => {
    if (!compilerRef.current) return;
    setState((s) => ({ ...s, resolutionPending: null }));
    await compilerRef.current.discard("USER_CANCELLED");
  }, []);

  return { state, start, resolve, discard };
}
