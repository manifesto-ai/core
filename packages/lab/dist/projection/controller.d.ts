/**
 * Projection Controller
 *
 * Controls the Lab projection UI.
 * Uses Ink for terminal rendering.
 */
import type { WorldEvent, Snapshot } from "@manifesto-ai/world";
import type { ProjectionOptions, ProjectionMode, ProjectionView, ProjectionController } from "../types.js";
/**
 * Projection state for tracking display information.
 */
export interface ProjectionState {
    mode: ProjectionMode;
    isPaused: boolean;
    activeViews: Set<ProjectionView>;
    events: WorldEvent[];
    proposalCount: number;
    pendingHITLCount: number;
    worldCount: number;
    snapshot: Snapshot | null;
}
/**
 * Create initial projection state.
 */
export declare function createProjectionState(options: ProjectionOptions | undefined): ProjectionState;
/**
 * Create a projection controller.
 *
 * @param options - Projection options
 * @returns ProjectionController instance
 */
export declare function createProjectionController(options: ProjectionOptions | undefined): ProjectionController;
//# sourceMappingURL=controller.d.ts.map