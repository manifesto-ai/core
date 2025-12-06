/**
 * Generator Base - Monadic Generator Interface
 *
 * 모든 Generator의 기반이 되는 인터페이스와 구현
 * Functor/Monad 패턴을 적용하여 합성 가능한 구조 제공
 */

import type { Result } from '@manifesto-ai/schema'
import { ok, isOk } from '@manifesto-ai/schema'
import type { AIClient } from '../core/client'
import type {
  AIGeneratorError,
  GeneratorContext,
  GenerationResult,
  GeneratorOptions,
} from '../types'

// ============================================================================
// Generator Interface (Functor + Monad)
// ============================================================================

/**
 * Generator 인터페이스
 *
 * @template TInput - Generator 입력 타입
 * @template TOutput - Generator 출력 타입
 *
 * @example
 * ```typescript
 * // 기본 사용
 * const result = await entityGenerator.generate(input, context, client)
 *
 * // map으로 결과 변환
 * const transformed = entityGenerator.map(entity => entity.fields.length)
 *
 * // flatMap으로 체이닝
 * const chained = entityGenerator.flatMap(entity =>
 *   listGenerator.withContext({ entity })
 * )
 *
 * // zip으로 병렬 실행
 * const parallel = entityGenerator.zip(configGenerator)
 * ```
 */
export interface Generator<TInput, TOutput> {
  readonly _tag: string
  readonly options: GeneratorOptions

  /**
   * Generator 실행
   */
  generate(
    input: TInput,
    context: GeneratorContext,
    client: AIClient
  ): Promise<Result<GenerationResult<TOutput>, AIGeneratorError>>

  /**
   * Functor: 성공 결과에 함수 적용
   */
  map<U>(f: (output: TOutput) => U): Generator<TInput, U>

  /**
   * Monad: 체이닝 (결과를 다른 Generator에 전달)
   */
  flatMap<U>(f: (output: TOutput) => Generator<TOutput, U>): Generator<TInput, U>

  /**
   * Applicative: 두 Generator 병렬 실행
   */
  zip<U>(other: Generator<TInput, U>): Generator<TInput, [TOutput, U]>

  /**
   * 옵션 변경 (새 인스턴스 반환 - 불변성)
   */
  withOptions(options: Partial<GeneratorOptions>): Generator<TInput, TOutput>

  /**
   * 컨텍스트 오버라이드 (새 인스턴스 반환)
   */
  withContext(contextOverride: Partial<GeneratorContext>): Generator<TInput, TOutput>
}

// ============================================================================
// Generator Implementation
// ============================================================================

type GenerateFn<TInput, TOutput> = (
  input: TInput,
  context: GeneratorContext,
  client: AIClient,
  options: GeneratorOptions
) => Promise<Result<GenerationResult<TOutput>, AIGeneratorError>>

class GeneratorImpl<TInput, TOutput> implements Generator<TInput, TOutput> {
  constructor(
    readonly _tag: string,
    readonly options: GeneratorOptions,
    private readonly generateFn: GenerateFn<TInput, TOutput>,
    private readonly contextOverride?: Partial<GeneratorContext>
  ) {}

  async generate(
    input: TInput,
    context: GeneratorContext,
    client: AIClient
  ): Promise<Result<GenerationResult<TOutput>, AIGeneratorError>> {
    const mergedContext = this.contextOverride
      ? { ...context, ...this.contextOverride }
      : context

    return this.generateFn(input, mergedContext, client, this.options)
  }

  map<U>(f: (output: TOutput) => U): Generator<TInput, U> {
    return new GeneratorImpl<TInput, U>(
      `${this._tag}.map`,
      this.options,
      async (input, context, client, options) => {
        const result = await this.generateFn(input, context, client, options)
        if (!isOk(result)) return result

        return ok({
          value: f(result.value.value),
          metadata: result.value.metadata,
        })
      },
      this.contextOverride
    )
  }

  flatMap<U>(f: (output: TOutput) => Generator<TOutput, U>): Generator<TInput, U> {
    return new GeneratorImpl<TInput, U>(
      `${this._tag}.flatMap`,
      this.options,
      async (input, context, client, options) => {
        const firstResult = await this.generateFn(input, context, client, options)
        if (!isOk(firstResult)) return firstResult

        const nextGenerator = f(firstResult.value.value)
        const secondResult = await nextGenerator.generate(
          firstResult.value.value,
          context,
          client
        )

        if (!isOk(secondResult)) return secondResult

        // Merge metadata
        return ok({
          value: secondResult.value.value,
          metadata: {
            ...secondResult.value.metadata,
            tokensUsed: {
              prompt:
                firstResult.value.metadata.tokensUsed.prompt +
                secondResult.value.metadata.tokensUsed.prompt,
              completion:
                firstResult.value.metadata.tokensUsed.completion +
                secondResult.value.metadata.tokensUsed.completion,
              total:
                firstResult.value.metadata.tokensUsed.total +
                secondResult.value.metadata.tokensUsed.total,
            },
            latencyMs:
              firstResult.value.metadata.latencyMs + secondResult.value.metadata.latencyMs,
          },
        })
      },
      this.contextOverride
    )
  }

  zip<U>(other: Generator<TInput, U>): Generator<TInput, [TOutput, U]> {
    return new GeneratorImpl<TInput, [TOutput, U]>(
      `${this._tag}.zip(${other._tag})`,
      this.options,
      async (input, context, client, options) => {
        // 병렬 실행
        const [firstResult, secondResult] = await Promise.all([
          this.generateFn(input, context, client, options),
          other.generate(input, context, client),
        ])

        if (!isOk(firstResult)) return firstResult
        if (!isOk(secondResult)) return secondResult

        return ok({
          value: [firstResult.value.value, secondResult.value.value] as [TOutput, U],
          metadata: {
            ...firstResult.value.metadata,
            tokensUsed: {
              prompt:
                firstResult.value.metadata.tokensUsed.prompt +
                secondResult.value.metadata.tokensUsed.prompt,
              completion:
                firstResult.value.metadata.tokensUsed.completion +
                secondResult.value.metadata.tokensUsed.completion,
              total:
                firstResult.value.metadata.tokensUsed.total +
                secondResult.value.metadata.tokensUsed.total,
            },
            latencyMs: Math.max(
              firstResult.value.metadata.latencyMs,
              secondResult.value.metadata.latencyMs
            ),
          },
        })
      },
      this.contextOverride
    )
  }

  withOptions(newOptions: Partial<GeneratorOptions>): Generator<TInput, TOutput> {
    return new GeneratorImpl(
      this._tag,
      { ...this.options, ...newOptions },
      this.generateFn,
      this.contextOverride
    )
  }

  withContext(contextOverride: Partial<GeneratorContext>): Generator<TInput, TOutput> {
    return new GeneratorImpl(
      this._tag,
      this.options,
      this.generateFn,
      { ...this.contextOverride, ...contextOverride }
    )
  }
}

// ============================================================================
// Factory Function
// ============================================================================

const DEFAULT_OPTIONS: GeneratorOptions = {
  temperature: 0.3,
  maxTokens: 4096,
  maxRetries: 3,
  timeout: 30000,
  customPrompt: '',
  validate: true,
}

/**
 * Generator 생성 팩토리 함수
 *
 * @example
 * ```typescript
 * const myGenerator = createGenerator(
 *   'MyGenerator',
 *   async (input, context, client, options) => {
 *     const result = await client.generateObject({
 *       schema: MySchema,
 *       prompt: buildPrompt(input),
 *       temperature: options.temperature,
 *     })
 *
 *     if (result._tag === 'Err') return result
 *
 *     return ok({
 *       value: mapToOutput(result.value.value),
 *       metadata: result.value.metadata,
 *     })
 *   }
 * )
 * ```
 */
export const createGenerator = <TInput, TOutput>(
  tag: string,
  generateFn: GenerateFn<TInput, TOutput>,
  defaultOptions: Partial<GeneratorOptions> = {}
): Generator<TInput, TOutput> => {
  return new GeneratorImpl(tag, { ...DEFAULT_OPTIONS, ...defaultOptions }, generateFn)
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 여러 Generator를 순차 실행
 */
export const sequence = <T, U>(
  generators: Generator<T, U>[]
): Generator<T, U[]> => {
  return createGenerator(
    'sequence',
    async (input, context, client, _options) => {
      const results: U[] = []
      let totalMetadata = {
        model: '',
        provider: '',
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
        latencyMs: 0,
        cached: false,
      }

      for (const gen of generators) {
        const result = await gen.generate(input, context, client)
        if (!isOk(result)) return result

        results.push(result.value.value)
        totalMetadata = {
          ...totalMetadata,
          model: result.value.metadata.model,
          provider: result.value.metadata.provider,
          tokensUsed: {
            prompt: totalMetadata.tokensUsed.prompt + result.value.metadata.tokensUsed.prompt,
            completion:
              totalMetadata.tokensUsed.completion + result.value.metadata.tokensUsed.completion,
            total: totalMetadata.tokensUsed.total + result.value.metadata.tokensUsed.total,
          },
          latencyMs: totalMetadata.latencyMs + result.value.metadata.latencyMs,
        }
      }

      return ok({
        value: results,
        metadata: totalMetadata,
      })
    }
  )
}

/**
 * 여러 Generator를 병렬 실행
 */
export const parallel = <T, U>(
  generators: Generator<T, U>[]
): Generator<T, U[]> => {
  return createGenerator(
    'parallel',
    async (input, context, client, _options) => {
      const promises = generators.map((gen) => gen.generate(input, context, client))
      const results = await Promise.all(promises)

      const values: U[] = []
      let totalMetadata = {
        model: '',
        provider: '',
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
        latencyMs: 0,
        cached: false,
      }

      for (const result of results) {
        if (!isOk(result)) return result

        values.push(result.value.value)
        totalMetadata = {
          ...totalMetadata,
          model: result.value.metadata.model,
          provider: result.value.metadata.provider,
          tokensUsed: {
            prompt: totalMetadata.tokensUsed.prompt + result.value.metadata.tokensUsed.prompt,
            completion:
              totalMetadata.tokensUsed.completion + result.value.metadata.tokensUsed.completion,
            total: totalMetadata.tokensUsed.total + result.value.metadata.tokensUsed.total,
          },
          latencyMs: Math.max(totalMetadata.latencyMs, result.value.metadata.latencyMs),
        }
      }

      return ok({
        value: values,
        metadata: totalMetadata,
      })
    }
  )
}
