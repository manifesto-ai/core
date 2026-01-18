/**
 * Projection Controller
 *
 * Controls the Lab projection UI.
 * Uses Ink for terminal rendering.
 */

import React from "react";
import { render } from "ink";
import type { WorldEvent, Snapshot } from "@manifesto-ai/world";
import type {
  ProjectionOptions,
  ProjectionMode,
  ProjectionView,
  ProjectionController,
  LabWorld,
} from "../types.js";
import { App } from "./components/App.js";

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
export function createProjectionState(
  options: ProjectionOptions | undefined
): ProjectionState {
  return {
    mode: options?.mode ?? "silent",
    isPaused: false,
    activeViews: new Set(["progress", "proposals"]),
    events: [],
    proposalCount: 0,
    pendingHITLCount: 0,
    worldCount: 0,
    snapshot: null,
  };
}

/**
 * Create a projection controller.
 *
 * @param options - Projection options
 * @returns ProjectionController instance
 */
export function createProjectionController(
  options: ProjectionOptions | undefined
): ProjectionController {
  const state = createProjectionState(options);
  let labWorld: LabWorld | null = null;
  let renderInstance: { unmount: () => void; rerender: (element: React.ReactElement) => void } | null = null;
  let abortHandler: (() => void) | null = null;

  const controller: ProjectionController = {
    get mode(): ProjectionMode {
      return state.mode;
    },

    setMode(mode: ProjectionMode): void {
      state.mode = mode;
      this.refresh();
    },

    toggleView(view: ProjectionView): void {
      if (state.activeViews.has(view)) {
        state.activeViews.delete(view);
      } else {
        state.activeViews.add(view);
      }
      this.refresh();
    },

    pause(): void {
      state.isPaused = true;
    },

    resume(): void {
      state.isPaused = false;
      this.refresh();
    },

    refresh(): void {
      if (state.isPaused || state.mode === "silent" || !labWorld || !renderInstance) {
        return;
      }

      // Re-render with updated state
      renderInstance.rerender(
        React.createElement(App, {
          labWorld,
          mode: state.mode,
          snapshot: state.snapshot,
          onAbort: abortHandler ?? undefined,
        })
      );
    },

    update(event: WorldEvent): void {
      if (state.mode === "silent") {
        return;
      }

      // Update state based on event
      state.events.push(event);

      switch (event.type) {
        case "proposal:submitted":
          state.proposalCount++;
          break;
        case "proposal:decided":
          if (event.decision === "pending") {
            state.pendingHITLCount++;
          }
          break;
        case "world:created":
          state.worldCount++;
          break;
        case "snapshot:changed":
          // Update snapshot with the new state
          state.snapshot = event.after.snapshot;
          break;
        case "execution:started":
          // Capture initial snapshot at execution start
          state.snapshot = event.baseSnapshot;
          break;
      }

      // Trigger refresh
      this.refresh();
    },

    start(world: LabWorld): void {
      labWorld = world;

      if (state.mode === "silent") {
        return;
      }

      // Set up abort handler
      abortHandler = () => {
        // This will be connected to the world's abort mechanism
        if (process.env.DEBUG === "true") {
          console.log("[Projection] Abort requested");
        }
      };

      // Render the Ink App component
      renderInstance = render(
        React.createElement(App, {
          labWorld: world,
          mode: state.mode,
          snapshot: state.snapshot,
          onAbort: abortHandler,
        })
      );
    },

    stop(): void {
      if (renderInstance) {
        renderInstance.unmount();
        renderInstance = null;
      }
      labWorld = null;
      abortHandler = null;
    },
  };

  return controller;
}
