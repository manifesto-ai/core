/**
 * Pipeline Module - Compilation Orchestration
 *
 * Provides the core compilation pipeline logic extracted from compiler.ts.
 * This module orchestrates: Artifacts -> Fragments -> Link -> Verify
 *
 * TRD 1.5: 의존성 방향 규칙
 * - pipeline/ imports from pass/, linker/, verifier/, patch/
 * - compiler.ts uses pipeline/ as orchestration layer
 *
 * INVARIANTS:
 * - Deterministic core: linking, verification are reproducible (#1)
 * - LLM is untrusted proposal generator (#2)
 * - Effects are descriptions, never executed (#5)
 * - Conflicts are surfaced, never auto-resolved (#6)
 */

// Re-export all pipeline components
export {
  compileFragmentsFromArtifacts,
  type CompileFragmentsOptions,
  type CompileFragmentsResult,
} from './fragment-compiler.js';

export {
  runCompilePipeline,
  type PipelineOptions,
  type PipelineResult,
} from './compile-orchestrator.js';

export {
  buildProvenanceMap,
  type ProvenanceMap,
} from './provenance-builder.js';
