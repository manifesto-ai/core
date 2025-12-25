import type { Expression, EvaluationContext } from './types.js';

/**
 * Expression 평가 결과
 */
export type EvalResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Expression 평가
 */
export function evaluate(expr: Expression, ctx: EvaluationContext): EvalResult {
  try {
    const value = evalExpr(expr, ctx);
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 내부 평가 함수
 */
function evalExpr(expr: Expression, ctx: EvaluationContext): unknown {
  // Literals
  if (expr === null) return null;
  if (typeof expr === 'string') return expr;
  if (typeof expr === 'number') return expr;
  if (typeof expr === 'boolean') return expr;

  if (!Array.isArray(expr)) {
    throw new Error(`Invalid expression: ${JSON.stringify(expr)}`);
  }

  // Handle empty arrays and array literals (non-operator arrays)
  if (expr.length === 0) {
    return expr;
  }

  const [op, ...args] = expr;

  // If first element is not a string, it's an array literal - return as-is
  if (typeof op !== 'string') {
    return expr;
  }

  switch (op) {
    // Value Access
    case 'get':
      return evalGet(args[0] as string, ctx);

    // Comparison
    case '==':
      return evalExpr(args[0] as Expression, ctx) === evalExpr(args[1] as Expression, ctx);
    case '!=':
      return evalExpr(args[0] as Expression, ctx) !== evalExpr(args[1] as Expression, ctx);
    case '>':
      return (
        (evalExpr(args[0] as Expression, ctx) as number) >
        (evalExpr(args[1] as Expression, ctx) as number)
      );
    case '>=':
      return (
        (evalExpr(args[0] as Expression, ctx) as number) >=
        (evalExpr(args[1] as Expression, ctx) as number)
      );
    case '<':
      return (
        (evalExpr(args[0] as Expression, ctx) as number) <
        (evalExpr(args[1] as Expression, ctx) as number)
      );
    case '<=':
      return (
        (evalExpr(args[0] as Expression, ctx) as number) <=
        (evalExpr(args[1] as Expression, ctx) as number)
      );

    // Logical
    case '!':
      return !evalExpr(args[0] as Expression, ctx);
    case 'all':
      return args.every((a) => Boolean(evalExpr(a as Expression, ctx)));
    case 'any':
      return args.some((a) => Boolean(evalExpr(a as Expression, ctx)));

    // Arithmetic
    case '+':
      return (
        (evalExpr(args[0] as Expression, ctx) as number) +
        (evalExpr(args[1] as Expression, ctx) as number)
      );
    case '-':
      return (
        (evalExpr(args[0] as Expression, ctx) as number) -
        (evalExpr(args[1] as Expression, ctx) as number)
      );
    case '*':
      return (
        (evalExpr(args[0] as Expression, ctx) as number) *
        (evalExpr(args[1] as Expression, ctx) as number)
      );
    case '/':
      return (
        (evalExpr(args[0] as Expression, ctx) as number) /
        (evalExpr(args[1] as Expression, ctx) as number)
      );
    case '%':
      return (
        (evalExpr(args[0] as Expression, ctx) as number) %
        (evalExpr(args[1] as Expression, ctx) as number)
      );

    // Conditional
    case 'case':
      return evalCase(args as Expression[], ctx);
    case 'match':
      return evalMatch(args as Expression[], ctx);
    case 'coalesce':
      return evalCoalesce(args as Expression[], ctx);

    // String/Array (polymorphic)
    case 'concat': {
      const values = args.map((a) => evalExpr(a as Expression, ctx));
      if (values.length === 0) return '';
      // 첫 인자 타입으로 결정: Array면 배열 병합, 아니면 문자열 연결
      if (Array.isArray(values[0])) {
        return values.flatMap((v) => (Array.isArray(v) ? v : []));
      }
      return values.map(String).join('');
    }
    case 'upper':
      return String(evalExpr(args[0] as Expression, ctx)).toUpperCase();
    case 'lower':
      return String(evalExpr(args[0] as Expression, ctx)).toLowerCase();
    case 'trim':
      return String(evalExpr(args[0] as Expression, ctx)).trim();
    case 'slice': {
      const val = evalExpr(args[0] as Expression, ctx);
      const start = args[1] as number;
      const end = args[2] as number | undefined;
      if (typeof val === 'string') return val.slice(start, end);
      if (Array.isArray(val)) return val.slice(start, end);
      return null;
    }
    case 'split':
      return String(evalExpr(args[0] as Expression, ctx)).split(args[1] as string);
    case 'join':
      return (evalExpr(args[0] as Expression, ctx) as string[]).join(args[1] as string);
    case 'matches':
      return new RegExp(args[1] as string).test(String(evalExpr(args[0] as Expression, ctx)));
    case 'replace':
      return String(evalExpr(args[0] as Expression, ctx)).replace(
        new RegExp(args[1] as string, 'g'),
        args[2] as string
      );

    // Array (polymorphic: String & Array)
    case 'length': {
      const val = evalExpr(args[0] as Expression, ctx);
      if (typeof val === 'string') return val.length;
      if (Array.isArray(val)) return val.length;
      return 0;
    }
    case 'at': {
      const val = evalExpr(args[0] as Expression, ctx);
      const index = args[1] as number;
      if (typeof val === 'string') return val.at(index) ?? null;
      if (Array.isArray(val)) return val.at(index) ?? null;
      return null;
    }
    case 'first':
      return (evalExpr(args[0] as Expression, ctx) as unknown[])[0];
    case 'last': {
      const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
      return arr[arr.length - 1];
    }
    case 'includes': {
      const val = evalExpr(args[0] as Expression, ctx);
      const search = evalExpr(args[1] as Expression, ctx);
      if (typeof val === 'string') return val.includes(String(search));
      if (Array.isArray(val)) return val.includes(search);
      return false;
    }
    case 'indexOf': {
      const val = evalExpr(args[0] as Expression, ctx);
      const search = evalExpr(args[1] as Expression, ctx);
      if (typeof val === 'string') return val.indexOf(String(search));
      if (Array.isArray(val)) return val.indexOf(search);
      return -1;
    }
    case 'map':
      return evalMap(args as Expression[], ctx);
    case 'filter':
      return evalFilter(args as Expression[], ctx);
    case 'every':
      return evalEvery(args as Expression[], ctx);
    case 'some':
      return evalSome(args as Expression[], ctx);
    case 'reduce':
      return evalReduce(args as Expression[], ctx);
    case 'flatten':
      return (evalExpr(args[0] as Expression, ctx) as unknown[][]).flat();
    case 'unique':
      return [...new Set(evalExpr(args[0] as Expression, ctx) as unknown[])];
    case 'sort':
      return evalSort(args as Expression[], ctx);
    case 'reverse':
      return [...(evalExpr(args[0] as Expression, ctx) as unknown[])].reverse();

    // Tier 1: Array manipulation (essential)
    case 'append': {
      const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
      const elem = evalExpr(args[1] as Expression, ctx);
      return [...arr, elem];
    }
    case 'prepend': {
      const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
      const elem = evalExpr(args[1] as Expression, ctx);
      return [elem, ...arr];
    }

    // Tier 2: FP patterns (recommended)
    case 'take': {
      const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
      const n = evalExpr(args[1] as Expression, ctx) as number;
      return arr.slice(0, n);
    }
    case 'drop': {
      const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
      const n = evalExpr(args[1] as Expression, ctx) as number;
      return arr.slice(n);
    }
    case 'find':
      return evalFind(args as Expression[], ctx);
    case 'findIndex':
      return evalFindIndex(args as Expression[], ctx);
    case 'isEmpty': {
      const val = evalExpr(args[0] as Expression, ctx);
      if (typeof val === 'string') return val.length === 0;
      if (Array.isArray(val)) return val.length === 0;
      return true; // null, undefined 등은 비어있는 것으로 간주
    }
    case 'range': {
      const start = evalExpr(args[0] as Expression, ctx) as number;
      const end = evalExpr(args[1] as Expression, ctx) as number;
      if (start > end) return [];
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }

    // Tier 3: Advanced transformations
    case 'zip': {
      const arr1 = evalExpr(args[0] as Expression, ctx) as unknown[];
      const arr2 = evalExpr(args[1] as Expression, ctx) as unknown[];
      const len = Math.min(arr1.length, arr2.length);
      return Array.from({ length: len }, (_, i) => [arr1[i], arr2[i]]);
    }
    case 'partition':
      return evalPartition(args as Expression[], ctx);
    case 'groupBy':
      return evalGroupBy(args as Expression[], ctx);
    case 'chunk': {
      const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
      const size = evalExpr(args[1] as Expression, ctx) as number;
      if (size <= 0) return [];
      const result: unknown[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
      }
      return result;
    }
    case 'compact': {
      const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
      return arr.filter(Boolean);
    }

    // Number
    case 'sum':
      return (evalExpr(args[0] as Expression, ctx) as number[]).reduce((a, b) => a + b, 0);
    case 'min':
      return Math.min(...(evalExpr(args[0] as Expression, ctx) as number[]));
    case 'max':
      return Math.max(...(evalExpr(args[0] as Expression, ctx) as number[]));
    case 'avg': {
      const nums = evalExpr(args[0] as Expression, ctx) as number[];
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    }
    case 'count':
      return (evalExpr(args[0] as Expression, ctx) as unknown[]).length;
    case 'round': {
      const val = evalExpr(args[0] as Expression, ctx) as number;
      const precision = (args[1] as number) ?? 0;
      const factor = Math.pow(10, precision);
      return Math.round(val * factor) / factor;
    }
    case 'floor':
      return Math.floor(evalExpr(args[0] as Expression, ctx) as number);
    case 'ceil':
      return Math.ceil(evalExpr(args[0] as Expression, ctx) as number);
    case 'abs':
      return Math.abs(evalExpr(args[0] as Expression, ctx) as number);
    case 'clamp': {
      const val = evalExpr(args[0] as Expression, ctx) as number;
      const min = args[1] as number;
      const max = args[2] as number;
      return Math.max(min, Math.min(max, val));
    }

    // Object
    case 'has':
      return (args[1] as string) in (evalExpr(args[0] as Expression, ctx) as object);
    case 'keys':
      return Object.keys(evalExpr(args[0] as Expression, ctx) as object);
    case 'values':
      return Object.values(evalExpr(args[0] as Expression, ctx) as object);
    case 'entries':
      return Object.entries(evalExpr(args[0] as Expression, ctx) as object);
    case 'pick': {
      const obj = evalExpr(args[0] as Expression, ctx) as Record<string, unknown>;
      const keys = args.slice(1) as string[];
      const result: Record<string, unknown> = {};
      for (const k of keys) {
        if (k in obj) result[k] = obj[k];
      }
      return result;
    }
    case 'omit': {
      const obj = evalExpr(args[0] as Expression, ctx) as Record<string, unknown>;
      const keysToOmit = new Set(args.slice(1) as string[]);
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!keysToOmit.has(k)) result[k] = v;
      }
      return result;
    }
    case 'assoc': {
      // ['assoc', obj, key, value] - 객체에 키-값 쌍 추가/수정 (불변)
      const obj = evalExpr(args[0] as Expression, ctx) as Record<string, unknown>;
      const key = args[1] as string;
      const val = evalExpr(args[2] as Expression, ctx);
      return { ...obj, [key]: val };
    }
    case 'dissoc': {
      // ['dissoc', obj, key] - 객체에서 키 제거 (불변)
      const obj = evalExpr(args[0] as Expression, ctx) as Record<string, unknown>;
      const key = args[1] as string;
      const { [key]: _, ...rest } = obj;
      return rest;
    }
    case 'merge': {
      // ['merge', obj1, obj2, ...] - 여러 객체 병합 (불변)
      const objects = args.map((a) => evalExpr(a as Expression, ctx) as Record<string, unknown>);
      return Object.assign({}, ...objects);
    }

    // Utility
    case 'uuid':
      // ['uuid'] - UUID v4 생성
      return crypto.randomUUID();

    // Type
    case 'isNull':
      return evalExpr(args[0] as Expression, ctx) === null;
    case 'isNumber':
      return typeof evalExpr(args[0] as Expression, ctx) === 'number';
    case 'isString':
      return typeof evalExpr(args[0] as Expression, ctx) === 'string';
    case 'isArray':
      return Array.isArray(evalExpr(args[0] as Expression, ctx));
    case 'isObject': {
      const val = evalExpr(args[0] as Expression, ctx);
      return val !== null && typeof val === 'object' && !Array.isArray(val);
    }
    case 'toNumber':
      return Number(evalExpr(args[0] as Expression, ctx));
    case 'toString':
      return String(evalExpr(args[0] as Expression, ctx));

    // Date
    case 'now':
      return Date.now();
    case 'date':
      return new Date(evalExpr(args[0] as Expression, ctx) as string | number).getTime();
    case 'year':
      return new Date(evalExpr(args[0] as Expression, ctx) as number).getFullYear();
    case 'month':
      return new Date(evalExpr(args[0] as Expression, ctx) as number).getMonth() + 1;
    case 'day':
      return new Date(evalExpr(args[0] as Expression, ctx) as number).getDate();
    case 'diff': {
      const d1 = evalExpr(args[0] as Expression, ctx) as number;
      const d2 = evalExpr(args[1] as Expression, ctx) as number;
      const unit = args[2] as string;
      const diffMs = d1 - d2;
      switch (unit) {
        case 'days':
          return Math.floor(diffMs / (1000 * 60 * 60 * 24));
        case 'hours':
          return Math.floor(diffMs / (1000 * 60 * 60));
        case 'minutes':
          return Math.floor(diffMs / (1000 * 60));
        case 'seconds':
          return Math.floor(diffMs / 1000);
        default:
          return diffMs;
      }
    }

    default:
      throw new Error(`Unknown operator: ${op}`);
  }
}

/**
 * get 연산자 평가
 */
function evalGet(path: string, ctx: EvaluationContext): unknown {
  if (path === '$') {
    return ctx.current;
  }
  if (path === '$index') {
    return ctx.index;
  }
  if (path === '$acc') {
    return ctx.accumulator;
  }
  if (path.startsWith('$.')) {
    const subPath = path.slice(2);
    return getNestedValue(ctx.current, subPath);
  }
  return ctx.get(path);
}

/**
 * 중첩된 객체에서 값 가져오기
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * case 연산자 평가
 */
function evalCase(args: Expression[], ctx: EvaluationContext): unknown {
  // 마지막이 default, 나머지는 [condition, result] 쌍
  for (let i = 0; i < args.length - 1; i += 2) {
    const condition = args[i];
    const result = args[i + 1];
    if (condition !== undefined && evalExpr(condition, ctx)) {
      return result !== undefined ? evalExpr(result, ctx) : undefined;
    }
  }
  // default
  const defaultVal = args[args.length - 1];
  return defaultVal !== undefined ? evalExpr(defaultVal, ctx) : undefined;
}

/**
 * match 연산자 평가
 */
function evalMatch(args: Expression[], ctx: EvaluationContext): unknown {
  const target = evalExpr(args[0] as Expression, ctx);
  // [target, ...pattern-result pairs, default]
  for (let i = 1; i < args.length - 1; i += 2) {
    const pattern = evalExpr(args[i] as Expression, ctx);
    const result = args[i + 1];
    if (target === pattern) {
      return result !== undefined ? evalExpr(result, ctx) : undefined;
    }
  }
  // default
  const defaultVal = args[args.length - 1];
  return defaultVal !== undefined ? evalExpr(defaultVal, ctx) : undefined;
}

/**
 * coalesce 연산자 평가
 */
function evalCoalesce(args: Expression[], ctx: EvaluationContext): unknown {
  for (const arg of args) {
    const val = evalExpr(arg, ctx);
    if (val !== null && val !== undefined) {
      return val;
    }
  }
  return null;
}

/**
 * map 연산자 평가
 */
function evalMap(args: Expression[], ctx: EvaluationContext): unknown[] {
  const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
  const mapper = args[1] as Expression;
  return arr.map((item, index) =>
    evalExpr(mapper, { ...ctx, current: item, index })
  );
}

/**
 * filter 연산자 평가
 */
function evalFilter(args: Expression[], ctx: EvaluationContext): unknown[] {
  const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
  const predicate = args[1] as Expression;
  return arr.filter((item, index) =>
    Boolean(evalExpr(predicate, { ...ctx, current: item, index }))
  );
}

/**
 * every 연산자 평가
 */
function evalEvery(args: Expression[], ctx: EvaluationContext): boolean {
  const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
  const predicate = args[1] as Expression;
  return arr.every((item, index) =>
    Boolean(evalExpr(predicate, { ...ctx, current: item, index }))
  );
}

/**
 * some 연산자 평가
 */
function evalSome(args: Expression[], ctx: EvaluationContext): boolean {
  const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
  const predicate = args[1] as Expression;
  return arr.some((item, index) =>
    Boolean(evalExpr(predicate, { ...ctx, current: item, index }))
  );
}

/**
 * reduce 연산자 평가
 */
function evalReduce(args: Expression[], ctx: EvaluationContext): unknown {
  const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
  const reducer = args[1] as Expression;
  const initial = evalExpr(args[2] as Expression, ctx);
  return arr.reduce(
    (acc, item, index) =>
      evalExpr(reducer, { ...ctx, current: item, index, accumulator: acc }),
    initial
  );
}

/**
 * sort 연산자 평가
 */
function evalSort(args: Expression[], ctx: EvaluationContext): unknown[] {
  const arr = [...(evalExpr(args[0] as Expression, ctx) as unknown[])];
  const comparator = args[1] as Expression | undefined;

  if (!comparator) {
    return arr.sort();
  }

  return arr.sort((a, b) => {
    const aVal = evalExpr(comparator, { ...ctx, current: a });
    const bVal = evalExpr(comparator, { ...ctx, current: b });
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    return aVal < bVal ? -1 : 1;
  });
}

/**
 * find 연산자 평가
 */
function evalFind(args: Expression[], ctx: EvaluationContext): unknown {
  const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
  const predicate = args[1] as Expression;
  return arr.find((item, index) =>
    Boolean(evalExpr(predicate, { ...ctx, current: item, index }))
  );
}

/**
 * findIndex 연산자 평가
 */
function evalFindIndex(args: Expression[], ctx: EvaluationContext): number {
  const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
  const predicate = args[1] as Expression;
  return arr.findIndex((item, index) =>
    Boolean(evalExpr(predicate, { ...ctx, current: item, index }))
  );
}

/**
 * partition 연산자 평가: 조건에 따라 두 배열로 분리
 */
function evalPartition(args: Expression[], ctx: EvaluationContext): [unknown[], unknown[]] {
  const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
  const predicate = args[1] as Expression;
  const truthy: unknown[] = [];
  const falsy: unknown[] = [];
  arr.forEach((item, index) => {
    if (Boolean(evalExpr(predicate, { ...ctx, current: item, index }))) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  });
  return [truthy, falsy];
}

/**
 * groupBy 연산자 평가: 키 표현식으로 그룹화
 */
function evalGroupBy(args: Expression[], ctx: EvaluationContext): Record<string, unknown[]> {
  const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
  const keyExpr = args[1] as Expression;
  const result: Record<string, unknown[]> = {};
  arr.forEach((item, index) => {
    const key = String(evalExpr(keyExpr, { ...ctx, current: item, index }));
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  });
  return result;
}
