import { describe, test, expect, beforeEach } from 'vitest'
import { ref, computed, nextTick } from 'vue'
import {
  useDependencyTracker,
  useGraphVisualization,
} from '../useDependencyTracker'
import type { ViewSchema, ViewSection, ViewField } from '@manifesto-ai/schema'

// Test fixtures
const createTestViewSchema = (sections: ViewSection[]): ViewSchema => ({
  _type: 'view',
  id: 'test-view',
  name: 'Test View',
  version: '0.1.0',
  entityRef: 'test-entity',
  mode: 'create',
  layout: { type: 'form' },
  sections,
})

const createTestSection = (fields: ViewField[]): ViewSection => ({
  id: 'section1',
  title: 'Test Section',
  layout: { type: 'form' },
  fields,
})

const createTestField = (
  id: string,
  options: Partial<ViewField> = {}
): ViewField => ({
  id,
  entityFieldId: id,
  component: 'text-input',
  ...options,
})

describe('useDependencyTracker', () => {
  describe('Initialization', () => {
    test('starts uninitialized without schema', () => {
      const { isInitialized, cycleError } = useDependencyTracker()

      expect(isInitialized.value).toBe(false)
      expect(cycleError.value).toBe(null)
    })

    test('initializes with direct schema', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('name'),
          createTestField('email'),
        ]),
      ])

      const { isInitialized, cycleError } = useDependencyTracker(schema)

      expect(isInitialized.value).toBe(true)
      expect(cycleError.value).toBe(null)
    })

    test('initializes with ref schema', () => {
      const schema = createTestViewSchema([
        createTestSection([createTestField('name')]),
      ])
      const schemaRef = ref(schema)

      const { isInitialized } = useDependencyTracker(schemaRef)

      expect(isInitialized.value).toBe(true)
    })

    test('handles null ref schema', () => {
      const schemaRef = ref<ViewSchema | null>(null)

      const { isInitialized } = useDependencyTracker(schemaRef)

      expect(isInitialized.value).toBe(false)
    })
  })

  describe('Graph Composition', () => {
    test('builds graph with field dependencies', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('firstName'),
          createTestField('lastName'),
          createTestField('fullName', { dependsOn: ['firstName', 'lastName'] }),
        ]),
      ])

      const { graph, isInitialized } = useDependencyTracker(schema)

      expect(isInitialized.value).toBe(true)
      expect(graph.value).not.toBe(null)
      expect(graph.value?.nodes.size).toBe(3)
    })

    test('graph contains dependency information', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('a'),
          createTestField('b', { dependsOn: ['a'] }),
        ]),
      ])

      const { graph } = useDependencyTracker(schema)

      const nodeB = graph.value?.nodes.get('b')
      expect(nodeB).toBeDefined()
      expect(nodeB?.dependencies.has('a')).toBe(true)
    })

    test('graph contains dependent information', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('a'),
          createTestField('b', { dependsOn: ['a'] }),
        ]),
      ])

      const { graph } = useDependencyTracker(schema)

      const nodeA = graph.value?.nodes.get('a')
      expect(nodeA).toBeDefined()
      expect(nodeA?.dependents.has('b')).toBe(true)
    })
  })

  describe('Cycle Detection', () => {
    test('detects circular dependencies', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('a', { dependsOn: ['b'] }),
          createTestField('b', { dependsOn: ['a'] }),
        ]),
      ])

      const { isInitialized, cycleError } = useDependencyTracker(schema)

      expect(isInitialized.value).toBe(false)
      expect(cycleError.value).not.toBe(null)
      expect(cycleError.value?.type).toBe('CYCLE_DETECTED')
    })

    test('detects longer circular chain', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('a', { dependsOn: ['c'] }),
          createTestField('b', { dependsOn: ['a'] }),
          createTestField('c', { dependsOn: ['b'] }),
        ]),
      ])

      const { cycleError } = useDependencyTracker(schema)

      expect(cycleError.value).not.toBe(null)
      expect(cycleError.value?.type).toBe('CYCLE_DETECTED')
    })
  })

  describe('getAffectedFields()', () => {
    test('returns affected fields for dependency chain', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('a'),
          createTestField('b', { dependsOn: ['a'] }),
          createTestField('c', { dependsOn: ['b'] }),
        ]),
      ])

      const { getAffectedFields } = useDependencyTracker(schema)

      const affected = getAffectedFields('a')

      expect(affected).toContain('b')
      expect(affected).toContain('c')
    })

    test('returns empty array for leaf field', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('a'),
          createTestField('b', { dependsOn: ['a'] }),
        ]),
      ])

      const { getAffectedFields } = useDependencyTracker(schema)

      const affected = getAffectedFields('b')

      expect(affected).toEqual([])
    })

    test('returns empty array when not initialized', () => {
      const { getAffectedFields } = useDependencyTracker()

      const affected = getAffectedFields('any')

      expect(affected).toEqual([])
    })

    test('updates affectedFields ref', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('a'),
          createTestField('b', { dependsOn: ['a'] }),
        ]),
      ])

      const { getAffectedFields, affectedFields } = useDependencyTracker(schema)

      getAffectedFields('a')

      expect(affectedFields.value).toContain('b')
    })
  })

  describe('getDependencies()', () => {
    test('returns direct dependencies', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('a'),
          createTestField('b'),
          createTestField('c', { dependsOn: ['a', 'b'] }),
        ]),
      ])

      const { getDependencies } = useDependencyTracker(schema)

      const deps = getDependencies('c')

      expect(deps).toContain('a')
      expect(deps).toContain('b')
      expect(deps.length).toBe(2)
    })

    test('returns empty array for root field', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('a'),
          createTestField('b', { dependsOn: ['a'] }),
        ]),
      ])

      const { getDependencies } = useDependencyTracker(schema)

      const deps = getDependencies('a')

      expect(deps).toEqual([])
    })

    test('returns empty array when not initialized', () => {
      const { getDependencies } = useDependencyTracker()

      const deps = getDependencies('any')

      expect(deps).toEqual([])
    })
  })

  describe('getEvaluationOrder()', () => {
    test('returns evaluation order for fields', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('a'),
          createTestField('b', { dependsOn: ['a'] }),
          createTestField('c', { dependsOn: ['b'] }),
        ]),
      ])

      const { getEvaluationOrder } = useDependencyTracker(schema)

      const order = getEvaluationOrder(['a'])

      expect(order).not.toBe(null)
      // Order should include affected fields
    })

    test('returns null when not initialized', () => {
      const { getEvaluationOrder } = useDependencyTracker()

      const order = getEvaluationOrder(['any'])

      expect(order).toBe(null)
    })
  })

  describe('clear()', () => {
    test('clears graph and resets state', () => {
      const schema = createTestViewSchema([
        createTestSection([createTestField('a')]),
      ])

      const { isInitialized, cycleError, affectedFields, clear } =
        useDependencyTracker(schema)

      expect(isInitialized.value).toBe(true)

      clear()

      expect(isInitialized.value).toBe(false)
      expect(cycleError.value).toBe(null)
      expect(affectedFields.value).toEqual([])
    })
  })

  describe('graph computed', () => {
    test('graph is null when not initialized', () => {
      const { graph } = useDependencyTracker()

      expect(graph.value).toBe(null)
    })

    test('graph updates after initialization', () => {
      const schema = createTestViewSchema([
        createTestSection([createTestField('a')]),
      ])

      const { graph } = useDependencyTracker(schema)

      expect(graph.value).not.toBe(null)
    })
  })
})

describe('useGraphVisualization', () => {
  test('returns empty nodes and edges for null graph', () => {
    const graphRef = computed(() => null)

    const visualization = useGraphVisualization(graphRef)

    expect(visualization.value.nodes).toEqual([])
    expect(visualization.value.edges).toEqual([])
  })

  test('returns nodes from graph', () => {
    const schema = createTestViewSchema([
      createTestSection([
        createTestField('a'),
        createTestField('b'),
        createTestField('c'),
      ]),
    ])

    const { graph } = useDependencyTracker(schema)
    const visualization = useGraphVisualization(graph)

    expect(visualization.value.nodes.length).toBe(3)
    expect(visualization.value.nodes.map((n) => n.id)).toContain('a')
    expect(visualization.value.nodes.map((n) => n.id)).toContain('b')
    expect(visualization.value.nodes.map((n) => n.id)).toContain('c')
  })

  test('returns edges for dependencies', () => {
    const schema = createTestViewSchema([
      createTestSection([
        createTestField('a'),
        createTestField('b', { dependsOn: ['a'] }),
      ]),
    ])

    const { graph } = useDependencyTracker(schema)
    const visualization = useGraphVisualization(graph)

    expect(visualization.value.edges.length).toBe(1)
    expect(visualization.value.edges[0]).toEqual({ from: 'b', to: 'a' })
  })

  test('handles complex dependency graph', () => {
    const schema = createTestViewSchema([
      createTestSection([
        createTestField('a'),
        createTestField('b'),
        createTestField('c', { dependsOn: ['a', 'b'] }),
        createTestField('d', { dependsOn: ['c'] }),
      ]),
    ])

    const { graph } = useDependencyTracker(schema)
    const visualization = useGraphVisualization(graph)

    expect(visualization.value.nodes.length).toBe(4)
    expect(visualization.value.edges.length).toBe(3) // c->a, c->b, d->c
  })
})
