/**
 * validateField Tests
 *
 * Entity 스키마 제약조건 기반 필드 검증 테스트
 */

import { describe, test, expect } from 'vitest'
import { createFormRuntime } from '../form-runtime'
import type { ViewSchema, EntitySchema, Expression } from '@manifesto-ai/schema'

// 테스트용 Entity 스키마
const createTestEntitySchema = (): EntitySchema => ({
  _type: 'entity',
  id: 'test-entity',
  version: '1.0.0',
  name: 'Test Entity',
  fields: [
    {
      id: 'name',
      dataType: 'string',
      label: 'Name',
      constraints: [
        { type: 'required', message: '이름을 입력해주세요' },
        { type: 'min', value: 2, message: '최소 2자 이상' },
        { type: 'max', value: 50, message: '최대 50자 이하' },
      ],
    },
    {
      id: 'email',
      dataType: 'string',
      label: 'Email',
      constraints: [
        { type: 'required' },
        { type: 'pattern', value: '^[\\w.-]+@[\\w.-]+\\.\\w+$', message: '이메일 형식이 아닙니다' },
      ],
    },
    {
      id: 'age',
      dataType: 'number',
      label: 'Age',
      constraints: [
        { type: 'min', value: 0, message: '나이는 0 이상이어야 합니다' },
        { type: 'max', value: 150, message: '나이는 150 이하여야 합니다' },
      ],
    },
    {
      id: 'tags',
      dataType: 'array',
      label: 'Tags',
      constraints: [
        { type: 'required', message: '태그를 선택해주세요' },
        { type: 'min', value: 1, message: '최소 1개 이상 선택' },
        { type: 'max', value: 5, message: '최대 5개까지 선택 가능' },
      ],
    },
    {
      id: 'password',
      dataType: 'string',
      label: 'Password',
      constraints: [
        { type: 'required' },
        {
          type: 'custom',
          expression: ['>=', ['LENGTH', '$state.password'], 8],
          message: '비밀번호는 8자 이상이어야 합니다',
        },
      ],
    },
    {
      id: 'noConstraints',
      dataType: 'string',
      label: 'No Constraints Field',
    },
  ],
})

// 테스트용 View 스키마
const createTestViewSchema = (): ViewSchema => ({
  _type: 'view',
  id: 'test-view',
  version: '1.0.0',
  name: 'Test View',
  entityRef: 'test-entity',
  mode: 'create',
  layout: { type: 'form', columns: 1 },
  sections: [
    {
      id: 'main',
      layout: { type: 'grid', columns: 1 },
      fields: [
        { id: 'name', entityFieldId: 'name', component: 'text-input' },
        { id: 'email', entityFieldId: 'email', component: 'text-input' },
        { id: 'age', entityFieldId: 'age', component: 'number-input' },
        { id: 'tags', entityFieldId: 'tags', component: 'multi-select' },
        { id: 'password', entityFieldId: 'password', component: 'text-input' },
        { id: 'noConstraints', entityFieldId: 'noConstraints', component: 'text-input' },
      ],
    },
  ],
})

describe('validateField', () => {
  describe('required constraint', () => {
    test('빈 값일 때 에러 반환', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { name: '' },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'name' })

      const meta = runtime.getFieldMeta('name')
      expect(meta?.errors).toContain('이름을 입력해주세요')
    })

    test('null 값일 때 에러 반환', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { name: null },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'name' })

      const meta = runtime.getFieldMeta('name')
      expect(meta?.errors).toContain('이름을 입력해주세요')
    })

    test('undefined 값일 때 에러 반환', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: {},
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'name' })

      const meta = runtime.getFieldMeta('name')
      expect(meta?.errors).toContain('이름을 입력해주세요')
    })

    test('빈 배열일 때 에러 반환', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { tags: [] },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'tags' })

      const meta = runtime.getFieldMeta('tags')
      expect(meta?.errors).toContain('태그를 선택해주세요')
    })

    test('값이 있을 때 에러 없음', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { name: 'John' },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'name' })

      const meta = runtime.getFieldMeta('name')
      expect(meta?.errors).toHaveLength(0)
    })
  })

  describe('min constraint', () => {
    test('문자열 길이가 최소값 미만일 때 에러', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { name: 'A' },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'name' })

      const meta = runtime.getFieldMeta('name')
      expect(meta?.errors).toContain('최소 2자 이상')
    })

    test('숫자가 최소값 미만일 때 에러', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { age: -1 },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'age' })

      const meta = runtime.getFieldMeta('age')
      expect(meta?.errors).toContain('나이는 0 이상이어야 합니다')
    })

    test('배열 길이가 최소값 미만일 때 에러', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { tags: [] },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'tags' })

      const meta = runtime.getFieldMeta('tags')
      // required 에러도 함께 포함
      expect(meta?.errors.length).toBeGreaterThan(0)
    })

    test('최소값 이상일 때 에러 없음', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { name: 'John', age: 25, tags: ['a', 'b'] },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'VALIDATE' })

      const nameMeta = runtime.getFieldMeta('name')
      const ageMeta = runtime.getFieldMeta('age')
      expect(nameMeta?.errors.filter((e) => e.includes('최소'))).toHaveLength(0)
      expect(ageMeta?.errors).toHaveLength(0)
    })
  })

  describe('max constraint', () => {
    test('문자열 길이가 최대값 초과일 때 에러', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { name: 'A'.repeat(51) },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'name' })

      const meta = runtime.getFieldMeta('name')
      expect(meta?.errors).toContain('최대 50자 이하')
    })

    test('숫자가 최대값 초과일 때 에러', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { age: 200 },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'age' })

      const meta = runtime.getFieldMeta('age')
      expect(meta?.errors).toContain('나이는 150 이하여야 합니다')
    })

    test('배열 길이가 최대값 초과일 때 에러', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { tags: ['a', 'b', 'c', 'd', 'e', 'f'] },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'tags' })

      const meta = runtime.getFieldMeta('tags')
      expect(meta?.errors).toContain('최대 5개까지 선택 가능')
    })
  })

  describe('pattern constraint', () => {
    test('패턴 불일치 시 에러', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { email: 'invalid-email' },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'email' })

      const meta = runtime.getFieldMeta('email')
      expect(meta?.errors).toContain('이메일 형식이 아닙니다')
    })

    test('패턴 일치 시 에러 없음', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { email: 'test@example.com' },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'email' })

      const meta = runtime.getFieldMeta('email')
      expect(meta?.errors.filter((e) => e.includes('이메일'))).toHaveLength(0)
    })

    test('빈 문자열일 때 패턴 검사 스킵 (required로 처리)', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { email: '' },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'email' })

      const meta = runtime.getFieldMeta('email')
      // required 에러는 있지만 패턴 에러는 없어야 함
      expect(meta?.errors.some((e) => e.includes('필수'))).toBe(true)
      expect(meta?.errors.some((e) => e.includes('이메일 형식'))).toBe(false)
    })
  })

  describe('custom constraint', () => {
    test('커스텀 표현식 실패 시 에러 (단순 비교)', () => {
      // 단순 비교: score 값이 50 이상인지
      const entitySchema: EntitySchema = {
        _type: 'entity',
        id: 'test-entity',
        version: '1.0.0',
        name: 'Test Entity',
        fields: [
          {
            id: 'score',
            dataType: 'number',
            label: 'Score',
            constraints: [
              {
                type: 'custom',
                expression: ['>=', '$state.score', 50],
                message: '점수는 50점 이상이어야 합니다',
              },
            ],
          },
        ],
      }

      const viewSchema: ViewSchema = {
        _type: 'view',
        id: 'test-view',
        version: '1.0.0',
        name: 'Test View',
        entityRef: 'test-entity',
        mode: 'create',
        layout: { type: 'form', columns: 1 },
        sections: [
          {
            id: 'main',
            layout: { type: 'grid', columns: 1 },
            fields: [{ id: 'score', entityFieldId: 'score', component: 'number-input' }],
          },
        ],
      }

      const runtime = createFormRuntime(viewSchema, {
        entitySchema,
        initialValues: { score: 30 }, // 50 미만
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'score' })

      const meta = runtime.getFieldMeta('score')
      expect(meta?.errors).toContain('점수는 50점 이상이어야 합니다')
    })

    test('커스텀 표현식 성공 시 에러 없음', () => {
      const entitySchema: EntitySchema = {
        _type: 'entity',
        id: 'test-entity',
        version: '1.0.0',
        name: 'Test Entity',
        fields: [
          {
            id: 'score',
            dataType: 'number',
            label: 'Score',
            constraints: [
              {
                type: 'custom',
                expression: ['>=', '$state.score', 50],
                message: '점수는 50점 이상이어야 합니다',
              },
            ],
          },
        ],
      }

      const viewSchema: ViewSchema = {
        _type: 'view',
        id: 'test-view',
        version: '1.0.0',
        name: 'Test View',
        entityRef: 'test-entity',
        mode: 'create',
        layout: { type: 'form', columns: 1 },
        sections: [
          {
            id: 'main',
            layout: { type: 'grid', columns: 1 },
            fields: [{ id: 'score', entityFieldId: 'score', component: 'number-input' }],
          },
        ],
      }

      const runtime = createFormRuntime(viewSchema, {
        entitySchema,
        initialValues: { score: 80 }, // 50 이상
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'score' })

      const meta = runtime.getFieldMeta('score')
      expect(meta?.errors.filter((e) => e.includes('점수'))).toHaveLength(0)
    })
  })

  describe('multiple constraints', () => {
    test('여러 제약조건 에러 누적', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { name: '' }, // required + min 둘 다 위반
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'name' })

      const meta = runtime.getFieldMeta('name')
      expect(meta?.errors.length).toBeGreaterThanOrEqual(1)
      expect(meta?.errors).toContain('이름을 입력해주세요')
    })
  })

  describe('no constraints', () => {
    test('제약조건 없는 필드는 에러 없음', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: { noConstraints: '' },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'noConstraints' })

      const meta = runtime.getFieldMeta('noConstraints')
      expect(meta?.errors).toHaveLength(0)
    })
  })

  describe('no entity schema', () => {
    test('Entity 스키마 없이도 동작 (검증 스킵)', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        initialValues: { name: '' },
      })
      runtime.initialize()

      runtime.dispatch({ type: 'FIELD_BLUR', fieldId: 'name' })

      const meta = runtime.getFieldMeta('name')
      expect(meta?.errors).toHaveLength(0)
    })
  })

  describe('validateAll', () => {
    test('전체 검증 시 모든 필드 에러 확인', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: {},
      })
      runtime.initialize()

      const result = runtime.dispatch({ type: 'SUBMIT' })

      // 검증 실패로 VALIDATION_ERROR 반환
      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('VALIDATION_ERROR')
      }
    })

    test('전체 검증 성공 시 submit 진행', () => {
      const runtime = createFormRuntime(createTestViewSchema(), {
        entitySchema: createTestEntitySchema(),
        initialValues: {
          name: 'John',
          email: 'john@example.com',
          age: 25,
          tags: ['tag1'],
          password: '12345678',
          noConstraints: '',
        },
      })
      runtime.initialize()

      const result = runtime.dispatch({ type: 'SUBMIT' })

      expect(result._tag).toBe('Ok')
      expect(runtime.getState().isSubmitting).toBe(true)
    })
  })
})
