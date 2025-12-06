/**
 * useSchemaLoader - Schema loading and caching hook for React
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import type { Schema, EntitySchema, ViewSchema, ActionSchema } from '@manifesto-ai/schema'
import { isOk } from '@manifesto-ai/schema'
import { createSchemaLoader, type SchemaLoader, type LoaderError } from '@manifesto-ai/engine'

// ============================================================================
// Types
// ============================================================================

export interface UseSchemaLoaderOptions {
  /** Cache enabled */
  cache?: boolean
  /** Cache TTL (ms) */
  cacheTTL?: number
  /** Schema base path */
  basePath?: string
}

export interface UseSchemaLoaderReturn<T extends Schema = Schema> {
  /** Loaded schema */
  schema: T | null
  /** Loading state */
  isLoading: boolean
  /** Error */
  error: LoaderError | null
  /** Load schema */
  load: (schemaId: string) => Promise<void>
  /** Load multiple schemas */
  loadMany: (schemaIds: string[]) => Promise<void>
  /** Invalidate cache */
  invalidate: (schemaId: string) => void
  /** Clear all cache */
  clearCache: () => void
  /** Cached schema list */
  cachedSchemas: string[]
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
// Hook
// ============================================================================

export function useSchemaLoader<T extends Schema = Schema>(
  options?: UseSchemaLoaderOptions
): UseSchemaLoaderReturn<T> {
  const loaderRef = useRef(getGlobalLoader(options))

  const [schema, setSchema] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<LoaderError | null>(null)

  const load = useCallback(async (schemaId: string): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await loaderRef.current.load(schemaId)

      if (isOk(result)) {
        setSchema(result.value as T)
      } else {
        setError(result.error)
        setSchema(null)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadMany = useCallback(async (schemaIds: string[]): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await loaderRef.current.loadMany(schemaIds)

      if (isOk(result)) {
        const schemas = result.value
        if (schemas.size > 0) {
          const firstId = schemaIds[0]
          if (firstId) {
            setSchema((schemas.get(firstId) as T) ?? null)
          }
        }
      } else {
        setError(result.error)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const invalidate = useCallback((schemaId: string): void => {
    loaderRef.current.invalidate(schemaId)
  }, [])

  const clearCache = useCallback((): void => {
    loaderRef.current.clearCache()
  }, [])

  const cachedSchemas = useMemo(() => loaderRef.current.getCachedSchemas(), [])

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
 * Entity schema loader
 */
export function useEntitySchema(options?: UseSchemaLoaderOptions) {
  return useSchemaLoader<EntitySchema>(options)
}

/**
 * View schema loader
 */
export function useViewSchema(options?: UseSchemaLoaderOptions) {
  return useSchemaLoader<ViewSchema>(options)
}

/**
 * Action schema loader
 */
export function useActionSchema(options?: UseSchemaLoaderOptions) {
  return useSchemaLoader<ActionSchema>(options)
}

/**
 * Load View schema with associated Entity schema
 */
export interface ViewWithEntity {
  view: ViewSchema
  entity: EntitySchema
}

export interface UseViewWithEntityReturn {
  /** Loaded View + Entity */
  schemas: ViewWithEntity | null
  /** Loading state */
  isLoading: boolean
  /** Error */
  error: LoaderError | null
  /** Load View + Entity */
  load: (viewSchemaId: string) => Promise<void>
}

export function useViewWithEntity(
  options?: UseSchemaLoaderOptions
): UseViewWithEntityReturn {
  const loaderRef = useRef(getGlobalLoader(options))

  const [schemas, setSchemas] = useState<ViewWithEntity | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<LoaderError | null>(null)

  const load = useCallback(async (viewSchemaId: string): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      // Load View schema first
      const viewResult = await loaderRef.current.load(viewSchemaId)

      if (!isOk(viewResult)) {
        setError(viewResult.error)
        setSchemas(null)
        return
      }

      const view = viewResult.value as ViewSchema

      // Load Entity schema via entityRef
      if (!view.entityRef) {
        setError({
          type: 'PARSE_ERROR',
          message: `View schema "${viewSchemaId}" does not have entityRef`,
        })
        setSchemas(null)
        return
      }

      const entityResult = await loaderRef.current.load(view.entityRef)

      if (!isOk(entityResult)) {
        setError(entityResult.error)
        setSchemas(null)
        return
      }

      const entity = entityResult.value as EntitySchema

      setSchemas({ view, entity })
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    schemas,
    isLoading,
    error,
    load,
  }
}
