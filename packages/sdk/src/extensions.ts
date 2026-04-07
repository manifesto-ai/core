/**
 * Public post-activation extension seam for safe arbitrary-snapshot operations.
 * App code should prefer the main sdk entry point unless it needs hypothetical
 * read-only analysis over caller-provided canonical snapshots.
 */
import { getAttachedExtensionKernel } from "./internal.js";
import type { ExtensionKernel } from "./extensions-types.js";
import type {
  BaseLaws,
  ActivatedInstance,
  ManifestoDomainShape,
} from "./types.js";

export type {
  ExtensionKernel,
  ExtensionSimulateResult,
  SimulationActionRef,
  SimulationSession,
  SimulationSessionResult,
  SimulationSessionStatus,
  SimulationSessionStep,
} from "./extensions-types.js";
export { createSimulationSession } from "./simulation-session.js";

export function getExtensionKernel<
  T extends ManifestoDomainShape,
  Laws extends BaseLaws,
>(
  app: ActivatedInstance<T, Laws>,
): ExtensionKernel<T> {
  return getAttachedExtensionKernel<T>(app as object);
}
