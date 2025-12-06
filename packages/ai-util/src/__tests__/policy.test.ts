import { describe, expect, it, beforeEach } from 'vitest'
import type { EvaluationContext } from '@manifesto-ai/engine'
import type { Expression } from '@manifesto-ai/schema'

import {
  createPolicyEngine,
  createPendingManager,
  type PolicyDecision,
} from '../policy'
import type { SemanticSnapshot, FieldStateAtom, InteractionAtom } from '../types'

const createContext = (state: Record<string, unknown> = {}): EvaluationContext => ({
  state,
  context: {},
  user: {},
  params: {},
  result: {},
  env: {},
})

const createField = (
  id: string,
  overrides: Partial<FieldStateAtom> = {}
): FieldStateAtom => ({
  id,
  entityFieldId: id,
  value: null,
  meta: {
    valid: true,
    dirty: false,
    touched: false,
    hidden: false,
    disabled: false,
    errors: [],
    ...overrides.meta,
  },
  ...overrides,
})

const createSnapshot = (
  fields: Record<string, FieldStateAtom>,
  interactions: InteractionAtom[] = []
): SemanticSnapshot => ({
  topology: {
    viewId: 'test',
    entityRef: 'test',
    mode: 'create',
    sections: [{ id: 'main', fields: Object.keys(fields) }],
  },
  state: {
    form: { isValid: true, isDirty: false, isSubmitting: false },
    fields,
    values: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.value])),
  },
  constraints: Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [
      k,
      { hidden: v.meta.hidden, disabled: v.meta.disabled },
    ])
  ),
  interactions,
})

describe('PolicyEngine', () => {
  describe('strict mode (default)', () => {
    it('denies hidden field updates with FIELD_FORBIDDEN', () => {
      const engine = createPolicyEngine({ defaultPolicy: 'strict' })
      const snapshot = createSnapshot({
        priceLimit: createField('priceLimit', { meta: { hidden: true } as any }),
      })
      const visibilityExpressions = new Map<string, Expression>([
        ['priceLimit', ['==', '$state.category', 'DIGITAL']],
      ])

      const decision = engine.evaluate(
        { type: 'updateField', fieldId: 'priceLimit', value: 100 },
        {
          snapshot,
          evaluationContext: createContext({ category: 'BOOK' }),
          visibilityExpressions,
        }
      )

      expect(decision.type).toBe('deny')
      if (decision.type === 'deny') {
        expect(decision.error.type).toBe('FIELD_FORBIDDEN')
        expect((decision.error as any).policy).toBe('strict')
      }
    })

    it('allows visible field updates', () => {
      const engine = createPolicyEngine({ defaultPolicy: 'strict' })
      const snapshot = createSnapshot({
        name: createField('name'),
      })

      const decision = engine.evaluate(
        { type: 'updateField', fieldId: 'name', value: 'Test' },
        {
          snapshot,
          evaluationContext: createContext(),
          visibilityExpressions: new Map(),
        }
      )

      expect(decision.type).toBe('allow')
    })

    it('includes visibilityMeta in strict mode error when expression is available', () => {
      const engine = createPolicyEngine({ defaultPolicy: 'strict' })
      const snapshot = createSnapshot({
        priceLimit: createField('priceLimit', { meta: { hidden: true } as any }),
      })
      const visibilityExpressions = new Map<string, Expression>([
        ['priceLimit', ['==', '$state.category', 'DIGITAL']],
      ])

      const decision = engine.evaluate(
        { type: 'updateField', fieldId: 'priceLimit', value: 100 },
        {
          snapshot,
          evaluationContext: createContext({ category: 'BOOK' }),
          visibilityExpressions,
        }
      )

      expect(decision.type).toBe('deny')
      if (decision.type === 'deny' && decision.error.type === 'FIELD_FORBIDDEN') {
        expect(decision.error.visibilityMeta).toBeDefined()
        expect(decision.error.visibilityMeta?.failedDependencies.length).toBeGreaterThan(0)
      }
    })
  })

  describe('deferred mode', () => {
    it('creates pending update instead of denying', () => {
      const engine = createPolicyEngine({ defaultPolicy: 'deferred' })
      const snapshot = createSnapshot({
        priceLimit: createField('priceLimit', { meta: { hidden: true } as any }),
      })
      const visibilityExpressions = new Map<string, Expression>([
        ['priceLimit', ['==', '$state.category', 'DIGITAL']],
      ])

      const decision = engine.evaluate(
        { type: 'updateField', fieldId: 'priceLimit', value: 100 },
        {
          snapshot,
          evaluationContext: createContext({ category: 'BOOK' }),
          visibilityExpressions,
        }
      )

      expect(decision.type).toBe('defer')
      if (decision.type === 'defer') {
        expect(decision.pendingUpdate.fieldId).toBe('priceLimit')
        expect(decision.pendingUpdate.value).toBe(100)
        expect(decision.pendingUpdate.blockedBy).toContain('category')
      }
    })

    it('stores pending update in pending manager', () => {
      const engine = createPolicyEngine({ defaultPolicy: 'deferred' })
      const snapshot = createSnapshot({
        priceLimit: createField('priceLimit', { meta: { hidden: true } as any }),
      })
      const visibilityExpressions = new Map<string, Expression>([
        ['priceLimit', ['==', '$state.category', 'DIGITAL']],
      ])

      engine.evaluate(
        { type: 'updateField', fieldId: 'priceLimit', value: 100 },
        {
          snapshot,
          evaluationContext: createContext({ category: 'BOOK' }),
          visibilityExpressions,
        }
      )

      const pendings = engine.getPendingUpdates()
      expect(pendings['priceLimit']).toBeDefined()
      expect(pendings['priceLimit'].value).toBe(100)
    })
  })

  describe('guided mode', () => {
    it('returns visibility reasoning with satisfaction path', () => {
      const engine = createPolicyEngine({ defaultPolicy: 'guided' })
      const snapshot = createSnapshot({
        priceLimit: createField('priceLimit', { meta: { hidden: true } as any }),
      })
      const visibilityExpressions = new Map<string, Expression>([
        [
          'priceLimit',
          ['AND', ['==', '$state.category', 'DIGITAL'], ['==', '$state.discountEnabled', true]],
        ],
      ])

      const decision = engine.evaluate(
        { type: 'updateField', fieldId: 'priceLimit', value: 100 },
        {
          snapshot,
          evaluationContext: createContext({ category: 'BOOK', discountEnabled: false }),
          visibilityExpressions,
        }
      )

      expect(decision.type).toBe('guide')
      if (decision.type === 'guide') {
        expect(decision.visibilityMeta.failedDependencies.length).toBe(2)
        expect(decision.visibilityMeta.satisfactionPath).toBeDefined()
        expect(decision.visibilityMeta.satisfactionPath?.length).toBe(2)
      }
    })
  })

  describe('field-level policy override', () => {
    it('uses field-specific policy over default', () => {
      const engine = createPolicyEngine({
        defaultPolicy: 'strict',
        fieldPolicies: [{ fieldId: 'priceLimit', policy: 'guided' }],
      })

      expect(engine.getFieldPolicy('priceLimit')).toBe('guided')
      expect(engine.getFieldPolicy('otherField')).toBe('strict')
    })
  })

  describe('disabled fields', () => {
    it('always denies disabled field updates regardless of policy', () => {
      const engine = createPolicyEngine({ defaultPolicy: 'deferred' })
      const snapshot = createSnapshot({
        name: createField('name', { meta: { disabled: true } as any }),
      })

      const decision = engine.evaluate(
        { type: 'updateField', fieldId: 'name', value: 'Test' },
        {
          snapshot,
          evaluationContext: createContext(),
          visibilityExpressions: new Map(),
        }
      )

      expect(decision.type).toBe('deny')
      if (decision.type === 'deny') {
        expect((decision.error as any).reason).toBe('DISABLED')
      }
    })
  })

  describe('non-updateField actions', () => {
    it('allows submit/reset/validate actions through', () => {
      const engine = createPolicyEngine({ defaultPolicy: 'strict' })
      const snapshot = createSnapshot({})

      const submitDecision = engine.evaluate(
        { type: 'submit' },
        { snapshot, evaluationContext: createContext(), visibilityExpressions: new Map() }
      )
      expect(submitDecision.type).toBe('allow')

      const resetDecision = engine.evaluate(
        { type: 'reset' },
        { snapshot, evaluationContext: createContext(), visibilityExpressions: new Map() }
      )
      expect(resetDecision.type).toBe('allow')
    })
  })
})

describe('PendingUpdateManager', () => {
  it('creates and retrieves pending updates', () => {
    const manager = createPendingManager()

    const pending = manager.create('fieldA', 'value', ['dep1', 'dep2'])

    expect(pending.fieldId).toBe('fieldA')
    expect(pending.value).toBe('value')
    expect(pending.blockedBy).toEqual(['dep1', 'dep2'])
    expect(manager.has('fieldA')).toBe(true)
  })

  it('removes pending updates when applied', () => {
    const manager = createPendingManager()
    manager.create('fieldA', 'value', ['dep1'])

    const applied = manager.apply('fieldA')

    expect(applied).not.toBeNull()
    expect(applied!.fieldId).toBe('fieldA')
    expect(manager.has('fieldA')).toBe(false)
  })

  it('checks applicable updates when dependencies change', () => {
    const manager = createPendingManager()
    manager.create('fieldA', 'valueA', ['dep1'])
    manager.create('fieldB', 'valueB', ['dep2'])

    const applicable = manager.checkApplicable('dep1', (id) => id === 'fieldA')

    expect(applicable).toHaveLength(1)
    expect(applicable[0].fieldId).toBe('fieldA')
  })

  it('clears all pending updates', () => {
    const manager = createPendingManager()
    manager.create('fieldA', 'a', [])
    manager.create('fieldB', 'b', [])

    manager.clear()

    expect(manager.size).toBe(0)
  })
})
