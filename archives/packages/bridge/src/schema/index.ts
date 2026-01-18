/**
 * Bridge Schema Exports
 *
 * Exports all Zod schemas and types for the Bridge package.
 */

// Source Event
export {
  SourceKind,
  SourceEvent,
  createSourceEvent,
  createUISourceEvent,
  createAPISourceEvent,
  createAgentSourceEvent,
  createSystemSourceEvent,
} from "./source-event.js";

// SnapshotView
export {
  SnapshotView,
  createSnapshotView,
  createEmptySnapshotView,
} from "./snapshot-view.js";

// Projection
export {
  ProjectionResultNone,
  ProjectionResultIntent,
  ProjectionResult,
  noneResult,
  intentResult,
  createSimpleProjection,
} from "./projection.js";
export type { ProjectionRequest, Projection } from "./projection.js";

// Projection Record
export {
  ProjectionRecord,
  createProjectionRecord,
} from "./projection-record.js";
