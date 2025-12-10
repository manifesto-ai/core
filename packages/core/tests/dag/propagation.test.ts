import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  propagate,
  propagateAsyncResult,
  analyzeImpact,
  createDebouncedPropagator,
  type SnapshotLike,
} from '../../src/dag/propagation.js';
import { buildDependencyGraph, type DependencyGraph } from '../../src/dag/graph.js';
import { defineDomain, defineSource, defineDerived } from '../../src/domain/define.js';
import type { ManifestoDomain } from '../../src/domain/types.js';

describe('DAG Propagation', () => {
  // Helper to create a simple domain for testing
  function createTestDomain(): ManifestoDomain<any, any> {
    return defineDomain({
      id: 'test-domain',
      name: 'Test Domain',
      description: 'Domain for testing propagation',
      dataSchema: z.object({
        a: z.number(),
        b: z.number(),
      }),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {
          'data.a': defineSource({
            schema: z.number(),
            semantic: { type: 'input', description: 'Value A' },
          }),
          'data.b': defineSource({
            schema: z.number(),
            semantic: { type: 'input', description: 'Value B' },
          }),
        },
        derived: {
          'derived.sum': defineDerived({
            deps: ['data.a', 'data.b'],
            expr: ['+', ['get', 'data.a'], ['get', 'data.b']],
            semantic: { type: 'computed', description: 'Sum of A and B' },
          }),
          'derived.product': defineDerived({
            deps: ['data.a', 'data.b'],
            expr: ['*', ['get', 'data.a'], ['get', 'data.b']],
            semantic: { type: 'computed', description: 'Product of A and B' },
          }),
          'derived.sumPlusProduct': defineDerived({
            deps: ['derived.sum', 'derived.product'],
            expr: ['+', ['get', 'derived.sum'], ['get', 'derived.product']],
            semantic: { type: 'computed', description: 'Sum plus Product' },
          }),
        },
      },
    });
  }

  // Helper to create a mock snapshot
  function createMockSnapshot(values: Record<string, unknown>): SnapshotLike {
    const data = new Map<string, unknown>(Object.entries(values));
    return {
      get: (path) => data.get(path),
      set: (path, value) => data.set(path, value),
    };
  }

  describe('propagate', () => {
    it('should propagate changes through derived paths', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);
      const snapshot = createMockSnapshot({
        'data.a': 5,
        'data.b': 3,
        'derived.sum': 0,
        'derived.product': 0,
        'derived.sumPlusProduct': 0,
      });

      const result = propagate(graph, ['data.a'], snapshot);

      expect(result.errors).toHaveLength(0);
      expect(result.changes.get('derived.sum')).toBe(8);
      expect(result.changes.get('derived.product')).toBe(15);
      expect(result.changes.get('derived.sumPlusProduct')).toBe(23);
    });

    it('should propagate multiple changed paths', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);
      const snapshot = createMockSnapshot({
        'data.a': 10,
        'data.b': 20,
        'derived.sum': 0,
        'derived.product': 0,
        'derived.sumPlusProduct': 0,
      });

      const result = propagate(graph, ['data.a', 'data.b'], snapshot);

      expect(result.errors).toHaveLength(0);
      expect(result.changes.get('derived.sum')).toBe(30);
      expect(result.changes.get('derived.product')).toBe(200);
      expect(result.changes.get('derived.sumPlusProduct')).toBe(230);
    });

    it('should not include unchanged values', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);
      const snapshot = createMockSnapshot({
        'data.a': 5,
        'data.b': 3,
        'derived.sum': 8, // Already correct
        'derived.product': 15, // Already correct
        'derived.sumPlusProduct': 23, // Already correct
      });

      const result = propagate(graph, ['data.a'], snapshot);

      // No changes because values are already correct
      expect(result.changes.has('derived.sum')).toBe(false);
      expect(result.changes.has('derived.product')).toBe(false);
      expect(result.changes.has('derived.sumPlusProduct')).toBe(false);
    });

    it('should collect errors for invalid expressions', () => {
      const domain = defineDomain({
        id: 'error-domain',
        name: 'Error Domain',
        description: 'Domain with error',
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
          derived: {
            'derived.invalid': defineDerived({
              deps: ['data.x'],
              expr: ['invalidOp', ['get', 'data.x']],
              semantic: { type: 'computed', description: 'Invalid' },
            }),
          },
        },
      });

      const graph = buildDependencyGraph(domain);
      const snapshot = createMockSnapshot({ 'data.x': 10 });

      const result = propagate(graph, ['data.x'], snapshot);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.path).toBe('derived.invalid');
    });

    it('should handle empty changed paths', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);
      const snapshot = createMockSnapshot({
        'data.a': 5,
        'data.b': 3,
      });

      const result = propagate(graph, [], snapshot);

      expect(result.changes.size).toBe(0);
      expect(result.pendingEffects).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle non-existent paths gracefully', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);
      const snapshot = createMockSnapshot({
        'data.a': 5,
        'data.b': 3,
      });

      const result = propagate(graph, ['non.existent.path'], snapshot);

      expect(result.errors).toHaveLength(0);
    });

    it('should record source changes in result', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);
      const snapshot = createMockSnapshot({
        'data.a': 5,
        'data.b': 3,
        'derived.sum': 0,
      });

      const result = propagate(graph, ['data.a'], snapshot);

      // Source should also be recorded if it was in changedPaths
      expect(result.changes.has('data.a')).toBe(true);
      expect(result.changes.get('data.a')).toBe(5);
    });
  });

  describe('analyzeImpact', () => {
    it('should analyze impact of source path change', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);

      const impact = analyzeImpact(graph, 'data.a');

      expect(impact.affectedPaths).toContain('derived.sum');
      expect(impact.affectedPaths).toContain('derived.product');
      expect(impact.affectedPaths).toContain('derived.sumPlusProduct');
      expect(impact.affectedNodes.length).toBeGreaterThan(0);
    });

    it('should return affected paths for leaf node', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);

      const impact = analyzeImpact(graph, 'derived.sumPlusProduct');

      // sumPlusProduct is a leaf, but it should include itself
      expect(impact.affectedPaths).toContain('derived.sumPlusProduct');
    });

    it('should handle non-existent path', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);

      const impact = analyzeImpact(graph, 'non.existent');

      expect(impact.affectedPaths).toHaveLength(0);
      expect(impact.affectedNodes).toHaveLength(0);
      expect(impact.asyncTriggers).toHaveLength(0);
    });
  });

  describe('createDebouncedPropagator', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce multiple queue calls', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);
      const snapshot = createMockSnapshot({
        'data.a': 5,
        'data.b': 3,
        'derived.sum': 0,
        'derived.product': 0,
        'derived.sumPlusProduct': 0,
      });

      const propagator = createDebouncedPropagator(graph, snapshot, 100);

      propagator.queue(['data.a']);
      propagator.queue(['data.b']);

      // No immediate propagation
      expect(snapshot.get('derived.sum')).toBe(0);

      // Advance time
      vi.advanceTimersByTime(100);

      // Now propagation should have happened
      expect(snapshot.get('derived.sum')).toBe(8);
    });

    it('should flush immediately when called', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);
      const snapshot = createMockSnapshot({
        'data.a': 5,
        'data.b': 3,
        'derived.sum': 0,
        'derived.product': 0,
        'derived.sumPlusProduct': 0,
      });

      const propagator = createDebouncedPropagator(graph, snapshot, 100);

      propagator.queue(['data.a']);
      const result = propagator.flush();

      expect(result.changes.size).toBeGreaterThan(0);
      expect(snapshot.get('derived.sum')).toBe(8);
    });

    it('should cancel pending propagation', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);
      const snapshot = createMockSnapshot({
        'data.a': 5,
        'data.b': 3,
        'derived.sum': 0,
        'derived.product': 0,
        'derived.sumPlusProduct': 0,
      });

      const propagator = createDebouncedPropagator(graph, snapshot, 100);

      propagator.queue(['data.a']);
      propagator.cancel();

      vi.advanceTimersByTime(200);

      // Should not have propagated
      expect(snapshot.get('derived.sum')).toBe(0);
    });

    it('should return last result on empty flush', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);
      const snapshot = createMockSnapshot({
        'data.a': 5,
        'data.b': 3,
        'derived.sum': 0,
      });

      const propagator = createDebouncedPropagator(graph, snapshot, 100);

      // First flush with data
      propagator.queue(['data.a']);
      const firstResult = propagator.flush();

      // Second flush without new data
      const secondResult = propagator.flush();

      expect(secondResult).toBe(firstResult);
    });

    it('should merge multiple paths in queue', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);
      const snapshot = createMockSnapshot({
        'data.a': 10,
        'data.b': 20,
        'derived.sum': 0,
        'derived.product': 0,
        'derived.sumPlusProduct': 0,
      });

      const propagator = createDebouncedPropagator(graph, snapshot, 50);

      propagator.queue(['data.a']);
      vi.advanceTimersByTime(25); // Not enough time
      propagator.queue(['data.b']);
      vi.advanceTimersByTime(50); // Now it fires

      expect(snapshot.get('derived.sum')).toBe(30);
      expect(snapshot.get('derived.product')).toBe(200);
    });
  });

  describe('deepEqual (internal behavior)', () => {
    // Test through propagate behavior
    it('should detect no change for identical primitive values', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);
      const snapshot = createMockSnapshot({
        'data.a': 5,
        'data.b': 3,
        'derived.sum': 8,
        'derived.product': 15,
        'derived.sumPlusProduct': 23,
      });

      const result = propagate(graph, ['data.a'], snapshot);

      expect(result.changes.has('derived.sum')).toBe(false);
    });

    it('should detect change for different values', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);
      const snapshot = createMockSnapshot({
        'data.a': 5,
        'data.b': 3,
        'derived.sum': 999, // Wrong value
        'derived.product': 15,
        'derived.sumPlusProduct': 23,
      });

      const result = propagate(graph, ['data.a'], snapshot);

      expect(result.changes.get('derived.sum')).toBe(8);
    });
  });
});
