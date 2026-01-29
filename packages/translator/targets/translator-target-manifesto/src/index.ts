/**
 * @packageDocumentation
 * Manifesto target exporter for @manifesto-ai/translator.
 */

export type {
  ManifestoExportContext,
  LoweringFailure,
  LoweringResult,
  InvocationStep,
  InvocationPlan,
  ManifestoBundle,
} from "./types.js";

export { manifestoExporter } from "./exporter.js";
export { emitForManifesto } from "./compat.js";
export { generateMelCandidate, type MelCandidate } from "./mel-candidate.js";
