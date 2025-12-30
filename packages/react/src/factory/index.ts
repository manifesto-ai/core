/**
 * Factory module for zero-config Manifesto React apps
 */

// Main factory function
export { createManifestoApp, type ManifestoAppResult } from "./create-app.js";

// Types
export type {
  InferState,
  InferComputed,
  InferActions,
  ActionDispatchers,
  ManifestoAppOptions,
  ManifestoApp,
  DomainModule,
  ActionRef,
  ComputedRef,
} from "./types.js";
