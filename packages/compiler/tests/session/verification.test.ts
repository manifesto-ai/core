/**
 * Runtime-aided Verification Tests
 *
 * Tests for CompilerSession verification methods that integrate
 * with Core Runtime's explain/getImpact functionality.
 *
 * PRD 6.6.2: Runtime-aided 검증
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createCompiler } from '../../src/compiler.js';
import { createCompilerSession } from '../../src/session.js';
import type { Compiler, CompilerSession } from '../../src/types/compiler.js';
import type { CompileInput, CodeArtifact, TextArtifact } from '../../src/types/artifact.js';
import type { Fragment, SchemaFragment, SourceFragment, DerivedFragment } from '../../src/types/fragment.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestCompiler(): Compiler {
  return createCompiler({
    coreVersion: '0.3.0',
  });
}

function createTestCodeArtifact(content: string, id = 'test-artifact'): CodeArtifact {
  return {
    id,
    kind: 'code',
    language: 'ts',
    content,
    metadata: {},
  };
}

function createSchemaFragment(id: string, path: string): SchemaFragment {
  return {
    id,
    kind: 'SchemaFragment',
    schemaKind: 'data',
    path,
    schema: { type: 'number' },
    provides: [path],
    requires: [],
    origin: {
      artifactId: 'test-artifact',
      location: { kind: 'code', file: 'test.ts', line: 1 },
    },
  };
}

function createSourceFragment(id: string, path: string, requires: string[] = []): SourceFragment {
  return {
    id,
    kind: 'SourceFragment',
    path,
    initialValue: 0,
    provides: [path],
    requires,
    origin: {
      artifactId: 'test-artifact',
      location: { kind: 'code', file: 'test.ts', line: 1 },
    },
  };
}

function createDerivedFragment(
  id: string,
  path: string,
  requires: string[],
  expression: unknown
): DerivedFragment {
  return {
    id,
    kind: 'DerivedFragment',
    path,
    expression,
    provides: [path],
    requires,
    origin: {
      artifactId: 'test-artifact',
      location: { kind: 'code', file: 'test.ts', line: 1 },
    },
  };
}

// ============================================================================
// explainPath Tests
// ============================================================================

describe('CompilerSession.explainPath', () => {
  let compiler: Compiler;
  let session: CompilerSession;

  beforeEach(() => {
    compiler = createTestCompiler();
    session = createCompilerSession(compiler);
  });

  it('should return explanation for existing path', async () => {
    const input: CompileInput = {
      artifacts: [createTestCodeArtifact('const count: number = 42;')],
    };

    await session.compile(input);

    // explainPath should work even if path doesn't exist in runtime
    const result = session.explainPath('data.test' as any);

    expect(result).toBeDefined();
    expect(result.path).toBe('data.test');
    expect(result.contributingFragments).toBeDefined();
    expect(Array.isArray(result.dependencies)).toBe(true);
    expect(typeof result.summary).toBe('string');
  });

  it('should return explanation with contributing fragments', async () => {
    const input: CompileInput = {
      artifacts: [createTestCodeArtifact('const count: number = 42;')],
    };

    await session.compile(input);
    const result = session.explainPath('data.count' as any);

    expect(result).toBeDefined();
    expect(result.path).toBe('data.count');
    expect(result.summary).toContain('data.count');
  });

  it('should handle non-existent path gracefully', () => {
    const result = session.explainPath('data.nonexistent' as any);

    expect(result).toBeDefined();
    expect(result.path).toBe('data.nonexistent');
    expect(result.value).toBeUndefined();
  });
});

// ============================================================================
// getChangeImpact Tests
// ============================================================================

describe('CompilerSession.getChangeImpact', () => {
  let compiler: Compiler;
  let session: CompilerSession;

  beforeEach(() => {
    compiler = createTestCompiler();
    session = createCompilerSession(compiler);
  });

  it('should return impact analysis for fragment', async () => {
    const input: CompileInput = {
      artifacts: [createTestCodeArtifact('const count: number = 42;')],
    };

    await session.compile(input);
    const snapshot = session.getSnapshot();

    // If fragments exist, test impact analysis
    if (snapshot.fragmentsCount > 0) {
      const result = session.getChangeImpact('fragment-1');

      expect(result).toBeDefined();
      expect(result.source.kind).toBe('fragment');
      expect(Array.isArray(result.directImpact)).toBe(true);
      expect(Array.isArray(result.transitiveImpact)).toBe(true);
      expect(Array.isArray(result.affectedFragments)).toBe(true);
    }
  });

  it('should return empty impact for non-existent fragment', () => {
    const result = session.getChangeImpact('nonexistent-fragment');

    expect(result).toBeDefined();
    expect(result.source).toEqual({ kind: 'fragment', fragmentId: 'nonexistent-fragment' });
    expect(result.directImpact).toEqual([]);
    expect(result.transitiveImpact).toEqual([]);
    expect(result.affectedFragments).toEqual([]);
  });

  it('should include potential issue changes', async () => {
    const input: CompileInput = {
      artifacts: [createTestCodeArtifact('const count: number = 42;')],
    };

    await session.compile(input);
    const result = session.getChangeImpact('any-fragment');

    expect(result).toBeDefined();
    expect(Array.isArray(result.potentialIssueChanges)).toBe(true);
    expect(Array.isArray(result.affectedConflicts)).toBe(true);
  });
});

// ============================================================================
// getPathImpact Tests
// ============================================================================

describe('CompilerSession.getPathImpact', () => {
  let compiler: Compiler;
  let session: CompilerSession;

  beforeEach(() => {
    compiler = createTestCompiler();
    session = createCompilerSession(compiler);
  });

  it('should return impact analysis for path', async () => {
    const input: CompileInput = {
      artifacts: [createTestCodeArtifact('const count: number = 42;')],
    };

    await session.compile(input);
    const result = session.getPathImpact('data.count' as any);

    expect(result).toBeDefined();
    expect(result.source.kind).toBe('path');
    if (result.source.kind === 'path') {
      expect(result.source.path).toBe('data.count');
    }
  });

  it('should identify affected fragments', async () => {
    const input: CompileInput = {
      artifacts: [createTestCodeArtifact('const count: number = 42;')],
    };

    await session.compile(input);
    const result = session.getPathImpact('data.count' as any);

    expect(result).toBeDefined();
    expect(Array.isArray(result.affectedFragments)).toBe(true);
  });

  it('should handle non-existent path', () => {
    const result = session.getPathImpact('data.nonexistent' as any);

    expect(result).toBeDefined();
    expect(result.source).toEqual({ kind: 'path', path: 'data.nonexistent' });
    expect(result.directImpact).toEqual([]);
  });
});

// ============================================================================
// getAgentContext Tests
// ============================================================================

describe('CompilerSession.getAgentContext', () => {
  let compiler: Compiler;
  let session: CompilerSession;

  beforeEach(() => {
    compiler = createTestCompiler();
    session = createCompilerSession(compiler);
  });

  it('should return agent context with snapshot', () => {
    const context = session.getAgentContext();

    expect(context).toBeDefined();
    expect(context.snapshot).toBeDefined();
    expect(context.snapshot.phase).toBe('idle');
  });

  it('should include available actions', async () => {
    const input: CompileInput = {
      artifacts: [createTestCodeArtifact('const count: number = 42;')],
    };

    await session.compile(input);
    const context = session.getAgentContext();

    expect(context).toBeDefined();
    expect(Array.isArray(context.availableActions)).toBe(true);
    // Each action should have explanation and estimatedImpact
    for (const actionInfo of context.availableActions) {
      expect(actionInfo.action).toBeDefined();
      expect(typeof actionInfo.explanation).toBe('string');
      expect(Array.isArray(actionInfo.estimatedImpact)).toBe(true);
    }
  });

  it('should include blocker details', () => {
    const context = session.getAgentContext();

    expect(context).toBeDefined();
    expect(Array.isArray(context.blockerDetails)).toBe(true);
  });

  it('should include fragment summary', async () => {
    const input: CompileInput = {
      artifacts: [createTestCodeArtifact('const count: number = 42;')],
    };

    await session.compile(input);
    const context = session.getAgentContext();

    expect(context).toBeDefined();
    expect(context.fragmentSummary).toBeDefined();
    expect(typeof context.fragmentSummary.byKind).toBe('object');
    expect(typeof context.fragmentSummary.byProvenance).toBe('object');
    expect(typeof context.fragmentSummary.totalPaths).toBe('number');
  });

  it('should include metadata with token estimation', () => {
    const context = session.getAgentContext();

    expect(context).toBeDefined();
    expect(context.metadata).toBeDefined();
    expect(typeof context.metadata.projectedAt).toBe('number');
    expect(typeof context.metadata.estimatedTokens).toBe('number');
    expect(context.metadata.estimatedTokens).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// explainIssue Tests
// ============================================================================

describe('CompilerSession.explainIssue', () => {
  let compiler: Compiler;
  let session: CompilerSession;

  beforeEach(() => {
    compiler = createTestCompiler();
    session = createCompilerSession(compiler);
  });

  it('should throw error for non-existent issue', () => {
    expect(() => session.explainIssue('nonexistent-issue')).toThrow(
      'Issue not found: nonexistent-issue'
    );
  });

  it('should explain issue with MISSING_DEPENDENCY code', async () => {
    // Create an artifact that produces a missing dependency issue
    const input: CompileInput = {
      artifacts: [
        createTestCodeArtifact(`
          // This code references a non-existent path
          const derived = get('data.missing');
        `),
      ],
    };

    await session.compile(input);
    const snapshot = session.getSnapshot();

    // Check if there are any issues to explain
    if (snapshot.blockingIssuesCount > 0) {
      const issueId = snapshot.blockers.find((b) => b.kind === 'issue')?.id;
      if (issueId) {
        const result = session.explainIssue(issueId);

        expect(result).toBeDefined();
        expect(result.issue).toBeDefined();
        expect(result.issue.id).toBe(issueId);
        expect(Array.isArray(result.reasoningChain)).toBe(true);
        expect(Array.isArray(result.relatedFragments)).toBe(true);
        expect(typeof result.summary).toBe('string');
      }
    }
  });
});

// ============================================================================
// explainConflict Tests
// ============================================================================

describe('CompilerSession.explainConflict', () => {
  let compiler: Compiler;
  let session: CompilerSession;

  beforeEach(() => {
    compiler = createTestCompiler();
    session = createCompilerSession(compiler);
  });

  it('should throw error for non-existent conflict', () => {
    expect(() => session.explainConflict('nonexistent-conflict')).toThrow(
      'Conflict not found: nonexistent-conflict'
    );
  });

  it('should explain conflict when one exists', async () => {
    // Create artifacts that produce a conflict (multiple providers for same path)
    const input: CompileInput = {
      artifacts: [
        createTestCodeArtifact(
          'const value: number = 1;',
          'artifact-1'
        ),
        createTestCodeArtifact(
          'const value: number = 2;',
          'artifact-2'
        ),
      ],
    };

    await session.compile(input);
    const snapshot = session.getSnapshot();

    // Check if there are any conflicts to explain
    if (snapshot.conflictsCount > 0) {
      const conflictId = snapshot.blockers.find((b) => b.kind === 'conflict')?.id;
      if (conflictId) {
        const result = session.explainConflict(conflictId);

        expect(result).toBeDefined();
        expect(result.conflict).toBeDefined();
        expect(result.conflict.id).toBe(conflictId);
        expect(Array.isArray(result.candidates)).toBe(true);
        expect(typeof result.conflictReason).toBe('string');
        expect(Array.isArray(result.resolutionOptions)).toBe(true);
        expect(typeof result.summary).toBe('string');
      }
    }
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Runtime-aided Verification Integration', () => {
  let compiler: Compiler;
  let session: CompilerSession;

  beforeEach(() => {
    compiler = createTestCompiler();
    session = createCompilerSession(compiler);
  });

  it('should provide consistent context across methods', async () => {
    const input: CompileInput = {
      artifacts: [createTestCodeArtifact('const count: number = 42;')],
    };

    await session.compile(input);

    const snapshot = session.getSnapshot();
    const agentContext = session.getAgentContext();

    // Agent context snapshot should match session snapshot
    expect(agentContext.snapshot.phase).toBe(snapshot.phase);
    expect(agentContext.snapshot.fragmentsCount).toBe(snapshot.fragmentsCount);
    expect(agentContext.snapshot.conflictsCount).toBe(snapshot.conflictsCount);
  });

  it('should handle compilation with multiple artifacts', async () => {
    const input: CompileInput = {
      artifacts: [
        createTestCodeArtifact('const a: number = 1;', 'artifact-1'),
        createTestCodeArtifact('const b: number = 2;', 'artifact-2'),
      ],
    };

    await session.compile(input);

    const context = session.getAgentContext();
    expect(context.snapshot.phase).toBe('done');
  });

  it('should track blockers and next steps', async () => {
    const input: CompileInput = {
      artifacts: [createTestCodeArtifact('const count: number = 42;')],
    };

    await session.compile(input);

    const context = session.getAgentContext();

    // Blockers should match between snapshot and context
    expect(context.blockerDetails.length).toBe(context.snapshot.blockers.length);

    // Available actions should match next steps
    expect(context.availableActions.length).toBe(context.snapshot.nextSteps.length);
  });
});
