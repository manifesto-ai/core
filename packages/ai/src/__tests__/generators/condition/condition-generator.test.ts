/**
 * Condition Generator Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ok, err } from '@manifesto-ai/schema'
import {
  conditionGenerator,
  generateCondition,
  tryGenerateFromTemplate,
  type ConditionGeneratorInput,
} from '../../../generators/condition'
import type { AIClient } from '../../../core/client'
import type { GeneratorContext } from '../../../types'
import type { GeneratedCondition } from '../../../core/schemas/condition.schema'

// ============================================================================
// Mock Setup
// ============================================================================

const createMockClient = (response: GeneratedCondition): AIClient => ({
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
        tokensUsed: { prompt: 50, completion: 100, total: 150 },
        latencyMs: 500,
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

const AVAILABLE_FIELDS = ['status', 'grade', 'amount', 'name', 'email', 'quantity']

const VALID_GENERATED_CONDITION: GeneratedCondition = {
  expression: ['AND', ['==', '$state.status', 'active'], ['>=', '$state.amount', 1000000]],
  referencedFields: ['status', 'amount'],
  interpretation: 'Active customers with amount >= 1,000,000',
}

// ============================================================================
// Template-First Tests
// ============================================================================

describe('Condition Generator - Template Matching', () => {
  it('should match permission pattern: VIP 고객만', () => {
    const result = tryGenerateFromTemplate('VIP 고객만', ['status', 'grade', 'name'])

    expect(result).not.toBeNull()
    expect(result?.source).toBe('template')
    expect(result?.templateName).toBe('permission.roleEquals')
    expect(result?.expression).toEqual(['==', '$state.grade', 'VIP'])
    expect(result?.referencedFields).toContain('grade')
  })

  it('should match comparison pattern: 금액이 100만원 이상', () => {
    const result = tryGenerateFromTemplate('금액이 100만원 이상', ['amount', 'status', 'name'])

    expect(result).not.toBeNull()
    expect(result?.source).toBe('template')
    expect(result?.expression).toEqual(['>=', '$state.amount', 1000000])
    expect(result?.referencedFields).toContain('amount')
  })

  it('should match presence pattern: 이름이 비어있으면', () => {
    const result = tryGenerateFromTemplate('이름이 비어있으면', ['name', 'email', 'phone'])

    expect(result).not.toBeNull()
    expect(result?.source).toBe('template')
    expect(result?.expression).toEqual(['IS_EMPTY', '$state.name'])
    expect(result?.referencedFields).toContain('name')
  })

  it('should match presence pattern: 이메일이 입력되었으면', () => {
    const result = tryGenerateFromTemplate('이메일이 입력된 경우', ['name', 'email', 'phone'])

    expect(result).not.toBeNull()
    expect(result?.source).toBe('template')
    expect(result?.expression).toEqual(['IS_NOT_NULL', '$state.email'])
  })

  it('should match status pattern: 상태가 승인일 때', () => {
    const result = tryGenerateFromTemplate('상태가 승인일 경우', ['status', 'amount'])

    expect(result).not.toBeNull()
    expect(result?.source).toBe('template')
    expect(result?.expression).toEqual(['==', '$state.status', '승인'])
  })

  it('should return null for unmatched patterns', () => {
    const result = tryGenerateFromTemplate(
      '복잡한 다중 조건이 있는 특수한 경우',
      AVAILABLE_FIELDS
    )

    expect(result).toBeNull()
  })

  it('should return null when required field not available', () => {
    // 매칭될 수 있는 필드가 전혀 없으면 null
    const result = tryGenerateFromTemplate('VIP 고객만', ['name', 'email'])

    // status 필드가 있으면 fallback으로 매칭되므로, 아예 관련 필드가 없는 경우만 테스트
    // 이 테스트는 매칭 필드가 전혀 없는 경우를 검증
    expect(result).toBeNull()
  })
})

// ============================================================================
// Generator Tests (with LLM fallback)
// ============================================================================

describe('Condition Generator - Full Generator', () => {
  const defaultContext: GeneratorContext = {}
  const defaultInput: ConditionGeneratorInput = {
    naturalLanguageRule: '활성 상태이고 금액이 100만원 이상일 때',
    target: 'visibility',
    entityId: 'customer',
    availableFields: AVAILABLE_FIELDS,
  }

  it('should use template when available', async () => {
    const mockClient = createMockClient(VALID_GENERATED_CONDITION)
    const input: ConditionGeneratorInput = {
      naturalLanguageRule: 'VIP 고객만',
      target: 'visibility',
      entityId: 'customer',
      availableFields: ['status', 'grade', 'name'],
    }

    const result = await conditionGenerator.generate(input, defaultContext, mockClient)

    expect(result._tag).toBe('Ok')
    if (result._tag === 'Ok') {
      expect(result.value.value.source).toBe('template')
      expect(result.value.metadata.model).toBe('template')
      // LLM이 호출되지 않았어야 함
      expect(mockClient.generateObject).not.toHaveBeenCalled()
    }
  })

  it('should fallback to LLM when template fails', async () => {
    const mockClient = createMockClient(VALID_GENERATED_CONDITION)

    const result = await conditionGenerator.generate(defaultInput, defaultContext, mockClient)

    expect(result._tag).toBe('Ok')
    if (result._tag === 'Ok') {
      expect(result.value.value.source).toBe('llm')
      expect(mockClient.generateObject).toHaveBeenCalled()
    }
  })

  it('should skip template when useTemplates is false', async () => {
    // 간단한 유효 expression으로 mock response 생성
    const simpleCondition: GeneratedCondition = {
      expression: ['==', '$state.status', 'active'],
      referencedFields: ['status'],
      interpretation: 'Status equals active',
    }
    const mockClient = createMockClient(simpleCondition)
    const input: ConditionGeneratorInput = {
      naturalLanguageRule: '복잡한 조건 표현',
      target: 'visibility',
      entityId: 'customer',
      availableFields: ['status', 'grade', 'name'],
      useTemplates: false,
    }

    const result = await conditionGenerator.generate(input, defaultContext, mockClient)

    expect(result._tag).toBe('Ok')
    if (result._tag === 'Ok') {
      expect(result.value.value.source).toBe('llm')
      expect(mockClient.generateObject).toHaveBeenCalled()
    }
  })

  it('should handle LLM errors', async () => {
    const mockClient = createMockErrorClient('API rate limit exceeded')

    const result = await conditionGenerator.generate(defaultInput, defaultContext, mockClient)

    expect(result._tag).toBe('Err')
  })
})

// ============================================================================
// Convenience Function Tests
// ============================================================================

describe('generateCondition helper', () => {
  it('should work with simple template match', async () => {
    const mockClient = createMockClient(VALID_GENERATED_CONDITION)

    const result = await generateCondition(
      mockClient,
      '금액이 100만원 이상',
      {
        target: 'visibility',
        entityId: 'product',
        availableFields: ['amount', 'price', 'name'],
      }
    )

    // 템플릿 매칭 성공
    expect('expression' in result).toBe(true)
    if ('expression' in result) {
      expect(result.source).toBe('template')
      expect(result.expression).toEqual(['>=', '$state.amount', 1000000])
    }
  })

  it('should return error for invalid generation', async () => {
    const mockClient = createMockErrorClient('Invalid prompt')

    const result = await generateCondition(
      mockClient,
      '매우 복잡한 조건',
      {
        target: 'validation',
        entityId: 'order',
        availableFields: ['status', 'total'],
      }
    )

    expect('_type' in result).toBe(true)
  })
})

// ============================================================================
// Monadic Interface Tests
// ============================================================================

describe('Condition Generator - Monadic Interface', () => {
  const defaultContext: GeneratorContext = {}

  it('should support map transformation', async () => {
    const mockClient = createMockClient(VALID_GENERATED_CONDITION)
    const input: ConditionGeneratorInput = {
      naturalLanguageRule: 'VIP 고객만',
      target: 'visibility',
      entityId: 'customer',
      availableFields: ['status', 'grade', 'name'],
    }

    const mappedGenerator = conditionGenerator.map(output => output.referencedFields.length)
    const result = await mappedGenerator.generate(input, defaultContext, mockClient)

    expect(result._tag).toBe('Ok')
    if (result._tag === 'Ok') {
      expect(typeof result.value.value).toBe('number')
    }
  })

  it('should support withOptions', async () => {
    const mockClient = createMockClient(VALID_GENERATED_CONDITION)
    const input: ConditionGeneratorInput = {
      naturalLanguageRule: '복잡한 조건',
      target: 'visibility',
      entityId: 'customer',
      availableFields: AVAILABLE_FIELDS,
    }

    const customGenerator = conditionGenerator.withOptions({
      temperature: 0.5,
      maxTokens: 2048,
    })

    expect(customGenerator.options.temperature).toBe(0.5)
    expect(customGenerator.options.maxTokens).toBe(2048)
  })
})
