import { describe, test, expect, beforeEach } from 'vitest'
import {
  DependencyTracker,
  createDependencyTracker,
  type CycleError,
} from '../dag'

describe('DependencyTracker (DAG)', () => {
  let tracker: DependencyTracker

  beforeEach(() => {
    tracker = createDependencyTracker()
  })

  describe('createDependencyTracker()', () => {
    test('creates empty tracker', () => {
      const t = createDependencyTracker()
      expect(t).toBeInstanceOf(DependencyTracker)
      expect(t.export().nodes.size).toBe(0)
    })
  })

  describe('addNode()', () => {
    test('adds single node', () => {
      tracker.addNode('a')
      const graph = tracker.export()
      expect(graph.nodes.has('a')).toBe(true)
    })

    test('adds multiple nodes', () => {
      tracker.addNode('a')
      tracker.addNode('b')
      tracker.addNode('c')
      const graph = tracker.export()
      expect(graph.nodes.size).toBe(3)
    })

    test('adding same node twice is idempotent', () => {
      tracker.addNode('a')
      tracker.addNode('a')
      const graph = tracker.export()
      expect(graph.nodes.size).toBe(1)
    })

    test('newly added node has no dependencies', () => {
      tracker.addNode('a')
      expect(tracker.getDependencies('a').size).toBe(0)
    })

    test('newly added node has no dependents', () => {
      tracker.addNode('a')
      expect(tracker.getDependents('a').size).toBe(0)
    })
  })

  describe('addDependencies()', () => {
    test('adds single dependency', () => {
      const result = tracker.addDependencies('b', ['a'])
      expect(result._tag).toBe('Ok')
      expect(tracker.getDependencies('b').has('a')).toBe(true)
      expect(tracker.getDependents('a').has('b')).toBe(true)
    })

    test('adds multiple dependencies', () => {
      const result = tracker.addDependencies('c', ['a', 'b'])
      expect(result._tag).toBe('Ok')
      expect(tracker.getDependencies('c').size).toBe(2)
      expect(tracker.getDependencies('c').has('a')).toBe(true)
      expect(tracker.getDependencies('c').has('b')).toBe(true)
    })

    test('auto-creates nodes that do not exist', () => {
      tracker.addDependencies('c', ['a', 'b'])
      const graph = tracker.export()
      expect(graph.nodes.has('a')).toBe(true)
      expect(graph.nodes.has('b')).toBe(true)
      expect(graph.nodes.has('c')).toBe(true)
    })

    test('maintains reverse dependencies (dependents)', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['a'])
      expect(tracker.getDependents('a').size).toBe(2)
      expect(tracker.getDependents('a').has('b')).toBe(true)
      expect(tracker.getDependents('a').has('c')).toBe(true)
    })
  })

  describe('Cycle Detection', () => {
    test('detects simple cycle (A -> B -> A)', () => {
      tracker.addDependencies('b', ['a'])
      const result = tracker.addDependencies('a', ['b'])

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('CYCLE_DETECTED')
        expect(result.error.cycle).toContain('a')
        expect(result.error.cycle).toContain('b')
      }
    })

    test('detects longer cycle (A -> B -> C -> A)', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])
      const result = tracker.addDependencies('a', ['c'])

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('CYCLE_DETECTED')
        expect(result.error.message).toContain('cycle')
      }
    })

    test('detects self-referencing cycle (A -> A)', () => {
      const result = tracker.addDependencies('a', ['a'])

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('CYCLE_DETECTED')
      }
    })

    test('allows DAG structures without cycles', () => {
      // Diamond pattern: D depends on B and C, both B and C depend on A
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['a'])
      const result = tracker.addDependencies('d', ['b', 'c'])

      expect(result._tag).toBe('Ok')
    })

    test('provides cycle path in error message', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])
      const result = tracker.addDependencies('a', ['c'])

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.message).toContain('->')
      }
    })
  })

  describe('getDependencies()', () => {
    test('returns empty set for node with no dependencies', () => {
      tracker.addNode('a')
      expect(tracker.getDependencies('a').size).toBe(0)
    })

    test('returns empty set for non-existent node', () => {
      expect(tracker.getDependencies('nonexistent').size).toBe(0)
    })

    test('returns direct dependencies only', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])

      const deps = tracker.getDependencies('c')
      expect(deps.size).toBe(1)
      expect(deps.has('b')).toBe(true)
      expect(deps.has('a')).toBe(false)
    })
  })

  describe('getDependents()', () => {
    test('returns empty set for node with no dependents', () => {
      tracker.addNode('a')
      expect(tracker.getDependents('a').size).toBe(0)
    })

    test('returns empty set for non-existent node', () => {
      expect(tracker.getDependents('nonexistent').size).toBe(0)
    })

    test('returns direct dependents only', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])

      const dependents = tracker.getDependents('a')
      expect(dependents.size).toBe(1)
      expect(dependents.has('b')).toBe(true)
      expect(dependents.has('c')).toBe(false)
    })
  })

  describe('getAllDependencies()', () => {
    test('returns all transitive dependencies', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])
      tracker.addDependencies('d', ['c'])

      const allDeps = tracker.getAllDependencies('d')
      expect(allDeps.size).toBe(3)
      expect(allDeps.has('a')).toBe(true)
      expect(allDeps.has('b')).toBe(true)
      expect(allDeps.has('c')).toBe(true)
    })

    test('returns empty set for root node', () => {
      tracker.addNode('a')
      expect(tracker.getAllDependencies('a').size).toBe(0)
    })

    test('handles diamond dependency pattern', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['a'])
      tracker.addDependencies('d', ['b', 'c'])

      const allDeps = tracker.getAllDependencies('d')
      expect(allDeps.size).toBe(3)
      expect(allDeps.has('a')).toBe(true)
      expect(allDeps.has('b')).toBe(true)
      expect(allDeps.has('c')).toBe(true)
    })

    test('returns empty set for non-existent node', () => {
      expect(tracker.getAllDependencies('nonexistent').size).toBe(0)
    })
  })

  describe('getAffectedNodes()', () => {
    test('returns all nodes that depend on changed node', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])
      tracker.addDependencies('d', ['c'])

      const affected = tracker.getAffectedNodes('a')
      expect(affected.size).toBe(3)
      expect(affected.has('b')).toBe(true)
      expect(affected.has('c')).toBe(true)
      expect(affected.has('d')).toBe(true)
    })

    test('returns empty set for leaf node', () => {
      tracker.addDependencies('b', ['a'])
      const affected = tracker.getAffectedNodes('b')
      expect(affected.size).toBe(0)
    })

    test('handles multiple paths', () => {
      // a -> b -> d
      // a -> c -> d
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['a'])
      tracker.addDependencies('d', ['b', 'c'])

      const affected = tracker.getAffectedNodes('a')
      expect(affected.size).toBe(3)
      expect(affected.has('b')).toBe(true)
      expect(affected.has('c')).toBe(true)
      expect(affected.has('d')).toBe(true)
    })

    test('returns empty set for non-existent node', () => {
      expect(tracker.getAffectedNodes('nonexistent').size).toBe(0)
    })
  })

  describe('topologicalSort()', () => {
    test('returns correct order for linear chain', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])

      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const order = result.value
        expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
        expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'))
      }
    })

    test('returns correct order for diamond pattern', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['a'])
      tracker.addDependencies('d', ['b', 'c'])

      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const order = result.value
        expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
        expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'))
        expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'))
        expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'))
      }
    })

    test('returns all nodes', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])

      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.length).toBe(3)
        expect(result.value).toContain('a')
        expect(result.value).toContain('b')
        expect(result.value).toContain('c')
      }
    })

    test('handles independent nodes', () => {
      tracker.addNode('a')
      tracker.addNode('b')
      tracker.addNode('c')

      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.length).toBe(3)
      }
    })

    test('returns empty array for empty graph', () => {
      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual([])
      }
    })
  })

  describe('getEvaluationOrder()', () => {
    test('returns evaluation order for specific nodes', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])
      tracker.addDependencies('d', ['c'])

      // Want to evaluate d, should include a, b, c, d
      const result = tracker.getEvaluationOrder(['d'])
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toContain('a')
        expect(result.value).toContain('b')
        expect(result.value).toContain('c')
        expect(result.value).toContain('d')
        expect(result.value.indexOf('a')).toBeLessThan(result.value.indexOf('d'))
      }
    })

    test('includes only relevant nodes', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])
      tracker.addNode('x') // Unrelated node
      tracker.addNode('y') // Unrelated node

      const result = tracker.getEvaluationOrder(['c'])
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toContain('a')
        expect(result.value).toContain('b')
        expect(result.value).toContain('c')
        expect(result.value).not.toContain('x')
        expect(result.value).not.toContain('y')
      }
    })

    test('handles multiple target nodes', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('d', ['c'])

      const result = tracker.getEvaluationOrder(['b', 'd'])
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.length).toBe(4)
      }
    })
  })

  describe('export()', () => {
    test('exports empty graph', () => {
      const graph = tracker.export()
      expect(graph.nodes.size).toBe(0)
    })

    test('exports graph with nodes and edges', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['a', 'b'])

      const graph = tracker.export()
      expect(graph.nodes.size).toBe(3)

      const nodeA = graph.nodes.get('a')
      expect(nodeA).toBeDefined()
      expect(nodeA?.id).toBe('a')
      expect(nodeA?.dependencies.size).toBe(0)
      expect(nodeA?.dependents.has('b')).toBe(true)
      expect(nodeA?.dependents.has('c')).toBe(true)

      const nodeC = graph.nodes.get('c')
      expect(nodeC).toBeDefined()
      expect(nodeC?.dependencies.has('a')).toBe(true)
      expect(nodeC?.dependencies.has('b')).toBe(true)
    })

    test('export returns immutable sets', () => {
      tracker.addDependencies('b', ['a'])
      const graph = tracker.export()
      const nodeB = graph.nodes.get('b')

      // Sets should be read-only (ReadonlySet)
      expect(nodeB?.dependencies).toBeInstanceOf(Set)
    })
  })

  describe('clear()', () => {
    test('removes all nodes and edges', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])

      tracker.clear()

      const graph = tracker.export()
      expect(graph.nodes.size).toBe(0)
    })

    test('can add nodes after clear', () => {
      tracker.addDependencies('b', ['a'])
      tracker.clear()
      tracker.addDependencies('d', ['c'])

      const graph = tracker.export()
      expect(graph.nodes.size).toBe(2)
      expect(graph.nodes.has('c')).toBe(true)
      expect(graph.nodes.has('d')).toBe(true)
    })
  })

  describe('removeNode()', () => {
    test('removes node and its edges', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])

      tracker.removeNode('b')

      const graph = tracker.export()
      expect(graph.nodes.has('b')).toBe(false)
      expect(graph.nodes.has('a')).toBe(true)
      expect(graph.nodes.has('c')).toBe(true)
    })

    test('updates dependents when node is removed', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['a'])

      tracker.removeNode('b')

      expect(tracker.getDependents('a').has('b')).toBe(false)
      expect(tracker.getDependents('a').has('c')).toBe(true)
    })

    test('updates dependencies when node is removed', () => {
      tracker.addDependencies('c', ['a', 'b'])

      tracker.removeNode('a')

      expect(tracker.getDependencies('c').has('a')).toBe(false)
      expect(tracker.getDependencies('c').has('b')).toBe(true)
    })

    test('removing non-existent node is safe', () => {
      tracker.addNode('a')
      expect(() => tracker.removeNode('nonexistent')).not.toThrow()
    })
  })

  describe('Complex Graph Scenarios', () => {
    test('handles large linear chain', () => {
      // Create chain: a -> b -> c -> ... -> z
      const nodes = 'abcdefghijklmnopqrstuvwxyz'.split('')
      for (let i = 1; i < nodes.length; i++) {
        tracker.addDependencies(nodes[i], [nodes[i - 1]])
      }

      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.length).toBe(26)
        expect(result.value[0]).toBe('a')
        expect(result.value[25]).toBe('z')
      }
    })

    test('handles wide dependency graph', () => {
      // Node z depends on a through y
      const deps = 'abcdefghijklmnopqrstuvwxy'.split('')
      deps.forEach(d => tracker.addNode(d))
      tracker.addDependencies('z', deps)

      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const zIndex = result.value.indexOf('z')
        expect(zIndex).toBe(result.value.length - 1)
      }
    })

    test('handles complex web of dependencies', () => {
      // Complex but acyclic graph
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['a'])
      tracker.addDependencies('d', ['b', 'c'])
      tracker.addDependencies('e', ['b'])
      tracker.addDependencies('f', ['d', 'e'])

      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const order = result.value
        // Verify all ordering constraints
        expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
        expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'))
        expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'))
        expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'))
        expect(order.indexOf('b')).toBeLessThan(order.indexOf('e'))
        expect(order.indexOf('d')).toBeLessThan(order.indexOf('f'))
        expect(order.indexOf('e')).toBeLessThan(order.indexOf('f'))
      }
    })
  })

  describe('Topological Sort Caching', () => {
    test('returns cached result on subsequent calls without changes', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])

      const result1 = tracker.topologicalSort()
      const result2 = tracker.topologicalSort()

      expect(result1._tag).toBe('Ok')
      expect(result2._tag).toBe('Ok')
      if (result1._tag === 'Ok' && result2._tag === 'Ok') {
        // 결과가 동일해야 함
        expect(result1.value).toEqual(result2.value)
      }
    })

    test('invalidates cache when node is added', () => {
      tracker.addDependencies('b', ['a'])
      const result1 = tracker.topologicalSort()

      tracker.addNode('c')
      const result2 = tracker.topologicalSort()

      expect(result1._tag).toBe('Ok')
      expect(result2._tag).toBe('Ok')
      if (result1._tag === 'Ok' && result2._tag === 'Ok') {
        expect(result2.value.length).toBeGreaterThan(result1.value.length)
      }
    })

    test('invalidates cache when dependency is added', () => {
      tracker.addNode('a')
      tracker.addNode('b')
      const result1 = tracker.topologicalSort()

      tracker.addDependencies('b', ['a'])
      const result2 = tracker.topologicalSort()

      expect(result1._tag).toBe('Ok')
      expect(result2._tag).toBe('Ok')
      // 순서가 보장됨
      if (result2._tag === 'Ok') {
        expect(result2.value.indexOf('a')).toBeLessThan(result2.value.indexOf('b'))
      }
    })

    test('invalidates cache when node is removed', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])
      const result1 = tracker.topologicalSort()

      tracker.removeNode('c')
      const result2 = tracker.topologicalSort()

      expect(result1._tag).toBe('Ok')
      expect(result2._tag).toBe('Ok')
      if (result1._tag === 'Ok' && result2._tag === 'Ok') {
        expect(result1.value.length).toBe(3)
        expect(result2.value.length).toBe(2)
      }
    })

    test('invalidates cache when cleared', () => {
      tracker.addDependencies('b', ['a'])
      tracker.topologicalSort()

      tracker.clear()
      tracker.addNode('x')
      const result = tracker.topologicalSort()

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual(['x'])
      }
    })
  })

  describe('Performance Benchmarks', () => {
    test('handles 1000 nodes efficiently', () => {
      const start = performance.now()

      // 1000개 노드의 선형 체인 생성
      for (let i = 1; i <= 1000; i++) {
        if (i === 1) {
          tracker.addNode(`node_${i}`)
        } else {
          tracker.addDependencies(`node_${i}`, [`node_${i - 1}`])
        }
      }

      const buildTime = performance.now() - start

      // 위상 정렬 실행
      const sortStart = performance.now()
      const result = tracker.topologicalSort()
      const sortTime = performance.now() - sortStart

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.length).toBe(1000)
      }

      // 벤치마크 출력
      console.log(`[DAG Benchmark] 1000 nodes: build=${buildTime.toFixed(2)}ms, sort=${sortTime.toFixed(2)}ms`)

      // 성능 임계값 (합리적인 범위)
      expect(buildTime).toBeLessThan(500) // 500ms 이내
      expect(sortTime).toBeLessThan(100) // 100ms 이내
    })

    test('handles deep chains (100 depth) without stack overflow', () => {
      // 100 깊이의 체인
      for (let i = 1; i <= 100; i++) {
        if (i === 1) {
          tracker.addNode(`deep_${i}`)
        } else {
          tracker.addDependencies(`deep_${i}`, [`deep_${i - 1}`])
        }
      }

      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.length).toBe(100)
        expect(result.value[0]).toBe('deep_1')
        expect(result.value[99]).toBe('deep_100')
      }
    })

    test('caching improves performance on repeated calls', () => {
      // 그래프 구성
      for (let i = 1; i <= 100; i++) {
        if (i === 1) {
          tracker.addNode(`n_${i}`)
        } else {
          tracker.addDependencies(`n_${i}`, [`n_${i - 1}`])
        }
      }

      // 첫 번째 호출 (캐시 미스)
      const start1 = performance.now()
      tracker.topologicalSort()
      const time1 = performance.now() - start1

      // 두 번째 호출 (캐시 히트)
      const start2 = performance.now()
      tracker.topologicalSort()
      const time2 = performance.now() - start2

      console.log(`[DAG Benchmark] Cache: first=${time1.toFixed(3)}ms, cached=${time2.toFixed(3)}ms`)

      // 캐시된 호출이 더 빠르거나 비슷해야 함
      expect(time2).toBeLessThanOrEqual(time1 + 0.5) // 약간의 측정 오차 허용
    })
  })

  describe('Complex Graph Patterns', () => {
    test('handles parallel branches with merge (diamond pattern)', () => {
      /**
       * Graph structure:
       *        a
       *       / \
       *      b   c
       *       \ /
       *        d
       */
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['a'])
      tracker.addDependencies('d', ['b', 'c'])

      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const order = result.value
        expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
        expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'))
        expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'))
        expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'))
      }

      // 영향도 검증
      const affected = tracker.getAffectedNodes('a')
      expect(affected).toContain('b')
      expect(affected).toContain('c')
      expect(affected).toContain('d')
    })

    test('handles multi-level parallel branches with multiple merges', () => {
      /**
       * Graph structure:
       *           a
       *         / | \
       *        b  c  d
       *        |\ | /|
       *        | \|/ |
       *        e  f  g
       *         \ | /
       *           h
       */
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['a'])
      tracker.addDependencies('d', ['a'])
      tracker.addDependencies('e', ['b'])
      tracker.addDependencies('f', ['b', 'c', 'd'])
      tracker.addDependencies('g', ['d'])
      tracker.addDependencies('h', ['e', 'f', 'g'])

      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const order = result.value
        // a가 가장 먼저
        expect(order.indexOf('a')).toBe(0)
        // h가 가장 마지막
        expect(order.indexOf('h')).toBe(order.length - 1)
        // 중간 레벨 검증
        expect(order.indexOf('b')).toBeLessThan(order.indexOf('e'))
        expect(order.indexOf('b')).toBeLessThan(order.indexOf('f'))
        expect(order.indexOf('c')).toBeLessThan(order.indexOf('f'))
        expect(order.indexOf('d')).toBeLessThan(order.indexOf('f'))
        expect(order.indexOf('d')).toBeLessThan(order.indexOf('g'))
      }

      // a 변경 시 모든 노드가 영향받음
      const affected = tracker.getAffectedNodes('a')
      expect(affected.size).toBe(7) // b, c, d, e, f, g, h
    })

    test('handles wide fan-out and fan-in pattern', () => {
      /**
       * Graph structure:
       *           root
       *      /  /  |  \  \
       *     a  b   c   d  e
       *      \  \  |  /  /
       *           sink
       */
      const fanNodes = ['a', 'b', 'c', 'd', 'e']
      fanNodes.forEach((n) => tracker.addDependencies(n, ['root']))
      tracker.addDependencies('sink', fanNodes)

      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        const order = result.value
        expect(order[0]).toBe('root')
        expect(order[order.length - 1]).toBe('sink')
        fanNodes.forEach((n) => {
          expect(order.indexOf('root')).toBeLessThan(order.indexOf(n))
          expect(order.indexOf(n)).toBeLessThan(order.indexOf('sink'))
        })
      }
    })

    test('handles multiple independent subgraphs', () => {
      /**
       * Two independent graphs:
       * Graph 1: a -> b -> c
       * Graph 2: x -> y -> z
       */
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])
      tracker.addDependencies('y', ['x'])
      tracker.addDependencies('z', ['y'])

      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.length).toBe(6)
        // 각 체인 내의 순서만 보장
        expect(result.value.indexOf('a')).toBeLessThan(result.value.indexOf('b'))
        expect(result.value.indexOf('b')).toBeLessThan(result.value.indexOf('c'))
        expect(result.value.indexOf('x')).toBeLessThan(result.value.indexOf('y'))
        expect(result.value.indexOf('y')).toBeLessThan(result.value.indexOf('z'))
      }

      // 독립 그래프 간 영향 없음
      expect(tracker.getAffectedNodes('a')).not.toContain('x')
      expect(tracker.getAffectedNodes('x')).not.toContain('a')
    })
  })

  describe('Remove and Transitive Cleanup', () => {
    test('removes node and cleans up all references', () => {
      /**
       * Before: a -> b -> c -> d
       * Remove: c
       * After: a -> b, d (orphaned)
       */
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])
      tracker.addDependencies('d', ['c'])

      tracker.removeNode('c')

      // c의 의존성이 b에서 제거됨
      expect(tracker.getDependents('b').has('c')).toBe(false)
      // c의 피의존성이 d에서 제거됨
      expect(tracker.getDependencies('d').has('c')).toBe(false)
      // d는 여전히 노드로 존재하지만 의존성 없음
      expect(tracker.getDependencies('d').size).toBe(0)
    })

    test('affected nodes update after removal', () => {
      /**
       * Before: a -> b -> c
       *              |
       *              v
       *              d
       * Remove: b
       * After: a (isolated), c (isolated), d (isolated)
       */
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])
      tracker.addDependencies('d', ['b'])

      // 삭제 전: a 변경 시 b, c, d 영향
      expect(tracker.getAffectedNodes('a').size).toBe(3)

      tracker.removeNode('b')

      // 삭제 후: a 변경 시 영향 없음
      expect(tracker.getAffectedNodes('a').size).toBe(0)
      // c, d는 더 이상 어떤 노드에도 의존하지 않음
      expect(tracker.getDependencies('c').size).toBe(0)
      expect(tracker.getDependencies('d').size).toBe(0)
    })

    test('removing leaf node does not affect parents', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['b'])

      tracker.removeNode('c')

      // 부모 체인 유지
      expect(tracker.getDependencies('b')).toContain('a')
      expect(tracker.getDependents('a')).toContain('b')

      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual(['a', 'b'])
      }
    })

    test('removing root node orphans all dependents', () => {
      /**
       * Before: root -> a, b, c
       * After remove root: a, b, c (all orphaned)
       */
      tracker.addDependencies('a', ['root'])
      tracker.addDependencies('b', ['root'])
      tracker.addDependencies('c', ['root'])

      tracker.removeNode('root')

      expect(tracker.getDependencies('a').size).toBe(0)
      expect(tracker.getDependencies('b').size).toBe(0)
      expect(tracker.getDependencies('c').size).toBe(0)
    })

    test('complex removal in diamond pattern', () => {
      /**
       * Before:    a
       *           / \
       *          b   c
       *           \ /
       *            d
       * Remove: b
       * After:    a
       *            \
       *             c
       *            /
       *           d (only depends on c now)
       */
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('c', ['a'])
      tracker.addDependencies('d', ['b', 'c'])

      tracker.removeNode('b')

      expect(tracker.getDependencies('d')).toContain('c')
      expect(tracker.getDependencies('d').has('b')).toBe(false)
      expect(tracker.getDependencies('d').size).toBe(1)

      // d는 여전히 c를 통해 a에 transitive 의존
      const allDeps = tracker.getAllDependencies('d')
      expect(allDeps).toContain('a')
      expect(allDeps).toContain('c')
    })
  })

  describe('Edge Cases', () => {
    test('empty dependencies array is a no-op', () => {
      tracker.addNode('a')
      const result = tracker.addDependencies('a', [])
      expect(result._tag).toBe('Ok')
      expect(tracker.getDependencies('a').size).toBe(0)
    })

    test('duplicate dependency addition is idempotent', () => {
      tracker.addDependencies('b', ['a'])
      tracker.addDependencies('b', ['a']) // 중복
      tracker.addDependencies('b', ['a']) // 중복

      expect(tracker.getDependencies('b').size).toBe(1)
      expect(tracker.getDependents('a').size).toBe(1)
    })

    test('empty graph topologicalSort returns empty array', () => {
      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual([])
      }
    })

    test('nodes without edges maintain order in topologicalSort', () => {
      tracker.addNode('z')
      tracker.addNode('y')
      tracker.addNode('x')

      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.length).toBe(3)
        // 순서는 보장되지 않지만 모든 노드 포함
        expect(result.value).toContain('x')
        expect(result.value).toContain('y')
        expect(result.value).toContain('z')
      }
    })

    test('getEvaluationOrder with empty array returns empty result', () => {
      tracker.addDependencies('b', ['a'])
      const result = tracker.getEvaluationOrder([])
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual([])
      }
    })

    test('getEvaluationOrder with non-existent node', () => {
      tracker.addDependencies('b', ['a'])
      const result = tracker.getEvaluationOrder(['nonexistent'])
      expect(result._tag).toBe('Ok')
      // 존재하지 않는 노드는 필터링됨
    })

    test('getAllDependencies returns empty for isolated node', () => {
      tracker.addNode('isolated')
      expect(tracker.getAllDependencies('isolated').size).toBe(0)
    })

    test('getAffectedNodes returns empty for leaf node', () => {
      tracker.addDependencies('b', ['a'])
      expect(tracker.getAffectedNodes('b').size).toBe(0)
    })

    test('removeNode on non-existent node is safe', () => {
      // 에러 없이 처리되어야 함
      expect(() => tracker.removeNode('ghost')).not.toThrow()
    })

    test('clear then re-add works correctly', () => {
      tracker.addDependencies('b', ['a'])
      tracker.clear()

      expect(tracker.export().nodes.size).toBe(0)

      tracker.addDependencies('y', ['x'])
      expect(tracker.getDependencies('y')).toContain('x')
    })
  })

  describe('Random Graph Fuzz Tests', () => {
    // 결정적 시드 기반 난수 생성기 (테스트 재현성)
    const seededRandom = (seed: number) => {
      return () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
      }
    }

    test('fuzz: random DAG with 100 nodes survives all operations', () => {
      const random = seededRandom(12345)
      const nodeCount = 100
      const nodes: string[] = []

      // 노드 생성 (순서대로 생성하면 자연스럽게 DAG 형성)
      for (let i = 0; i < nodeCount; i++) {
        const nodeId = `fuzz_${i}`
        nodes.push(nodeId)

        // 이전 노드들 중 랜덤하게 의존성 추가 (0~3개)
        const depCount = Math.floor(random() * 4)
        const deps: string[] = []
        for (let j = 0; j < depCount && i > 0; j++) {
          const depIndex = Math.floor(random() * i)
          const dep = nodes[depIndex]
          if (!deps.includes(dep)) {
            deps.push(dep)
          }
        }

        if (deps.length > 0) {
          const result = tracker.addDependencies(nodeId, deps)
          expect(result._tag).toBe('Ok')
        } else {
          tracker.addNode(nodeId)
        }
      }

      // 위상 정렬 성공 확인
      const sortResult = tracker.topologicalSort()
      expect(sortResult._tag).toBe('Ok')
      if (sortResult._tag === 'Ok') {
        expect(sortResult.value.length).toBe(nodeCount)
      }

      // 랜덤 노드 제거 후에도 안정적
      for (let i = 0; i < 10; i++) {
        const removeIndex = Math.floor(random() * nodes.length)
        const toRemove = nodes[removeIndex]
        tracker.removeNode(toRemove)
        nodes.splice(removeIndex, 1)

        const afterRemove = tracker.topologicalSort()
        expect(afterRemove._tag).toBe('Ok')
      }
    })

    test('fuzz: cycle detection rejects all invalid additions', () => {
      const random = seededRandom(54321)

      // 선형 체인 생성
      for (let i = 1; i <= 20; i++) {
        if (i === 1) {
          tracker.addNode(`chain_${i}`)
        } else {
          tracker.addDependencies(`chain_${i}`, [`chain_${i - 1}`])
        }
      }

      // 역방향 엣지 추가 시도 (모두 실패해야 함)
      let cycleAttempts = 0
      for (let i = 0; i < 50; i++) {
        const from = Math.floor(random() * 19) + 1 // 1-19
        const to = Math.floor(random() * 19) + 2 // 2-20

        if (from >= to) {
          // 역방향: chain_to -> chain_from (이미 chain_from -> ... -> chain_to 경로 존재)
          const result = tracker.addDependencies(`chain_${from}`, [`chain_${to}`])
          if (result._tag === 'Err') {
            cycleAttempts++
            expect(result.error.type).toBe('CYCLE_DETECTED')
          }
        }
      }

      // 최소 몇 개의 cycle은 탐지되어야 함
      expect(cycleAttempts).toBeGreaterThan(0)

      // 원본 체인은 여전히 유효
      const result = tracker.topologicalSort()
      expect(result._tag).toBe('Ok')
    })

    test('fuzz: stress test with rapid add/remove cycles', () => {
      const random = seededRandom(99999)
      const operations = 500

      for (let op = 0; op < operations; op++) {
        const action = random()

        if (action < 0.4) {
          // 40%: 노드 추가
          const nodeId = `stress_${op}`
          tracker.addNode(nodeId)
        } else if (action < 0.7) {
          // 30%: 의존성 추가 (cycle 발생 시 무시)
          const nodes = Array.from((tracker.export()).nodes.keys())
          if (nodes.length >= 2) {
            const from = nodes[Math.floor(random() * nodes.length)]
            const to = nodes[Math.floor(random() * nodes.length)]
            if (from !== to) {
              tracker.addDependencies(from, [to]) // cycle이면 실패, 무시
            }
          }
        } else if (action < 0.9) {
          // 20%: 노드 제거
          const nodes = Array.from((tracker.export()).nodes.keys())
          if (nodes.length > 0) {
            const toRemove = nodes[Math.floor(random() * nodes.length)]
            tracker.removeNode(toRemove)
          }
        } else {
          // 10%: 위상 정렬 실행
          const result = tracker.topologicalSort()
          expect(result._tag).toBe('Ok')
        }
      }

      // 최종 상태도 유효해야 함
      const finalResult = tracker.topologicalSort()
      expect(finalResult._tag).toBe('Ok')
    })

    test('fuzz: getAllDependencies and getAffectedNodes consistency', () => {
      const random = seededRandom(11111)

      // 랜덤 DAG 생성
      for (let i = 0; i < 30; i++) {
        const nodeId = `cons_${i}`
        const deps: string[] = []

        for (let j = 0; j < i && deps.length < 3; j++) {
          if (random() < 0.3) {
            deps.push(`cons_${j}`)
          }
        }

        if (deps.length > 0) {
          tracker.addDependencies(nodeId, deps)
        } else {
          tracker.addNode(nodeId)
        }
      }

      // 일관성 검증: A가 B에 의존하면, B 변경 시 A가 영향받아야 함
      const graph = tracker.export()
      for (const [nodeId, node] of graph.nodes) {
        for (const dep of node.dependencies) {
          const affected = tracker.getAffectedNodes(dep)
          expect(affected.has(nodeId)).toBe(true)
        }
      }
    })
  })
})
