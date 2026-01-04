/**
 * Projection Render Context
 *
 * Creates RenderContext for custom renderers.
 * Added in v1.1.
 */
import type { RenderContext, LabState, LabTraceEvent, ProjectionMode, NecessityLevel } from "../types.js";
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
export declare function createRenderContext(options: CreateRenderContextOptions): RenderContext;
/**
 * Format elapsed time for display.
 *
 * @param ms - Milliseconds elapsed
 * @returns Formatted time string (HH:MM:SS)
 */
export declare function formatElapsedTime(ms: number): string;
/**
 * Get level name for display.
 *
 * @param level - Necessity level
 * @returns Human-readable level name
 */
export declare function getLevelName(level: NecessityLevel): string;
//# sourceMappingURL=context.d.ts.map