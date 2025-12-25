/**
 * Expression Operator Metadata
 *
 * Comprehensive metadata for all Expression DSL operators.
 * Used for UI rendering, validation, and documentation.
 */

import type { OperatorMeta, OperatorCategory } from "./types";

/**
 * All operators organized by category
 */
export const OPERATORS: Record<string, OperatorMeta> = {
  // ============================================
  // Access
  // ============================================
  get: {
    name: "Get",
    category: "access",
    arity: 1,
    argLabels: ["path"],
    description: "경로에서 값 가져오기",
    example: ["get", "data.fieldName"],
  },

  // ============================================
  // Comparison
  // ============================================
  "==": {
    name: "Equal",
    category: "comparison",
    arity: 2,
    argLabels: ["left", "right"],
    description: "두 값이 같은지 비교",
    example: ["==", ["get", "data.x"], 10],
  },
  "!=": {
    name: "Not Equal",
    category: "comparison",
    arity: 2,
    argLabels: ["left", "right"],
    description: "두 값이 다른지 비교",
    example: ["!=", ["get", "data.x"], 10],
  },
  ">": {
    name: "Greater Than",
    category: "comparison",
    arity: 2,
    argLabels: ["left", "right"],
    description: "왼쪽이 오른쪽보다 큰지 비교",
    example: [">", ["get", "data.x"], 10],
  },
  ">=": {
    name: "Greater or Equal",
    category: "comparison",
    arity: 2,
    argLabels: ["left", "right"],
    description: "왼쪽이 오른쪽 이상인지 비교",
    example: [">=", ["get", "data.x"], 10],
  },
  "<": {
    name: "Less Than",
    category: "comparison",
    arity: 2,
    argLabels: ["left", "right"],
    description: "왼쪽이 오른쪽보다 작은지 비교",
    example: ["<", ["get", "data.x"], 10],
  },
  "<=": {
    name: "Less or Equal",
    category: "comparison",
    arity: 2,
    argLabels: ["left", "right"],
    description: "왼쪽이 오른쪽 이하인지 비교",
    example: ["<=", ["get", "data.x"], 10],
  },

  // ============================================
  // Logic
  // ============================================
  "!": {
    name: "Not",
    category: "logic",
    arity: 1,
    argLabels: ["value"],
    description: "논리 부정",
    example: ["!", ["get", "data.isActive"]],
  },
  all: {
    name: "All",
    category: "logic",
    arity: "variadic",
    minArgs: 1,
    description: "모든 조건이 참인지 (AND)",
    example: ["all", ["get", "data.a"], ["get", "data.b"]],
  },
  any: {
    name: "Any",
    category: "logic",
    arity: "variadic",
    minArgs: 1,
    description: "하나라도 참인지 (OR)",
    example: ["any", ["get", "data.a"], ["get", "data.b"]],
  },

  // ============================================
  // Arithmetic
  // ============================================
  "+": {
    name: "Add",
    category: "arithmetic",
    arity: 2,
    argLabels: ["left", "right"],
    description: "더하기",
    example: ["+", ["get", "data.x"], ["get", "data.y"]],
  },
  "-": {
    name: "Subtract",
    category: "arithmetic",
    arity: 2,
    argLabels: ["left", "right"],
    description: "빼기",
    example: ["-", ["get", "data.x"], ["get", "data.y"]],
  },
  "*": {
    name: "Multiply",
    category: "arithmetic",
    arity: 2,
    argLabels: ["left", "right"],
    description: "곱하기",
    example: ["*", ["get", "data.price"], ["get", "data.quantity"]],
  },
  "/": {
    name: "Divide",
    category: "arithmetic",
    arity: 2,
    argLabels: ["left", "right"],
    description: "나누기",
    example: ["/", ["get", "data.total"], ["get", "data.count"]],
  },
  "%": {
    name: "Modulo",
    category: "arithmetic",
    arity: 2,
    argLabels: ["left", "right"],
    description: "나머지",
    example: ["%", ["get", "data.x"], 2],
  },

  // ============================================
  // String
  // ============================================
  concat: {
    name: "Concat",
    category: "string",
    arity: "variadic",
    minArgs: 2,
    description: "문자열/배열 연결",
    example: ["concat", ["get", "data.firstName"], " ", ["get", "data.lastName"]],
  },
  upper: {
    name: "Upper",
    category: "string",
    arity: 1,
    argLabels: ["text"],
    description: "대문자로 변환",
    example: ["upper", ["get", "data.name"]],
  },
  lower: {
    name: "Lower",
    category: "string",
    arity: 1,
    argLabels: ["text"],
    description: "소문자로 변환",
    example: ["lower", ["get", "data.name"]],
  },
  trim: {
    name: "Trim",
    category: "string",
    arity: 1,
    argLabels: ["text"],
    description: "앞뒤 공백 제거",
    example: ["trim", ["get", "data.input"]],
  },
  slice: {
    name: "Slice",
    category: "string",
    arity: 3,
    argLabels: ["text", "start", "end"],
    description: "문자열/배열 일부 추출",
    example: ["slice", ["get", "data.text"], 0, 10],
  },
  split: {
    name: "Split",
    category: "string",
    arity: 2,
    argLabels: ["text", "delimiter"],
    description: "문자열을 배열로 분리",
    example: ["split", ["get", "data.csv"], ","],
  },
  join: {
    name: "Join",
    category: "string",
    arity: 2,
    argLabels: ["array", "delimiter"],
    description: "배열을 문자열로 결합",
    example: ["join", ["get", "data.tags"], ", "],
  },
  matches: {
    name: "Matches",
    category: "string",
    arity: 2,
    argLabels: ["text", "pattern"],
    description: "정규식 매칭 여부",
    example: ["matches", ["get", "data.email"], "^.+@.+$"],
  },
  replace: {
    name: "Replace",
    category: "string",
    arity: 3,
    argLabels: ["text", "pattern", "replacement"],
    description: "문자열 치환",
    example: ["replace", ["get", "data.text"], "old", "new"],
  },

  // ============================================
  // Array
  // ============================================
  length: {
    name: "Length",
    category: "array",
    arity: 1,
    argLabels: ["collection"],
    description: "배열/문자열 길이",
    example: ["length", ["get", "data.items"]],
  },
  at: {
    name: "At",
    category: "array",
    arity: 2,
    argLabels: ["array", "index"],
    description: "특정 인덱스 요소 가져오기",
    example: ["at", ["get", "data.items"], 0],
  },
  first: {
    name: "First",
    category: "array",
    arity: 1,
    argLabels: ["array"],
    description: "첫 번째 요소",
    example: ["first", ["get", "data.items"]],
  },
  last: {
    name: "Last",
    category: "array",
    arity: 1,
    argLabels: ["array"],
    description: "마지막 요소",
    example: ["last", ["get", "data.items"]],
  },
  includes: {
    name: "Includes",
    category: "array",
    arity: 2,
    argLabels: ["array", "value"],
    description: "요소 포함 여부",
    example: ["includes", ["get", "data.tags"], "important"],
  },
  indexOf: {
    name: "IndexOf",
    category: "array",
    arity: 2,
    argLabels: ["array", "value"],
    description: "요소의 인덱스 찾기",
    example: ["indexOf", ["get", "data.items"], "target"],
  },
  map: {
    name: "Map",
    category: "array",
    arity: 2,
    argLabels: ["array", "transform"],
    description: "각 요소 변환 ($ = 현재 아이템)",
    example: ["map", ["get", "data.items"], ["get", "$.name"]],
  },
  filter: {
    name: "Filter",
    category: "array",
    arity: 2,
    argLabels: ["array", "condition"],
    description: "조건에 맞는 요소 필터링 ($ = 현재 아이템)",
    example: ["filter", ["get", "data.items"], [">", ["get", "$.price"], 100]],
  },
  every: {
    name: "Every",
    category: "array",
    arity: 2,
    argLabels: ["array", "condition"],
    description: "모든 요소가 조건 충족",
    example: ["every", ["get", "data.items"], [">", ["get", "$"], 0]],
  },
  some: {
    name: "Some",
    category: "array",
    arity: 2,
    argLabels: ["array", "condition"],
    description: "일부 요소가 조건 충족",
    example: ["some", ["get", "data.items"], ["==", ["get", "$"], null]],
  },
  reduce: {
    name: "Reduce",
    category: "array",
    arity: 3,
    argLabels: ["array", "reducer", "initial"],
    description: "배열을 단일 값으로 축소 ($acc = 누적값, $ = 현재)",
    example: ["reduce", ["get", "data.numbers"], ["+", ["get", "$acc"], ["get", "$"]], 0],
  },
  flatten: {
    name: "Flatten",
    category: "array",
    arity: 1,
    argLabels: ["array"],
    description: "중첩 배열 평탄화",
    example: ["flatten", ["get", "data.nestedItems"]],
  },
  unique: {
    name: "Unique",
    category: "array",
    arity: 1,
    argLabels: ["array"],
    description: "중복 제거",
    example: ["unique", ["get", "data.tags"]],
  },
  sort: {
    name: "Sort",
    category: "array",
    arity: 1,
    argLabels: ["array"],
    description: "정렬",
    example: ["sort", ["get", "data.numbers"]],
  },
  reverse: {
    name: "Reverse",
    category: "array",
    arity: 1,
    argLabels: ["array"],
    description: "역순",
    example: ["reverse", ["get", "data.items"]],
  },

  // ============================================
  // Number
  // ============================================
  sum: {
    name: "Sum",
    category: "number",
    arity: 1,
    argLabels: ["numbers"],
    description: "배열 합계",
    example: ["sum", ["get", "data.prices"]],
  },
  min: {
    name: "Min",
    category: "number",
    arity: 1,
    argLabels: ["numbers"],
    description: "최솟값",
    example: ["min", ["get", "data.prices"]],
  },
  max: {
    name: "Max",
    category: "number",
    arity: 1,
    argLabels: ["numbers"],
    description: "최댓값",
    example: ["max", ["get", "data.prices"]],
  },
  avg: {
    name: "Average",
    category: "number",
    arity: 1,
    argLabels: ["numbers"],
    description: "평균",
    example: ["avg", ["get", "data.scores"]],
  },
  count: {
    name: "Count",
    category: "number",
    arity: 1,
    argLabels: ["array"],
    description: "요소 개수",
    example: ["count", ["get", "data.items"]],
  },
  round: {
    name: "Round",
    category: "number",
    arity: 1,
    argLabels: ["number"],
    description: "반올림",
    example: ["round", ["get", "data.value"]],
  },
  floor: {
    name: "Floor",
    category: "number",
    arity: 1,
    argLabels: ["number"],
    description: "내림",
    example: ["floor", ["get", "data.value"]],
  },
  ceil: {
    name: "Ceiling",
    category: "number",
    arity: 1,
    argLabels: ["number"],
    description: "올림",
    example: ["ceil", ["get", "data.value"]],
  },
  abs: {
    name: "Absolute",
    category: "number",
    arity: 1,
    argLabels: ["number"],
    description: "절댓값",
    example: ["abs", ["get", "data.difference"]],
  },
  clamp: {
    name: "Clamp",
    category: "number",
    arity: 3,
    argLabels: ["value", "min", "max"],
    description: "범위 내로 제한",
    example: ["clamp", ["get", "data.value"], 0, 100],
  },

  // ============================================
  // Object
  // ============================================
  has: {
    name: "Has",
    category: "object",
    arity: 2,
    argLabels: ["object", "key"],
    description: "키 존재 여부",
    example: ["has", ["get", "data.user"], "email"],
  },
  keys: {
    name: "Keys",
    category: "object",
    arity: 1,
    argLabels: ["object"],
    description: "객체의 키 목록",
    example: ["keys", ["get", "data.config"]],
  },
  values: {
    name: "Values",
    category: "object",
    arity: 1,
    argLabels: ["object"],
    description: "객체의 값 목록",
    example: ["values", ["get", "data.config"]],
  },
  entries: {
    name: "Entries",
    category: "object",
    arity: 1,
    argLabels: ["object"],
    description: "객체의 [키, 값] 쌍 목록",
    example: ["entries", ["get", "data.config"]],
  },
  pick: {
    name: "Pick",
    category: "object",
    arity: 2,
    argLabels: ["object", "keys"],
    description: "특정 키만 선택",
    example: ["pick", ["get", "data.user"], ["id", "name"]],
  },
  omit: {
    name: "Omit",
    category: "object",
    arity: 2,
    argLabels: ["object", "keys"],
    description: "특정 키 제외",
    example: ["omit", ["get", "data.user"], ["password"]],
  },
  assoc: {
    name: "Assoc",
    category: "object",
    arity: 3,
    argLabels: ["object", "key", "value"],
    description: "키-값 쌍 추가/수정 (불변)",
    example: ["assoc", ["get", "data.user"], "role", "admin"],
  },
  dissoc: {
    name: "Dissoc",
    category: "object",
    arity: 2,
    argLabels: ["object", "key"],
    description: "키 제거 (불변)",
    example: ["dissoc", ["get", "data.user"], "password"],
  },
  merge: {
    name: "Merge",
    category: "object",
    arity: "variadic",
    minArgs: 2,
    description: "객체 병합 (불변)",
    example: ["merge", ["get", "data.defaults"], ["get", "data.overrides"]],
  },

  // ============================================
  // Conditional
  // ============================================
  case: {
    name: "Case",
    category: "conditional",
    arity: "special",
    description: "조건부 분기 (if-else)",
    example: ["case", ["get", "data.isVip"], "VIP", "일반"],
  },
  match: {
    name: "Match",
    category: "conditional",
    arity: "special",
    description: "패턴 매칭",
    example: ["match", ["get", "data.status"], "active", "활성", "inactive", "비활성", "알 수 없음"],
  },
  coalesce: {
    name: "Coalesce",
    category: "conditional",
    arity: "variadic",
    minArgs: 2,
    description: "첫 번째 non-null 값",
    example: ["coalesce", ["get", "data.nickname"], ["get", "data.name"], "익명"],
  },

  // ============================================
  // Type
  // ============================================
  isNull: {
    name: "Is Null",
    category: "type",
    arity: 1,
    argLabels: ["value"],
    description: "null 여부",
    example: ["isNull", ["get", "data.value"]],
  },
  isNumber: {
    name: "Is Number",
    category: "type",
    arity: 1,
    argLabels: ["value"],
    description: "숫자 여부",
    example: ["isNumber", ["get", "data.value"]],
  },
  isString: {
    name: "Is String",
    category: "type",
    arity: 1,
    argLabels: ["value"],
    description: "문자열 여부",
    example: ["isString", ["get", "data.value"]],
  },
  isArray: {
    name: "Is Array",
    category: "type",
    arity: 1,
    argLabels: ["value"],
    description: "배열 여부",
    example: ["isArray", ["get", "data.value"]],
  },
  isObject: {
    name: "Is Object",
    category: "type",
    arity: 1,
    argLabels: ["value"],
    description: "객체 여부",
    example: ["isObject", ["get", "data.value"]],
  },
  toNumber: {
    name: "To Number",
    category: "type",
    arity: 1,
    argLabels: ["value"],
    description: "숫자로 변환",
    example: ["toNumber", ["get", "data.stringValue"]],
  },
  toString: {
    name: "To String",
    category: "type" as const,
    arity: 1,
    argLabels: ["value"],
    description: "문자열로 변환",
    example: ["toString", ["get", "data.numericValue"]],
  },

  // ============================================
  // Date
  // ============================================
  now: {
    name: "Now",
    category: "date",
    arity: 0,
    description: "현재 시간",
    example: ["now"],
  },
  date: {
    name: "Date",
    category: "date",
    arity: 1,
    argLabels: ["dateString"],
    description: "날짜 파싱",
    example: ["date", "2024-01-01"],
  },
  year: {
    name: "Year",
    category: "date",
    arity: 1,
    argLabels: ["date"],
    description: "연도 추출",
    example: ["year", ["get", "data.createdAt"]],
  },
  month: {
    name: "Month",
    category: "date",
    arity: 1,
    argLabels: ["date"],
    description: "월 추출",
    example: ["month", ["get", "data.createdAt"]],
  },
  day: {
    name: "Day",
    category: "date",
    arity: 1,
    argLabels: ["date"],
    description: "일 추출",
    example: ["day", ["get", "data.createdAt"]],
  },
  diff: {
    name: "Diff",
    category: "date",
    arity: 3,
    argLabels: ["date1", "date2", "unit"],
    description: "날짜 차이",
    example: ["diff", ["get", "data.start"], ["get", "data.end"], "days"],
  },

  // ============================================
  // Utility
  // ============================================
  uuid: {
    name: "UUID",
    category: "utility",
    arity: 0,
    description: "UUID v4 생성",
    example: ["uuid"],
  },

  // ============================================
  // Array (FP Patterns - Phase 2.5)
  // ============================================
  append: {
    name: "Append",
    category: "array",
    arity: 2,
    argLabels: ["array", "element"],
    description: "배열 끝에 요소 추가",
    example: ["append", ["get", "data.items"], "new"],
  },
  prepend: {
    name: "Prepend",
    category: "array",
    arity: 2,
    argLabels: ["array", "element"],
    description: "배열 앞에 요소 추가",
    example: ["prepend", ["get", "data.items"], "new"],
  },
  take: {
    name: "Take",
    category: "array",
    arity: 2,
    argLabels: ["array", "n"],
    description: "앞에서 n개 요소",
    example: ["take", ["get", "data.items"], 5],
  },
  drop: {
    name: "Drop",
    category: "array",
    arity: 2,
    argLabels: ["array", "n"],
    description: "앞에서 n개 제외",
    example: ["drop", ["get", "data.items"], 2],
  },
  find: {
    name: "Find",
    category: "array",
    arity: 2,
    argLabels: ["array", "predicate"],
    description: "조건에 맞는 첫 요소",
    example: ["find", ["get", "data.items"], ["==", ["get", "$.id"], "target"]],
  },
  findIndex: {
    name: "Find Index",
    category: "array",
    arity: 2,
    argLabels: ["array", "predicate"],
    description: "조건에 맞는 첫 인덱스",
    example: ["findIndex", ["get", "data.items"], ["==", ["get", "$.id"], "target"]],
  },
  isEmpty: {
    name: "Is Empty",
    category: "array",
    arity: 1,
    argLabels: ["collection"],
    description: "배열/문자열이 비어있는지 (다형성)",
    example: ["isEmpty", ["get", "data.items"]],
  },
  range: {
    name: "Range",
    category: "array",
    arity: 2,
    argLabels: ["start", "end"],
    description: "숫자 범위 배열 생성",
    example: ["range", 1, 10],
  },
  zip: {
    name: "Zip",
    category: "array",
    arity: 2,
    argLabels: ["array1", "array2"],
    description: "두 배열을 쌍으로 묶기",
    example: ["zip", ["get", "data.ids"], ["get", "data.names"]],
  },
  partition: {
    name: "Partition",
    category: "array",
    arity: 2,
    argLabels: ["array", "predicate"],
    description: "조건으로 두 배열로 분리",
    example: ["partition", ["get", "data.items"], [">", ["get", "$.value"], 0]],
  },
  groupBy: {
    name: "Group By",
    category: "array",
    arity: 2,
    argLabels: ["array", "keyExpr"],
    description: "키 표현식으로 그룹화",
    example: ["groupBy", ["get", "data.orders"], ["get", "$.status"]],
  },
  chunk: {
    name: "Chunk",
    category: "array",
    arity: 2,
    argLabels: ["array", "size"],
    description: "고정 크기로 분할",
    example: ["chunk", ["get", "data.items"], 3],
  },
  compact: {
    name: "Compact",
    category: "array",
    arity: 1,
    argLabels: ["array"],
    description: "falsy 값 제거",
    example: ["compact", ["get", "data.items"]],
  },
};

/**
 * Operators grouped by category for UI
 */
export const OPERATOR_GROUPS: Record<OperatorCategory, string[]> = {
  access: ["get"],
  comparison: ["==", "!=", ">", ">=", "<", "<="],
  logic: ["!", "all", "any"],
  arithmetic: ["+", "-", "*", "/", "%"],
  string: ["concat", "upper", "lower", "trim", "slice", "split", "join", "matches", "replace"],
  array: [
    "length", "at", "first", "last", "includes", "indexOf",
    "map", "filter", "every", "some", "reduce",
    "flatten", "unique", "sort", "reverse",
    // FP patterns (Phase 2.5)
    "append", "prepend", "take", "drop",
    "find", "findIndex", "isEmpty", "range",
    "zip", "partition", "groupBy", "chunk", "compact",
  ],
  number: ["sum", "min", "max", "avg", "count", "round", "floor", "ceil", "abs", "clamp"],
  object: ["has", "keys", "values", "entries", "pick", "omit", "assoc", "dissoc", "merge"],
  conditional: ["case", "match", "coalesce"],
  type: ["isNull", "isNumber", "isString", "isArray", "isObject", "toNumber", "toString"],
  date: ["now", "date", "year", "month", "day", "diff"],
  utility: ["uuid"],
};

/**
 * Category display names
 */
export const CATEGORY_NAMES: Record<OperatorCategory, string> = {
  access: "Access",
  comparison: "Comparison",
  logic: "Logic",
  arithmetic: "Arithmetic",
  string: "String",
  array: "Array",
  number: "Number",
  object: "Object",
  conditional: "Conditional",
  type: "Type",
  date: "Date",
  utility: "Utility",
};

/**
 * Category colors for UI
 */
export const CATEGORY_COLORS: Record<OperatorCategory, string> = {
  access: "text-neon-cyan",
  comparison: "text-neon-blue",
  logic: "text-neon-violet",
  arithmetic: "text-neon-orange",
  string: "text-neon-pink",
  array: "text-neon-emerald",
  number: "text-neon-amber",
  object: "text-neon-cyan",
  conditional: "text-neon-violet",
  type: "text-muted-foreground",
  date: "text-neon-blue",
  utility: "text-neon-rose",
};

/**
 * Get operator metadata
 */
export function getOperatorMeta(op: string): OperatorMeta | undefined {
  return OPERATORS[op];
}

/**
 * Create default expression for an operator
 */
export function createDefaultExpr(op: string): unknown {
  const meta = OPERATORS[op];
  if (!meta) return null;

  if (meta.arity === 0) {
    return [op];
  }

  if (meta.arity === 1) {
    return [op, null];
  }

  if (meta.arity === 2) {
    return [op, null, null];
  }

  if (meta.arity === 3) {
    return [op, null, null, null];
  }

  if (meta.arity === "variadic") {
    const minArgs = meta.minArgs ?? 2;
    return [op, ...Array(minArgs).fill(null)];
  }

  // Special cases
  if (op === "case") {
    return ["case", null, null, null]; // condition, then, else
  }

  if (op === "match") {
    return ["match", null, null, null, null]; // target, pattern1, result1, default
  }

  return [op, null];
}
