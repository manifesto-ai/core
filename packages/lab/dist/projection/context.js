/**
 * Projection Render Context
 *
 * Creates RenderContext for custom renderers.
 * Added in v1.1.
 */
/**
 * Create a render context for custom renderers.
 *
 * @param options - Context creation options
 * @returns RenderContext
 */
export function createRenderContext(options) {
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
export function formatElapsedTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => n.toString().padStart(2, "0");
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
export function getLevelName(level) {
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
//# sourceMappingURL=context.js.map