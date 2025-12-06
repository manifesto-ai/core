/**
 * useSchemaLoader - 스키마 로딩 및 캐싱 관리
 */

import { ref, shallowRef, computed, type Ref, type ComputedRef } from 'vue'
import type { Schema, EntitySchema, ViewSchema, ActionSchema } from '@manifesto-ai/schema'
import { isOk } from '@manifesto-ai/schema'
import { createSchemaLoader, type SchemaLoader, type LoaderError } from '@manifesto-ai/engine'

// ============================================================================
// Types
// ============================================================================

export interface UseSchemaLoaderOptions {
  /** 캐시 활성화 */
  cache?: boolean
  /** 캐시 TTL (ms) */
  cacheTTL?: number
  /** 스키마 기본 경로 */
  basePath?: string
}

export interface UseSchemaLoaderReturn<T extends Schema = Schema> {
  /** 로드된 스키마 */
  schema: Ref<T | null>
  /** 로딩 상태 */
  isLoading: Ref<boolean>
  /** 에러 */
  error: Ref<LoaderError | null>
  /** 스키마 로드 */
  load: (schemaId: string) => Promise<void>
  /** 여러 스키마 로드 */
  loadMany: (schemaIds: string[]) => Promise<void>
  /** 캐시 무효화 */
  invalidate: (schemaId: string) => void
  /** 전체 캐시 클리어 */
  clearCache: () => void
  /** 캐시된 스키마 목록 */
  cachedSchemas: ComputedRef<string[]>
}

// ============================================================================
// Global Loader Instance
// ============================================================================

let globalLoader: SchemaLoader | null = null

const getGlobalLoader = (options?: UseSchemaLoaderOptions): SchemaLoader => {
  if (!globalLoader) {
    globalLoader = createSchemaLoader(options)
  }
  return globalLoader
}

// ============================================================================
// Composable
// ============================================================================

export function useSchemaLoader<T extends Schema = Schema>(
  options?: UseSchemaLoaderOptions
): UseSchemaLoaderReturn<T> {
  const loader = getGlobalLoader(options)

  const schema = shallowRef<T | null>(null) as Ref<T | null>
  const isLoading = ref(false)
  const error = ref<LoaderError | null>(null)

  const load = async (schemaId: string): Promise<void> => {
    isLoading.value = true
    error.value = null

    try {
      const result = await loader.load(schemaId)

      if (isOk(result)) {
        schema.value = result.value as T
      } else {
        error.value = result.error
        schema.value = null
      }
    } finally {
      isLoading.value = false
    }
  }

  const loadMany = async (schemaIds: string[]): Promise<void> => {
    isLoading.value = true
    error.value = null

    try {
      const result = await loader.loadMany(schemaIds)

      if (isOk(result)) {
        // 여러 스키마 로드 시 마지막 스키마만 저장 (또는 Map 반환)
        const schemas = result.value
        if (schemas.size > 0) {
          const firstId = schemaIds[0]
          if (firstId) {
            schema.value = (schemas.get(firstId) as T) ?? null
          }
        }
      } else {
        error.value = result.error
      }
    } finally {
      isLoading.value = false
    }
  }

  const invalidate = (schemaId: string): void => {
    loader.invalidate(schemaId)
  }

  const clearCache = (): void => {
    loader.clearCache()
  }

  const cachedSchemas = computed(() => loader.getCachedSchemas())

  return {
    schema,
    isLoading,
    error,
    load,
    loadMany,
    invalidate,
    clearCache,
    cachedSchemas,
  }
}

/**
 * Entity 스키마 전용 로더
 */
export function useEntitySchema(options?: UseSchemaLoaderOptions) {
  return useSchemaLoader<EntitySchema>(options)
}

/**
 * View 스키마 전용 로더
 */
export function useViewSchema(options?: UseSchemaLoaderOptions) {
  return useSchemaLoader<ViewSchema>(options)
}

/**
 * Action 스키마 전용 로더
 */
export function useActionSchema(options?: UseSchemaLoaderOptions) {
  return useSchemaLoader<ActionSchema>(options)
}

/**
 * View 스키마와 연관된 Entity 스키마를 함께 로드
 *
 * View 스키마의 entityRef 필드를 통해 연결된 Entity 스키마를
 * 자동으로 로드하는 편의 함수
 */
export interface ViewWithEntity {
  view: ViewSchema
  entity: EntitySchema
}

export interface UseViewWithEntityReturn {
  /** 로드된 View + Entity */
  schemas: Ref<ViewWithEntity | null>
  /** 로딩 상태 */
  isLoading: Ref<boolean>
  /** 에러 */
  error: Ref<LoaderError | null>
  /** View + Entity 로드 */
  load: (viewSchemaId: string) => Promise<void>
}

export function useViewWithEntity(
  options?: UseSchemaLoaderOptions
): UseViewWithEntityReturn {
  const loader = getGlobalLoader(options)

  const schemas = shallowRef<ViewWithEntity | null>(null) as Ref<ViewWithEntity | null>
  const isLoading = ref(false)
  const error = ref<LoaderError | null>(null)

  const load = async (viewSchemaId: string): Promise<void> => {
    isLoading.value = true
    error.value = null

    try {
      // 먼저 View 스키마 로드
      const viewResult = await loader.load(viewSchemaId)

      if (!isOk(viewResult)) {
        error.value = viewResult.error
        schemas.value = null
        return
      }

      const view = viewResult.value as ViewSchema

      // View의 entityRef를 통해 Entity 스키마 로드
      if (!view.entityRef) {
        error.value = {
          type: 'PARSE_ERROR',
          message: `View schema "${viewSchemaId}" does not have entityRef`,
        }
        schemas.value = null
        return
      }

      const entityResult = await loader.load(view.entityRef)

      if (!isOk(entityResult)) {
        error.value = entityResult.error
        schemas.value = null
        return
      }

      const entity = entityResult.value as EntitySchema

      schemas.value = { view, entity }
    } finally {
      isLoading.value = false
    }
  }

  return {
    schemas,
    isLoading,
    error,
    load,
  }
}
