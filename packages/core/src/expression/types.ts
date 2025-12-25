/**
 * Expression DSL Types
 *
 * MapGL-like 선언적 표현식 언어
 * - JSON-serializable (코드가 아닌 데이터)
 * - Side-effect 없음 (순수 함수)
 * - 정적 분석 가능 (의존성 추출, AI 파싱)
 */

import type { SemanticPath } from '../domain/types.js';

// =============================================================================
// Literals
// =============================================================================

/** 리터럴 값 */
export type LiteralExpr = string | number | boolean | null;

// =============================================================================
// Value Access
// =============================================================================

/** 경로로 값 읽기 */
export type GetExpr = ['get', SemanticPath];

// =============================================================================
// Operators
// =============================================================================

/** 비교 연산자 */
export type EqExpr = ['==', Expression, Expression];
export type NeqExpr = ['!=', Expression, Expression];
export type GtExpr = ['>', Expression, Expression];
export type GteExpr = ['>=', Expression, Expression];
export type LtExpr = ['<', Expression, Expression];
export type LteExpr = ['<=', Expression, Expression];

export type ComparisonExpr = EqExpr | NeqExpr | GtExpr | GteExpr | LtExpr | LteExpr;

/** 논리 연산자 */
export type NotExpr = ['!', Expression];
export type AllExpr = ['all', ...Expression[]];
export type AnyExpr = ['any', ...Expression[]];

export type LogicalExpr = NotExpr | AllExpr | AnyExpr;

/** 산술 연산자 */
export type AddExpr = ['+', Expression, Expression];
export type SubExpr = ['-', Expression, Expression];
export type MulExpr = ['*', Expression, Expression];
export type DivExpr = ['/', Expression, Expression];
export type ModExpr = ['%', Expression, Expression];

export type ArithmeticExpr = AddExpr | SubExpr | MulExpr | DivExpr | ModExpr;

// =============================================================================
// Conditional
// =============================================================================

/** Case clause: [condition, result] */
export type CaseClause = [Expression, Expression];

/** Match clause: [pattern, result] */
export type MatchClause = [Expression, Expression];

/** case: if-else chain */
export type CaseExpr = ['case', ...CaseClause[], Expression];

/** match: pattern match */
export type MatchExpr = ['match', Expression, ...MatchClause[], Expression];

/** coalesce: first non-null */
export type CoalesceExpr = ['coalesce', ...Expression[]];

export type ConditionalExpr = CaseExpr | MatchExpr | CoalesceExpr;

// =============================================================================
// String Functions
// =============================================================================

export type ConcatExpr = ['concat', ...Expression[]];
export type UpperExpr = ['upper', Expression];
export type LowerExpr = ['lower', Expression];
export type TrimExpr = ['trim', Expression];
export type SliceExpr = ['slice', Expression, number, number?];
export type SplitExpr = ['split', Expression, string];
export type JoinExpr = ['join', Expression, string];
export type MatchesExpr = ['matches', Expression, string];
export type ReplaceExpr = ['replace', Expression, string, string];

export type StringFn =
  | ConcatExpr
  | UpperExpr
  | LowerExpr
  | TrimExpr
  | SliceExpr
  | SplitExpr
  | JoinExpr
  | MatchesExpr
  | ReplaceExpr;

// =============================================================================
// Array Functions
// =============================================================================

export type LengthExpr = ['length', Expression];
export type AtExpr = ['at', Expression, number];
export type FirstExpr = ['first', Expression];
export type LastExpr = ['last', Expression];
export type IncludesExpr = ['includes', Expression, Expression];
export type IndexOfExpr = ['indexOf', Expression, Expression];
export type MapExpr = ['map', Expression, Expression];
export type FilterExpr = ['filter', Expression, Expression];
export type EveryExpr = ['every', Expression, Expression];
export type SomeExpr = ['some', Expression, Expression];
export type ReduceExpr = ['reduce', Expression, Expression, Expression];
export type FlattenExpr = ['flatten', Expression];
export type UniqueExpr = ['unique', Expression];
export type SortExpr = ['sort', Expression, Expression?];
export type ReverseExpr = ['reverse', Expression];

// Tier 1: 필수 (배열 조작)
// Note: concat은 다형성으로 String & Array 모두 지원 (StringFn에 정의)
export type AppendExpr = ['append', Expression, Expression];
export type PrependExpr = ['prepend', Expression, Expression];

// Tier 2: 권장 (FP 패턴)
export type TakeExpr = ['take', Expression, Expression];
export type DropExpr = ['drop', Expression, Expression];
export type FindExpr = ['find', Expression, Expression];
export type FindIndexExpr = ['findIndex', Expression, Expression];
export type IsEmptyExpr = ['isEmpty', Expression];
export type RangeExpr = ['range', Expression, Expression];

// Tier 3: 고급 (복잡한 변환)
export type ZipExpr = ['zip', Expression, Expression];
export type PartitionExpr = ['partition', Expression, Expression];
export type GroupByExpr = ['groupBy', Expression, Expression];
export type ChunkExpr = ['chunk', Expression, Expression];
export type CompactExpr = ['compact', Expression];

export type ArrayFn =
  | LengthExpr
  | AtExpr
  | FirstExpr
  | LastExpr
  | IncludesExpr
  | IndexOfExpr
  | MapExpr
  | FilterExpr
  | EveryExpr
  | SomeExpr
  | ReduceExpr
  | FlattenExpr
  | UniqueExpr
  | SortExpr
  | ReverseExpr
  // Tier 1
  | AppendExpr
  | PrependExpr
  // Tier 2
  | TakeExpr
  | DropExpr
  | FindExpr
  | FindIndexExpr
  | IsEmptyExpr
  | RangeExpr
  // Tier 3
  | ZipExpr
  | PartitionExpr
  | GroupByExpr
  | ChunkExpr
  | CompactExpr;

// =============================================================================
// Number Functions
// =============================================================================

export type SumExpr = ['sum', Expression];
export type MinExpr = ['min', Expression];
export type MaxExpr = ['max', Expression];
export type AvgExpr = ['avg', Expression];
export type CountExpr = ['count', Expression];
export type RoundExpr = ['round', Expression, number?];
export type FloorExpr = ['floor', Expression];
export type CeilExpr = ['ceil', Expression];
export type AbsExpr = ['abs', Expression];
export type ClampExpr = ['clamp', Expression, number, number];

export type NumberFn =
  | SumExpr
  | MinExpr
  | MaxExpr
  | AvgExpr
  | CountExpr
  | RoundExpr
  | FloorExpr
  | CeilExpr
  | AbsExpr
  | ClampExpr;

// =============================================================================
// Object Functions
// =============================================================================

export type HasExpr = ['has', Expression, string];
export type KeysExpr = ['keys', Expression];
export type ValuesExpr = ['values', Expression];
export type EntriesExpr = ['entries', Expression];
export type PickExpr = ['pick', Expression, ...string[]];
export type OmitExpr = ['omit', Expression, ...string[]];
export type AssocExpr = ['assoc', Expression, string, Expression];
export type DissocExpr = ['dissoc', Expression, string];
export type MergeExpr = ['merge', ...Expression[]];

export type ObjectFn = HasExpr | KeysExpr | ValuesExpr | EntriesExpr | PickExpr | OmitExpr | AssocExpr | DissocExpr | MergeExpr;

// =============================================================================
// Type Functions
// =============================================================================

export type IsNullExpr = ['isNull', Expression];
export type IsNumberExpr = ['isNumber', Expression];
export type IsStringExpr = ['isString', Expression];
export type IsArrayExpr = ['isArray', Expression];
export type IsObjectExpr = ['isObject', Expression];
export type ToNumberExpr = ['toNumber', Expression];
export type ToStringExpr = ['toString', Expression];

export type TypeFn =
  | IsNullExpr
  | IsNumberExpr
  | IsStringExpr
  | IsArrayExpr
  | IsObjectExpr
  | ToNumberExpr
  | ToStringExpr;

// =============================================================================
// Utility Functions
// =============================================================================

export type UuidExpr = ['uuid'];

export type UtilityFn = UuidExpr;

// =============================================================================
// Date Functions
// =============================================================================

export type NowExpr = ['now'];
export type DateExpr = ['date', Expression];
export type YearExpr = ['year', Expression];
export type MonthExpr = ['month', Expression];
export type DayExpr = ['day', Expression];
export type DiffExpr = ['diff', Expression, Expression, string];

export type DateFn = NowExpr | DateExpr | YearExpr | MonthExpr | DayExpr | DiffExpr;

// =============================================================================
// Combined Expression Type
// =============================================================================

export type OperatorExpr = ComparisonExpr | LogicalExpr | ArithmeticExpr;
export type FunctionExpr =
  | ConditionalExpr
  | StringFn
  | ArrayFn
  | NumberFn
  | ObjectFn
  | TypeFn
  | UtilityFn
  | DateFn;

/**
 * Expression: MapGL-like 선언적 표현식
 */
export type Expression = LiteralExpr | GetExpr | OperatorExpr | FunctionExpr;

// =============================================================================
// Evaluation Context
// =============================================================================

/**
 * EvaluationContext: Expression 평가에 필요한 컨텍스트
 */
export type EvaluationContext = {
  /** 모든 경로의 값을 조회하는 함수 */
  get: (path: SemanticPath) => unknown;

  /** 현재 컨텍스트 값 (map/filter 내부에서 사용) */
  current?: unknown;

  /** 현재 인덱스 (map/filter 내부에서 사용) */
  index?: number;

  /** 누적값 (reduce에서 사용) */
  accumulator?: unknown;
};
