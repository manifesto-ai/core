/**
 * Tooling seam for Host-owned execution state.
 *
 * These accessors read the Host-owned namespace (`snapshot.namespaces.host`)
 * — internal execution representation, not application state. They exist for
 * runtime tooling (SDK simulation, inspectors, studio) that must observe
 * Host execution bookkeeping. Application code should never need them; the
 * projected snapshot is the app-facing read model.
 *
 * Keeping them on an explicit subpath makes the coupling legible: consumers
 * of this seam accept that the Host-owned state layout may change with Host
 * minor releases.
 */
export type { HostOwnedState, IntentSlot } from "./types/host-state.js";
export {
  getHostState,
  getIntentSlot,
  getLegacyDataRootHostState,
} from "./types/host-state.js";
