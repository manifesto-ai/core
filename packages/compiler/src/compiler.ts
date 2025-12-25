/**
 * Compiler - Main Entry Point
 *
 * The createCompiler() factory function creates a Compiler instance that
 * orchestrates the full compilation pipeline: Artifacts -> Fragments -> Link -> Verify
 *
 * PRD 8.1: 상위 API
 *
 * INVARIANTS (from AGENT_README):
 * - Deterministic core: linking, verification are reproducible (#1)
 * - LLM is untrusted proposal generator (#2)
 * - Effects are descriptions, never executed (#5)
 * - Conflicts are surfaced, never auto-resolved (#6)
 * - Patch-first editing (#9)
 */

import type { Fragment, FragmentId } from './types/fragment.js';
import type { Provenance } from './types/provenance.js';
import type { Patch, PatchHint } from './types/patch.js';
import type { Conflict } from './types/conflict.js';
import type { Issue } from './types/issue.js';
import type { Codebook } from './types/codebook.js';
import type { CompileInput, ArtifactSelection } from './types/artifact.js';
import type {
  CompilerConfig,
  CompileOptions,
  CompileResult,
  LinkResult,
  DomainDraft,
} from './types/session.js';
import type {
  Compiler,
  CompilerSession,
  ApplyPatchResult,
  ExtendedCompilerConfig,
} from './types/compiler.js';

// Pass system
import type { Pass, NLPass, ExecutePassOptions } from './pass/index.js';
import {
  createPassRegistry,
  createPassExecutor,
  codeAstExtractorPass,
  schemaPass,
  expressionLoweringPass,
  effectLoweringPass,
  policyLoweringPass,
  actionPass,
  createNLExtractorPass,
  lowerDrafts,
} from './pass/index.js';

// Linker
import { link as linkerLink, type LinkOptions } from './linker/index.js';

// Verifier
import { verify as verifierVerify, type VerifyResult, type VerifyOptions } from './verifier/index.js';

// Patch
import { applyPatch as patchApply, applyPatches } from './patch/index.js';

// Session
import { createCompilerSession } from './session.js';

// ============================================================================
// Default Passes
// ============================================================================

/**
 * Get default passes for the compiler
 */
function getDefaultPasses(config: CompilerConfig): (Pass | NLPass)[] {
  const passes: (Pass | NLPass)[] = [
    codeAstExtractorPass,
    schemaPass,
    expressionLoweringPass,
    effectLoweringPass,
    policyLoweringPass,
    actionPass,
  ];

  // Add NL pass if LLM adapter is configured
  if (config.llmAdapter) {
    passes.push(createNLExtractorPass({ adapter: config.llmAdapter }));
  }

  return passes;
}

// ============================================================================
// createCompiler
// ============================================================================

/**
 * Create a new Compiler instance
 *
 * @param config - Compiler configuration
 * @returns Compiler instance
 *
 * @example
 * ```typescript
 * const compiler = createCompiler({
 *   coreVersion: '0.3.0',
 *   effectPolicy: { maxRisk: 'medium' },
 * });
 *
 * const result = await compiler.compile({
 *   artifacts: [{
 *     id: 'code-1',
 *     kind: 'code',
 *     language: 'ts',
 *     content: 'const x = 10;'
 *   }]
 * });
 * ```
 */
export function createCompiler(config: ExtendedCompilerConfig): Compiler {
  // Initialize pass registry
  const registry = createPassRegistry();

  // Register passes
  const passConfig = config.passes ?? {};
  const disabledSet = new Set(passConfig.disabled ?? []);

  if (passConfig.useDefaults !== false) {
    const defaults = getDefaultPasses(config);
    for (const pass of defaults) {
      if (!disabledSet.has(pass.name)) {
        registry.register(pass);
      }
    }
  }

  if (passConfig.custom) {
    for (const pass of passConfig.custom) {
      if (!disabledSet.has(pass.name)) {
        registry.register(pass);
      }
    }
  }

  const executor = createPassExecutor(registry);

  // Initialize codebook (mutable during compilation)
  let codebook = config.codebook;

  // Create compiler instance
  const compiler: Compiler = {
    config,

    get codebook() {
      return codebook;
    },

    async compile(input: CompileInput, options?: CompileOptions): Promise<CompileResult> {
      // Step 1: Compile fragments
      const fragments = await this.compileFragments(input, input.selection);

      // Step 2: Apply patches if provided
      let workingFragments = fragments;
      if (options?.patches && options.patches.length > 0) {
        const patchResult = applyPatches(workingFragments, options.patches, codebook);
        workingFragments = patchResult.fragments;
        if (patchResult.codebook) {
          codebook = patchResult.codebook;
        }
      }

      // Step 3: Link fragments
      const linkResult = this.link(workingFragments);

      // Step 4: Verify if not skipped
      let verifyIssues: Issue[] = [];
      if (!options?.skipVerification) {
        const verifyResult = this.verify(linkResult);
        verifyIssues = verifyResult.issues;
      }

      // Step 5: Build provenance map
      const provenance = new Map<FragmentId, Provenance>();
      for (const fragment of linkResult.fragments) {
        provenance.set(fragment.id, fragment.origin);
      }

      return {
        fragments: linkResult.fragments,
        domain: linkResult.domain,
        issues: [...linkResult.issues, ...verifyIssues],
        conflicts: linkResult.conflicts,
        provenance,
      };
    },

    async compileFragments(
      input: CompileInput,
      selection?: ArtifactSelection
    ): Promise<Fragment[]> {
      const allFragments: Fragment[] = [];
      const allDrafts: import('./types/fragment-draft.js').FragmentDraft[] = [];

      for (const artifact of input.artifacts) {
        const executeOptions: ExecutePassOptions = {};

        // Apply selection if this artifact matches
        if (selection && selection.artifactId === artifact.id) {
          executeOptions.selection = selection.span;
        }

        const result = await executor.execute(artifact, executeOptions);
        allFragments.push(...result.fragments);

        // Collect drafts from NL pass results
        for (const passResult of result.passResults) {
          if (passResult.drafts && passResult.drafts.length > 0) {
            allDrafts.push(...passResult.drafts);
          }
        }
      }

      // Lower drafts to fragments (NL pass output)
      // INVARIANT #2: LLM generates drafts, lowering validates and converts
      if (allDrafts.length > 0) {
        const { fragments: loweredFragments } = lowerDrafts(allDrafts);
        allFragments.push(...loweredFragments);
      }

      return allFragments;
    },

    link(fragments: Fragment[], patches?: Patch[]): LinkResult {
      let workingFragments = fragments;

      // Apply patches if provided
      if (patches && patches.length > 0) {
        const patchResult = applyPatches(workingFragments, patches, codebook);
        workingFragments = patchResult.fragments;
        if (patchResult.codebook) {
          codebook = patchResult.codebook;
        }
      }

      // Use linker with configured options
      const linkOptions: LinkOptions = {
        ...config.linker,
        codebook,
      };

      return linkerLink(workingFragments, linkOptions);
    },

    verify(target: DomainDraft | LinkResult): VerifyResult {
      // Determine if target is LinkResult or DomainDraft
      const isLinkResult = 'fragments' in target && 'conflicts' in target;

      if (isLinkResult) {
        return verifierVerify(target as LinkResult, config.verifier);
      }

      // For DomainDraft, create a minimal LinkResult
      const draftResult: LinkResult = {
        fragments: [],
        domain: target as DomainDraft,
        conflicts: [],
        issues: [],
        version: 'verify-domain',
      };

      return verifierVerify(draftResult, config.verifier);
    },

    suggestPatches(issues?: Issue[], conflicts?: Conflict[]): PatchHint[] {
      const hints: PatchHint[] = [];

      // Generate hints from issues
      if (issues) {
        for (const issue of issues) {
          if (issue.suggestedFix) {
            hints.push(issue.suggestedFix);
          }
        }
      }

      // Generate hints from conflicts
      // INVARIANT #6: Conflicts are surfaced, hints are suggestions only
      if (conflicts) {
        for (const conflict of conflicts) {
          if (conflict.suggestedResolutions) {
            hints.push(...conflict.suggestedResolutions);
          }
        }
      }

      return hints;
    },

    applyPatch(fragments: Fragment[], patch: Patch): ApplyPatchResult {
      const result = patchApply(fragments, patch, codebook);
      if (result.codebook) {
        codebook = result.codebook;
      }
      return result;
    },

    createSession(): CompilerSession {
      return createCompilerSession(this);
    },
  };

  return compiler;
}
