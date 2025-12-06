import { describe, expect, it } from 'vitest'
import type { EvaluationContext } from '@manifesto-ai/engine'
import type { Expression } from '@manifesto-ai/schema'

import {
  analyzeVisibility,
  generateVisibilityExplanation,
  generateSatisfactionGuide,
} from '../visibility'

const createContext = (state: Record<string, unknown> = {}): EvaluationContext => ({
  state,
  context: {},
  user: {},
  params: {},
  result: {},
  env: {},
})

describe('analyzeVisibility', () => {
  describe('simple comparisons', () => {
    it('detects failed equality condition', () => {
      const expr: Expression = ['==', '$state.category', 'DIGITAL']
      const context = createContext({ category: 'BOOK' })

      const result = analyzeVisibility(expr, context)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.satisfied).toBe(false)
        expect(result.value.conditionType).toBe('simple')
        expect(result.value.failedDependencies).toHaveLength(1)
        expect(result.value.failedDependencies[0]).toEqual({
          field: 'category',
          currentValue: 'BOOK',
          operator: '==',
          expectedValue: 'DIGITAL',
          description: 'category must equal "DIGITAL"',
        })
      }
    })

    it('returns empty failedDependencies when condition is satisfied', () => {
      const expr: Expression = ['==', '$state.category', 'DIGITAL']
      const context = createContext({ category: 'DIGITAL' })

      const result = analyzeVisibility(expr, context)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.satisfied).toBe(true)
        expect(result.value.failedDependencies).toHaveLength(0)
      }
    })

    it('detects failed greater-than condition', () => {
      const expr: Expression = ['>', '$state.price', 0]
      const context = createContext({ price: 0 })

      const result = analyzeVisibility(expr, context)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.satisfied).toBe(false)
        expect(result.value.failedDependencies[0]).toMatchObject({
          field: 'price',
          currentValue: 0,
          operator: '>',
          expectedValue: 0,
        })
      }
    })

    it('handles IN operator', () => {
      const expr: Expression = ['IN', '$state.status', ['ACTIVE', 'PENDING']]
      const context = createContext({ status: 'INACTIVE' })

      const result = analyzeVisibility(expr, context)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.satisfied).toBe(false)
        expect(result.value.failedDependencies[0]).toMatchObject({
          field: 'status',
          operator: 'IN',
          expectedValue: ['ACTIVE', 'PENDING'],
        })
      }
    })
  })

  describe('compound conditions (AND)', () => {
    it('collects all failed conditions in AND expression', () => {
      const expr: Expression = [
        'AND',
        ['==', '$state.category', 'DIGITAL'],
        ['==', '$state.discountEnabled', true],
      ]
      const context = createContext({
        category: 'BOOK',
        discountEnabled: false,
      })

      const result = analyzeVisibility(expr, context)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.satisfied).toBe(false)
        expect(result.value.conditionType).toBe('compound')
        expect(result.value.failedDependencies).toHaveLength(2)
        expect(result.value.failedDependencies[0].field).toBe('category')
        expect(result.value.failedDependencies[1].field).toBe('discountEnabled')
      }
    })

    it('returns partial failures when some AND conditions pass', () => {
      const expr: Expression = [
        'AND',
        ['==', '$state.category', 'DIGITAL'],
        ['==', '$state.discountEnabled', true],
      ]
      const context = createContext({
        category: 'DIGITAL', // passes
        discountEnabled: false, // fails
      })

      const result = analyzeVisibility(expr, context)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.satisfied).toBe(false)
        expect(result.value.failedDependencies).toHaveLength(1)
        expect(result.value.failedDependencies[0].field).toBe('discountEnabled')
      }
    })
  })

  describe('compound conditions (OR)', () => {
    it('returns empty failures when at least one OR condition passes', () => {
      const expr: Expression = [
        'OR',
        ['==', '$state.category', 'DIGITAL'],
        ['==', '$state.category', 'BOOK'],
      ]
      const context = createContext({ category: 'BOOK' })

      const result = analyzeVisibility(expr, context)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.satisfied).toBe(true)
        expect(result.value.failedDependencies).toHaveLength(0)
      }
    })

    it('returns optimal failure path when all OR conditions fail', () => {
      const expr: Expression = [
        'OR',
        ['==', '$state.category', 'DIGITAL'],
        ['==', '$state.category', 'BOOK'],
      ]
      const context = createContext({ category: 'OTHER' })

      const result = analyzeVisibility(expr, context)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.satisfied).toBe(false)
        expect(result.value.failedDependencies.length).toBeGreaterThan(0)
      }
    })

    it('selects shortest path when OR has branches with different step counts', () => {
      // OR 조건: (category == DIGITAL AND isActive == true) OR (isPremium == true)
      // 첫 번째 경로: 2단계, 두 번째 경로: 1단계
      // 최적화된 경로는 두 번째(1단계)를 선택해야 함
      const expr: Expression = [
        'OR',
        ['AND', ['==', '$state.category', 'DIGITAL'], ['==', '$state.isActive', true]],
        ['==', '$state.isPremium', true],
      ]
      const context = createContext({
        category: 'BOOK',
        isActive: false,
        isPremium: false,
      })

      const result = analyzeVisibility(expr, context)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.satisfied).toBe(false)
        // 최적 경로는 1단계 (isPremium만 변경)
        expect(result.value.failedDependencies).toHaveLength(1)
        expect(result.value.failedDependencies[0].field).toBe('isPremium')
      }
    })

    it('considers operator weight when selecting optimal path', () => {
      // OR 조건:
      // 경로 1: category != 'CURRENT' (가중치 1.5)
      // 경로 2: status == 'ACTIVE' (가중치 1.0)
      // 경로 2가 더 낮은 비용이므로 선택되어야 함
      const expr: Expression = [
        'OR',
        ['!=', '$state.category', 'CURRENT'],
        ['==', '$state.status', 'ACTIVE'],
      ]
      const context = createContext({
        category: 'CURRENT',
        status: 'INACTIVE',
      })

      const result = analyzeVisibility(expr, context)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.satisfied).toBe(false)
        expect(result.value.failedDependencies).toHaveLength(1)
        // == 연산자(가중치 1.0)가 != 연산자(가중치 1.5)보다 낮으므로 status 선택
        expect(result.value.failedDependencies[0].field).toBe('status')
      }
    })
  })

  describe('satisfaction path computation', () => {
    it('computes satisfaction path when option is enabled', () => {
      const expr: Expression = [
        'AND',
        ['==', '$state.category', 'DIGITAL'],
        ['==', '$state.discountEnabled', true],
      ]
      const context = createContext({
        category: 'BOOK',
        discountEnabled: false,
      })

      const result = analyzeVisibility(expr, context, {
        computeSatisfactionPath: true,
      })

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value.satisfactionPath).toBeDefined()
        expect(result.value.satisfactionPath).toHaveLength(2)
        expect(result.value.satisfactionPath![0]).toMatchObject({
          field: 'category',
          action: 'set',
          targetValue: 'DIGITAL',
          order: 1,
        })
      }
    })
  })
})

describe('generateVisibilityExplanation', () => {
  it('generates readable explanation for failed conditions', () => {
    const expr: Expression = ['==', '$state.category', 'DIGITAL']
    const context = createContext({ category: 'BOOK' })

    const result = analyzeVisibility(expr, context)
    expect(result._tag).toBe('Ok')
    if (result._tag === 'Ok') {
      const explanation = generateVisibilityExplanation(result.value)
      expect(explanation).toContain('Field is hidden because')
      expect(explanation).toContain('category must equal "DIGITAL"')
    }
  })

  it('returns satisfied message when conditions are met', () => {
    const expr: Expression = ['==', '$state.category', 'DIGITAL']
    const context = createContext({ category: 'DIGITAL' })

    const result = analyzeVisibility(expr, context)
    expect(result._tag).toBe('Ok')
    if (result._tag === 'Ok') {
      const explanation = generateVisibilityExplanation(result.value)
      expect(explanation).toBe('Field visibility conditions are satisfied.')
    }
  })
})

describe('generateSatisfactionGuide', () => {
  it('generates step-by-step guide to make field visible', () => {
    const expr: Expression = [
      'AND',
      ['==', '$state.category', 'DIGITAL'],
      ['==', '$state.discountEnabled', true],
    ]
    const context = createContext({
      category: 'BOOK',
      discountEnabled: false,
    })

    const result = analyzeVisibility(expr, context, {
      computeSatisfactionPath: true,
    })

    expect(result._tag).toBe('Ok')
    if (result._tag === 'Ok') {
      const guide = generateSatisfactionGuide(result.value)
      expect(guide).toContain('To make this field visible')
      expect(guide).toContain('set category to "DIGITAL"')
      expect(guide).toContain('set discountEnabled to true')
    }
  })
})
