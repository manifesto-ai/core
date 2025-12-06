/**
 * setOptions Tests
 *
 * DataSource 기반 동적 옵션 설정 테스트
 */

import { describe, test, expect, vi } from 'vitest'
import { createFormRuntime, type FetchHandler } from '../form-runtime'
import type { ViewSchema, EntitySchema, EnumValue } from '@manifesto-ai/schema'

// 테스트용 Entity 스키마
const createTestEntitySchema = (): EntitySchema => ({
  _type: 'entity',
  id: 'test-entity',
  version: '1.0.0',
  name: 'Test Entity',
  fields: [
    {
      id: 'category',
      dataType: 'enum',
      label: 'Category',
      enumValues: [
        { value: 'A', label: 'Category A' },
        { value: 'B', label: 'Category B' },
      ],
    },
    {
      id: 'subCategory',
      dataType: 'enum',
      label: 'Sub Category',
    },
    {
      id: 'product',
      dataType: 'reference',
      label: 'Product',
    },
    {
      id: 'floor',
      dataType: 'reference',
      label: 'Floor',
    },
  ],
})

// 테스트용 View 스키마 (setOptions reaction 포함)
const createTestViewSchema = (reactions?: ViewSchema['sections'][0]['fields'][0]['reactions']): ViewSchema => ({
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
        { id: 'category', entityFieldId: 'category', component: 'select' },
        {
          id: 'subCategory',
          entityFieldId: 'subCategory',
          component: 'select',
          reactions,
        },
        { id: 'product', entityFieldId: 'product', component: 'select' },
        { id: 'floor', entityFieldId: 'floor', component: 'select' },
      ],
    },
  ],
})

describe('setOptions action', () => {
  describe('static source', () => {
    test('static 옵션 설정', async () => {
      const staticOptions: EnumValue[] = [
        { value: 'X', label: 'Option X' },
        { value: 'Y', label: 'Option Y' },
      ]

      const viewSchema = createTestViewSchema([
        {
          trigger: 'mount',
          actions: [
            {
              type: 'setOptions',
              target: 'subCategory',
              source: {
                type: 'static',
                static: staticOptions,
              },
            },
          ],
        },
      ])

      const runtime = createFormRuntime(viewSchema, {
        entitySchema: createTestEntitySchema(),
      })
      runtime.initialize()

      // mount reactions는 initialize에서 실행됨
      // 비동기 처리 대기
      await new Promise((resolve) => setTimeout(resolve, 10))

      const options = runtime.getFieldOptions('subCategory')
      expect(options).toEqual(staticOptions)
    })
  })

  describe('derived source', () => {
    test('derived - state 값에서 옵션 추출', async () => {
      // allOptions를 state에 저장하고, derived로 참조하는 시나리오
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
            fields: [
              {
                id: 'subCategory',
                entityFieldId: 'subCategory',
                component: 'select',
                reactions: [
                  {
                    trigger: 'mount',
                    actions: [
                      {
                        type: 'setOptions',
                        target: 'subCategory',
                        source: {
                          type: 'derived',
                          // state.allOptions에서 직접 참조
                          derived: '$state.allOptions',
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }

      const runtime = createFormRuntime(viewSchema, {
        entitySchema: createTestEntitySchema(),
        initialValues: {
          allOptions: [
            { value: 'A1', label: 'Sub A1' },
            { value: 'A2', label: 'Sub A2' },
          ],
        },
      })
      runtime.initialize()

      // mount reactions는 initialize에서 실행됨
      // 비동기 처리 대기
      await new Promise((resolve) => setTimeout(resolve, 10))

      const options = runtime.getFieldOptions('subCategory')
      expect(options).toEqual([
        { value: 'A1', label: 'Sub A1' },
        { value: 'A2', label: 'Sub A2' },
      ])
    })
  })

  describe('api source', () => {
    test('API 호출 후 옵션 설정', async () => {
      const mockResponse = {
        data: [
          { id: 1, name: 'Floor 1' },
          { id: 2, name: 'Floor 2' },
        ],
      }

      const mockFetchHandler: FetchHandler = vi.fn().mockResolvedValue(mockResponse)

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
            fields: [
              {
                id: 'floor',
                entityFieldId: 'floor',
                component: 'select',
                reactions: [
                  {
                    trigger: 'mount',
                    actions: [
                      {
                        type: 'setOptions',
                        target: 'floor',
                        source: {
                          type: 'api',
                          api: {
                            endpoint: '/api/floors',
                            method: 'GET',
                            transform: {
                              path: 'data',
                              map: { value: 'id', label: 'name' },
                            },
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }

      const runtime = createFormRuntime(viewSchema, {
        entitySchema: createTestEntitySchema(),
        fetchHandler: mockFetchHandler,
      })
      runtime.initialize()

      // mount reactions는 initialize에서 실행됨
      // 비동기 처리 대기
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(mockFetchHandler).toHaveBeenCalledWith('/api/floors', {
        method: 'GET',
        body: undefined,
      })

      const options = runtime.getFieldOptions('floor')
      expect(options).toEqual([
        { value: 1, label: 'Floor 1' },
        { value: 2, label: 'Floor 2' },
      ])
    })

    test('params에 정적 값 사용', async () => {
      const mockFetchHandler: FetchHandler = vi.fn().mockResolvedValue([])

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
            fields: [
              {
                id: 'floor',
                entityFieldId: 'floor',
                component: 'select',
                reactions: [
                  {
                    trigger: 'mount',
                    actions: [
                      {
                        type: 'setOptions',
                        target: 'floor',
                        source: {
                          type: 'api',
                          api: {
                            endpoint: '/api/floors',
                            method: 'GET',
                            params: {
                              productId: 'product-123',
                              active: true,
                            },
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }

      const runtime = createFormRuntime(viewSchema, {
        entitySchema: createTestEntitySchema(),
        fetchHandler: mockFetchHandler,
      })
      runtime.initialize()

      // mount reactions는 initialize에서 실행됨
      // 비동기 처리 대기
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(mockFetchHandler).toHaveBeenCalledWith(
        '/api/floors?productId=product-123&active=true',
        expect.any(Object)
      )
    })

    test('POST 메서드로 params 전송', async () => {
      const mockFetchHandler: FetchHandler = vi.fn().mockResolvedValue([])

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
            fields: [
              {
                id: 'floor',
                entityFieldId: 'floor',
                component: 'select',
                reactions: [
                  {
                    trigger: 'mount',
                    actions: [
                      {
                        type: 'setOptions',
                        target: 'floor',
                        source: {
                          type: 'api',
                          api: {
                            endpoint: '/api/floors/search',
                            method: 'POST',
                            params: {
                              filter: 'active',
                            },
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }

      const runtime = createFormRuntime(viewSchema, {
        entitySchema: createTestEntitySchema(),
        fetchHandler: mockFetchHandler,
      })
      runtime.initialize()

      // mount reactions는 initialize에서 실행됨
      // 비동기 처리 대기
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(mockFetchHandler).toHaveBeenCalledWith('/api/floors/search', {
        method: 'POST',
        body: { filter: 'active' },
      })
    })

    test('transform path로 중첩 데이터 추출', async () => {
      const mockResponse = {
        result: {
          items: [
            { code: 'F1', title: 'First Floor' },
            { code: 'F2', title: 'Second Floor' },
          ],
        },
      }

      const mockFetchHandler: FetchHandler = vi.fn().mockResolvedValue(mockResponse)

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
            fields: [
              {
                id: 'floor',
                entityFieldId: 'floor',
                component: 'select',
                reactions: [
                  {
                    trigger: 'mount',
                    actions: [
                      {
                        type: 'setOptions',
                        target: 'floor',
                        source: {
                          type: 'api',
                          api: {
                            endpoint: '/api/floors',
                            transform: {
                              path: 'result.items',
                              map: { value: 'code', label: 'title' },
                            },
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }

      const runtime = createFormRuntime(viewSchema, {
        entitySchema: createTestEntitySchema(),
        fetchHandler: mockFetchHandler,
      })
      runtime.initialize()

      // mount reactions는 initialize에서 실행됨
      // 비동기 처리 대기
      await new Promise((resolve) => setTimeout(resolve, 10))

      const options = runtime.getFieldOptions('floor')
      expect(options).toEqual([
        { value: 'F1', label: 'First Floor' },
        { value: 'F2', label: 'Second Floor' },
      ])
    })

    test('fetchHandler 없을 때 빈 배열 반환', async () => {
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
            fields: [
              {
                id: 'floor',
                entityFieldId: 'floor',
                component: 'select',
                reactions: [
                  {
                    trigger: 'mount',
                    actions: [
                      {
                        type: 'setOptions',
                        target: 'floor',
                        source: {
                          type: 'api',
                          api: { endpoint: '/api/floors' },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }

      const runtime = createFormRuntime(viewSchema, {
        entitySchema: createTestEntitySchema(),
        // fetchHandler 없음
      })
      runtime.initialize()

      // mount reactions는 initialize에서 실행됨
      // 비동기 처리 대기
      await new Promise((resolve) => setTimeout(resolve, 10))

      const options = runtime.getFieldOptions('floor')
      expect(options).toEqual([])
    })

    test('API 에러 시 빈 배열 반환', async () => {
      const mockFetchHandler: FetchHandler = vi.fn().mockRejectedValue(new Error('Network error'))

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
            fields: [
              {
                id: 'floor',
                entityFieldId: 'floor',
                component: 'select',
                reactions: [
                  {
                    trigger: 'mount',
                    actions: [
                      {
                        type: 'setOptions',
                        target: 'floor',
                        source: {
                          type: 'api',
                          api: { endpoint: '/api/floors' },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }

      const runtime = createFormRuntime(viewSchema, {
        entitySchema: createTestEntitySchema(),
        fetchHandler: mockFetchHandler,
      })
      runtime.initialize()

      // mount reactions는 initialize에서 실행됨
      // 비동기 처리 대기
      await new Promise((resolve) => setTimeout(resolve, 10))

      const options = runtime.getFieldOptions('floor')
      expect(options).toEqual([])
    })
  })

  describe('FormState fieldOptions', () => {
    test('getState()에 fieldOptions 포함', async () => {
      const staticOptions: EnumValue[] = [{ value: 1, label: 'Option 1' }]

      const viewSchema = createTestViewSchema([
        {
          trigger: 'mount',
          actions: [
            {
              type: 'setOptions',
              target: 'subCategory',
              source: { type: 'static', static: staticOptions },
            },
          ],
        },
      ])

      const runtime = createFormRuntime(viewSchema, {
        entitySchema: createTestEntitySchema(),
      })
      runtime.initialize()

      // mount reactions는 initialize에서 실행됨
      // 비동기 처리 대기
      await new Promise((resolve) => setTimeout(resolve, 10))

      const state = runtime.getState()
      expect(state.fieldOptions.get('subCategory')).toEqual(staticOptions)
    })
  })
})
