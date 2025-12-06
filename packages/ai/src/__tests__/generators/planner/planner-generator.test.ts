/**
 * Planner Generator Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { ok, err } from '@manifesto-ai/schema'
import {
  plannerGenerator,
  generatePlan,
  generateViewPlansFromEntities,
  type PlannerGeneratorInput,
} from '../../../generators/planner'
import type { AIClient } from '../../../core/client'
import type { GeneratorContext } from '../../../types'
import type { GeneratedPlannerOutput, EntityInfo } from '../../../core/schemas/view-plan.schema'

// ============================================================================
// Mock Setup
// ============================================================================

const createMockClient = (response: GeneratedPlannerOutput): AIClient => ({
  provider: {
    config: { type: 'openai', model: 'gpt-4o-mini' },
    type: 'openai',
    getModel: vi.fn(),
  },
  generateObject: vi.fn().mockResolvedValue(
    ok({
      value: response,
      metadata: {
        model: 'gpt-4o-mini',
        provider: 'openai',
        tokensUsed: { prompt: 200, completion: 500, total: 700 },
        latencyMs: 2000,
        cached: false,
      },
    })
  ),
  generateText: vi.fn(),
  generateWithTools: vi.fn(),
})

const createMockErrorClient = (message: string): AIClient => ({
  provider: {
    config: { type: 'openai', model: 'gpt-4o-mini' },
    type: 'openai',
    getModel: vi.fn(),
  },
  generateObject: vi.fn().mockResolvedValue(
    err({
      _type: 'PROVIDER_ERROR',
      provider: 'openai',
      message,
    })
  ),
  generateText: vi.fn(),
  generateWithTools: vi.fn(),
})

// ============================================================================
// Test Data
// ============================================================================

const VALID_PLANNER_OUTPUT: GeneratedPlannerOutput = {
  systemName: '온라인 쇼핑몰 관리 시스템',
  description: '상품, 주문, 고객을 관리하는 이커머스 백오피스 시스템',
  entities: [
    { name: 'Product', description: '판매 상품', role: 'core' },
    { name: 'Order', description: '고객 주문', role: 'transaction' },
    { name: 'Customer', description: '쇼핑몰 고객', role: 'core' },
  ],
  viewPlans: [
    { viewType: 'list', purpose: 'search', entity: 'Product', priority: 1 },
    { viewType: 'form', purpose: 'create', entity: 'Product', priority: 2 },
    { viewType: 'form', purpose: 'edit', entity: 'Product', priority: 3 },
    { viewType: 'list', purpose: 'search', entity: 'Order', priority: 4 },
    { viewType: 'wizard', purpose: 'create', entity: 'Order', priority: 5 },
    { viewType: 'detail', purpose: 'view', entity: 'Order', priority: 6 },
    { viewType: 'list', purpose: 'search', entity: 'Customer', priority: 7 },
    { viewType: 'form', purpose: 'create', entity: 'Customer', priority: 8 },
  ],
  entityRelations: [
    { from: 'Order', to: 'Customer', type: 'manyToMany' },
    { from: 'Order', to: 'Product', type: 'manyToMany' },
  ],
}

// ============================================================================
// Generator Tests
// ============================================================================

describe('Planner Generator', () => {
  const defaultContext: GeneratorContext = {}
  const defaultInput: PlannerGeneratorInput = {
    prompt: '온라인 쇼핑몰 관리 시스템',
    maxEntities: 10,
    maxViews: 20,
  }

  it('should generate plan from requirements', async () => {
    const mockClient = createMockClient(VALID_PLANNER_OUTPUT)

    const result = await plannerGenerator.generate(defaultInput, defaultContext, mockClient)

    expect(result._tag).toBe('Ok')
    if (result._tag === 'Ok') {
      expect(result.value.value.systemName).toBe('온라인 쇼핑몰 관리 시스템')
      expect(result.value.value.entities.length).toBe(3)
      expect(result.value.value.viewPlans.length).toBe(8)
    }
  })

  it('should normalize entity names to PascalCase', async () => {
    const outputWithLowercase: GeneratedPlannerOutput = {
      ...VALID_PLANNER_OUTPUT,
      entities: [
        { name: 'product', description: '상품', role: 'core' },
        { name: 'order_item', description: '주문 항목', role: 'core' },
      ],
      viewPlans: [
        { viewType: 'list', purpose: 'search', entity: 'product', priority: 1 },
        { viewType: 'list', purpose: 'search', entity: 'order_item', priority: 2 },
      ],
    }
    const mockClient = createMockClient(outputWithLowercase)

    const result = await plannerGenerator.generate(defaultInput, defaultContext, mockClient)

    expect(result._tag).toBe('Ok')
    if (result._tag === 'Ok') {
      expect(result.value.value.entities[0].name).toBe('Product')
      expect(result.value.value.entities[1].name).toBe('OrderItem')
    }
  })

  it('should filter excluded view types', async () => {
    const mockClient = createMockClient(VALID_PLANNER_OUTPUT)
    const inputWithExcludes: PlannerGeneratorInput = {
      ...defaultInput,
      excludeViewTypes: ['wizard', 'dashboard'],
    }

    const result = await plannerGenerator.generate(inputWithExcludes, defaultContext, mockClient)

    expect(result._tag).toBe('Ok')
    if (result._tag === 'Ok') {
      const hasWizard = result.value.value.viewPlans.some(p => p.viewType === 'wizard')
      expect(hasWizard).toBe(false)
    }
  })

  it('should limit view plans to maxViews', async () => {
    const mockClient = createMockClient(VALID_PLANNER_OUTPUT)
    const inputWithLimit: PlannerGeneratorInput = {
      ...defaultInput,
      maxViews: 5,
    }

    const result = await plannerGenerator.generate(inputWithLimit, defaultContext, mockClient)

    expect(result._tag).toBe('Ok')
    if (result._tag === 'Ok') {
      expect(result.value.value.viewPlans.length).toBeLessThanOrEqual(5)
    }
  })

  it('should reassign priorities after filtering', async () => {
    const mockClient = createMockClient(VALID_PLANNER_OUTPUT)
    const inputWithExcludes: PlannerGeneratorInput = {
      ...defaultInput,
      excludeViewTypes: ['wizard'],
    }

    const result = await plannerGenerator.generate(inputWithExcludes, defaultContext, mockClient)

    expect(result._tag).toBe('Ok')
    if (result._tag === 'Ok') {
      const priorities = result.value.value.viewPlans.map(p => p.priority)
      // Check sequential priorities starting from 1
      expect(priorities[0]).toBe(1)
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBe(priorities[i - 1] + 1)
      }
    }
  })

  it('should handle LLM errors', async () => {
    const mockClient = createMockErrorClient('API rate limit exceeded')

    const result = await plannerGenerator.generate(defaultInput, defaultContext, mockClient)

    expect(result._tag).toBe('Err')
  })

  it('should validate entity references in view plans', async () => {
    const invalidOutput: GeneratedPlannerOutput = {
      ...VALID_PLANNER_OUTPUT,
      viewPlans: [
        { viewType: 'list', purpose: 'search', entity: 'NonExistentEntity', priority: 1 },
      ],
    }
    const mockClient = createMockClient(invalidOutput)

    const result = await plannerGenerator.generate(defaultInput, defaultContext, mockClient)

    expect(result._tag).toBe('Err')
  })
})

// ============================================================================
// Convenience Function Tests
// ============================================================================

describe('generatePlan helper', () => {
  it('should work with minimal input', async () => {
    const mockClient = createMockClient(VALID_PLANNER_OUTPUT)

    const result = await generatePlan(mockClient, '온라인 쇼핑몰')

    expect('systemName' in result).toBe(true)
    if ('systemName' in result) {
      expect(result.entities.length).toBeGreaterThan(0)
      expect(result.viewPlans.length).toBeGreaterThan(0)
    }
  })

  it('should apply industry context', async () => {
    const mockClient = createMockClient(VALID_PLANNER_OUTPUT)

    const result = await generatePlan(
      mockClient,
      '온라인 쇼핑몰',
      { industry: 'commerce' }
    )

    expect('systemName' in result).toBe(true)
    expect(mockClient.generateObject).toHaveBeenCalled()
  })

  it('should return error on failure', async () => {
    const mockClient = createMockErrorClient('Generation failed')

    const result = await generatePlan(mockClient, '온라인 쇼핑몰')

    expect('_type' in result).toBe(true)
  })
})

// ============================================================================
// Pattern-based Generation Tests
// ============================================================================

describe('generateViewPlansFromEntities', () => {
  const testEntities: EntityInfo[] = [
    { name: 'Customer', description: '고객', role: 'core' },
    { name: 'Order', description: '주문', role: 'transaction' },
    { name: 'Category', description: '카테고리', role: 'master' },
  ]

  it('should generate view plans based on entity roles', () => {
    const viewPlans = generateViewPlansFromEntities(testEntities)

    expect(viewPlans.length).toBeGreaterThan(0)

    // Core entities should have full CRUD
    const customerViews = viewPlans.filter(p => p.entity === 'Customer')
    const viewTypes = customerViews.map(v => `${v.viewType}-${v.purpose}`)
    expect(viewTypes).toContain('list-search')
    expect(viewTypes).toContain('form-create')
    expect(viewTypes).toContain('form-edit')
    expect(viewTypes).toContain('detail-view')
  })

  it('should generate wizard for transaction entities', () => {
    const viewPlans = generateViewPlansFromEntities(testEntities)

    const orderViews = viewPlans.filter(p => p.entity === 'Order')
    const hasWizard = orderViews.some(v => v.viewType === 'wizard')
    expect(hasWizard).toBe(true)
  })

  it('should not generate detail view for master entities', () => {
    const viewPlans = generateViewPlansFromEntities(testEntities)

    const categoryViews = viewPlans.filter(p => p.entity === 'Category')
    const hasDetail = categoryViews.some(v => v.viewType === 'detail')
    expect(hasDetail).toBe(false)
  })

  it('should generate sequential priorities', () => {
    const viewPlans = generateViewPlansFromEntities(testEntities)

    const priorities = viewPlans.map(p => p.priority)
    // Should be sequential starting from 1
    expect(priorities[0]).toBe(1)
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBe(priorities[i - 1] + 1)
    }
  })

  it('should apply industry-specific patterns', () => {
    const viewPlans = generateViewPlansFromEntities(testEntities, 'commerce')

    expect(viewPlans.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// Monadic Interface Tests
// ============================================================================

describe('Planner Generator - Monadic Interface', () => {
  const defaultContext: GeneratorContext = {}
  const defaultInput: PlannerGeneratorInput = {
    prompt: '테스트 시스템',
  }

  it('should support map transformation', async () => {
    const mockClient = createMockClient(VALID_PLANNER_OUTPUT)

    const mappedGenerator = plannerGenerator.map(output => output.entities.length)
    const result = await mappedGenerator.generate(defaultInput, defaultContext, mockClient)

    expect(result._tag).toBe('Ok')
    if (result._tag === 'Ok') {
      expect(typeof result.value.value).toBe('number')
      expect(result.value.value).toBe(3)
    }
  })

  it('should support withOptions', () => {
    const customGenerator = plannerGenerator.withOptions({
      temperature: 0.7,
      maxTokens: 16384,
    })

    expect(customGenerator.options.temperature).toBe(0.7)
    expect(customGenerator.options.maxTokens).toBe(16384)
  })

  it('should support withContext', async () => {
    const mockClient = createMockClient(VALID_PLANNER_OUTPUT)
    const customGenerator = plannerGenerator.withContext({
      industry: { type: 'commerce' },
    })

    const result = await customGenerator.generate(defaultInput, defaultContext, mockClient)

    expect(result._tag).toBe('Ok')
  })
})
