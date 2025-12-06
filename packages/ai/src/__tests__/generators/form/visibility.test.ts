/**
 * Visibility Tests
 *
 * 필드 관계 기반 visibility 규칙 추론 및 생성 테스트
 */

import { describe, it, expect } from 'vitest'
import type { EntitySchema, EntityField } from '@manifesto-ai/schema'
import {
  inferVisibilityRules,
  generateFormVisibility,
  visibilityToReaction,
  buildVisibilityReactions,
  type FieldVisibility,
} from '../../../generators/form/visibility'

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockEntityField = (id: string, dataType: EntityField['dataType'], options?: Partial<EntityField>): EntityField => ({
  id,
  dataType,
  label: id,
  ...options,
})

const createMockEntity = (fields: EntityField[]): EntitySchema => ({
  _type: 'entity',
  id: 'test-entity',
  version: '0.1.0',
  name: 'Test Entity',
  fields,
})

// ============================================================================
// Inference Tests
// ============================================================================

describe('inferVisibilityRules', () => {
  describe('Boolean Field Patterns', () => {
    it('should infer visibility from hasX pattern', () => {
      const entity = createMockEntity([
        createMockEntityField('hasDelivery', 'boolean'),
        createMockEntityField('deliveryAddress', 'string'),
      ])

      const rules = inferVisibilityRules(entity)

      expect(rules.length).toBe(1)
      expect(rules[0]).toMatchObject({
        fieldId: 'hasDelivery',
        targetFieldId: 'deliveryAddress',
        source: 'inferred',
      })
      expect(rules[0].expression).toEqual(['==', '$state.hasDelivery', true])
    })

    it('should infer visibility from enableX pattern', () => {
      const entity = createMockEntity([
        createMockEntityField('enableNotification', 'boolean'),
        createMockEntityField('notificationEmail', 'string'),
      ])

      const rules = inferVisibilityRules(entity)

      expect(rules.length).toBe(1)
      expect(rules[0].expression).toEqual(['==', '$state.enableNotification', true])
    })

    it('should infer visibility from sameAsX pattern', () => {
      const entity = createMockEntity([
        createMockEntityField('sameAsShipping', 'boolean'),
        createMockEntityField('billingAddress', 'string'),
      ])

      const rules = inferVisibilityRules(entity)

      expect(rules.length).toBe(1)
      expect(rules[0]).toMatchObject({
        fieldId: 'sameAsShipping',
        targetFieldId: 'billingAddress',
      })
      // sameAsShipping이 false일 때 billingAddress 표시
      expect(rules[0].expression).toEqual(['==', '$state.sameAsShipping', false])
    })
  })

  describe('Enum Field Patterns', () => {
    it('should infer visibility from enum values matching field name', () => {
      const entity = createMockEntity([
        createMockEntityField('userType', 'enum', {
          enumValues: [
            { value: 'personal', label: 'Personal' },
            { value: 'business', label: 'Business' },
          ],
        }),
        createMockEntityField('businessName', 'string'),
      ])

      const rules = inferVisibilityRules(entity)

      expect(rules.length).toBe(1)
      expect(rules[0]).toMatchObject({
        fieldId: 'userType',
        targetFieldId: 'businessName',
      })
      expect(rules[0].expression).toEqual(['==', '$state.userType', 'business'])
    })

    it('should match enum label as well as value', () => {
      const entity = createMockEntity([
        createMockEntityField('accountType', 'enum', {
          enumValues: [
            { value: 'ind', label: 'Individual' },
            { value: 'corp', label: 'Corporate' },
          ],
        }),
        createMockEntityField('corporateId', 'string'),
      ])

      const rules = inferVisibilityRules(entity)

      expect(rules.length).toBe(1)
      expect(rules[0].expression).toEqual(['==', '$state.accountType', 'corp'])
    })
  })

  describe('Reference Field Patterns', () => {
    it('should infer visibility from parent-child relationship', () => {
      const entity = createMockEntity([
        createMockEntityField('parentCategory', 'reference'),
        createMockEntityField('subCategory', 'reference'),
      ])

      const rules = inferVisibilityRules(entity)

      expect(rules.length).toBe(1)
      expect(rules[0]).toMatchObject({
        fieldId: 'parentCategory',
        targetFieldId: 'subCategory',
      })
      expect(rules[0].expression).toEqual(['!=', '$state.parentCategory', null])
    })

    it('should infer visibility from category-subcategory relationship', () => {
      const entity = createMockEntity([
        createMockEntityField('category', 'reference'),
        createMockEntityField('subcategory', 'reference'),
      ])

      const rules = inferVisibilityRules(entity)

      expect(rules.length).toBe(1)
      expect(rules[0].expression).toEqual(['!=', '$state.category', null])
    })
  })

  describe('No Matches', () => {
    it('should return empty array when no patterns match', () => {
      const entity = createMockEntity([
        createMockEntityField('firstName', 'string'),
        createMockEntityField('lastName', 'string'),
        createMockEntityField('email', 'string'),
      ])

      const rules = inferVisibilityRules(entity)

      expect(rules).toEqual([])
    })

    it('should not match field with itself', () => {
      const entity = createMockEntity([
        createMockEntityField('hasDelivery', 'boolean'),
      ])

      const rules = inferVisibilityRules(entity)

      expect(rules).toEqual([])
    })
  })
})

// ============================================================================
// Reaction Builder Tests
// ============================================================================

describe('visibilityToReaction', () => {
  it('should convert visibility to reaction with NOT expression', () => {
    const visibility: FieldVisibility = {
      fieldId: 'hasDelivery',
      targetFieldId: 'deliveryAddress',
      expression: ['==', '$state.hasDelivery', true],
      source: 'inferred',
    }

    const reaction = visibilityToReaction(visibility)

    expect(reaction).toEqual({
      trigger: 'change',
      actions: [
        {
          type: 'updateProp',
          target: 'deliveryAddress',
          prop: 'hidden',
          value: ['NOT', ['==', '$state.hasDelivery', true]],
        },
      ],
    })
  })
})

describe('buildVisibilityReactions', () => {
  it('should group reactions by source field', () => {
    const visibilities: FieldVisibility[] = [
      {
        fieldId: 'userType',
        targetFieldId: 'businessName',
        expression: ['==', '$state.userType', 'business'],
        source: 'inferred',
      },
      {
        fieldId: 'userType',
        targetFieldId: 'businessId',
        expression: ['==', '$state.userType', 'business'],
        source: 'inferred',
      },
      {
        fieldId: 'hasDelivery',
        targetFieldId: 'deliveryAddress',
        expression: ['==', '$state.hasDelivery', true],
        source: 'inferred',
      },
    ]

    const reactionMap = buildVisibilityReactions(visibilities)

    expect(reactionMap.size).toBe(2)
    expect(reactionMap.get('userType')?.length).toBe(2)
    expect(reactionMap.get('hasDelivery')?.length).toBe(1)
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('generateFormVisibility', () => {
  it('should generate visibility reactions from inference', async () => {
    const entity = createMockEntity([
      createMockEntityField('hasDelivery', 'boolean'),
      createMockEntityField('deliveryAddress', 'string'),
      createMockEntityField('userType', 'enum', {
        enumValues: [
          { value: 'personal', label: 'Personal' },
          { value: 'business', label: 'Business' },
        ],
      }),
      createMockEntityField('businessName', 'string'),
    ])

    const reactions = await generateFormVisibility(entity, {
      inferFromDependencies: true,
    })

    expect(reactions.size).toBe(2)
    expect(reactions.has('hasDelivery')).toBe(true)
    expect(reactions.has('userType')).toBe(true)
  })

  it('should skip inference when disabled', async () => {
    const entity = createMockEntity([
      createMockEntityField('hasDelivery', 'boolean'),
      createMockEntityField('deliveryAddress', 'string'),
    ])

    const reactions = await generateFormVisibility(entity, {
      inferFromDependencies: false,
    })

    expect(reactions.size).toBe(0)
  })

  it('should prioritize hints over inference', async () => {
    const entity = createMockEntity([
      createMockEntityField('status', 'string'),
      createMockEntityField('vipDiscount', 'number'),
    ])

    const reactions = await generateFormVisibility(entity, {
      hints: [
        // 템플릿 매칭 가능한 패턴 사용 (상태가 VIP일 때)
        { fieldId: 'vipDiscount', rule: '상태가 VIP일 때' },
      ],
      inferFromDependencies: true,
      useLLM: false,
    })

    // hints로 지정된 필드는 inference 결과와 중복되지 않음
    expect(reactions.size).toBeGreaterThan(0)
    expect(reactions.has('status')).toBe(true)
  })

  it('should use template matching for hints', async () => {
    const entity = createMockEntity([
      createMockEntityField('status', 'string'),
      createMockEntityField('vipSection', 'string'),
    ])

    const reactions = await generateFormVisibility(entity, {
      hints: [
        { fieldId: 'vipSection', rule: '상태가 VIP일 때' },
      ],
      useLLM: false,
    })

    expect(reactions.size).toBe(1)
    expect(reactions.has('status')).toBe(true)
  })
})
