/**
 * @fileoverview Emit Module Exports
 *
 * emitForManifesto() generates Manifesto-compatible output artifacts.
 */

// Main emit function
export { emitForManifesto } from "./emit.js";

// Topological sort utility
export { topologicalSort, type TopologicalSortResult } from "./topological-sort.js";

// MelCandidate generation
export { generateMelCandidate } from "./mel-candidate.js";
