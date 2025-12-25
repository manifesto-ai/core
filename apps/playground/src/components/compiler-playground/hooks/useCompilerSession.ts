'use client';

/**
 * useCompilerSession Hook
 *
 * Manages the compiler session via SSE streaming API.
 * Provides real-time compilation progress updates.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Fragment, Issue, Conflict, NextStep, CompilerPhase, InputArtifact } from '../types';

// ============================================================================
// Types (Playground-specific snapshot)
// ============================================================================

/**
 * Playground-specific snapshot format
 */
export interface PlaygroundSnapshot {
  phase: CompilerPhase;
  fragments: Fragment[];
  issues: Issue[];
  conflicts: Conflict[];
  nextSteps: NextStep[];
  progress: {
    stage: number;
    total: number;
    message: string;
  };
}

export interface CompileResult {
  fragments: Fragment[];
  issues: Issue[];
  conflicts: Conflict[];
  stats?: {
    fragmentCount: number;
    issueCount: number;
    conflictCount: number;
  };
}

export interface UseCompilerSessionOptions {
  /** OpenAI model to use */
  model?: string;
  /** Enable SSE streaming (default: true) */
  streaming?: boolean;
  /** Callback for log events */
  onLog?: (level: string, message: string, data?: unknown) => void;
}

export interface UseCompilerSessionReturn {
  /** Current snapshot (real-time state) */
  snapshot: PlaygroundSnapshot | null;
  /** Compilation result (after compile() completes) */
  result: CompileResult | null;
  /** Whether compilation is in progress */
  isCompiling: boolean;
  /** Whether SSE connection is active */
  isConnected: boolean;
  /** Error message if compilation failed */
  error: string | null;

  // Derived state
  /** Extracted fragments */
  fragments: Fragment[];
  /** Compilation issues */
  issues: Issue[];
  /** Path conflicts */
  conflicts: Conflict[];
  /** Suggested next steps */
  nextSteps: NextStep[];
  /** Current compiler phase */
  currentPhase: CompilerPhase | null;

  // Actions
  /** Compile natural language input with optional additional artifacts */
  compileNL: (input: string, additionalArtifacts?: InputArtifact[]) => Promise<void>;
  /** Reset compilation state */
  reset: () => void;
  /** Abort current compilation */
  abort: () => void;
}

// ============================================================================
// SSE Event Types
// ============================================================================

interface SSEConnectedEvent {
  type: 'connected';
  sessionId: string;
  timestamp: number;
}

interface SSEPhaseEvent {
  type: 'phase';
  phase: CompilerPhase;
  previousPhase: CompilerPhase;
  timestamp: number;
}

interface SSEProgressEvent {
  type: 'progress';
  progress: { stage: number; total: number; message: string };
  timestamp: number;
}

interface SSESnapshotEvent {
  type: 'snapshot';
  snapshot: {
    phase: CompilerPhase;
    progress: { stage: number; total: number; message: string };
    fragmentsCount: number;
    conflictsCount: number;
    blockingIssuesCount: number;
  };
  timestamp: number;
}

interface SSECompleteEvent {
  type: 'complete';
  result: {
    fragments: Fragment[];
    issues: Issue[];
    conflicts: Conflict[];
    stats: {
      fragmentCount: number;
      issueCount: number;
      conflictCount: number;
    };
  };
  snapshot: {
    phase: CompilerPhase;
    nextSteps: Array<{
      id: string;
      action: string;
      priority: string;
      description: string;
    }>;
    progress: { stage: number; total: number; message: string };
  };
  timestamp: number;
}

interface SSEErrorEvent {
  type: 'error';
  error: string;
  details?: string;
  phase?: CompilerPhase;
  timestamp: number;
}

type SSEEvent =
  | SSEConnectedEvent
  | SSEPhaseEvent
  | SSEProgressEvent
  | SSESnapshotEvent
  | SSECompleteEvent
  | SSEErrorEvent;

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCompilerSession(
  options: UseCompilerSessionOptions = {}
): UseCompilerSessionReturn {
  const { model = 'gpt-4o', streaming = true, onLog } = options;

  // State
  const [snapshot, setSnapshot] = useState<PlaygroundSnapshot | null>(null);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Handle SSE events
  const handleSSEEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'connected':
        setIsConnected(true);
        onLog?.('info', `Connected to session: ${event.sessionId}`);
        break;

      case 'phase':
        setSnapshot((prev) => prev ? { ...prev, phase: event.phase } : {
          phase: event.phase,
          fragments: [],
          issues: [],
          conflicts: [],
          nextSteps: [],
          progress: { stage: 0, total: 0, message: '' },
        });
        onLog?.('info', `Phase: ${event.previousPhase} → ${event.phase}`);
        break;

      case 'progress':
        setSnapshot((prev) => prev ? { ...prev, progress: event.progress } : null);
        break;

      case 'snapshot':
        setSnapshot((prev) => prev ? {
          ...prev,
          phase: event.snapshot.phase,
          progress: event.snapshot.progress,
        } : null);
        break;

      case 'complete':
        setResult(event.result);
        setSnapshot({
          phase: 'done',
          fragments: event.result.fragments,
          issues: event.result.issues,
          conflicts: event.result.conflicts,
          nextSteps: event.snapshot.nextSteps.map((step) => ({
            id: step.id,
            action: step.action,
            priority: step.priority as 'high' | 'medium' | 'low',
            description: step.description,
          })),
          progress: event.snapshot.progress,
        });
        onLog?.('info', `Compilation complete: ${event.result.stats.fragmentCount} fragments`);
        break;

      case 'error':
        setError(event.error);
        setSnapshot((prev) => prev ? { ...prev, phase: 'error' } : null);
        onLog?.('error', event.error, event.details);
        break;
    }
  }, [onLog]);

  // Parse SSE stream
  const parseSSEStream = useCallback(async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse complete SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      let currentEventType = '';
      let currentData = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6);

          // Process complete event
          if (currentEventType && currentData) {
            try {
              const event: SSEEvent = JSON.parse(currentData);
              handleSSEEvent(event);
            } catch (e) {
              console.warn('Failed to parse SSE event:', e, currentData);
            }
            currentEventType = '';
            currentData = '';
          }
        }
      }
    }
  }, [handleSSEEvent]);

  // Compile with SSE streaming
  const compileNLStreaming = useCallback(
    async (input: string, additionalArtifacts: InputArtifact[] = []) => {
      if (!input.trim() && additionalArtifacts.length === 0) {
        setError('Input cannot be empty');
        return;
      }

      // Abort any existing compilation
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsCompiling(true);
      setError(null);
      setResult(null);
      setIsConnected(false);

      // Set initial snapshot
      setSnapshot({
        phase: 'idle',
        fragments: [],
        issues: [],
        conflicts: [],
        nextSteps: [],
        progress: { stage: 0, total: 0, message: 'Connecting...' },
      });

      // Build artifacts array
      const artifacts = [
        ...(input.trim() ? [{ id: `main-${Date.now()}`, type: 'text' as const, content: input }] : []),
        ...additionalArtifacts.map((a) => ({
          id: a.id,
          type: 'text' as const,
          content: a.content,
        })),
      ];

      try {
        const response = await fetch('/api/compiler/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artifacts,
            model,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          let errorMessage = 'Failed to start compilation';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // Ignore JSON parse error
          }
          throw new Error(errorMessage);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // Parse SSE stream
        const reader = response.body.getReader();
        await parseSSEStream(reader);

      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          console.log('Compilation aborted');
          return;
        }
        const message = err instanceof Error ? err.message : 'Compilation failed';
        setError(message);
        console.error('Compilation error:', err);
        setSnapshot((prev) => prev ? { ...prev, phase: 'error' } : null);
      } finally {
        setIsCompiling(false);
        setIsConnected(false);
      }
    },
    [model, parseSSEStream]
  );

  // Fallback: Non-streaming compile
  const compileNLFallback = useCallback(
    async (input: string, additionalArtifacts: InputArtifact[] = []) => {
      if (!input.trim() && additionalArtifacts.length === 0) {
        setError('Input cannot be empty');
        return;
      }

      setIsCompiling(true);
      setError(null);
      setResult(null);

      // Set initial snapshot state
      setSnapshot({
        phase: 'parsing',
        fragments: [],
        issues: [],
        conflicts: [],
        nextSteps: [],
        progress: { stage: 1, total: 6, message: 'Parsing input...' },
      });

      // Build artifacts array
      const artifacts = [
        ...(input.trim() ? [{ id: `main-${Date.now()}`, type: 'text' as const, content: input }] : []),
        ...additionalArtifacts.map((a) => ({
          id: a.id,
          type: 'text' as const,
          content: a.content,
        })),
      ];

      try {
        const response = await fetch('/api/compiler', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artifacts,
            model,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Compilation failed');
        }

        if (data.result) {
          setResult(data.result);
        }

        if (data.snapshot) {
          setSnapshot({ ...data.snapshot, phase: 'done' });
        } else {
          setSnapshot((prev) => prev ? { ...prev, phase: 'done' } : null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Compilation failed';
        setError(message);
        console.error('Compilation error:', err);
        setSnapshot((prev) => prev ? { ...prev, phase: 'error' } : null);
      } finally {
        setIsCompiling(false);
      }
    },
    [model]
  );

  // Main compile action (choose streaming or fallback)
  const compileNL = streaming ? compileNLStreaming : compileNLFallback;

  // Abort action
  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsCompiling(false);
    setIsConnected(false);
  }, []);

  // Reset action
  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setResult(null);
    setError(null);
    setSnapshot(null);
    setIsCompiling(false);
    setIsConnected(false);
  }, []);

  // Derived state
  const fragments = result?.fragments ?? [];
  const issues = result?.issues ?? [];
  const conflicts = result?.conflicts ?? [];
  const nextSteps = snapshot?.nextSteps ?? [];
  const currentPhase = snapshot?.phase ?? null;

  return {
    snapshot,
    result,
    isCompiling,
    isConnected,
    error,
    fragments,
    issues,
    conflicts,
    nextSteps,
    currentPhase,
    compileNL,
    reset,
    abort,
  };
}

export default useCompilerSession;
