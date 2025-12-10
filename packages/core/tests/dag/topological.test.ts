import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  topologicalSortWithCycleDetection,
  getLevelOrder,
  reverseTopologicalSort,
  partialTopologicalSort,
  getAffectedOrder,
} from '../../src/dag/topological.js';
import { buildDependencyGraph, type DependencyGraph } from '../../src/dag/graph.js';
import { defineDomain, defineSource, defineDerived } from '../../src/domain/define.js';
import type { ManifestoDomain } from '../../src/domain/types.js';

describe('topological', () => {
  // Helper to create a simple chain domain
  // data.a -> derived.b -> derived.c
  function createSimpleDomain(): ManifestoDomain<any, any> {
    return defineDomain({
      id: 'simple',
      name: 'Simple',
      description: 'Simple chain domain',
      dataSchema: z.object({ a: z.number() }),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {
          'data.a': defineSource({
            schema: z.number(),
            semantic: { type: 'input', description: 'A' },
          }),
        },
        derived: {
          'derived.b': defineDerived({
            deps: ['data.a'],
            expr: ['*', ['get', 'data.a'], 2],
            semantic: { type: 'computed', description: 'B' },
          }),
          'derived.c': defineDerived({
            deps: ['derived.b'],
            expr: ['*', ['get', 'derived.b'], 2],
            semantic: { type: 'computed', description: 'C' },
          }),
        },
        async: {},
      },
      actions: {},
    });
  }

  function createSimpleGraph(): DependencyGraph {
    return buildDependencyGraph(createSimpleDomain());
  }

  // Helper to create a diamond domain
  //       data.a
  //       /    \
  //  derived.b  derived.c
  //       \    /
  //      derived.d
  function createDiamondDomain(): ManifestoDomain<any, any> {
    return defineDomain({
      id: 'diamond',
      name: 'Diamond',
      description: 'Diamond dependency domain',
      dataSchema: z.object({ a: z.number() }),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {
          'data.a': defineSource({
            schema: z.number(),
            semantic: { type: 'input', description: 'A' },
          }),
        },
        derived: {
          'derived.b': defineDerived({
            deps: ['data.a'],
            expr: ['+', ['get', 'data.a'], 1],
            semantic: { type: 'computed', description: 'B' },
          }),
          'derived.c': defineDerived({
            deps: ['data.a'],
            expr: ['*', ['get', 'data.a'], 2],
            semantic: { type: 'computed', description: 'C' },
          }),
          'derived.d': defineDerived({
            deps: ['derived.b', 'derived.c'],
            expr: ['+', ['get', 'derived.b'], ['get', 'derived.c']],
            semantic: { type: 'computed', description: 'D' },
          }),
        },
        async: {},
      },
      actions: {},
    });
  }

  function createDiamondGraph(): DependencyGraph {
    return buildDependencyGraph(createDiamondDomain());
  }

  // Helper to create empty domain
  function createEmptyDomain(): ManifestoDomain<any, any> {
    return defineDomain({
      id: 'empty',
      name: 'Empty',
      description: 'Empty domain',
      dataSchema: z.object({}),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {},
        derived: {},
        async: {},
      },
      actions: {},
    });
  }

  function createEmptyGraph(): DependencyGraph {
    return buildDependencyGraph(createEmptyDomain());
  }

  // Helper to create single node domain
  function createSingleNodeDomain(): ManifestoDomain<any, any> {
    return defineDomain({
      id: 'single',
      name: 'Single',
      description: 'Single node domain',
      dataSchema: z.object({ x: z.number() }),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {
          'data.x': defineSource({
            schema: z.number(),
            semantic: { type: 'input', description: 'X' },
          }),
        },
        derived: {},
        async: {},
      },
      actions: {},
    });
  }

  function createSingleNodeGraph(): DependencyGraph {
    return buildDependencyGraph(createSingleNodeDomain());
  }

  // ===========================================
  // topologicalSortWithCycleDetection
  // ===========================================
  describe('topologicalSortWithCycleDetection', () => {
    it('should return sorted order for acyclic graph', () => {
      const graph = createSimpleGraph();
      const result = topologicalSortWithCycleDetection(graph);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.order).toContain('data.a');
        expect(result.order).toContain('derived.b');
        expect(result.order).toContain('derived.c');

        // data.a must come before derived.b
        expect(result.order.indexOf('data.a')).toBeLessThan(
          result.order.indexOf('derived.b')
        );
        // derived.b must come before derived.c
        expect(result.order.indexOf('derived.b')).toBeLessThan(
          result.order.indexOf('derived.c')
        );
      }
    });

    it('should handle diamond dependency', () => {
      const graph = createDiamondGraph();
      const result = topologicalSortWithCycleDetection(graph);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // data.a must come before derived.b and derived.c
        expect(result.order.indexOf('data.a')).toBeLessThan(
          result.order.indexOf('derived.b')
        );
        expect(result.order.indexOf('data.a')).toBeLessThan(
          result.order.indexOf('derived.c')
        );
        // derived.b and derived.c must come before derived.d
        expect(result.order.indexOf('derived.b')).toBeLessThan(
          result.order.indexOf('derived.d')
        );
        expect(result.order.indexOf('derived.c')).toBeLessThan(
          result.order.indexOf('derived.d')
        );
      }
    });

    it('should handle empty graph', () => {
      const graph = createEmptyGraph();
      const result = topologicalSortWithCycleDetection(graph);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.order).toEqual([]);
      }
    });

    it('should handle single node', () => {
      const graph = createSingleNodeGraph();
      const result = topologicalSortWithCycleDetection(graph);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.order).toEqual(['data.x']);
      }
    });
  });

  // ===========================================
  // getLevelOrder
  // ===========================================
  describe('getLevelOrder', () => {
    it('should group nodes by level', () => {
      const graph = createSimpleGraph();
      const levels = getLevelOrder(graph);

      // Level 0: data.a (no deps)
      // Level 1: derived.b (depends on data.a)
      // Level 2: derived.c (depends on derived.b)
      expect(levels).toHaveLength(3);
      expect(levels[0]).toContain('data.a');
      expect(levels[1]).toContain('derived.b');
      expect(levels[2]).toContain('derived.c');
    });

    it('should put parallel nodes in same level', () => {
      const graph = createDiamondGraph();
      const levels = getLevelOrder(graph);

      // Level 0: data.a
      // Level 1: derived.b, derived.c (both depend only on data.a)
      // Level 2: derived.d (depends on b and c)
      expect(levels).toHaveLength(3);
      expect(levels[0]).toContain('data.a');
      expect(levels[1]).toContain('derived.b');
      expect(levels[1]).toContain('derived.c');
      expect(levels[2]).toContain('derived.d');
    });

    it('should handle empty graph', () => {
      const graph = createEmptyGraph();
      const levels = getLevelOrder(graph);

      expect(levels).toEqual([]);
    });

    it('should handle single node', () => {
      const graph = createSingleNodeGraph();
      const levels = getLevelOrder(graph);

      expect(levels).toHaveLength(1);
      expect(levels[0]).toEqual(['data.x']);
    });
  });

  // ===========================================
  // reverseTopologicalSort
  // ===========================================
  describe('reverseTopologicalSort', () => {
    it('should return reversed topological order', () => {
      const graph = createSimpleGraph();
      const reversed = reverseTopologicalSort(graph);

      // Original: data.a -> derived.b -> derived.c
      // Reversed: derived.c -> derived.b -> data.a
      expect(reversed.indexOf('derived.c')).toBeLessThan(
        reversed.indexOf('derived.b')
      );
      expect(reversed.indexOf('derived.b')).toBeLessThan(
        reversed.indexOf('data.a')
      );
    });

    it('should handle single node', () => {
      const graph = createSingleNodeGraph();
      const reversed = reverseTopologicalSort(graph);

      expect(reversed).toEqual(['data.x']);
    });

    it('should handle empty graph', () => {
      const graph = createEmptyGraph();
      const reversed = reverseTopologicalSort(graph);

      expect(reversed).toEqual([]);
    });
  });

  // ===========================================
  // partialTopologicalSort
  // ===========================================
  describe('partialTopologicalSort', () => {
    it('should filter and maintain order', () => {
      const graph = createSimpleGraph();
      const partial = partialTopologicalSort(graph, ['data.a', 'derived.c']);

      expect(partial).toHaveLength(2);
      expect(partial.indexOf('data.a')).toBeLessThan(
        partial.indexOf('derived.c')
      );
    });

    it('should return empty for no matching paths', () => {
      const graph = createSimpleGraph();
      const partial = partialTopologicalSort(graph, ['nonexistent.path']);

      expect(partial).toEqual([]);
    });

    it('should handle single matching path', () => {
      const graph = createSimpleGraph();
      const partial = partialTopologicalSort(graph, ['derived.b']);

      expect(partial).toEqual(['derived.b']);
    });

    it('should handle all paths', () => {
      const graph = createSimpleGraph();
      const partial = partialTopologicalSort(graph, [
        'data.a',
        'derived.b',
        'derived.c',
      ]);

      expect(partial).toHaveLength(3);
      expect(partial.indexOf('data.a')).toBeLessThan(
        partial.indexOf('derived.b')
      );
      expect(partial.indexOf('derived.b')).toBeLessThan(
        partial.indexOf('derived.c')
      );
    });
  });

  // ===========================================
  // getAffectedOrder
  // ===========================================
  describe('getAffectedOrder', () => {
    it('should return affected paths in order', () => {
      const graph = createSimpleGraph();
      const affected = getAffectedOrder(graph, ['data.a']);

      // Changing data.a affects derived.b and derived.c
      expect(affected).toContain('data.a');
      expect(affected).toContain('derived.b');
      expect(affected).toContain('derived.c');

      // Order must be preserved
      expect(affected.indexOf('data.a')).toBeLessThan(
        affected.indexOf('derived.b')
      );
      expect(affected.indexOf('derived.b')).toBeLessThan(
        affected.indexOf('derived.c')
      );
    });

    it('should handle middle node change', () => {
      const graph = createSimpleGraph();
      const affected = getAffectedOrder(graph, ['derived.b']);

      // Changing derived.b only affects derived.c
      expect(affected).toContain('derived.b');
      expect(affected).toContain('derived.c');
      expect(affected).not.toContain('data.a');
    });

    it('should handle leaf node change', () => {
      const graph = createSimpleGraph();
      const affected = getAffectedOrder(graph, ['derived.c']);

      // Changing derived.c affects only itself (no dependents)
      expect(affected).toEqual(['derived.c']);
    });

    it('should handle multiple changed paths', () => {
      const graph = createDiamondGraph();
      const affected = getAffectedOrder(graph, ['derived.b', 'derived.c']);

      // Both derived.b and derived.c affect derived.d
      expect(affected).toContain('derived.b');
      expect(affected).toContain('derived.c');
      expect(affected).toContain('derived.d');
    });

    it('should deduplicate overlapping affected paths', () => {
      const graph = createDiamondGraph();
      // Both data.a -> derived.b -> derived.d
      //       data.a -> derived.c -> derived.d
      const affected = getAffectedOrder(graph, ['data.a']);

      // derived.d should only appear once
      const dCount = affected.filter((p) => p === 'derived.d').length;
      expect(dCount).toBe(1);
    });

    it('should handle empty changed paths', () => {
      const graph = createSimpleGraph();
      const affected = getAffectedOrder(graph, []);

      expect(affected).toEqual([]);
    });
  });
});
