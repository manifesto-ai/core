/**
 * Schema Loader
 *
 * 스키마 파일 로딩, 캐싱, 버전 관리
 */

import type { Schema, EntitySchema, ViewSchema, ActionSchema, SchemaVersion, Result } from '@manifesto-ai/schema'
import { validateSchema, ok, err } from '@manifesto-ai/schema'
import type { ValidationError } from '@manifesto-ai/schema'

// ============================================================================
// Types
// ============================================================================

export interface SchemaLoaderOptions {
  /** 캐시 활성화 (기본값: true) */
  cache?: boolean
  /** 캐시 TTL (ms, 기본값: 5분) */
  cacheTTL?: number
  /** 스키마 기본 경로 */
  basePath?: string
}

export interface CachedSchema<T extends Schema = Schema> {
  schema: T
  loadedAt: number
  version: SchemaVersion
}

export type LoaderError =
  | { type: 'FETCH_ERROR'; message: string; url: string }
  | { type: 'PARSE_ERROR'; message: string }
  | { type: 'VALIDATION_ERROR'; errors: ValidationError[] }
  | { type: 'NOT_FOUND'; schemaId: string }

// ============================================================================
// Schema Loader
// ============================================================================

export class SchemaLoader {
  private cache = new Map<string, CachedSchema>()
  private options: Required<SchemaLoaderOptions>

  constructor(options: SchemaLoaderOptions = {}) {
    this.options = {
      cache: options.cache ?? true,
      cacheTTL: options.cacheTTL ?? 5 * 60 * 1000, // 5분
      basePath: options.basePath ?? '/schemas',
    }
  }

  /**
   * 스키마 로드 (URL에서)
   */
  async load(schemaId: string): Promise<Result<Schema, LoaderError>> {
    // 캐시 확인
    if (this.options.cache) {
      const cached = this.getFromCache(schemaId)
      if (cached) {
        return ok(cached.schema)
      }
    }

    const url = this.buildUrl(schemaId)

    try {
      const response = await fetch(url)

      if (!response.ok) {
        if (response.status === 404) {
          return err({ type: 'NOT_FOUND', schemaId })
        }
        return err({
          type: 'FETCH_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
          url,
        })
      }

      const data = await response.json()
      return this.processSchema(schemaId, data)
    } catch (e) {
      return err({
        type: 'FETCH_ERROR',
        message: e instanceof Error ? e.message : 'Unknown fetch error',
        url,
      })
    }
  }

  /**
   * JSON 데이터에서 직접 스키마 로드
   */
  loadFromData(schemaId: string, data: unknown): Result<Schema, LoaderError> {
    return this.processSchema(schemaId, data)
  }

  /**
   * 여러 스키마 동시 로드
   */
  async loadMany(schemaIds: string[]): Promise<Result<Map<string, Schema>, LoaderError>> {
    const results = await Promise.all(schemaIds.map((id) => this.load(id)))
    const schemas = new Map<string, Schema>()

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!
      if (result._tag === 'Err') {
        return result
      }
      schemas.set(schemaIds[i]!, result.value)
    }

    return ok(schemas)
  }

  /**
   * Entity 스키마 로드
   */
  async loadEntity(schemaId: string): Promise<Result<EntitySchema, LoaderError>> {
    const result = await this.load(schemaId)
    if (result._tag === 'Err') return result

    if (result.value._type !== 'entity') {
      return err({
        type: 'VALIDATION_ERROR',
        errors: [{ path: ['_type'], message: 'Expected entity schema' }],
      })
    }

    return ok(result.value as EntitySchema)
  }

  /**
   * View 스키마 로드
   */
  async loadView(schemaId: string): Promise<Result<ViewSchema, LoaderError>> {
    const result = await this.load(schemaId)
    if (result._tag === 'Err') return result

    if (result.value._type !== 'view') {
      return err({
        type: 'VALIDATION_ERROR',
        errors: [{ path: ['_type'], message: 'Expected view schema' }],
      })
    }

    return ok(result.value as ViewSchema)
  }

  /**
   * Action 스키마 로드
   */
  async loadAction(schemaId: string): Promise<Result<ActionSchema, LoaderError>> {
    const result = await this.load(schemaId)
    if (result._tag === 'Err') return result

    if (result.value._type !== 'action') {
      return err({
        type: 'VALIDATION_ERROR',
        errors: [{ path: ['_type'], message: 'Expected action schema' }],
      })
    }

    return ok(result.value as ActionSchema)
  }

  /**
   * 캐시 무효화
   */
  invalidate(schemaId: string): void {
    this.cache.delete(schemaId)
  }

  /**
   * 전체 캐시 클리어
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * 캐시된 스키마 목록
   */
  getCachedSchemas(): string[] {
    return Array.from(this.cache.keys())
  }

  private processSchema(schemaId: string, data: unknown): Result<Schema, LoaderError> {
    // JSON 파싱
    let parsed: unknown
    if (typeof data === 'string') {
      try {
        parsed = JSON.parse(data)
      } catch {
        return err({ type: 'PARSE_ERROR', message: 'Invalid JSON' })
      }
    } else {
      parsed = data
    }

    // 스키마 검증
    const validationResult = validateSchema(parsed)
    if (validationResult._tag === 'Err') {
      return err({ type: 'VALIDATION_ERROR', errors: validationResult.error })
    }

    const schema = validationResult.value

    // 캐시 저장
    if (this.options.cache) {
      this.cache.set(schemaId, {
        schema,
        loadedAt: Date.now(),
        version: schema.version,
      })
    }

    return ok(schema)
  }

  private getFromCache(schemaId: string): CachedSchema | null {
    const cached = this.cache.get(schemaId)
    if (!cached) return null

    // TTL 확인
    if (Date.now() - cached.loadedAt > this.options.cacheTTL) {
      this.cache.delete(schemaId)
      return null
    }

    return cached
  }

  private buildUrl(schemaId: string): string {
    const base = this.options.basePath.replace(/\/$/, '')
    const id = schemaId.replace(/^\//, '')
    return `${base}/${id}.json`
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export const createSchemaLoader = (options?: SchemaLoaderOptions): SchemaLoader => {
  return new SchemaLoader(options)
}
