/**
 * @manifesto-ai/bridge
 *
 * Two-way binding between UI/external sources and Manifesto Domain.
 *
 * Per Intent & Projection Specification v1.0:
 * - Domain → UI: subscribe(callback) for SnapshotView changes
 * - UI → Domain: dispatch(body) for direct IntentBody submission
 * - UI → Domain: dispatchEvent(source) for Projection-based routing
 *
 * @example
 * ```typescript
 * import { createBridge, createUISourceEvent } from "@manifesto-ai/bridge";
 * import { createManifestoWorld } from "@manifesto-ai/world";
 *
 * // Create world and bridge
 * const world = createManifestoWorld({ schemaHash: "..." });
 * const bridge = createBridge({
 *   world,
 *   schemaHash: world.schemaHash,
 *   defaultActor: { actorId: "user-1", kind: "human" },
 * });
 *
 * // Register projection
 * bridge.registerProjection({
 *   projectionId: "ui:todo-form",
 *   project(req) {
 *     if (req.source.payload?.action === "submit") {
 *       return {
 *         kind: "intent",
 *         body: { type: "todo.create", input: req.source.payload.data },
 *       };
 *     }
 *     return { kind: "none" };
 *   },
 * });
 *
 * // Subscribe to changes
 * const unsubscribe = bridge.subscribe((snapshot) => {
 *   console.log("Snapshot updated:", snapshot);
 * });
 *
 * // Dispatch event
 * await bridge.dispatchEvent(
 *   createUISourceEvent("form-submit", { action: "submit", data: { title: "Buy milk" } })
 * );
 *
 * // Clean up
 * unsubscribe();
 * bridge.dispose();
 * ```
 */

// =============================================================================
// Bridge
// =============================================================================

export {
  type Unsubscribe,
  type SnapshotSubscriber,
  type BridgeConfig,
  Bridge,
  createBridge,
} from "./bridge/index.js";

// =============================================================================
// Schema Types
// =============================================================================

// Source Event
export {
  SourceKind,
  SourceEvent,
  createSourceEvent,
  createUISourceEvent,
  createAPISourceEvent,
  createAgentSourceEvent,
  createSystemSourceEvent,
} from "./schema/index.js";

// Snapshot View
export {
  SnapshotView,
  createSnapshotView,
  createEmptySnapshotView,
} from "./schema/index.js";

// Projection
export {
  ProjectionResultNone,
  ProjectionResultIntent,
  ProjectionResult,
  noneResult,
  intentResult,
  createSimpleProjection,
} from "./schema/index.js";
export type { ProjectionRequest, Projection } from "./schema/index.js";

// Projection Record
export {
  ProjectionRecord,
  createProjectionRecord,
} from "./schema/index.js";

// =============================================================================
// Projection System
// =============================================================================

export {
  type ProjectionRegistry,
  InMemoryProjectionRegistry,
  createProjectionRegistry,
} from "./projection/index.js";

export {
  type ProjectionRecorder,
  InMemoryProjectionRecorder,
  NoOpProjectionRecorder,
  createProjectionRecorder,
  createNoOpRecorder,
} from "./projection/index.js";

// =============================================================================
// Intent Issuer
// =============================================================================

export {
  type IssueRequest,
  type IntentIssuer,
  DefaultIntentIssuer,
  createIntentIssuer,
  toSourceRef,
} from "./issuer/index.js";

// =============================================================================
// Utilities
// =============================================================================

export {
  toSnapshotView,
  deepFreeze,
  toDeepFrozenSnapshotView,
} from "./utils/index.js";

// =============================================================================
// Errors
// =============================================================================

export {
  type BridgeErrorCode,
  BridgeError,
  createBridgeError,
  projectionNotFound,
  projectionAlreadyRegistered,
  noActorConfigured,
  noWorldConfigured,
  noSnapshotAvailable,
  dispatchFailed,
  projectionError,
  invalidArgument,
} from "./errors.js";

// =============================================================================
// Re-exports from @manifesto-ai/world
// =============================================================================

export { IntentBody, type ActorRef } from "@manifesto-ai/world";
