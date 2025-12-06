/**
 * Performance Benchmark Tests
 *
 * PRD 요구사항: DSL 파싱 및 초기 렌더링 지연 시간 50ms 미만
 */

import { describe, it, expect } from 'vitest'
import { FormRuntime, createFormRuntime } from '../form-runtime'
import type { ViewSchema, EntitySchema, ViewField, EntityField } from '@manifesto-ai/schema'

// ============================================================================
// Test Helpers - Large Schema Generator
// ============================================================================

/**
 * 대규모 폼 스키마 생성 (N개 필드)
 */
function generateLargeViewSchema(fieldCount: number): ViewSchema {
  const fields: ViewField[] = []

  for (let i = 0; i < fieldCount; i++) {
    const field: ViewField = {
      id: `field_${i}`,
      entityFieldId: `field_${i}`,
      component: i % 3 === 0 ? 'select' : i % 3 === 1 ? 'number' : 'text',
      label: `Field ${i}`,
      // 25%의 필드에 hidden 표현식 추가
      ...(i % 4 === 0 && {
        hidden: ['==', `$state.field_${Math.max(0, i - 1)}`, 'hide'],
      }),
      // 25%의 필드에 disabled 표현식 추가
      ...(i % 4 === 1 && {
        disabled: ['==', `$state.field_${Math.max(0, i - 2)}`, 'disable'],
      }),
      // 10%의 필드에 reactions 추가
      ...(i % 10 === 0 && {
        reactions: [
          {
            trigger: 'change' as const,
            actions: [
              {
                type: 'setValue' as const,
                target: `field_${Math.min(fieldCount - 1, i + 1)}`,
                value: 'derived',
              },
            ],
          },
        ],
      }),
    }
    fields.push(field)
  }

  // 섹션으로 분할 (10개씩)
  const sections = []
  const fieldsPerSection = 10
  for (let i = 0; i < fields.length; i += fieldsPerSection) {
    sections.push({
      id: `section_${Math.floor(i / fieldsPerSection)}`,
      title: `Section ${Math.floor(i / fieldsPerSection)}`,
      fields: fields.slice(i, i + fieldsPerSection),
    })
  }

  return {
    id: 'large-form',
    name: 'Large Form',
    version: '1.0.0',
    entityRef: 'large-entity',
    mode: 'create',
    sections,
    layout: { type: 'form', columns: 2 },
  }
}

/**
 * 대규모 Entity 스키마 생성
 */
function generateLargeEntitySchema(fieldCount: number): EntitySchema {
  const fields: EntityField[] = []

  for (let i = 0; i < fieldCount; i++) {
    const field: EntityField = {
      id: `field_${i}`,
      dataType: i % 3 === 0 ? 'string' : i % 3 === 1 ? 'number' : 'string',
      label: `Field ${i}`,
      // 10%의 필드에 제약조건 추가
      ...(i % 10 === 0 && {
        constraints: [
          { type: 'required' as const, message: `Field ${i} is required` },
        ],
      }),
      // select 필드에 enum 옵션 추가
      ...(i % 3 === 0 && {
        enumValues: [
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' },
          { value: 'option3', label: 'Option 3' },
        ],
      }),
    }
    fields.push(field)
  }

  return {
    id: 'large-entity',
    name: 'Large Entity',
    version: '1.0.0',
    fields,
  }
}

/**
 * 복잡한 표현식이 포함된 스키마 생성
 */
function generateComplexExpressionSchema(fieldCount: number): ViewSchema {
  const fields: ViewField[] = []

  for (let i = 0; i < fieldCount; i++) {
    const field: ViewField = {
      id: `field_${i}`,
      entityFieldId: `field_${i}`,
      component: 'text',
      label: `Field ${i}`,
      // 복잡한 중첩 표현식
      hidden: [
        'OR',
        ['AND', ['==', `$state.field_0`, 'a'], ['==', `$state.field_1`, 'b']],
        ['AND', ['==', `$state.field_2`, 'c'], ['!=', `$state.field_3`, 'd']],
        ['IS_EMPTY', `$state.field_${Math.min(4, fieldCount - 1)}`],
      ],
      disabled: [
        'AND',
        ['NOT', ['IS_NULL', `$state.field_${Math.min(5, fieldCount - 1)}`]],
        ['>', `$state.field_${Math.min(6, fieldCount - 1)}`, 10],
      ],
    }
    fields.push(field)
  }

  return {
    id: 'complex-form',
    name: 'Complex Form',
    version: '1.0.0',
    entityRef: 'complex-entity',
    mode: 'create',
    sections: [
      {
        id: 'main',
        title: 'Main',
        fields,
      },
    ],
    layout: { type: 'form', columns: 2 },
  }
}

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance Benchmarks', () => {
  describe('Initialization Performance', () => {
    it('should initialize 50-field form under 50ms', () => {
      const viewSchema = generateLargeViewSchema(50)
      const entitySchema = generateLargeEntitySchema(50)

      const start = performance.now()

      const runtime = createFormRuntime(viewSchema, { entitySchema })
      const result = runtime.initialize()

      const elapsed = performance.now() - start

      expect(result._tag).toBe('Ok')
      expect(elapsed).toBeLessThan(50)

      console.log(`[Benchmark] 50 fields initialization: ${elapsed.toFixed(2)}ms`)
    })

    it('should initialize 100-field form under 50ms', () => {
      const viewSchema = generateLargeViewSchema(100)
      const entitySchema = generateLargeEntitySchema(100)

      const start = performance.now()

      const runtime = createFormRuntime(viewSchema, { entitySchema })
      const result = runtime.initialize()

      const elapsed = performance.now() - start

      expect(result._tag).toBe('Ok')
      expect(elapsed).toBeLessThan(50)

      console.log(`[Benchmark] 100 fields initialization: ${elapsed.toFixed(2)}ms`)
    })

    it('should initialize 200-field form under 100ms', () => {
      const viewSchema = generateLargeViewSchema(200)
      const entitySchema = generateLargeEntitySchema(200)

      const start = performance.now()

      const runtime = createFormRuntime(viewSchema, { entitySchema })
      const result = runtime.initialize()

      const elapsed = performance.now() - start

      expect(result._tag).toBe('Ok')
      expect(elapsed).toBeLessThan(100)

      console.log(`[Benchmark] 200 fields initialization: ${elapsed.toFixed(2)}ms`)
    })
  })

  describe('Expression Evaluation Performance', () => {
    it('should evaluate complex expressions for 50 fields under 20ms', () => {
      const viewSchema = generateComplexExpressionSchema(50)
      const entitySchema = generateLargeEntitySchema(50)

      const runtime = createFormRuntime(viewSchema, { entitySchema })
      runtime.initialize()

      // 초기값 설정
      const initialValues: Record<string, unknown> = {}
      for (let i = 0; i < 50; i++) {
        initialValues[`field_${i}`] = i % 2 === 0 ? 'test' : i
      }

      const start = performance.now()

      // 필드 변경으로 재평가 트리거
      runtime.dispatch({ type: 'FIELD_CHANGE', fieldId: 'field_0', value: 'changed' })

      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(20)

      console.log(`[Benchmark] Complex expression evaluation (50 fields): ${elapsed.toFixed(2)}ms`)
    })
  })

  describe('Field Change Performance', () => {
    it('should process field change under 5ms for 100-field form', () => {
      const viewSchema = generateLargeViewSchema(100)
      const entitySchema = generateLargeEntitySchema(100)

      const runtime = createFormRuntime(viewSchema, { entitySchema })
      runtime.initialize()

      const timings: number[] = []

      // 10번 측정하여 평균 계산
      for (let i = 0; i < 10; i++) {
        const start = performance.now()
        runtime.dispatch({ type: 'FIELD_CHANGE', fieldId: `field_${i * 10}`, value: `value_${i}` })
        timings.push(performance.now() - start)
      }

      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length

      expect(avgTime).toBeLessThan(5)

      console.log(`[Benchmark] Avg field change time (100 fields): ${avgTime.toFixed(2)}ms`)
    })
  })

  describe('Validation Performance', () => {
    it('should validate all fields under 30ms for 100-field form', () => {
      const viewSchema = generateLargeViewSchema(100)
      const entitySchema = generateLargeEntitySchema(100)

      const runtime = createFormRuntime(viewSchema, { entitySchema })
      runtime.initialize()

      const start = performance.now()

      runtime.dispatch({ type: 'VALIDATE' })

      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(30)

      console.log(`[Benchmark] Full validation (100 fields): ${elapsed.toFixed(2)}ms`)
    })
  })

  describe('State Access Performance', () => {
    it('should get state under 1ms for 100-field form', () => {
      const viewSchema = generateLargeViewSchema(100)
      const entitySchema = generateLargeEntitySchema(100)

      const runtime = createFormRuntime(viewSchema, { entitySchema })
      runtime.initialize()

      const timings: number[] = []

      // 100번 측정하여 평균 계산
      for (let i = 0; i < 100; i++) {
        const start = performance.now()
        runtime.getState()
        timings.push(performance.now() - start)
      }

      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length

      expect(avgTime).toBeLessThan(1)

      console.log(`[Benchmark] Avg getState time (100 fields): ${avgTime.toFixed(3)}ms`)
    })
  })

  describe('Memory Efficiency', () => {
    it('should handle multiple runtime instances efficiently', () => {
      const viewSchema = generateLargeViewSchema(50)
      const entitySchema = generateLargeEntitySchema(50)

      const start = performance.now()

      // 10개의 런타임 인스턴스 생성
      const runtimes: FormRuntime[] = []
      for (let i = 0; i < 10; i++) {
        const runtime = createFormRuntime(viewSchema, { entitySchema })
        runtime.initialize()
        runtimes.push(runtime)
      }

      const elapsed = performance.now() - start

      expect(runtimes.length).toBe(10)
      expect(elapsed).toBeLessThan(500)

      console.log(`[Benchmark] 10 runtime instances (50 fields each): ${elapsed.toFixed(2)}ms`)
    })
  })
})

describe('Benchmark Summary', () => {
  it('should print benchmark summary', () => {
    const sizes = [10, 25, 50, 100, 200, 500]
    const results: Array<{ size: number; initTime: number; changeTime: number }> = []

    for (const size of sizes) {
      const viewSchema = generateLargeViewSchema(size)
      const entitySchema = generateLargeEntitySchema(size)

      // Init time
      const initStart = performance.now()
      const runtime = createFormRuntime(viewSchema, { entitySchema })
      runtime.initialize()
      const initTime = performance.now() - initStart

      // Change time (avg of 5)
      const changeTimes: number[] = []
      for (let i = 0; i < 5; i++) {
        const start = performance.now()
        runtime.dispatch({ type: 'FIELD_CHANGE', fieldId: `field_${i}`, value: `v${i}` })
        changeTimes.push(performance.now() - start)
      }
      const changeTime = changeTimes.reduce((a, b) => a + b, 0) / changeTimes.length

      results.push({ size, initTime, changeTime })
    }

    console.log('\n=== Performance Benchmark Summary ===')
    console.log('| Fields | Init (ms) | Change (ms) |')
    console.log('|--------|-----------|-------------|')
    for (const r of results) {
      console.log(`| ${r.size.toString().padStart(6)} | ${r.initTime.toFixed(2).padStart(9)} | ${r.changeTime.toFixed(2).padStart(11)} |`)
    }
    console.log('=====================================\n')

    // PRD 요구사항 검증: 50ms 미만
    const largestResult = results[results.length - 1]
    expect(largestResult.initTime).toBeLessThan(50)
  })
})
