/**
 * Projection Render Context
 *
 * Creates RenderContext for custom renderers.
 * Added in v1.1.
 */

import type { Snapshot } from "@manifesto-ai/world";
import type {
  RenderContext,
  LabState,
  LabTraceEvent,
  ProjectionMode,
  NecessityLevel,
} from "../types.js";

/**
 * Options for creating a render context.
 */
export interface CreateRenderContextOptions {
  /** Current step number */
  step: number;

  /** Total steps (estimated, 0 if unknown) */
  totalSteps?: number;

  /** Run identifier */
  runId: string;

  /** Necessity level */
  level: NecessityLevel;

  /** Current lab state */
  state: LabState;

  /** Start time for elapsed calculation */
  startTime: number;

  /** Recent trace events */
  recentEvents?: LabTraceEvent[];

  /** Max recent events to include */
  maxRecentEvents?: number;

  /** Current projection mode */
  mode: ProjectionMode;
}

/**
 * Create a render context for custom renderers.
 *
 * @param options - Context creation options
 * @returns RenderContext
 */
export function createRenderContext(
  options: CreateRenderContextOptions
): RenderContext {
  const recentEvents = options.recentEvents ?? [];
  const maxRecent = options.maxRecentEvents ?? 10;

  return {
    step: options.step,
    totalSteps: options.totalSteps ?? 0,
    runId: options.runId,
    level: options.level,
    state: options.state,
    elapsedMs: Date.now() - options.startTime,
    recentEvents: recentEvents.slice(-maxRecent),
    mode: options.mode,
  };
}

/**
 * Format elapsed time for display.
 *
 * @param ms - Milliseconds elapsed
 * @returns Formatted time string (HH:MM:SS)
 */
export function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Get level name for display.
 *
 * @param level - Necessity level
 * @returns Human-readable level name
 */
export function getLevelName(level: NecessityLevel): string {
  switch (level) {
    case 0:
      return "Deterministic";
    case 1:
      return "Partial Observation";
    case 2:
      return "Open-Ended Rules";
    case 3:
      return "Natural Language";
    default:
      return `Level ${level}`;
  }
}
