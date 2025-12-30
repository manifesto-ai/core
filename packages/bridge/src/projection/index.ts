/**
 * Projection System Exports
 *
 * Exports projection registry and recorder for the Bridge package.
 */

// Registry
export {
  type ProjectionRegistry,
  InMemoryProjectionRegistry,
  createProjectionRegistry,
} from "./registry.js";

// Recorder
export {
  type ProjectionRecorder,
  InMemoryProjectionRecorder,
  NoOpProjectionRecorder,
  createProjectionRecorder,
  createNoOpRecorder,
} from "./recorder.js";
