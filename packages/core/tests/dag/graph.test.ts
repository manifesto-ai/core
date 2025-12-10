import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  buildDependencyGraph,
  getDirectDependencies,
  getDirectDependents,
  getAllDependencies,
  getAllDependents,
  hasCycle,
} from '../../src/dag/graph.js';
import { defineDomain, defineSource, defineDerived } from '../../src/domain/define.js';

describe('Dependency Graph', () => {
  const createTestDomain = () =>
    defineDomain({
      id: 'test',
      name: 'Test',
      description: 'Test domain',
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
            semantic: { type: 'input', description: 'A' },
          }),
          'data.b': defineSource({
            schema: z.number(),
            semantic: { type: 'input', description: 'B' },
          }),
        },
        derived: {
          'derived.sum': defineDerived({
            deps: ['data.a', 'data.b'],
            expr: ['+', ['get', 'data.a'], ['get', 'data.b']],
            semantic: { type: 'calculation', description: 'Sum' },
          }),
          'derived.double': defineDerived({
            deps: ['derived.sum'],
            expr: ['*', ['get', 'derived.sum'], 2],
            semantic: { type: 'calculation', description: 'Double sum' },
          }),
          'derived.isPositive': defineDerived({
            deps: ['derived.sum'],
            expr: ['>', ['get', 'derived.sum'], 0],
            semantic: { type: 'condition', description: 'Is positive' },
          }),
        },
      },
    });

  describe('buildDependencyGraph', () => {
    it('should build graph with all nodes', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);

      expect(graph.nodes.size).toBe(5); // 2 sources + 3 derived
      expect(graph.nodes.has('data.a')).toBe(true);
      expect(graph.nodes.has('data.b')).toBe(true);
      expect(graph.nodes.has('derived.sum')).toBe(true);
      expect(graph.nodes.has('derived.double')).toBe(true);
      expect(graph.nodes.has('derived.isPositive')).toBe(true);
    });

    it('should have correct dependencies', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);

      // derived.sum depends on data.a and data.b
      const sumDeps = graph.dependencies.get('derived.sum');
      expect(sumDeps?.has('data.a')).toBe(true);
      expect(sumDeps?.has('data.b')).toBe(true);

      // derived.double depends on derived.sum
      const doubleDeps = graph.dependencies.get('derived.double');
      expect(doubleDeps?.has('derived.sum')).toBe(true);
    });

    it('should have correct dependents', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);

      // data.a is depended on by derived.sum
      const aDependents = graph.dependents.get('data.a');
      expect(aDependents?.has('derived.sum')).toBe(true);

      // derived.sum is depended on by derived.double and derived.isPositive
      const sumDependents = graph.dependents.get('derived.sum');
      expect(sumDependents?.has('derived.double')).toBe(true);
      expect(sumDependents?.has('derived.isPositive')).toBe(true);
    });

    it('should have correct topological order', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);

      const order = graph.topologicalOrder;

      // Sources should come before derived
      const aIndex = order.indexOf('data.a');
      const bIndex = order.indexOf('data.b');
      const sumIndex = order.indexOf('derived.sum');
      const doubleIndex = order.indexOf('derived.double');

      expect(aIndex).toBeLessThan(sumIndex);
      expect(bIndex).toBeLessThan(sumIndex);
      expect(sumIndex).toBeLessThan(doubleIndex);
    });
  });

  describe('getDirectDependencies', () => {
    it('should return direct deps', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);

      const deps = getDirectDependencies(graph, 'derived.sum');
      expect(deps).toContain('data.a');
      expect(deps).toContain('data.b');
      expect(deps).not.toContain('derived.double');
    });
  });

  describe('getDirectDependents', () => {
    it('should return direct dependents', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);

      const dependents = getDirectDependents(graph, 'derived.sum');
      expect(dependents).toContain('derived.double');
      expect(dependents).toContain('derived.isPositive');
    });
  });

  describe('getAllDependencies', () => {
    it('should return all transitive deps', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);

      const deps = getAllDependencies(graph, 'derived.double');
      expect(deps).toContain('derived.sum');
      expect(deps).toContain('data.a');
      expect(deps).toContain('data.b');
    });
  });

  describe('getAllDependents', () => {
    it('should return all transitive dependents', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);

      const dependents = getAllDependents(graph, 'data.a');
      expect(dependents).toContain('derived.sum');
      expect(dependents).toContain('derived.double');
      expect(dependents).toContain('derived.isPositive');
    });
  });

  describe('hasCycle', () => {
    it('should detect no cycle in valid graph', () => {
      const domain = createTestDomain();
      const graph = buildDependencyGraph(domain);

      expect(hasCycle(graph)).toBe(false);
    });
  });
});
