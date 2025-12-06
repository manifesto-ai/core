import { describe, expect, expectTypeOf, test } from 'vitest'
import {
  createTypedExpression,
  type ArrayExprBuilder,
  type NumberExprBuilder,
  type StringExprBuilder,
} from '../typed-expression'

type Product = {
  name: string
  price: number
  status: 'ACTIVE' | 'SOLD_OUT'
  tags: string[]
}

const expr = createTypedExpression<Product>()

// @ts-expect-error invalid field name should be rejected
expr.field('pricee')

// @ts-expect-error string fields do not expose numeric operators
expr.field('name').gt(10)

// @ts-expect-error enum literal must match the union
expr.field('status').is('DELETED')

// @ts-expect-error array element type mismatch
expr.field('tags').contains(123)

// @ts-expect-error collection helpers are not on number fields
expr.field('price').contains('SALE')

describe('Typed Expression Builder', () => {
  test('builds typed comparison and logic AST', () => {
    const visibility = expr
      .field('status')
      .is('ACTIVE')
      .and(expr.field('price').gt(0))

    expect(visibility.getAST()).toEqual([
      'AND',
      ['==', '$state.status', 'ACTIVE'],
      ['>', '$state.price', 0],
    ])
  })

  test('supports array helpers with element typing', () => {
    const hasTag = expr.field('tags').contains('NEW')
    const isEmpty = expr.field('tags').isEmpty()
    const length = expr.field('tags').length().gt(1)

    expectTypeOf(expr.field('tags')).toMatchTypeOf<ArrayExprBuilder<string>>()
    expectTypeOf(length).toMatchTypeOf<NumberExprBuilder>()

    expect(hasTag.getAST()).toEqual([
      'CONTAINS',
      '$state.tags',
      'NEW',
    ])
    expect(isEmpty.getAST()).toEqual(['IS_EMPTY', '$state.tags'])
    expect(length.getAST()).toEqual(['>', ['LENGTH', '$state.tags'], 1])
  })

  test('string helpers stay type-safe', () => {
    const starts = expr.field('name').startsWith('PROD-')
    const match = expr.field('name').matches(/^SKU-\d+$/)

    expect(starts.getAST()).toEqual([
      'STARTS_WITH',
      '$state.name',
      'PROD-',
    ])
    expect(match.getAST()).toEqual(['MATCH', '$state.name', '^SKU-\\d+$'])
  })

  test('union literals and optional/nullable types stay narrowed', () => {
    expectTypeOf(expr.field('status')).toMatchTypeOf<StringExprBuilder>()
    const statusAst = expr.field('status').is('ACTIVE').build()
    expect(statusAst).toEqual(['==', '$state.status', 'ACTIVE'])

    type Optional = { price?: number | null }
    const optionalExpr = createTypedExpression<Optional>()
    expectTypeOf(optionalExpr.field('price')).toMatchTypeOf<NumberExprBuilder>()
    expect(optionalExpr.field('price').gte(0).getAST()).toEqual([
      '>=',
      '$state.price',
      0,
    ])
  })

  test('array of objects are typed and forbid deep dot paths', () => {
    type WithItems = { items: { id: string; qty: number }[] }
    const itemExpr = createTypedExpression<WithItems>()

    expectTypeOf(itemExpr.field('items')).toMatchTypeOf<
      ArrayExprBuilder<{ id: string; qty: number }>
    >()

    const containsAst = itemExpr.field('items').contains({ id: 'sku1', qty: 2 }).build()
    expect(containsAst).toEqual([
      'CONTAINS',
      '$state.items',
      { id: 'sku1', qty: 2 },
    ])

    // @ts-expect-error array element deep paths are not allowed
    itemExpr.field('items.id')
  })

  test('val and raw helpers bridge literal and custom expressions', () => {
    const literal = expr.val(42)
    expectTypeOf(expr.val('x')).toMatchTypeOf<StringExprBuilder>()
    expectTypeOf(expr.val(1)).toMatchTypeOf<NumberExprBuilder>()

    const combined = expr.raw(['NOT', literal.build()]).or(
      expr.field('price').lte(100)
    )

    expect(literal.getAST()).toBe(42)
    expect(combined.getAST()).toEqual(['OR', ['NOT', 42], ['<=', '$state.price', 100]])
  })

  test('infers nested field paths', () => {
    type Nested = { meta: { code: string } }
    const nested = createTypedExpression<Nested>()

    expectTypeOf(nested.field('meta.code')).toMatchTypeOf<StringExprBuilder>()

    // @ts-expect-error nested path must exist
    nested.field('meta.missing')
  })
})
