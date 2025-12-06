/**
 * Legacy Adapter
 *
 * PRD 3.3 - Anti-Corruption Layer
 * 레거시 API 응답(XML/SOAP 등)을 표준 JSON으로 변환하는 파이프라인 처리기
 */

import type { AdapterConfig, TransformPipeline } from '@manifesto-ai/schema'
import { ok, err, type Result } from '@manifesto-ai/schema'
import {
  executeTransformPipeline,
  type TransformStepConfig,
} from './transform-operations'

// ============================================================================
// Types
// ============================================================================

export interface LegacyAdapterOptions {
  /** 디버그 모드 */
  debug?: boolean
  /** XML 파서 (주입 가능) */
  xmlParser?: (xml: string) => Record<string, unknown>
  /** 타임아웃 (ms) */
  timeout?: number
}

export interface AdapterError {
  readonly type: 'ADAPTER_ERROR' | 'PARSE_ERROR' | 'TRANSFORM_ERROR'
  readonly message: string
  readonly phase?: 'request' | 'response'
  readonly originalError?: unknown
}

export interface AdapterResult<T> {
  readonly data: T
  readonly meta?: {
    readonly originalFormat?: string
    readonly transformSteps?: number
    readonly durationMs?: number
  }
}

// ============================================================================
// Legacy Adapter Class
// ============================================================================

export class LegacyAdapter {
  private readonly options: Required<LegacyAdapterOptions>

  constructor(options: LegacyAdapterOptions = {}) {
    this.options = {
      debug: options.debug ?? false,
      xmlParser: options.xmlParser ?? defaultXmlParser,
      timeout: options.timeout ?? 30000,
    }
  }

  /**
   * 요청 변환 (UI State -> Legacy API Payload)
   */
  transformRequest<T = unknown>(
    data: unknown,
    config: AdapterConfig
  ): Result<T, AdapterError> {
    const startTime = Date.now()

    if (this.options.debug) {
      console.log('[LegacyAdapter] transformRequest input:', data)
    }

    if (!config.requestTransform) {
      return ok(data as T)
    }

    const steps = this.convertPipelineToSteps(config.requestTransform)
    const result = executeTransformPipeline(data, steps)

    if (result._tag === 'Err') {
      return err({
        type: 'TRANSFORM_ERROR',
        message: result.error.message,
        phase: 'request',
        originalError: result.error,
      })
    }

    if (this.options.debug) {
      console.log('[LegacyAdapter] transformRequest output:', result.value)
      console.log('[LegacyAdapter] transformRequest duration:', Date.now() - startTime, 'ms')
    }

    return ok(result.value as T)
  }

  /**
   * 응답 변환 (Legacy API Response -> UI State)
   */
  transformResponse<T = unknown>(
    data: unknown,
    config: AdapterConfig
  ): Result<T, AdapterError> {
    const startTime = Date.now()

    if (this.options.debug) {
      console.log('[LegacyAdapter] transformResponse input:', data)
    }

    // 먼저 데이터 포맷 감지 및 파싱
    let parsedData = data

    if (typeof data === 'string') {
      const parseResult = this.parseResponseData(data, config.type)
      if (parseResult._tag === 'Err') {
        return parseResult as Result<T, AdapterError>
      }
      parsedData = parseResult.value
    }

    // 변환 파이프라인 없으면 파싱된 데이터 그대로 반환
    if (!config.responseTransform) {
      return ok(parsedData as T)
    }

    const steps = this.convertPipelineToSteps(config.responseTransform)
    const result = executeTransformPipeline(parsedData, steps)

    if (result._tag === 'Err') {
      return err({
        type: 'TRANSFORM_ERROR',
        message: result.error.message,
        phase: 'response',
        originalError: result.error,
      })
    }

    if (this.options.debug) {
      console.log('[LegacyAdapter] transformResponse output:', result.value)
      console.log('[LegacyAdapter] transformResponse duration:', Date.now() - startTime, 'ms')
    }

    return ok(result.value as T)
  }

  /**
   * 응답 데이터 파싱 (XML, SOAP 등)
   */
  private parseResponseData(
    data: string,
    type?: AdapterConfig['type']
  ): Result<unknown, AdapterError> {
    // 빈 문자열 체크
    if (!data.trim()) {
      return ok({})
    }

    // GraphQL은 항상 JSON 응답
    if (type === 'graphql') {
      try {
        const parsed = JSON.parse(data)
        return ok(parsed)
      } catch {
        return ok(data)
      }
    }

    // XML/SOAP 감지 및 파싱 (soap/legacy 타입이거나 XML처럼 보이는 경우)
    if (type === 'soap' || (type === 'legacy' && this.looksLikeXml(data)) || this.looksLikeXml(data)) {
      try {
        const parsed = this.options.xmlParser(data)
        return ok(parsed)
      } catch (e) {
        return err({
          type: 'PARSE_ERROR',
          message: `XML parsing failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
          phase: 'response',
          originalError: e,
        })
      }
    }

    // JSON 파싱 시도
    try {
      const parsed = JSON.parse(data)
      return ok(parsed)
    } catch {
      // 파싱 실패시 원본 문자열 반환
      return ok(data)
    }
  }

  /**
   * XML 형식인지 간단히 체크
   */
  private looksLikeXml(data: string): boolean {
    const trimmed = data.trim()
    return trimmed.startsWith('<?xml') || trimmed.startsWith('<')
  }

  /**
   * TransformPipeline을 TransformStepConfig 배열로 변환
   */
  private convertPipelineToSteps(pipeline: TransformPipeline): TransformStepConfig[] {
    return pipeline.steps.map((step) => ({
      operation: step.operation,
      config: step.config,
    }))
  }
}

// ============================================================================
// Default XML Parser
// ============================================================================

/**
 * 기본 XML 파서 (간단한 구현)
 * 실제 프로덕션에서는 fast-xml-parser 등 사용 권장
 */
const defaultXmlParser = (xml: string): Record<string, unknown> => {
  // XML 선언 제거
  const cleanXml = xml.replace(/<\?xml[^?]*\?>/g, '').trim()

  // SOAP Envelope 처리
  if (cleanXml.includes('soap:Envelope') || cleanXml.includes('SOAP-ENV:Envelope')) {
    const bodyMatch = cleanXml.match(/<(?:soap:|SOAP-ENV:)?Body[^>]*>([\s\S]*?)<\/(?:soap:|SOAP-ENV:)?Body>/i)
    if (bodyMatch && bodyMatch[1]) {
      return parseXmlNode(bodyMatch[1].trim())
    }
  }

  return parseXmlNode(cleanXml)
}

/**
 * XML 노드를 재귀적으로 파싱
 */
const parseXmlNode = (xml: string): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  // 태그 매칭 정규식
  const tagRegex = /<(\w+)(?:\s[^>]*)?>([^<]*(?:(?!<\1)[^<]*)*)<\/\1>/g
  let match

  while ((match = tagRegex.exec(xml)) !== null) {
    const tagName = match[1]
    const content = match[2]

    if (!tagName || content === undefined) continue

    const trimmedContent = content.trim()

    // 내부에 더 많은 태그가 있으면 재귀 파싱
    if (trimmedContent.includes('<')) {
      const parsed = parseXmlNode(trimmedContent)

      // 같은 이름의 태그가 여러 개면 배열로
      if (tagName in result) {
        if (!Array.isArray(result[tagName])) {
          result[tagName] = [result[tagName]]
        }
        (result[tagName] as unknown[]).push(parsed)
      } else {
        result[tagName] = parsed
      }
    } else {
      // 텍스트 노드
      if (tagName in result) {
        if (!Array.isArray(result[tagName])) {
          result[tagName] = [result[tagName]]
        }
        (result[tagName] as unknown[]).push(trimmedContent)
      } else {
        result[tagName] = trimmedContent
      }
    }
  }

  return result
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * 새 어댑터 생성
 */
export const createLegacyAdapter = (options?: LegacyAdapterOptions): LegacyAdapter => {
  return new LegacyAdapter(options)
}

/**
 * 단일 요청 변환 (간편 함수)
 */
export const transformRequest = <T = unknown>(
  data: unknown,
  config: AdapterConfig,
  options?: LegacyAdapterOptions
): Result<T, AdapterError> => {
  const adapter = createLegacyAdapter(options)
  return adapter.transformRequest<T>(data, config)
}

/**
 * 단일 응답 변환 (간편 함수)
 */
export const transformResponse = <T = unknown>(
  data: unknown,
  config: AdapterConfig,
  options?: LegacyAdapterOptions
): Result<T, AdapterError> => {
  const adapter = createLegacyAdapter(options)
  return adapter.transformResponse<T>(data, config)
}

// ============================================================================
// Preset Adapters
// ============================================================================

/**
 * 자주 사용되는 어댑터 프리셋
 */
export const adapterPresets = {
  /**
   * SOAP to JSON 어댑터
   */
  soap: (responseBodyPath?: string): AdapterConfig => ({
    type: 'soap',
    responseTransform: responseBodyPath
      ? {
          steps: [
            {
              _step: 'transform',
              id: 'extractBody',
              operation: 'custom',
              config: {
                transform: (data: unknown) => {
                  if (!data || typeof data !== 'object') return data
                  const parts = responseBodyPath.split('.')
                  let current: unknown = data
                  for (const part of parts) {
                    if (current && typeof current === 'object') {
                      current = (current as Record<string, unknown>)[part]
                    }
                  }
                  return current
                },
              },
            },
          ],
        }
      : undefined,
  }),

  /**
   * 레거시 ERP 응답을 표준 형식으로 변환
   */
  legacyErp: (fieldMappings: Record<string, string>): AdapterConfig => ({
    type: 'legacy',
    responseTransform: {
      steps: [
        {
          _step: 'transform',
          id: 'mapFields',
          operation: 'map',
          config: {
            mappings: fieldMappings,
          },
        },
      ],
    },
  }),

  /**
   * GraphQL 응답 어댑터
   */
  graphql: (dataPath: string): AdapterConfig => ({
    type: 'graphql',
    responseTransform: {
      steps: [
        {
          _step: 'transform',
          id: 'extractData',
          operation: 'custom',
          config: {
            transform: (data: unknown) => {
              if (!data || typeof data !== 'object') return data
              const parts = dataPath.split('.')
              let current: unknown = data
              for (const part of parts) {
                if (current && typeof current === 'object') {
                  current = (current as Record<string, unknown>)[part]
                }
              }
              return current
            },
          },
        },
      ],
    },
  }),
}
