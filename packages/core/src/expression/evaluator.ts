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

  const [op, ...args] = expr;

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

    // String
    case 'concat':
      return args.map((a) => String(evalExpr(a as Expression, ctx))).join('');
    case 'upper':
      return String(evalExpr(args[0] as Expression, ctx)).toUpperCase();
    case 'lower':
      return String(evalExpr(args[0] as Expression, ctx)).toLowerCase();
    case 'trim':
      return String(evalExpr(args[0] as Expression, ctx)).trim();
    case 'slice':
      return String(evalExpr(args[0] as Expression, ctx)).slice(
        args[1] as number,
        args[2] as number | undefined
      );
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

    // Array
    case 'length':
      return (evalExpr(args[0] as Expression, ctx) as unknown[]).length;
    case 'at':
      return (evalExpr(args[0] as Expression, ctx) as unknown[])[args[1] as number];
    case 'first':
      return (evalExpr(args[0] as Expression, ctx) as unknown[])[0];
    case 'last': {
      const arr = evalExpr(args[0] as Expression, ctx) as unknown[];
      return arr[arr.length - 1];
    }
    case 'includes':
      return (evalExpr(args[0] as Expression, ctx) as unknown[]).includes(
        evalExpr(args[1] as Expression, ctx)
      );
    case 'indexOf':
      return (evalExpr(args[0] as Expression, ctx) as unknown[]).indexOf(
        evalExpr(args[1] as Expression, ctx)
      );
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
