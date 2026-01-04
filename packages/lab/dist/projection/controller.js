/**
 * Projection Controller
 *
 * Controls the Lab projection UI.
 * Uses Ink for terminal rendering.
 */
import React from "react";
import { render } from "ink";
import { App } from "./components/App.js";
/**
 * Create initial projection state.
 */
export function createProjectionState(options) {
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
export function createProjectionController(options) {
    const state = createProjectionState(options);
    let labWorld = null;
    let renderInstance = null;
    let abortHandler = null;
    const controller = {
        get mode() {
            return state.mode;
        },
        setMode(mode) {
            state.mode = mode;
            this.refresh();
        },
        toggleView(view) {
            if (state.activeViews.has(view)) {
                state.activeViews.delete(view);
            }
            else {
                state.activeViews.add(view);
            }
            this.refresh();
        },
        pause() {
            state.isPaused = true;
        },
        resume() {
            state.isPaused = false;
            this.refresh();
        },
        refresh() {
            if (state.isPaused || state.mode === "silent" || !labWorld || !renderInstance) {
                return;
            }
            // Re-render with updated state
            renderInstance.rerender(React.createElement(App, {
                labWorld,
                mode: state.mode,
                snapshot: state.snapshot,
                onAbort: abortHandler ?? undefined,
            }));
        },
        update(event) {
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
        start(world) {
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
            renderInstance = render(React.createElement(App, {
                labWorld: world,
                mode: state.mode,
                snapshot: state.snapshot,
                onAbort: abortHandler,
            }));
        },
        stop() {
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
//# sourceMappingURL=controller.js.map