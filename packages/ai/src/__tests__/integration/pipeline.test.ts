/**
 * E2E Integration Tests - Full Generation Pipeline
 *
 * Planner → Entity → FormView with Visibility 전체 파이프라인 테스트
 * LLM 호출 없이 Template/Pattern 기반 테스트
 */

import { describe, it, expect } from 'vitest'
import type { EntitySchema, EntityField } from '@manifesto-ai/schema'
import {
  // Planner
  generateViewPlansFromEntities,
  inferEntityRole,
  suggestEntitiesFromDescription,
  INDUSTRY_PATTERNS,
  // Entity (types for mock)
  type EntityGeneratorInput,
  // Form
  inferComponentType,
  inferColSpan,
  generateFormVisibility,
  inferVisibilityRules,
  // Condition
  tryGenerateFromTemplate,
  validateExpression,
  type ConditionGeneratorOutput,
} from '../../generators'

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockEntityField = (
  id: string,
  dataType: EntityField['dataType'],
  options?: Partial<EntityField>
): EntityField => ({
  id,
  dataType,
  label: id,
  ...options,
})

const createMockEntity = (
  id: string,
  name: string,
  fields: EntityField[]
): EntitySchema => ({
  _type: 'entity',
  id,
  version: '0.1.0',
  name,
  fields,
})

// ============================================================================
// Full Pipeline Tests (Without LLM)
// ============================================================================

describe('Full Pipeline Integration', () => {
  describe('Planner → Entity → View Pipeline', () => {
    it('should suggest entities from system description', () => {
      const description = '온라인 쇼핑몰에서 고객이 상품을 주문하고 결제하는 시스템'

      const suggestions = suggestEntitiesFromDescription(description)

      expect(suggestions).toContain('Customer')
      expect(suggestions).toContain('Product')
      expect(suggestions).toContain('Order')
      expect(suggestions).toContain('Payment')
    })

    it('should infer entity roles based on industry patterns', () => {
      // Commerce industry
      expect(inferEntityRole('Order', 'commerce')).toBe('transaction')
      expect(inferEntityRole('Product', 'commerce')).toBe('core')
      expect(inferEntityRole('Category', 'commerce')).toBe('master')

      // Finance industry
      expect(inferEntityRole('Account', 'finance')).toBe('core')
      expect(inferEntityRole('Transaction', 'finance')).toBe('transaction')

      // SaaS industry
      expect(inferEntityRole('Subscription', 'saas')).toBe('transaction')
      expect(inferEntityRole('User', 'saas')).toBe('core')
    })

    it('should generate view plans for entities', () => {
      const entities = [
        { name: 'Customer', description: '고객 정보', role: 'core' as const },
        { name: 'Order', description: '주문 정보', role: 'transaction' as const },
      ]

      const viewPlans = generateViewPlansFromEntities(entities, 'commerce')

      // Customer (core): list, form(create), form(edit), detail
      const customerViews = viewPlans.filter(p => p.entity === 'Customer')
      expect(customerViews.length).toBeGreaterThanOrEqual(4)

      // Order (transaction): list, wizard(create), detail
      const orderViews = viewPlans.filter(p => p.entity === 'Order')
      expect(orderViews.length).toBeGreaterThanOrEqual(3)
      expect(orderViews.some(v => v.viewType === 'wizard')).toBe(true)
    })
  })

  describe('Entity → FormView Component Inference', () => {
    it('should infer correct component types from data types', () => {
      expect(inferComponentType('string', 'name')).toBe('text-input')
      expect(inferComponentType('string', 'description')).toBe('textarea')
      expect(inferComponentType('number', 'amount')).toBe('number-input')
      expect(inferComponentType('boolean', 'isActive')).toBe('checkbox')
      expect(inferComponentType('date', 'birthDate')).toBe('date-picker')
      expect(inferComponentType('datetime', 'createdAt')).toBe('datetime-picker')
      expect(inferComponentType('enum', 'status', 3)).toBe('radio')
      expect(inferComponentType('enum', 'category', 10)).toBe('select')
      expect(inferComponentType('reference', 'userId')).toBe('autocomplete')
    })

    it('should infer correct column spans', () => {
      expect(inferColSpan('string', 'description')).toBe(2)
      expect(inferColSpan('string', 'content')).toBe(2)
      expect(inferColSpan('string', 'address')).toBe(2)
      expect(inferColSpan('boolean', 'isActive')).toBe(1)
      expect(inferColSpan('string', 'name')).toBe(1)
    })
  })

  describe('Entity → Visibility Inference', () => {
    it('should infer visibility from boolean field patterns', async () => {
      const entity = createMockEntity('customer', 'Customer', [
        createMockEntityField('hasDelivery', 'boolean'),
        createMockEntityField('deliveryAddress', 'string'),
        createMockEntityField('sameAsShipping', 'boolean'),
        createMockEntityField('billingAddress', 'string'),
      ])

      const visibilityRules = inferVisibilityRules(entity)

      // hasDelivery → deliveryAddress
      const deliveryRule = visibilityRules.find(r => r.targetFieldId === 'deliveryAddress')
      expect(deliveryRule).toBeDefined()
      expect(deliveryRule?.expression).toEqual(['==', '$state.hasDelivery', true])

      // sameAsShipping → billingAddress (false일 때 표시)
      const billingRule = visibilityRules.find(r => r.targetFieldId === 'billingAddress')
      expect(billingRule).toBeDefined()
      expect(billingRule?.expression).toEqual(['==', '$state.sameAsShipping', false])
    })

    it('should infer visibility from enum field patterns', async () => {
      const entity = createMockEntity('user', 'User', [
        createMockEntityField('userType', 'enum', {
          enumValues: [
            { value: 'personal', label: 'Personal' },
            { value: 'business', label: 'Business' },
          ],
        }),
        createMockEntityField('businessName', 'string'),
        createMockEntityField('businessId', 'string'),
      ])

      const visibilityRules = inferVisibilityRules(entity)

      // userType === 'business' → businessName, businessId
      const businessRules = visibilityRules.filter(r =>
        r.targetFieldId === 'businessName' || r.targetFieldId === 'businessId'
      )
      expect(businessRules.length).toBe(2)
      expect(businessRules[0].expression).toEqual(['==', '$state.userType', 'business'])
    })

    it('should generate visibility reactions for form', async () => {
      const entity = createMockEntity('order', 'Order', [
        createMockEntityField('hasDelivery', 'boolean'),
        createMockEntityField('deliveryAddress', 'string'),
        createMockEntityField('status', 'string'),
      ])

      const reactions = await generateFormVisibility(entity, {
        hints: [
          { fieldId: 'deliveryAddress', rule: '상태가 active일 때' },
        ],
        inferFromDependencies: true,
      })

      // status → deliveryAddress (from hint, takes priority)
      expect(reactions.has('status')).toBe(true)
      // Note: inferFromDependencies는 hints에서 이미 처리된 타겟은 제외함
    })
  })

  describe('Condition Template Pipeline', () => {
    it('should generate conditions from natural language', () => {
      const availableFields = ['status', 'grade', 'amount', 'quantity']

      // Permission pattern
      const vipResult = tryGenerateFromTemplate('VIP 고객만', availableFields)
      expect(vipResult).not.toBeNull()
      expect(vipResult?.expression[0]).toBe('==')

      // Status pattern
      const statusResult = tryGenerateFromTemplate('상태가 active일 때', availableFields)
      expect(statusResult).not.toBeNull()
      expect(statusResult?.expression).toEqual(['==', '$state.status', 'active'])

      // Comparison pattern
      const amountResult = tryGenerateFromTemplate('금액이 100만원 이상', availableFields)
      expect(amountResult).not.toBeNull()
      expect(amountResult?.expression[0]).toBe('>=')
    })

    it('should validate generated expressions', () => {
      const validExpression = ['==', '$state.status', 'active']
      const validResult = validateExpression(validExpression, ['status'])
      expect(validResult.valid).toBe(true)

      const invalidExpression = ['==', '$state.nonexistent', 'value']
      const invalidResult = validateExpression(invalidExpression, ['status'])
      expect(invalidResult.valid).toBe(false)
    })
  })
})

// ============================================================================
// Industry-specific Integration Tests
// ============================================================================

describe('Industry-specific Pipeline', () => {
  describe('Commerce Industry', () => {
    it('should generate complete commerce system plan', () => {
      const entities = [
        { name: 'Product', description: '상품', role: inferEntityRole('Product', 'commerce') },
        { name: 'Order', description: '주문', role: inferEntityRole('Order', 'commerce') },
        { name: 'Customer', description: '고객', role: inferEntityRole('Customer', 'commerce') },
        { name: 'Category', description: '카테고리', role: inferEntityRole('Category', 'commerce') },
      ]

      const viewPlans = generateViewPlansFromEntities(entities, 'commerce')

      // 각 Entity에 대해 최소 기본 CRUD 뷰가 생성되어야 함
      expect(viewPlans.length).toBeGreaterThanOrEqual(12) // 4 entities * ~3 views

      // Transaction entity는 wizard를 가져야 함
      const orderViews = viewPlans.filter(p => p.entity === 'Order')
      expect(orderViews.some(v => v.viewType === 'wizard')).toBe(true)

      // Master entity는 list/form만 가져야 함
      const categoryViews = viewPlans.filter(p => p.entity === 'Category')
      expect(categoryViews.every(v => v.viewType === 'list' || v.viewType === 'form')).toBe(true)
    })
  })

  describe('SaaS Industry', () => {
    it('should generate complete SaaS system plan', () => {
      const entities = [
        { name: 'User', description: '사용자', role: inferEntityRole('User', 'saas') },
        { name: 'Organization', description: '조직', role: inferEntityRole('Organization', 'saas') },
        { name: 'Subscription', description: '구독', role: inferEntityRole('Subscription', 'saas') },
        { name: 'Role', description: '역할', role: inferEntityRole('Role', 'saas') },
      ]

      const viewPlans = generateViewPlansFromEntities(entities, 'saas')

      // Core entities have full CRUD
      const userViews = viewPlans.filter(p => p.entity === 'User')
      expect(userViews.length).toBeGreaterThanOrEqual(4)

      // Transaction entities have wizard
      const subscriptionViews = viewPlans.filter(p => p.entity === 'Subscription')
      expect(subscriptionViews.some(v => v.viewType === 'wizard')).toBe(true)
    })
  })
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty entity list', () => {
    const viewPlans = generateViewPlansFromEntities([], 'general')
    expect(viewPlans).toEqual([])
  })

  it('should handle entity with no visibility-inferable fields', async () => {
    const entity = createMockEntity('simple', 'Simple', [
      createMockEntityField('name', 'string'),
      createMockEntityField('email', 'string'),
    ])

    const visibilityRules = inferVisibilityRules(entity)
    expect(visibilityRules).toEqual([])
  })

  it('should handle unknown industry gracefully', () => {
    const role = inferEntityRole('Customer', 'unknown_industry')
    // Should fallback to general patterns
    expect(role).toBe('core')
  })

  it('should handle condition template that does not match', () => {
    const result = tryGenerateFromTemplate(
      '복잡한 비즈니스 규칙으로 인해 매칭 불가',
      ['field1', 'field2']
    )
    expect(result).toBeNull()
  })
})
