/**
 * Typed Expression Builder
 *
 * Domain entity 타입을 제네릭으로 주입하여
 * - 필드명 오타
 * - 타입 불일치 비교
 * 를 컴파일 타임에 차단하는 표현식 빌더.
 */

import type { ContextReference, Expression, Literal } from '../types'

// ============================================================================
// Type Utilities
// ============================================================================

type DotPrefix<T extends string> = T extends '' ? '' : `.${T}`

type Tail<Arr extends readonly unknown[]> = Arr extends [unknown, ...infer Rest]
  ? Rest
  : []

type FieldPath<T, Depth extends readonly unknown[] = [1, 1, 1]> = Depth['length'] extends 0
  ? never
  : T extends Record<string, unknown>
    ? {
        [K in keyof T & string]:
          | K
          | (NonNullable<T[K]> extends Record<string, unknown>
              ? NonNullable<T[K]> extends readonly unknown[]
                ? K
                : `${K}${DotPrefix<FieldPath<NonNullable<T[K]>, Tail<Depth>>>}`
              : never)
      }[keyof T & string]
    : never

type PathValue<T, P extends string, Depth extends readonly unknown[] = [1, 1, 1]> =
  Depth['length'] extends 0
    ? never
    : P extends `${infer Head}.${infer Rest}`
      ? Head extends keyof T
        ? PathValue<T[Head], Rest, Tail<Depth>>
        : never
      : P extends keyof T
        ? T[P]
        : never

type Narrow<T> = Exclude<T, null | undefined>

type BuilderFor<T> = [Narrow<T>] extends [never]
  ? BaseExprBuilder<unknown>
  : Narrow<T> extends number
    ? NumberExprBuilder
    : Narrow<T> extends string
      ? StringExprBuilder
      : Narrow<T> extends readonly (infer E)[]
        ? ArrayExprBuilder<E>
        : BaseExprBuilder<Narrow<T>>

type Operand<T> = [Narrow<T>] extends [never]
  ? never
  : Narrow<T> | BuilderFor<T>

type ExpressionInput = Expression | LogicBuilder

// ============================================================================
// Builder Interfaces
// ============================================================================

export interface LogicBuilder {
  and(...exprs: ExpressionInput[]): LogicBuilder
  or(...exprs: ExpressionInput[]): LogicBuilder
  build(): Expression
  getAST(): Expression
}

export interface BaseExprBuilder<T> extends LogicBuilder {
  is(value: Operand<T>): LogicBuilder
  not(value: Operand<T>): LogicBuilder
  in(values: readonly Operand<T>[]): LogicBuilder
}

export interface NumberExprBuilder extends BaseExprBuilder<number> {
  gt(value: Operand<number>): LogicBuilder
  gte(value: Operand<number>): LogicBuilder
  lt(value: Operand<number>): LogicBuilder
  lte(value: Operand<number>): LogicBuilder
}

export interface StringExprBuilder extends BaseExprBuilder<string> {
  contains(value: Operand<string>): LogicBuilder
  startsWith(value: Operand<string>): LogicBuilder
  endsWith(value: Operand<string>): LogicBuilder
  matches(pattern: RegExp | string): LogicBuilder
}

export interface ArrayExprBuilder<E> extends BaseExprBuilder<readonly E[]> {
  contains(value: Operand<E>): LogicBuilder
  isEmpty(): LogicBuilder
  length(): NumberExprBuilder
}

export interface TypedExpression<TSchema> {
  /** $state.fieldName */
  field<Path extends FieldPath<TSchema>>(
    path: Path
  ): BuilderFor<PathValue<TSchema, Path>>
  /** 값 리터럴 */
  val<V extends Literal>(value: V): BuilderFor<V>
  /** 임의의 Expression AST를 래핑 */
  raw(expression: Expression): LogicBuilder
  /** 기타 컨텍스트 참조 ($context / $user / $params / $result / $env) */
  context(path: string): BaseExprBuilder<unknown>
  user(path: string): BaseExprBuilder<unknown>
  params(path: string): BaseExprBuilder<unknown>
  result(path: string): BaseExprBuilder<unknown>
  env(path: string): BaseExprBuilder<unknown>
  and(...exprs: ExpressionInput[]): LogicBuilder
  or(...exprs: ExpressionInput[]): LogicBuilder
}

// ============================================================================
// Implementation
// ============================================================================

const isBuilder = (value: unknown): value is LogicBuilder =>
  typeof (value as { getAST?: unknown })?.getAST === 'function'

const toExpression = (value: ExpressionInput): Expression =>
  isBuilder(value) ? value.build() : value

const unwrapOperand = (value: any): Expression =>
  isBuilder(value) ? value.build() : (value as Expression)

class ExprBuilderImpl
  implements NumberExprBuilder, StringExprBuilder, ArrayExprBuilder<unknown>, LogicBuilder
{
  constructor(private readonly current: Expression) {}

  build(): Expression {
    return this.current
  }

  getAST(): Expression {
    return this.current
  }

  // Comparison
  is(value: any): LogicBuilder {
    return new ExprBuilderImpl(['==', this.current, unwrapOperand(value)])
  }

  not(value: any): LogicBuilder {
    return new ExprBuilderImpl(['!=', this.current, unwrapOperand(value)])
  }

  in(values: readonly any[]): LogicBuilder {
    return new ExprBuilderImpl([
      'IN',
      this.current,
      values.map((v) => unwrapOperand(v)),
    ])
  }

  // Number-only
  gt(value: any): LogicBuilder {
    return new ExprBuilderImpl(['>', this.current, unwrapOperand(value)])
  }

  gte(value: any): LogicBuilder {
    return new ExprBuilderImpl(['>=', this.current, unwrapOperand(value)])
  }

  lt(value: any): LogicBuilder {
    return new ExprBuilderImpl(['<', this.current, unwrapOperand(value)])
  }

  lte(value: any): LogicBuilder {
    return new ExprBuilderImpl(['<=', this.current, unwrapOperand(value)])
  }

  // String-only
  contains(value: any): LogicBuilder {
    return new ExprBuilderImpl(['CONTAINS', this.current, unwrapOperand(value)])
  }

  startsWith(value: any): LogicBuilder {
    return new ExprBuilderImpl([
      'STARTS_WITH',
      this.current,
      unwrapOperand(value),
    ])
  }

  endsWith(value: any): LogicBuilder {
    return new ExprBuilderImpl([
      'ENDS_WITH',
      this.current,
      unwrapOperand(value),
    ])
  }

  matches(pattern: RegExp | string): LogicBuilder {
    const normalized = typeof pattern === 'string' ? pattern : pattern.source
    return new ExprBuilderImpl(['MATCH', this.current, normalized])
  }

  // Array-only
  isEmpty(): LogicBuilder {
    return new ExprBuilderImpl(['IS_EMPTY', this.current])
  }

  length(): NumberExprBuilder {
    return new ExprBuilderImpl(['LENGTH', this.current])
  }

  // Logic chaining
  and(...exprs: ExpressionInput[]): LogicBuilder {
    return new ExprBuilderImpl(['AND', this.current, ...exprs.map(toExpression)])
  }

  or(...exprs: ExpressionInput[]): LogicBuilder {
    return new ExprBuilderImpl(['OR', this.current, ...exprs.map(toExpression)])
  }
}

// ============================================================================
// Factory
// ============================================================================

export const createTypedExpression = <TSchema>(): TypedExpression<TSchema> => ({
  field: (path) =>
    new ExprBuilderImpl(`$state.${path}` as ContextReference) as unknown as BuilderFor<
      PathValue<TSchema, typeof path>
    >,

  val: (value) =>
    new ExprBuilderImpl(value) as unknown as BuilderFor<Exclude<typeof value, undefined>>,

  raw: (expression) => new ExprBuilderImpl(expression),

  context: (path) =>
    new ExprBuilderImpl(`$context.${path}` as ContextReference),

  user: (path) => new ExprBuilderImpl(`$user.${path}` as ContextReference),

  params: (path) => new ExprBuilderImpl(`$params.${path}` as ContextReference),

  result: (path) => new ExprBuilderImpl(`$result.${path}` as ContextReference),

  env: (path) => new ExprBuilderImpl(`$env.${path}` as ContextReference),

  and: (...exprs) => new ExprBuilderImpl(['AND', ...exprs.map(toExpression)]),

  or: (...exprs) => new ExprBuilderImpl(['OR', ...exprs.map(toExpression)]),
})

export type { FieldPath, PathValue, BuilderFor }
