import { describe, it, expect } from 'vitest';
import {
  buildDependencyGraph,
  analyzeGraph,
  findCycles,
  findConnectedComponents,
  findAllDependencies,
  findAllDependents,
  analyzeContextSharing,
  calculateRelationshipStrength,
  resolveImportPath,
} from '../../../src/domains/analyzer/algorithms/dependency-graph.js';
import type { FileAnalysis, ImportInfo } from '../../../src/parser/types.js';

describe('Dependency Graph', () => {
  const createAnalysis = (
    path: string,
    imports: ImportInfo[] = [],
    exports: string[] = []
  ): FileAnalysis => ({
    path,
    relativePath: path.replace('/src/', ''),
    type: 'component',
    ast: null,
    patterns: [],
    imports,
    exports: exports.map(name => ({
      name,
      isDefault: name === 'default',
      isTypeOnly: false,
      type: 'function' as const,
    })),
    confidence: 0.9,
    issues: [],
    parseTime: 10,
  });

  describe('buildDependencyGraph', () => {
    it('should build graph from file analyses', () => {
      const analyses: FileAnalysis[] = [
        createAnalysis('/src/a.tsx', [
          { source: './b', specifiers: [{ name: 'B', isDefault: true, isNamespace: false }], isTypeOnly: false },
        ]),
        createAnalysis('/src/b.tsx', [
          { source: './c', specifiers: [{ name: 'C', isDefault: false, isNamespace: false }], isTypeOnly: false },
        ]),
        createAnalysis('/src/c.tsx'),
      ];

      const graph = buildDependencyGraph(analyses);

      expect(graph.nodes).toContain('/src/a.tsx');
      expect(graph.nodes).toContain('/src/b.tsx');
      expect(graph.nodes).toContain('/src/c.tsx');
      // Use source/target instead of from/to
      expect(graph.edges.some(e => e.source === '/src/a.tsx' && e.target === '/src/b.tsx')).toBe(true);
      expect(graph.edges.some(e => e.source === '/src/b.tsx' && e.target === '/src/c.tsx')).toBe(true);
    });

    it('should handle external dependencies', () => {
      const analyses: FileAnalysis[] = [
        createAnalysis('/src/a.tsx', [
          { source: 'react', specifiers: [{ name: 'useState', isDefault: false, isNamespace: false }], isTypeOnly: false },
          { source: './b', specifiers: [{ name: 'B', isDefault: true, isNamespace: false }], isTypeOnly: false },
        ]),
        createAnalysis('/src/b.tsx'),
      ];

      const graph = buildDependencyGraph(analyses);

      // External dependencies should not be in nodes
      expect(graph.nodes).not.toContain('react');
      expect(graph.edges.some(e => e.target === 'react')).toBe(false);
    });
  });

  describe('findCycles', () => {
    it('should detect cycles in the graph', () => {
      // A -> B -> C -> A (cycle)
      const graph = {
        nodes: ['/src/a.tsx', '/src/b.tsx', '/src/c.tsx'],
        edges: [
          { source: '/src/a.tsx', target: '/src/b.tsx', specifiers: [], isReexport: false },
          { source: '/src/b.tsx', target: '/src/c.tsx', specifiers: [], isReexport: false },
          { source: '/src/c.tsx', target: '/src/a.tsx', specifiers: [], isReexport: false },
        ],
      };

      const cycles = findCycles(graph);

      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should not detect cycles in DAG', () => {
      // A -> B -> C (no cycle)
      const graph = {
        nodes: ['/src/a.tsx', '/src/b.tsx', '/src/c.tsx'],
        edges: [
          { source: '/src/a.tsx', target: '/src/b.tsx', specifiers: [], isReexport: false },
          { source: '/src/b.tsx', target: '/src/c.tsx', specifiers: [], isReexport: false },
        ],
      };

      const cycles = findCycles(graph);

      expect(cycles).toHaveLength(0);
    });
  });

  describe('findConnectedComponents', () => {
    it('should find connected components', () => {
      // Two disconnected groups: (A-B) and (C-D)
      const graph = {
        nodes: ['/src/a.tsx', '/src/b.tsx', '/src/c.tsx', '/src/d.tsx'],
        edges: [
          { source: '/src/a.tsx', target: '/src/b.tsx', specifiers: [], isReexport: false },
          { source: '/src/c.tsx', target: '/src/d.tsx', specifiers: [], isReexport: false },
        ],
      };

      const components = findConnectedComponents(graph);

      expect(components).toHaveLength(2);
    });

    it('should find single component when all connected', () => {
      const graph = {
        nodes: ['/src/a.tsx', '/src/b.tsx', '/src/c.tsx'],
        edges: [
          { source: '/src/a.tsx', target: '/src/b.tsx', specifiers: [], isReexport: false },
          { source: '/src/b.tsx', target: '/src/c.tsx', specifiers: [], isReexport: false },
        ],
      };

      const components = findConnectedComponents(graph);

      expect(components).toHaveLength(1);
      expect(components[0]).toHaveLength(3);
    });
  });

  describe('findAllDependencies', () => {
    it('should find all transitive dependencies', () => {
      const graph = {
        nodes: ['/src/a.tsx', '/src/b.tsx', '/src/c.tsx', '/src/d.tsx'],
        edges: [
          { source: '/src/a.tsx', target: '/src/b.tsx', specifiers: [], isReexport: false },
          { source: '/src/b.tsx', target: '/src/c.tsx', specifiers: [], isReexport: false },
          { source: '/src/c.tsx', target: '/src/d.tsx', specifiers: [], isReexport: false },
        ],
      };

      const deps = findAllDependencies(graph, '/src/a.tsx');

      expect(deps.has('/src/b.tsx')).toBe(true);
      expect(deps.has('/src/c.tsx')).toBe(true);
      expect(deps.has('/src/d.tsx')).toBe(true);
      expect(deps.has('/src/a.tsx')).toBe(false);
    });
  });

  describe('findAllDependents', () => {
    it('should find all files that depend on a node', () => {
      const graph = {
        nodes: ['/src/a.tsx', '/src/b.tsx', '/src/c.tsx', '/src/d.tsx'],
        edges: [
          { source: '/src/a.tsx', target: '/src/d.tsx', specifiers: [], isReexport: false },
          { source: '/src/b.tsx', target: '/src/d.tsx', specifiers: [], isReexport: false },
          { source: '/src/c.tsx', target: '/src/d.tsx', specifiers: [], isReexport: false },
        ],
      };

      const dependents = findAllDependents(graph, '/src/d.tsx');

      expect(dependents.has('/src/a.tsx')).toBe(true);
      expect(dependents.has('/src/b.tsx')).toBe(true);
      expect(dependents.has('/src/c.tsx')).toBe(true);
    });
  });

  describe('analyzeGraph', () => {
    it('should provide graph analysis', () => {
      const analyses: FileAnalysis[] = [
        createAnalysis('/src/a.tsx', [
          { source: './b', specifiers: [{ name: 'B', isDefault: true, isNamespace: false }], isTypeOnly: false },
        ]),
        createAnalysis('/src/b.tsx', [
          { source: './c', specifiers: [{ name: 'C', isDefault: true, isNamespace: false }], isTypeOnly: false },
        ]),
        createAnalysis('/src/c.tsx'),
      ];

      const graph = buildDependencyGraph(analyses);
      const analysis = analyzeGraph(analyses, graph);

      expect(analysis.nodes.size).toBe(3);
      expect(analysis.entryPoints).toContain('/src/a.tsx');
      expect(analysis.leafNodes).toContain('/src/c.tsx');
    });
  });

  describe('analyzeContextSharing', () => {
    it('should analyze context sharing patterns', () => {
      const analyses: FileAnalysis[] = [
        {
          ...createAnalysis('/src/UserContext.tsx'),
          patterns: [
            { type: 'context', name: 'UserContext', location: { start: { line: 1, column: 0 }, end: { line: 5, column: 1 } }, confidence: 0.95, metadata: { contextName: 'UserContext', hasProvider: true }, needsReview: false },
          ],
        },
        {
          ...createAnalysis('/src/useUser.ts', [
            { source: './UserContext', specifiers: [{ name: 'UserContext', isDefault: false, isNamespace: false }], isTypeOnly: false },
          ]),
          patterns: [
            { type: 'hook', name: 'useUser', location: { start: { line: 1, column: 0 }, end: { line: 10, column: 1 } }, confidence: 0.9, metadata: { contextName: 'UserContext', hasConsumer: true }, needsReview: false },
          ],
        },
      ];

      const graph = buildDependencyGraph(analyses);
      const graphAnalysis = analyzeGraph(analyses, graph);
      const contextSharing = analyzeContextSharing(graphAnalysis);

      expect(contextSharing.size).toBeGreaterThan(0);
    });
  });

  describe('calculateRelationshipStrength', () => {
    it('should calculate relationship strength between files', () => {
      const graph = {
        nodes: ['/src/a.tsx', '/src/b.tsx'],
        edges: [
          { source: '/src/a.tsx', target: '/src/b.tsx', specifiers: ['B', 'BHelper'], isReexport: false },
        ],
      };

      const strength = calculateRelationshipStrength(graph, '/src/a.tsx', '/src/b.tsx');

      expect(strength).toBeGreaterThan(0);
    });

    it('should return 0 for unrelated files', () => {
      const graph = {
        nodes: ['/src/a.tsx', '/src/b.tsx'],
        edges: [],
      };

      const strength = calculateRelationshipStrength(graph, '/src/a.tsx', '/src/b.tsx');

      expect(strength).toBe(0);
    });
  });

  describe('resolveImportPath', () => {
    const allFiles = [
      '/src/features/user/hooks/useUser.ts',
      '/src/features/user/hooks/UserContext.ts',
      '/src/features/user/context.ts',
      '/src/features/shared/utils.ts',
      '/src/hooks/index.ts',
    ];

    it('should resolve relative imports', () => {
      expect(resolveImportPath('/src/features/user/hooks/useUser.ts', './UserContext', allFiles)).toBe('/src/features/user/hooks/UserContext.ts');
      expect(resolveImportPath('/src/features/user/hooks/useUser.ts', '../context', allFiles)).toBe('/src/features/user/context.ts');
    });

    it('should return null for package imports', () => {
      expect(resolveImportPath('/src/file.ts', 'react', allFiles)).toBeNull();
      expect(resolveImportPath('/src/file.ts', '@tanstack/react-query', allFiles)).toBeNull();
    });

    it('should handle index imports', () => {
      const resolved = resolveImportPath('/src/components/Button.tsx', '../hooks', allFiles);
      expect(resolved).toBe('/src/hooks/index.ts');
    });
  });
});
