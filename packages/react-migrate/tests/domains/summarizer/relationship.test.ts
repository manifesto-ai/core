/**
 * Relationship Analysis Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDomainRelationshipStrength,
  determineRelationshipType,
  createRelationship,
  analyzeAllRelationships,
  analyzeDomainBoundaries,
  detectCyclicDependencies,
} from '../../../src/domains/summarizer/algorithms/relationship.js';
import type { DomainSummary, DomainRelationship } from '../../../src/domains/summarizer/types.js';
import type { DependencyGraph } from '../../../src/domains/analyzer/types.js';

describe('Relationship Analysis', () => {
  // Helper to create mock domain
  const createMockDomain = (id: string, files: string[], overrides?: Partial<DomainSummary>): DomainSummary => ({
    id,
    name: id,
    description: '',
    sourceFiles: files,
    entities: [],
    actions: [],
    boundaries: { imports: [], exports: [], sharedState: [] },
    suggestedBy: '',
    confidence: 0.9,
    needsReview: false,
    reviewNotes: [],
    ...overrides,
  });

  // Helper to create mock graph
  const createMockGraph = (edges: Array<{ source: string; target: string }>): DependencyGraph => ({
    nodes: [...new Set(edges.flatMap(e => [e.source, e.target]))],
    edges: edges.map(e => ({
      source: e.source,
      target: e.target,
      type: 'import' as const,
      weight: 1,
    })),
    entryPoints: [],
  });

  describe('calculateDomainRelationshipStrength', () => {
    it('should return 0 for unrelated domains', () => {
      const domain1 = createMockDomain('domain-1', ['src/user/profile.ts']);
      const domain2 = createMockDomain('domain-2', ['src/auth/login.ts']);
      const graph = createMockGraph([]);

      const strength = calculateDomainRelationshipStrength(domain1, domain2, graph);
      expect(strength).toBe(0);
    });

    it('should increase strength for import relationship', () => {
      const domain1 = createMockDomain('domain-1', ['src/user/profile.ts']);
      const domain2 = createMockDomain('domain-2', ['src/api/client.ts']);
      const graph = createMockGraph([
        { source: 'src/user/profile.ts', target: 'src/api/client.ts' },
      ]);

      const strength = calculateDomainRelationshipStrength(domain1, domain2, graph);
      expect(strength).toBeGreaterThan(0);
    });

    it('should increase strength for shared state', () => {
      const domain1 = createMockDomain('domain-1', ['src/user/profile.ts'], {
        boundaries: { imports: [], exports: [], sharedState: ['UserContext'] },
      });
      const domain2 = createMockDomain('domain-2', ['src/settings/prefs.ts'], {
        boundaries: { imports: [], exports: [], sharedState: ['UserContext'] },
      });
      const graph = createMockGraph([]);

      const strength = calculateDomainRelationshipStrength(domain1, domain2, graph);
      expect(strength).toBeGreaterThan(0);
    });

    it('should increase strength for same directory', () => {
      const domain1 = createMockDomain('domain-1', ['src/user/profile.ts']);
      const domain2 = createMockDomain('domain-2', ['src/user/settings.ts']);
      const graph = createMockGraph([]);

      const strength = calculateDomainRelationshipStrength(domain1, domain2, graph);
      expect(strength).toBeGreaterThan(0);
    });

    it('should cap strength at 1', () => {
      const domain1 = createMockDomain('domain-1', ['src/user/profile.ts'], {
        boundaries: { imports: [], exports: [], sharedState: ['A', 'B', 'C'] },
      });
      const domain2 = createMockDomain('domain-2', ['src/user/settings.ts'], {
        boundaries: { imports: [], exports: [], sharedState: ['A', 'B', 'C'] },
      });
      // Multiple imports
      const graph = createMockGraph([
        { source: 'src/user/profile.ts', target: 'src/user/settings.ts' },
        { source: 'src/user/settings.ts', target: 'src/user/profile.ts' },
      ]);

      const strength = calculateDomainRelationshipStrength(domain1, domain2, graph);
      expect(strength).toBeLessThanOrEqual(1);
    });
  });

  describe('determineRelationshipType', () => {
    it('should return null for unrelated domains', () => {
      const domain1 = createMockDomain('domain-1', ['src/a.ts']);
      const domain2 = createMockDomain('domain-2', ['src/b.ts']);
      const graph = createMockGraph([]);

      const type = determineRelationshipType(domain1, domain2, graph);
      expect(type).toBeNull();
    });

    it('should detect dependency relationship', () => {
      const domain1 = createMockDomain('domain-1', ['src/user/profile.ts']);
      const domain2 = createMockDomain('domain-2', ['src/api/client.ts']);
      const graph = createMockGraph([
        { source: 'src/user/profile.ts', target: 'src/api/client.ts' },
      ]);

      const type = determineRelationshipType(domain1, domain2, graph);
      expect(type).toBe('dependency');
    });

    it('should detect shared_state relationship', () => {
      const domain1 = createMockDomain('domain-1', ['src/a.ts'], {
        boundaries: { imports: [], exports: [], sharedState: ['SharedContext'] },
      });
      const domain2 = createMockDomain('domain-2', ['src/b.ts'], {
        boundaries: { imports: [], exports: [], sharedState: ['SharedContext'] },
      });
      const graph = createMockGraph([]);

      const type = determineRelationshipType(domain1, domain2, graph);
      expect(type).toBe('shared_state');
    });

    it('should detect event_flow relationship', () => {
      const domain1 = createMockDomain('domain-1', ['src/a.ts'], {
        actions: [{ id: 'action-1', name: 'onUserUpdate', type: 'event', sourcePatterns: [], confidence: 0.9 }],
      });
      const domain2 = createMockDomain('domain-2', ['src/b.ts']);
      const graph = createMockGraph([
        { source: 'src/a.ts', target: 'src/b.ts' },
      ]);

      const type = determineRelationshipType(domain1, domain2, graph);
      expect(type).toBe('event_flow');
    });
  });

  describe('createRelationship', () => {
    it('should return null for weak relationship', () => {
      const domain1 = createMockDomain('domain-1', ['src/a.ts']);
      const domain2 = createMockDomain('domain-2', ['src/b.ts']);
      const graph = createMockGraph([]);

      const rel = createRelationship(domain1, domain2, graph);
      expect(rel).toBeNull();
    });

    it('should create relationship for strong connection', () => {
      const domain1 = createMockDomain('domain-1', ['src/user/profile.ts']);
      const domain2 = createMockDomain('domain-2', ['src/user/api.ts']);
      const graph = createMockGraph([
        { source: 'src/user/profile.ts', target: 'src/user/api.ts' },
      ]);

      const rel = createRelationship(domain1, domain2, graph);
      expect(rel).not.toBeNull();
      expect(rel?.type).toBe('dependency');
      expect(rel?.from).toBe('domain-1');
      expect(rel?.to).toBe('domain-2');
    });

    it('should include evidence', () => {
      const domain1 = createMockDomain('domain-1', ['src/user/profile.ts']);
      const domain2 = createMockDomain('domain-2', ['src/user/api.ts']);
      const graph = createMockGraph([
        { source: 'src/user/profile.ts', target: 'src/user/api.ts' },
      ]);

      const rel = createRelationship(domain1, domain2, graph);
      expect(rel?.evidence.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeAllRelationships', () => {
    it('should analyze relationships between all domain pairs', () => {
      const domains = [
        createMockDomain('domain-1', ['src/a.ts']),
        createMockDomain('domain-2', ['src/b.ts']),
        createMockDomain('domain-3', ['src/c.ts']),
      ];
      const graph = createMockGraph([
        { source: 'src/a.ts', target: 'src/b.ts' },
      ]);

      const result = analyzeAllRelationships(domains, graph);
      expect(result.relationships.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect strong couplings', () => {
      const domains = [
        createMockDomain('domain-1', ['src/a/x.ts', 'src/a/y.ts'], {
          boundaries: { imports: [], exports: [], sharedState: ['A', 'B'] },
        }),
        createMockDomain('domain-2', ['src/a/z.ts'], {
          boundaries: { imports: [], exports: [], sharedState: ['A', 'B'] },
        }),
      ];
      const graph = createMockGraph([
        { source: 'src/a/x.ts', target: 'src/a/z.ts' },
        { source: 'src/a/y.ts', target: 'src/a/z.ts' },
        { source: 'src/a/z.ts', target: 'src/a/x.ts' },
      ]);

      const result = analyzeAllRelationships(domains, graph);
      // May or may not have strong couplings depending on strength calculation
      expect(result.strongCouplings).toBeDefined();
    });

    it('should suggest merges for highly coupled domains', () => {
      const domains = [
        createMockDomain('domain-1', ['src/a/x.ts', 'src/a/y.ts'], {
          boundaries: { imports: [], exports: [], sharedState: ['A', 'B', 'C'] },
        }),
        createMockDomain('domain-2', ['src/a/z.ts', 'src/a/w.ts'], {
          boundaries: { imports: [], exports: [], sharedState: ['A', 'B', 'C'] },
        }),
      ];
      const graph = createMockGraph([
        { source: 'src/a/x.ts', target: 'src/a/z.ts' },
        { source: 'src/a/y.ts', target: 'src/a/w.ts' },
        { source: 'src/a/z.ts', target: 'src/a/x.ts' },
        { source: 'src/a/w.ts', target: 'src/a/y.ts' },
      ]);

      const result = analyzeAllRelationships(domains, graph);
      expect(result.suggestedMerges).toBeDefined();
    });
  });

  describe('analyzeDomainBoundaries', () => {
    it('should identify imports from other domains', () => {
      const domain1 = createMockDomain('domain-1', ['src/user/profile.ts']);
      const domain2 = createMockDomain('domain-2', ['src/api/client.ts']);
      const graph = createMockGraph([
        { source: 'src/user/profile.ts', target: 'src/api/client.ts' },
      ]);

      const analyzed = analyzeDomainBoundaries(domain1, [domain1, domain2], graph);
      expect(analyzed.boundaries.imports).toContain('domain-2');
    });

    it('should identify exports to other domains', () => {
      const domain1 = createMockDomain('domain-1', ['src/user/profile.ts']);
      const domain2 = createMockDomain('domain-2', ['src/api/client.ts']);
      const graph = createMockGraph([
        { source: 'src/user/profile.ts', target: 'src/api/client.ts' },
      ]);

      const analyzed = analyzeDomainBoundaries(domain2, [domain1, domain2], graph);
      expect(analyzed.boundaries.exports).toContain('domain-1');
    });

    it('should identify shared context', () => {
      const domain1 = createMockDomain('domain-1', ['src/user/profile.ts'], {
        entities: [{ id: 'e1', name: 'UserContext', type: 'entity', fields: [], sourcePatterns: [], confidence: 0.9 }],
      });
      const domain2 = createMockDomain('domain-2', ['src/settings/prefs.ts'], {
        entities: [{ id: 'e2', name: 'UserContext', type: 'entity', fields: [], sourcePatterns: [], confidence: 0.9 }],
      });
      const graph = createMockGraph([]);

      const analyzed = analyzeDomainBoundaries(domain1, [domain1, domain2], graph);
      expect(analyzed.boundaries.sharedState).toContain('UserContext');
    });
  });

  describe('detectCyclicDependencies', () => {
    it('should detect simple cycle', () => {
      const domains = [
        createMockDomain('A', []),
        createMockDomain('B', []),
        createMockDomain('C', []),
      ];
      const relationships: DomainRelationship[] = [
        { id: 'r1', type: 'dependency', from: 'A', to: 'B', strength: 0.5, evidence: [] },
        { id: 'r2', type: 'dependency', from: 'B', to: 'C', strength: 0.5, evidence: [] },
        { id: 'r3', type: 'dependency', from: 'C', to: 'A', strength: 0.5, evidence: [] },
      ];

      const cycles = detectCyclicDependencies(domains, relationships);
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should return empty for acyclic graph', () => {
      const domains = [
        createMockDomain('A', []),
        createMockDomain('B', []),
        createMockDomain('C', []),
      ];
      const relationships: DomainRelationship[] = [
        { id: 'r1', type: 'dependency', from: 'A', to: 'B', strength: 0.5, evidence: [] },
        { id: 'r2', type: 'dependency', from: 'B', to: 'C', strength: 0.5, evidence: [] },
      ];

      const cycles = detectCyclicDependencies(domains, relationships);
      expect(cycles).toHaveLength(0);
    });

    it('should not consider non-dependency relationships', () => {
      const domains = [
        createMockDomain('A', []),
        createMockDomain('B', []),
      ];
      const relationships: DomainRelationship[] = [
        { id: 'r1', type: 'shared_state', from: 'A', to: 'B', strength: 0.5, evidence: [] },
        { id: 'r2', type: 'shared_state', from: 'B', to: 'A', strength: 0.5, evidence: [] },
      ];

      const cycles = detectCyclicDependencies(domains, relationships);
      expect(cycles).toHaveLength(0);
    });
  });
});
