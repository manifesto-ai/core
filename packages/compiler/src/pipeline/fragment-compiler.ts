/**
 * Fragment Compiler - Artifact to Fragment Transformation
 *
 * Handles the first phase of compilation: transforming artifacts
 * into fragments through the pass system.
 *
 * Flow:
 * Input Artifacts -> Pass Executor -> Fragments + Drafts -> Lower Drafts -> All Fragments
 */

import type { Fragment } from '../types/fragment.js';
import type { FragmentDraft } from '../types/fragment-draft.js';
import type { Artifact, ArtifactSelection } from '../types/artifact.js';
import type { PassExecutor, ExecutePassOptions } from '../pass/index.js';
import { lowerDrafts } from '../pass/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for compileFragmentsFromArtifacts
 */
export interface CompileFragmentsOptions {
  /** Pass executor to use */
  executor: PassExecutor;
  /** Optional selection for partial compilation */
  selection?: ArtifactSelection;
}

/**
 * Result of fragment compilation
 */
export interface CompileFragmentsResult {
  /** Generated fragments */
  fragments: Fragment[];
  /** Collected drafts (before lowering) */
  drafts: FragmentDraft[];
  /** Issues from compilation (pass-level) */
  issues: Array<{ artifactId: string; message: string }>;
}

// ============================================================================
// compileFragmentsFromArtifacts
// ============================================================================

/**
 * Compile artifacts into fragments using the pass system
 *
 * This is the first phase of the compilation pipeline:
 * 1. Execute passes on each artifact
 * 2. Collect fragments and drafts
 * 3. Lower drafts to fragments (INVARIANT #2: LLM generates drafts, lowering validates)
 *
 * @param artifacts - Input artifacts to compile
 * @param options - Compilation options including executor and selection
 * @returns Compiled fragments and any collected drafts/issues
 */
export async function compileFragmentsFromArtifacts(
  artifacts: Artifact[],
  options: CompileFragmentsOptions
): Promise<CompileFragmentsResult> {
  const { executor, selection } = options;

  const allFragments: Fragment[] = [];
  const allDrafts: FragmentDraft[] = [];
  const issues: Array<{ artifactId: string; message: string }> = [];

  for (const artifact of artifacts) {
    const executeOptions: ExecutePassOptions = {};

    // Apply selection if this artifact matches
    if (selection && selection.artifactId === artifact.id) {
      executeOptions.selection = selection.span;
    }

    try {
      const result = await executor.execute(artifact, executeOptions);
      allFragments.push(...result.fragments);

      // Collect drafts from NL pass results
      for (const passResult of result.passResults) {
        if (passResult.drafts && passResult.drafts.length > 0) {
          allDrafts.push(...passResult.drafts);
        }
      }
    } catch (error) {
      // Record issue but continue with other artifacts
      issues.push({
        artifactId: artifact.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Lower drafts to fragments (NL pass output)
  // INVARIANT #2: LLM generates drafts, lowering validates and converts
  if (allDrafts.length > 0) {
    const { fragments: loweredFragments, results: loweringResults } = lowerDrafts(allDrafts);
    allFragments.push(...loweredFragments);

    // Extract errors from lowering results
    for (const result of loweringResults) {
      if (result.errors) {
        for (const error of result.errors) {
          issues.push({
            artifactId: 'draft-lowering',
            message: error.message,
          });
        }
      }
    }
  }

  return {
    fragments: allFragments,
    drafts: allDrafts,
    issues,
  };
}
