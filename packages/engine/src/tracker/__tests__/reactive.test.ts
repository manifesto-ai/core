import { describe, test, expect, beforeEach } from 'vitest'
import {
  ReactiveDependencyTracker,
  createReactiveTracker,
} from '../reactive'
import { createContext, type EvaluationContext } from '../../evaluator'
import type { ViewSchema, ViewSection, ViewField } from '@manifesto-ai/schema'

// Test fixtures
const createTestViewSchema = (sections: ViewSection[]): ViewSchema => ({
  _type: 'view',
  id: 'test-view',
  name: 'Test View',
  version: '0.1.0',
  entityId: 'test-entity',
  mode: 'create',
  sections,
})

const createTestSection = (fields: ViewField[]): ViewSection => ({
  id: 'section1',
  title: 'Test Section',
  fields,
})

const createTestField = (
  id: string,
  options: Partial<ViewField> = {}
): ViewField => ({
  id,
  entityFieldId: id,
  ...options,
})

describe('ReactiveDependencyTracker', () => {
  let tracker: ReactiveDependencyTracker

  beforeEach(() => {
    tracker = createReactiveTracker()
  })

  describe('createReactiveTracker()', () => {
    test('creates new tracker instance', () => {
      const t = createReactiveTracker()
      expect(t).toBeInstanceOf(ReactiveDependencyTracker)
    })
  })

  describe('buildFromViewSchema()', () => {
    test('builds graph from empty schema', () => {
      const schema = createTestViewSchema([])
      const result = tracker.buildFromViewSchema(schema)
      expect(result._tag).toBe('Ok')
    })

    test('builds graph from schema with simple fields', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('name'),
          createTestField('email'),
          createTestField('age'),
        ]),
      ])

      const result = tracker.buildFromViewSchema(schema)
      expect(result._tag).toBe('Ok')

      const graph = tracker.exportGraph()
      // 3 fields + 1 section = 4 nodes
      expect(graph.nodes.size).toBe(4)
    })

    test('builds graph from schema with explicit dependsOn', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('firstName'),
          createTestField('lastName'),
          createTestField('fullName', { dependsOn: ['firstName', 'lastName'] }),
        ]),
      ])

      const result = tracker.buildFromViewSchema(schema)
      expect(result._tag).toBe('Ok')

      const graph = tracker.exportGraph()
      const fullNameNode = graph.nodes.get('fullName')
      expect(fullNameNode?.dependencies.has('firstName')).toBe(true)
      expect(fullNameNode?.dependencies.has('lastName')).toBe(true)
    })

    test('extracts dependencies from reactions', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('productType'),
          createTestField('floors', {
            reactions: [
              {
                trigger: 'change',
                condition: ['==', '$state.productType', 'HIGH_RISE'],
                actions: [
                  { type: 'updateProp', target: 'floors', prop: 'min', value: 10 },
                ],
              },
            ],
          }),
        ]),
      ])

      const result = tracker.buildFromViewSchema(schema)
      expect(result._tag).toBe('Ok')
    })

    test('extracts field references from setValue actions', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('price'),
          createTestField('quantity'),
          createTestField('total', {
            reactions: [
              {
                trigger: 'change',
                actions: [
                  {
                    type: 'setValue',
                    target: 'total',
                    value: ['*', '$state.price', '$state.quantity'],
                  },
                ],
              },
            ],
          }),
        ]),
      ])

      const result = tracker.buildFromViewSchema(schema)
      expect(result._tag).toBe('Ok')
    })

    test('detects circular dependencies and returns error', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('a', { dependsOn: ['b'] }),
          createTestField('b', { dependsOn: ['a'] }),
        ]),
      ])

      const result = tracker.buildFromViewSchema(schema)
      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('CYCLE_DETECTED')
      }
    })

    test('handles multiple sections', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('field1'),
          createTestField('field2'),
        ]),
        {
          id: 'section2',
          title: 'Section 2',
          fields: [
            createTestField('field3'),
            createTestField('field4', { dependsOn: ['field1'] }),
          ],
        },
      ])

      const result = tracker.buildFromViewSchema(schema)
      expect(result._tag).toBe('Ok')

      const graph = tracker.exportGraph()
      // 4 fields + 2 sections = 6 nodes
      expect(graph.nodes.size).toBe(6)
    })
  })

  describe('getAffectedFields()', () => {
    test('returns affected fields for simple dependency', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('firstName'),
          createTestField('fullName', { dependsOn: ['firstName'] }),
        ]),
      ])
      tracker.buildFromViewSchema(schema)

      const affected = tracker.getAffectedFields('firstName')
      expect(affected).toContain('fullName')
    })

    test('returns transitive affected fields', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('a'),
          createTestField('b', { dependsOn: ['a'] }),
          createTestField('c', { dependsOn: ['b'] }),
        ]),
      ])
      tracker.buildFromViewSchema(schema)

      const affected = tracker.getAffectedFields('a')
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
      tracker.buildFromViewSchema(schema)

      const affected = tracker.getAffectedFields('b')
      expect(affected).toEqual([])
    })

    test('returns empty array for unknown field', () => {
      const schema = createTestViewSchema([
        createTestSection([createTestField('a')]),
      ])
      tracker.buildFromViewSchema(schema)

      const affected = tracker.getAffectedFields('unknown')
      expect(affected).toEqual([])
    })
  })

  describe('evaluateAffected()', () => {
    test('evaluates affected field expressions', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('price'),
          createTestField('discount', {
            dependsOn: ['price'],
            reactions: [
              {
                trigger: 'change',
                actions: [
                  {
                    type: 'updateProp',
                    target: 'discount',
                    prop: 'hidden',
                    value: ['<', '$state.price', 100],
                  },
                ],
              },
            ],
          }),
        ]),
      ])
      tracker.buildFromViewSchema(schema)

      const ctx = createContext({ state: { price: 50, discount: 0 } })
      const result = tracker.evaluateAffected('price', ctx)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.updatedFields).toContain('discount')
      }
    })

    test('returns evaluation error for invalid expression', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('trigger'),
          createTestField('target', {
            dependsOn: ['trigger'],
            reactions: [
              {
                trigger: 'change',
                actions: [
                  {
                    type: 'setValue',
                    target: 'target',
                    value: ['INVALID_OPERATOR', '$state.trigger'],
                  },
                ],
              },
            ],
          }),
        ]),
      ])
      tracker.buildFromViewSchema(schema)

      const ctx = createContext({ state: { trigger: 'test' } })
      const result = tracker.evaluateAffected('trigger', ctx)

      expect(result._tag).toBe('Err')
    })

    test('detects cycles created via cross-field setValue actions', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('a', {
            reactions: [
              {
                trigger: 'change',
                actions: [
                  {
                    type: 'setValue',
                    target: 'b',
                    value: '$state.a',
                  },
                ],
              },
            ],
          }),
          createTestField('b', {
            reactions: [
              {
                trigger: 'change',
                actions: [
                  {
                    type: 'setValue',
                    target: 'a',
                    value: '$state.b',
                  },
                ],
              },
            ],
          }),
        ]),
      ])

      const result = tracker.buildFromViewSchema(schema)

      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('CYCLE_DETECTED')
        expect(result.error.message).toContain('a -> b')
      }
    })

    test('allows computed target field without cycles when multiple sources feed it', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('price'),
          createTestField('discountRate'),
          createTestField('finalPrice', {
            reactions: [
              {
                trigger: 'change',
                actions: [
                  {
                    type: 'setValue',
                    target: 'finalPrice',
                    value: ['*', '$state.price', ['-', 1, ['/', '$state.discountRate', 100]]],
                  },
                ],
              },
            ],
          }),
        ]),
      ])

      const buildResult = tracker.buildFromViewSchema(schema)
      expect(buildResult._tag).toBe('Ok')

      const ctx = createContext({
        state: { price: 200, discountRate: 10, finalPrice: 0 },
      })

      const evalResult = tracker.evaluateAffected('price', ctx)
      expect(evalResult._tag).toBe('Ok')
      if (evalResult._tag === 'Ok') {
        const computed = evalResult.value.evaluatedExpressions.get('finalPrice.value')
        expect(computed).toBeCloseTo(180)
      }
    })
  })

  describe('evaluateAll()', () => {
    test('evaluates all expressions in topological order', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('a'),
          createTestField('b', {
            dependsOn: ['a'],
            reactions: [
              {
                trigger: 'change',
                actions: [
                  {
                    type: 'setValue',
                    target: 'b',
                    value: ['+', '$state.a', 1],
                  },
                ],
              },
            ],
          }),
          createTestField('c', {
            dependsOn: ['b'],
            reactions: [
              {
                trigger: 'change',
                actions: [
                  {
                    type: 'setValue',
                    target: 'c',
                    value: ['+', '$state.b', 1],
                  },
                ],
              },
            ],
          }),
        ]),
      ])
      tracker.buildFromViewSchema(schema)

      const ctx = createContext({ state: { a: 1, b: 0, c: 0 } })
      const result = tracker.evaluateAll(ctx)

      expect(result._tag).toBe('Ok')
    })

    test('returns empty map for schema without expressions', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('name'),
          createTestField('email'),
        ]),
      ])
      tracker.buildFromViewSchema(schema)

      const ctx = createContext({ state: { name: 'John', email: 'john@example.com' } })
      const result = tracker.evaluateAll(ctx)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.size).toBe(0)
      }
    })
  })

  describe('exportGraph()', () => {
    test('returns dependency graph', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('a'),
          createTestField('b', { dependsOn: ['a'] }),
        ]),
      ])
      tracker.buildFromViewSchema(schema)

      const graph = tracker.exportGraph()
      expect(graph.nodes).toBeDefined()
      // 2 fields + 1 section = 3 nodes
      expect(graph.nodes.size).toBe(3)
    })
  })

  describe('Complex Reactive Scenarios', () => {
    test('handles form with conditional visibility', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('showAdvanced'),
          createTestField('advancedOption1', {
            dependsOn: ['showAdvanced'],
            reactions: [
              {
                trigger: 'change',
                actions: [
                  {
                    type: 'updateProp',
                    target: 'advancedOption1',
                    prop: 'hidden',
                    value: ['NOT', '$state.showAdvanced'],
                  },
                ],
              },
            ],
          }),
          createTestField('advancedOption2', {
            dependsOn: ['showAdvanced'],
            reactions: [
              {
                trigger: 'change',
                actions: [
                  {
                    type: 'updateProp',
                    target: 'advancedOption2',
                    prop: 'hidden',
                    value: ['NOT', '$state.showAdvanced'],
                  },
                ],
              },
            ],
          }),
        ]),
      ])

      const buildResult = tracker.buildFromViewSchema(schema)
      expect(buildResult._tag).toBe('Ok')

      // Toggle showAdvanced should affect both advanced fields
      const affected = tracker.getAffectedFields('showAdvanced')
      expect(affected).toContain('advancedOption1')
      expect(affected).toContain('advancedOption2')
    })

    test('handles computed fields chain', () => {
      const schema = createTestViewSchema([
        createTestSection([
          createTestField('unitPrice'),
          createTestField('quantity'),
          createTestField('subtotal', {
            dependsOn: ['unitPrice', 'quantity'],
            reactions: [
              {
                trigger: 'change',
                actions: [
                  {
                    type: 'setValue',
                    target: 'subtotal',
                    value: ['*', '$state.unitPrice', '$state.quantity'],
                  },
                ],
              },
            ],
          }),
          createTestField('taxRate'),
          createTestField('tax', {
            dependsOn: ['subtotal', 'taxRate'],
            reactions: [
              {
                trigger: 'change',
                actions: [
                  {
                    type: 'setValue',
                    target: 'tax',
                    value: ['*', '$state.subtotal', '$state.taxRate'],
                  },
                ],
              },
            ],
          }),
          createTestField('total', {
            dependsOn: ['subtotal', 'tax'],
            reactions: [
              {
                trigger: 'change',
                actions: [
                  {
                    type: 'setValue',
                    target: 'total',
                    value: ['+', '$state.subtotal', '$state.tax'],
                  },
                ],
              },
            ],
          }),
        ]),
      ])

      const buildResult = tracker.buildFromViewSchema(schema)
      expect(buildResult._tag).toBe('Ok')

      // Changing unitPrice should cascade through subtotal -> tax, total
      const affectedByUnitPrice = tracker.getAffectedFields('unitPrice')
      expect(affectedByUnitPrice).toContain('subtotal')
      expect(affectedByUnitPrice).toContain('tax')
      expect(affectedByUnitPrice).toContain('total')

      // Changing taxRate only affects tax and total
      const affectedByTaxRate = tracker.getAffectedFields('taxRate')
      expect(affectedByTaxRate).toContain('tax')
      expect(affectedByTaxRate).toContain('total')
      expect(affectedByTaxRate).not.toContain('subtotal')
    })

    test('rebuilds graph on new schema', () => {
      const schema1 = createTestViewSchema([
        createTestSection([createTestField('field1')]),
      ])
      tracker.buildFromViewSchema(schema1)

      const schema2 = createTestViewSchema([
        createTestSection([
          createTestField('fieldA'),
          createTestField('fieldB'),
        ]),
      ])
      tracker.buildFromViewSchema(schema2)

      const graph = tracker.exportGraph()
      expect(graph.nodes.has('field1')).toBe(false)
      expect(graph.nodes.has('fieldA')).toBe(true)
      expect(graph.nodes.has('fieldB')).toBe(true)
    })
  })
})
