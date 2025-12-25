/**
 * Pass Registry Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  PassRegistry,
  PassExecutor,
  createPassRegistry,
  createPassExecutor,
  type Pass,
  type NLPass,
  type PassContext,
  type Finding,
} from '../../src/pass/index.js';
import type { Artifact, CodeArtifact } from '../../src/types/artifact.js';
import type { Fragment, FragmentDraft } from '../../src/types/fragment.js';
import { createProvenance, codeOrigin } from '../../src/types/provenance.js';

// Test fixtures
const testProvenance = createProvenance(
  'test-artifact',
  codeOrigin({ startLine: 1, startCol: 0, endLine: 1, endCol: 10 })
);

const testArtifact: CodeArtifact = {
  id: 'test-artifact',
  kind: 'code',
  language: 'ts',
  content: 'const x = 10;',
};

// Mock Pass implementations
const mockExtractorPass: Pass = {
  name: 'test-extractor',
  priority: 0,
  category: 'extractor',
  supports: (artifact) => artifact.kind === 'code',
  analyze: (ctx) => [
    {
      id: 'finding-1',
      kind: 'variable_declaration',
      passName: 'test-extractor',
      artifactId: ctx.artifact.id,
      data: {
        kind: 'variable_declaration',
        name: 'x',
        varKind: 'const',
        initialValue: 10,
        sourceCode: 'const x = 10;',
      },
      provenance: testProvenance,
    },
  ],
  compile: () => [],
};

const mockSchemaPass: Pass = {
  name: 'test-schema',
  priority: 100,
  dependsOn: ['test-extractor'],
  category: 'lowering',
  supports: (artifact) => artifact.kind === 'code',
  analyze: (ctx) => ctx.previousFindings.filter((f) => f.kind === 'variable_declaration'),
  compile: (findings) =>
    findings.map((f) => ({
      id: `sch_${f.id}`,
      kind: 'SchemaFragment' as const,
      requires: [],
      provides: [`data.${(f.data as { name: string }).name}`],
      namespace: 'data' as const,
      fields: [
        {
          path: `data.${(f.data as { name: string }).name}`,
          type: 'number' as const,
        },
      ],
      origin: f.provenance,
      evidence: [],
      compilerVersion: '0.1.0',
    })),
};

const mockExpressionPass: Pass = {
  name: 'test-expression',
  priority: 200,
  dependsOn: ['test-schema'],
  category: 'lowering',
  supports: () => true,
  analyze: () => [],
  compile: () => [],
};

describe('PassRegistry', () => {
  describe('registration', () => {
    it('should register a pass', () => {
      const registry = createPassRegistry();
      registry.register(mockExtractorPass);

      expect(registry.getPass('test-extractor')).toBe(mockExtractorPass);
    });

    it('should register multiple passes', () => {
      const registry = createPassRegistry();
      registry.registerAll([mockExtractorPass, mockSchemaPass]);

      expect(registry.getAllPasses()).toHaveLength(2);
    });

    it('should throw on duplicate registration', () => {
      const registry = createPassRegistry();
      registry.register(mockExtractorPass);

      expect(() => registry.register(mockExtractorPass)).toThrow('already registered');
    });

    it('should enable/disable passes', () => {
      const registry = createPassRegistry();
      registry.register(mockExtractorPass);

      registry.setEnabled('test-extractor', false);
      expect(registry.getEnabledPasses()).toHaveLength(0);

      registry.setEnabled('test-extractor', true);
      expect(registry.getEnabledPasses()).toHaveLength(1);
    });
  });

  describe('sorting', () => {
    it('should sort passes by priority', () => {
      const registry = createPassRegistry();
      registry.registerAll([mockSchemaPass, mockExtractorPass, mockExpressionPass]);

      const sorted = registry.getSortedPasses();

      expect(sorted[0]?.name).toBe('test-extractor');
      expect(sorted[1]?.name).toBe('test-schema');
      expect(sorted[2]?.name).toBe('test-expression');
    });

    it('should respect dependencies', () => {
      const registry = createPassRegistry();

      // Register in reverse order
      registry.registerAll([mockExpressionPass, mockSchemaPass, mockExtractorPass]);

      const sorted = registry.getSortedPasses();

      // Despite registration order, should be sorted by dependencies
      const extractorIdx = sorted.findIndex((p) => p.name === 'test-extractor');
      const schemaIdx = sorted.findIndex((p) => p.name === 'test-schema');
      const exprIdx = sorted.findIndex((p) => p.name === 'test-expression');

      expect(extractorIdx).toBeLessThan(schemaIdx);
      expect(schemaIdx).toBeLessThan(exprIdx);
    });

    it('should detect cyclic dependencies', () => {
      const registry = createPassRegistry();

      const passA: Pass = {
        name: 'pass-a',
        priority: 0,
        dependsOn: ['pass-b'],
        category: 'lowering',
        supports: () => true,
        analyze: () => [],
        compile: () => [],
      };

      const passB: Pass = {
        name: 'pass-b',
        priority: 0,
        dependsOn: ['pass-a'],
        category: 'lowering',
        supports: () => true,
        analyze: () => [],
        compile: () => [],
      };

      registry.registerAll([passA, passB]);

      expect(() => registry.getSortedPasses()).toThrow('Cyclic dependency');
    });
  });

  describe('supporting passes', () => {
    it('should filter passes that support artifact', () => {
      const registry = createPassRegistry();

      const codeOnlyPass: Pass = {
        name: 'code-only',
        priority: 0,
        category: 'extractor',
        supports: (artifact) => artifact.kind === 'code',
        analyze: () => [],
        compile: () => [],
      };

      const textOnlyPass: Pass = {
        name: 'text-only',
        priority: 0,
        category: 'extractor',
        supports: (artifact) => artifact.kind === 'text',
        analyze: () => [],
        compile: () => [],
      };

      registry.registerAll([codeOnlyPass, textOnlyPass]);

      const supporting = registry.getSupportingPasses(testArtifact);
      expect(supporting).toHaveLength(1);
      expect(supporting[0]?.name).toBe('code-only');
    });
  });
});

describe('PassExecutor', () => {
  it('should execute passes in order', async () => {
    const registry = createPassRegistry();
    registry.registerAll([mockExtractorPass, mockSchemaPass]);

    const executor = createPassExecutor(registry);
    const result = await executor.execute(testArtifact);

    expect(result.passResults).toHaveLength(2);
    expect(result.passResults[0]?.passName).toBe('test-extractor');
    expect(result.passResults[1]?.passName).toBe('test-schema');
  });

  it('should collect findings from all passes', async () => {
    const registry = createPassRegistry();
    registry.registerAll([mockExtractorPass, mockSchemaPass]);

    const executor = createPassExecutor(registry);
    const result = await executor.execute(testArtifact);

    // Extractor finds 1, Schema pass reuses it
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
  });

  it('should collect fragments from all passes', async () => {
    const registry = createPassRegistry();
    registry.registerAll([mockExtractorPass, mockSchemaPass]);

    const executor = createPassExecutor(registry);
    const result = await executor.execute(testArtifact);

    expect(result.fragments).toHaveLength(1);
    expect(result.fragments[0]?.kind).toBe('SchemaFragment');
  });

  it('should pass previousFindings to subsequent passes', async () => {
    const registry = createPassRegistry();

    let receivedFindings: Finding[] = [];

    const receiverPass: Pass = {
      name: 'receiver',
      priority: 100,
      dependsOn: ['test-extractor'],
      category: 'lowering',
      supports: () => true,
      analyze: (ctx) => {
        receivedFindings = ctx.previousFindings;
        return [];
      },
      compile: () => [],
    };

    registry.registerAll([mockExtractorPass, receiverPass]);

    const executor = createPassExecutor(registry);
    await executor.execute(testArtifact);

    expect(receivedFindings.length).toBeGreaterThan(0);
    expect(receivedFindings[0]?.kind).toBe('variable_declaration');
  });

  it('should handle pass errors gracefully', async () => {
    const registry = createPassRegistry();

    const errorPass: Pass = {
      name: 'error-pass',
      priority: 0,
      category: 'extractor',
      supports: () => true,
      analyze: () => {
        throw new Error('Test error');
      },
      compile: () => [],
    };

    registry.register(errorPass);

    const executor = createPassExecutor(registry);
    const result = await executor.execute(testArtifact);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.error.message).toBe('Test error');
  });

  it('should call event callbacks', async () => {
    const registry = createPassRegistry();
    registry.register(mockExtractorPass);

    const executor = createPassExecutor(registry);

    const startCalls: string[] = [];
    const completeCalls: string[] = [];

    await executor.execute(testArtifact, {
      onPassStart: (name) => startCalls.push(name),
      onPassComplete: (result) => completeCalls.push(result.passName),
    });

    expect(startCalls).toContain('test-extractor');
    expect(completeCalls).toContain('test-extractor');
  });

  it('should handle NL passes (async)', async () => {
    const registry = createPassRegistry();

    const nlPass: NLPass = {
      name: 'nl-pass',
      priority: 900,
      category: 'nl',
      supports: (artifact) => artifact.kind === 'text',
      analyze: () => [],
      compile: async () => {
        // Simulate async LLM call
        await new Promise((resolve) => setTimeout(resolve, 10));
        return [
          {
            kind: 'SchemaFragment',
            provisionalRequires: [],
            provisionalProvides: ['data.test'],
            status: 'raw',
            origin: testProvenance,
            confidence: 0.8,
            namespace: 'data',
            fields: [{ path: 'data.test', type: 'string' }],
          } as FragmentDraft,
        ];
      },
    };

    registry.register(nlPass);

    const textArtifact: Artifact = {
      id: 'text-1',
      kind: 'text',
      content: 'Add a test field',
    };

    const executor = createPassExecutor(registry);
    const result = await executor.execute(textArtifact);

    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]?.kind).toBe('SchemaFragment');
  });
});
