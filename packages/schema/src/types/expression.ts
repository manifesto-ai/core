/**
 * Expression Types - Mapbox Style Expression 기반 안전한 표현식 시스템
 *
 * eval() 없이 배열 기반 AST로 표현식을 정의하고 평가
 * 모든 연산자는 화이트리스트로 관리되어 코드 인젝션 방지
 */

// ============================================================================
// Context References - 런타임에 참조 가능한 변수들
// ============================================================================

export type ContextReference =
  | `$state.${string}` // 현재 폼 상태
  | `$context.${string}` // 앱 컨텍스트 (브랜드/환경 설정 등)
  | `$user.${string}` // 유저 정보
  | `$params.${string}` // URL/라우트 파라미터
  | `$result.${string}` // 이전 액션의 결과
  | `$env.${string}` // 환경 변수 (화이트리스트)

// ============================================================================
// Literal Types
// ============================================================================

export type Literal = string | number | boolean | null

// ============================================================================
// Comparison Operators
// ============================================================================

export type EqExpression = ['==', Expression, Expression]
export type NeqExpression = ['!=', Expression, Expression]
export type GtExpression = ['>', Expression, Expression]
export type GteExpression = ['>=', Expression, Expression]
export type LtExpression = ['<', Expression, Expression]
export type LteExpression = ['<=', Expression, Expression]

export type ComparisonExpression =
  | EqExpression
  | NeqExpression
  | GtExpression
  | GteExpression
  | LtExpression
  | LteExpression

// ============================================================================
// Logical Operators
// ============================================================================

export type AndExpression = ['AND', ...Expression[]]
export type OrExpression = ['OR', ...Expression[]]
export type NotExpression = ['NOT', Expression]

export type LogicalExpression = AndExpression | OrExpression | NotExpression

// ============================================================================
// Collection Operators
// ============================================================================

export type InExpression = ['IN', Expression, Expression[]]
export type NotInExpression = ['NOT_IN', Expression, Expression[]]
export type ContainsExpression = ['CONTAINS', Expression, Expression]
export type IsEmptyExpression = ['IS_EMPTY', Expression]
export type LengthExpression = ['LENGTH', Expression]

export type CollectionExpression =
  | InExpression
  | NotInExpression
  | ContainsExpression
  | IsEmptyExpression
  | LengthExpression

// ============================================================================
// String Operators
// ============================================================================

export type ConcatExpression = ['CONCAT', ...Expression[]]
export type UpperExpression = ['UPPER', Expression]
export type LowerExpression = ['LOWER', Expression]
export type TrimExpression = ['TRIM', Expression]
export type StartsWithExpression = ['STARTS_WITH', Expression, Expression]
export type EndsWithExpression = ['ENDS_WITH', Expression, Expression]
export type MatchExpression = ['MATCH', Expression, string] // string은 정규식 패턴

export type StringExpression =
  | ConcatExpression
  | UpperExpression
  | LowerExpression
  | TrimExpression
  | StartsWithExpression
  | EndsWithExpression
  | MatchExpression

// ============================================================================
// Numeric Operators
// ============================================================================

export type AddExpression = ['+', Expression, Expression]
export type SubExpression = ['-', Expression, Expression]
export type MulExpression = ['*', Expression, Expression]
export type DivExpression = ['/', Expression, Expression]
export type ModExpression = ['%', Expression, Expression]
export type AbsExpression = ['ABS', Expression]
export type RoundExpression = ['ROUND', Expression, Expression?] // 두번째는 소수점 자릿수
export type FloorExpression = ['FLOOR', Expression]
export type CeilExpression = ['CEIL', Expression]
export type MinExpression = ['MIN', ...Expression[]]
export type MaxExpression = ['MAX', ...Expression[]]

export type NumericExpression =
  | AddExpression
  | SubExpression
  | MulExpression
  | DivExpression
  | ModExpression
  | AbsExpression
  | RoundExpression
  | FloorExpression
  | CeilExpression
  | MinExpression
  | MaxExpression

// ============================================================================
// Conditional Operators
// ============================================================================

export type IfExpression = ['IF', Expression, Expression, Expression] // condition, then, else
export type CaseExpression = ['CASE', ...[Expression, Expression][], Expression] // pairs + default
export type CoalesceExpression = ['COALESCE', ...Expression[]] // 첫 번째 non-null 반환

export type ConditionalExpression =
  | IfExpression
  | CaseExpression
  | CoalesceExpression

// ============================================================================
// Type Checking Operators
// ============================================================================

export type IsNullExpression = ['IS_NULL', Expression]
export type IsNotNullExpression = ['IS_NOT_NULL', Expression]
export type TypeOfExpression = ['TYPE_OF', Expression]

export type TypeExpression = IsNullExpression | IsNotNullExpression | TypeOfExpression

// ============================================================================
// Object Access Operators
// ============================================================================

export type GetExpression = ['GET', Expression, string] // object, key
export type GetPathExpression = ['GET_PATH', Expression, string] // object, dot.path.notation

export type AccessExpression = GetExpression | GetPathExpression

// ============================================================================
// Date Operators
// ============================================================================

export type NowExpression = ['NOW']
export type TodayExpression = ['TODAY']
export type DateDiffExpression = ['DATE_DIFF', Expression, Expression, 'days' | 'hours' | 'minutes']
export type DateAddExpression = ['DATE_ADD', Expression, number, 'days' | 'hours' | 'minutes']
export type FormatDateExpression = ['FORMAT_DATE', Expression, string]

export type DateExpression =
  | NowExpression
  | TodayExpression
  | DateDiffExpression
  | DateAddExpression
  | FormatDateExpression

// ============================================================================
// Unified Expression Type
// ============================================================================

export type Expression =
  | Literal
  | ContextReference
  | ComparisonExpression
  | LogicalExpression
  | CollectionExpression
  | StringExpression
  | NumericExpression
  | ConditionalExpression
  | TypeExpression
  | AccessExpression
  | DateExpression

// ============================================================================
// Expression Type Guards
// ============================================================================

export const isLiteral = (expr: Expression): expr is Literal =>
  typeof expr === 'string' ||
  typeof expr === 'number' ||
  typeof expr === 'boolean' ||
  expr === null

export const isContextReference = (expr: Expression): expr is ContextReference =>
  typeof expr === 'string' && expr.startsWith('$')

export const isExpressionArray = (expr: unknown): expr is unknown[] =>
  Array.isArray(expr)

// ============================================================================
// Operator Registry - 화이트리스트
// ============================================================================

export const ALLOWED_OPERATORS = [
  // Comparison
  '==', '!=', '>', '>=', '<', '<=',
  // Logical
  'AND', 'OR', 'NOT',
  // Collection
  'IN', 'NOT_IN', 'CONTAINS', 'IS_EMPTY', 'LENGTH',
  // String
  'CONCAT', 'UPPER', 'LOWER', 'TRIM', 'STARTS_WITH', 'ENDS_WITH', 'MATCH',
  // Numeric
  '+', '-', '*', '/', '%', 'ABS', 'ROUND', 'FLOOR', 'CEIL', 'MIN', 'MAX',
  // Conditional
  'IF', 'CASE', 'COALESCE',
  // Type
  'IS_NULL', 'IS_NOT_NULL', 'TYPE_OF',
  // Access
  'GET', 'GET_PATH',
  // Date
  'NOW', 'TODAY', 'DATE_DIFF', 'DATE_ADD', 'FORMAT_DATE',
] as const

export type Operator = (typeof ALLOWED_OPERATORS)[number]

export const isAllowedOperator = (op: string): op is Operator =>
  (ALLOWED_OPERATORS as readonly string[]).includes(op)
