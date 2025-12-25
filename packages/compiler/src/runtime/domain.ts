/**
 * Compiler Domain - Manifesto Domain for Compiler Runtime
 *
 * Models the compiler state as a Manifesto Domain, enabling:
 * - Path subscription for real-time observability
 * - Derived values for computed state (blockers, nextSteps)
 * - Event emission for logging
 *
 * PRD 6.8: Compiler Runtime 투명성
 *
 * Domain structure:
 * - data.artifacts: Input artifacts
 * - data.fragments: Generated fragments
 * - data.patches: Applied patches
 * - data.issues: Link/verify issues
 * - data.conflicts: Detected conflicts
 * - data.domain: Generated domain draft
 * - state.phase: Current compiler phase
 * - state.progress: Progress info
 * - state.error: Error message (if any)
 * - derived.blockers: Blocking issues and conflicts
 * - derived.nextSteps: Suggested next actions
 * - derived.isComplete: Whether compilation is complete
 * - derived.isValid: Whether result is valid
 */

import { z } from 'zod';
import {
  defineDomain,
  defineSource,
  defineDerived,
} from '@manifesto-ai/core';
import type { CompilerPhase } from '../types/session.js';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Artifact schema (simplified for domain)
 */
const ArtifactSchema = z.object({
  id: z.string(),
  kind: z.enum(['code', 'text', 'manifesto']),
  content: z.string().optional(),
}).passthrough();

/**
 * Fragment schema (simplified for domain)
 */
const FragmentSchema = z.object({
  id: z.string(),
  kind: z.string(),
  requires: z.array(z.string()),
  provides: z.array(z.string()),
}).passthrough();

/**
 * Patch schema (simplified)
 */
const PatchSchema = z.object({
  id: z.string(),
  ops: z.array(z.unknown()),
}).passthrough();

/**
 * Issue schema
 */
const IssueSchema = z.object({
  id: z.string(),
  code: z.string(),
  severity: z.enum(['error', 'warning', 'info', 'suggestion']),
  message: z.string(),
  path: z.string().optional(),
}).passthrough();

/**
 * Conflict schema
 */
const ConflictSchema = z.object({
  id: z.string(),
  type: z.string(),
  target: z.string(),
  candidates: z.array(z.string()),
  message: z.string(),
}).passthrough();

/**
 * Domain draft schema (simplified)
 */
const DomainDraftSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  dataSchema: z.record(z.unknown()),
  stateSchema: z.record(z.unknown()),
  sources: z.record(z.unknown()),
  derived: z.record(z.unknown()),
  actions: z.record(z.unknown()),
}).passthrough().nullable();

/**
 * Compiler data schema
 */
const CompilerDataSchema = z.object({
  artifacts: z.array(ArtifactSchema),
  fragments: z.array(FragmentSchema),
  patches: z.array(PatchSchema),
  issues: z.array(IssueSchema),
  conflicts: z.array(ConflictSchema),
  domain: DomainDraftSchema,
});

/**
 * Progress schema
 */
const ProgressSchema = z.object({
  stage: z.number(),
  total: z.number(),
  message: z.string(),
});

/**
 * Compiler state schema
 */
const CompilerStateSchema = z.object({
  phase: z.enum([
    'idle',
    'parsing',
    'extracting',
    'lowering',
    'linking',
    'verifying',
    'repairing',
    'done',
    'error',
  ] as const),
  progress: ProgressSchema,
  error: z.string().nullable(),
});

// ============================================================================
// Type exports
// ============================================================================

export type CompilerData = z.infer<typeof CompilerDataSchema>;
export type CompilerState = z.infer<typeof CompilerStateSchema>;

// ============================================================================
// Initial State
// ============================================================================

const initialState: CompilerState = {
  phase: 'idle',
  progress: {
    stage: 0,
    total: 0,
    message: '',
  },
  error: null,
};

// ============================================================================
// Compiler Domain Definition
// ============================================================================

/**
 * Compiler Domain
 *
 * Models the compiler runtime as a Manifesto domain for observability.
 */
export const compilerDomain = defineDomain<CompilerData, CompilerState>({
  id: 'manifesto-compiler',
  name: 'Manifesto Compiler',
  description: 'Compiler runtime state for observability',
  dataSchema: CompilerDataSchema,
  stateSchema: CompilerStateSchema,
  initialState,
  paths: {
    // Source definitions (data paths)
    sources: {
      artifacts: defineSource({
        schema: z.array(ArtifactSchema),
        defaultValue: [],
        semantic: {
          type: 'Artifact[]',
          description: 'Input artifacts to compile',
        },
      }),
      fragments: defineSource({
        schema: z.array(FragmentSchema),
        defaultValue: [],
        semantic: {
          type: 'Fragment[]',
          description: 'Generated fragments',
        },
      }),
      patches: defineSource({
        schema: z.array(PatchSchema),
        defaultValue: [],
        semantic: {
          type: 'Patch[]',
          description: 'Applied patches',
        },
      }),
      issues: defineSource({
        schema: z.array(IssueSchema),
        defaultValue: [],
        semantic: {
          type: 'Issue[]',
          description: 'Link and verification issues',
        },
      }),
      conflicts: defineSource({
        schema: z.array(ConflictSchema),
        defaultValue: [],
        semantic: {
          type: 'Conflict[]',
          description: 'Detected conflicts',
        },
      }),
      domain: defineSource({
        schema: DomainDraftSchema,
        defaultValue: null,
        semantic: {
          type: 'DomainDraft | null',
          description: 'Generated domain draft',
        },
      }),
    },

    // Derived definitions
    // Note: Using simple expressions that work with Manifesto Expression DSL
    derived: {
      isComplete: defineDerived({
        deps: ['state.phase'],
        expr: ['==', ['get', 'state.phase'], 'done'],
        semantic: {
          type: 'boolean',
          description: 'Whether compilation is complete',
        },
      }),

      hasError: defineDerived({
        deps: ['state.phase'],
        expr: ['==', ['get', 'state.phase'], 'error'],
        semantic: {
          type: 'boolean',
          description: 'Whether compilation ended in error',
        },
      }),

      fragmentCount: defineDerived({
        deps: ['data.fragments'],
        expr: ['length', ['get', 'data.fragments']],
        semantic: {
          type: 'number',
          description: 'Number of generated fragments',
        },
      }),

      conflictCount: defineDerived({
        deps: ['data.conflicts'],
        expr: ['length', ['get', 'data.conflicts']],
        semantic: {
          type: 'number',
          description: 'Number of detected conflicts',
        },
      }),

      issueCount: defineDerived({
        deps: ['data.issues'],
        expr: ['length', ['get', 'data.issues']],
        semantic: {
          type: 'number',
          description: 'Number of issues',
        },
      }),
    },
  },
  actions: {},
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get initial compiler data
 */
export function getInitialCompilerData(): CompilerData {
  return {
    artifacts: [],
    fragments: [],
    patches: [],
    issues: [],
    conflicts: [],
    domain: null,
  };
}

/**
 * Get initial compiler state
 */
export function getInitialCompilerState(): CompilerState {
  return { ...initialState };
}
