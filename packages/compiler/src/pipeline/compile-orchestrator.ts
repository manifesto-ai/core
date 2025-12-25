/**
 * Compile Orchestrator - Full Pipeline Execution
 *
 * Orchestrates the complete compilation pipeline:
 * Artifacts -> Fragments -> (Patch) -> Link -> (Verify) -> Result
 *
 * This is the core compilation flow extracted from Compiler.compile().
 */

import type { Fragment } from '../types/fragment.js';
import type { Patch } from '../types/patch.js';
import type { Issue } from '../types/issue.js';
import type { Codebook } from '../types/codebook.js';
import type { Artifact, ArtifactSelection } from '../types/artifact.js';
import type { CompileResult, LinkResult, DomainDraft } from '../types/session.js';
import type { PassExecutor } from '../pass/index.js';
import type { LinkOptions } from '../linker/index.js';
import type { VerifyOptions, VerifyResult } from '../verifier/index.js';

import { link as linkerLink } from '../linker/index.js';
import { verify as verifierVerify } from '../verifier/index.js';
import { applyPatches } from '../patch/index.js';
import { compileFragmentsFromArtifacts } from './fragment-compiler.js';
import { buildProvenanceMap } from './provenance-builder.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Pipeline execution options
 */
export interface PipelineOptions {
  /** Pass executor for fragment compilation */
  executor: PassExecutor;
  /** Optional artifact selection */
  selection?: ArtifactSelection;
  /** Patches to apply after fragment compilation */
  patches?: Patch[];
  /** Codebook for path aliasing */
  codebook?: Codebook;
  /** Linker options */
  linkerOptions?: LinkOptions;
  /** Verifier options */
  verifierOptions?: VerifyOptions;
  /** Skip verification phase */
  skipVerification?: boolean;
}

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  /** Final compile result */
  result: CompileResult;
  /** Link result (intermediate) */
  linkResult: LinkResult;
  /** Verify result (if not skipped) */
  verifyResult?: VerifyResult;
  /** Updated codebook (if patches were applied) */
  codebook?: Codebook;
}

// ============================================================================
// runCompilePipeline
// ============================================================================

/**
 * Run the full compilation pipeline
 *
 * Steps:
 * 1. Compile artifacts to fragments
 * 2. Apply patches (if provided)
 * 3. Link fragments
 * 4. Verify (if not skipped)
 * 5. Build provenance map
 *
 * @param artifacts - Input artifacts
 * @param options - Pipeline options
 * @returns Complete pipeline result
 */
export async function runCompilePipeline(
  artifacts: Artifact[],
  options: PipelineOptions
): Promise<PipelineResult> {
  const {
    executor,
    selection,
    patches,
    codebook: initialCodebook,
    linkerOptions,
    verifierOptions,
    skipVerification,
  } = options;

  let codebook = initialCodebook;

  // Step 1: Compile fragments from artifacts
  const compileResult = await compileFragmentsFromArtifacts(artifacts, {
    executor,
    selection,
  });

  let workingFragments = compileResult.fragments;

  // Step 2: Apply patches if provided
  if (patches && patches.length > 0) {
    const patchResult = applyPatches(workingFragments, patches, codebook);
    workingFragments = patchResult.fragments;
    if (patchResult.codebook) {
      codebook = patchResult.codebook;
    }
  }

  // Step 3: Link fragments
  const linkOptions: LinkOptions = {
    ...linkerOptions,
    codebook,
  };
  const linkResult = linkerLink(workingFragments, linkOptions);

  // Step 4: Verify (if not skipped)
  let verifyResult: VerifyResult | undefined;
  let verifyIssues: Issue[] = [];

  if (!skipVerification) {
    verifyResult = verifierVerify(linkResult, verifierOptions);
    verifyIssues = verifyResult.issues;
  }

  // Step 5: Build provenance map
  const provenance = buildProvenanceMap(linkResult.fragments);

  // Build final result
  const result: CompileResult = {
    fragments: linkResult.fragments,
    domain: linkResult.domain,
    issues: [...linkResult.issues, ...verifyIssues],
    conflicts: linkResult.conflicts,
    provenance,
  };

  return {
    result,
    linkResult,
    verifyResult,
    codebook,
  };
}
