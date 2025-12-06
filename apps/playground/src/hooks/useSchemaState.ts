'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { EXAMPLE_SCHEMAS, getExampleSchema } from '@/lib/example-schemas'
import type { FormViewSchema, EntitySchema } from '@manifesto-ai/schema'

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

export interface SchemaState {
  entitySchemaJson: string
  viewSchemaJson: string
  setEntitySchemaJson: (json: string) => void
  setViewSchemaJson: (json: string) => void
  parsedEntitySchema: EntitySchema | null
  parsedViewSchema: FormViewSchema | null
  parseError: string | null
  loadExample: (exampleId: string) => void
}

export function useSchemaState(): SchemaState {
  const [entitySchemaJson, setEntitySchemaJson] = useState<string>('')
  const [viewSchemaJson, setViewSchemaJson] = useState<string>('')
  const [parseError, setParseError] = useState<string | null>(null)

  // Debounce schema changes for real-time preview (300ms)
  const debouncedEntityJson = useDebounce(entitySchemaJson, 300)
  const debouncedViewJson = useDebounce(viewSchemaJson, 300)

  // Parse schemas with debounced values
  const { parsedEntitySchema, parsedViewSchema, error } = useMemo(() => {
    if (!debouncedEntityJson && !debouncedViewJson) {
      return { parsedEntitySchema: null, parsedViewSchema: null, error: null }
    }

    try {
      const entity = debouncedEntityJson
        ? JSON.parse(debouncedEntityJson)
        : null
      const view = debouncedViewJson ? JSON.parse(debouncedViewJson) : null

      // Basic validation
      if (entity && entity._type !== 'entity') {
        return {
          parsedEntitySchema: null,
          parsedViewSchema: null,
          error: 'Entity schema must have _type: "entity"',
        }
      }

      if (view && view._type !== 'view') {
        return {
          parsedEntitySchema: null,
          parsedViewSchema: null,
          error: 'View schema must have _type: "view"',
        }
      }

      return {
        parsedEntitySchema: entity as EntitySchema | null,
        parsedViewSchema: view as FormViewSchema | null,
        error: null,
      }
    } catch (e) {
      return {
        parsedEntitySchema: null,
        parsedViewSchema: null,
        error: e instanceof Error ? e.message : 'Invalid JSON',
      }
    }
  }, [debouncedEntityJson, debouncedViewJson])

  // Update parse error state
  useEffect(() => {
    setParseError(error)
  }, [error])

  // Load example schema
  const loadExample = useCallback((exampleId: string) => {
    const example = getExampleSchema(exampleId)
    if (example) {
      setEntitySchemaJson(JSON.stringify(example.entity, null, 2))
      setViewSchemaJson(JSON.stringify(example.view, null, 2))
      setParseError(null)
    }
  }, [])

  // Load default example on mount
  useEffect(() => {
    const firstExample = EXAMPLE_SCHEMAS[0]
    if (firstExample && !entitySchemaJson && !viewSchemaJson) {
      loadExample(firstExample.id)
    }
  }, [loadExample, entitySchemaJson, viewSchemaJson])

  return {
    entitySchemaJson,
    viewSchemaJson,
    setEntitySchemaJson,
    setViewSchemaJson,
    parsedEntitySchema,
    parsedViewSchema,
    parseError,
    loadExample,
  }
}
