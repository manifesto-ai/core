/**
 * Action Catalog Module
 *
 * Per Intent & Projection Specification v1.1 (§3.4, §7.4)
 *
 * Provides state-dependent action enumeration for UIs and LLM runtimes.
 */

// Types
export type {
  ExpressionIR,
  AvailabilityContext,
  AvailabilityPredicate,
  ActionDescriptor,
  AvailabilityStatus,
  ProjectedAction,
  ActionCatalog,
  PruningOptions,
  AppliedPruningOptions,
  ActionCatalogProjectionRequest,
  ActionCatalogProjector,
} from "./types.js";

// Hash utilities
export { computeCatalogHash, getAppliedPruningOptions } from "./hash.js";

// Projector
export {
  DefaultActionCatalogProjector,
  createActionCatalogProjector,
} from "./projector.js";
