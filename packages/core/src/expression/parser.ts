import type { Expression, GetExpr } from './types.js';
import type { SemanticPath } from '../domain/types.js';

/**
 * Expression 파싱 결과
 */
export type ParseResult =
  | { ok: true; expression: Expression }
  | { ok: false; error: string };

/**
 * Expression 유효성 검사
 */
export function isValidExpression(expr: unknown): expr is Expression {
  if (expr === null) return true;
  if (typeof expr === 'string') return true;
  if (typeof expr === 'number') return true;
  if (typeof expr === 'boolean') return true;

  if (!Array.isArray(expr)) return false;
  if (expr.length === 0) return false;

  const [op] = expr;
  if (typeof op !== 'string') return false;

  return isValidOperator(op);
}

/**
 * 유효한 연산자인지 확인
 */
function isValidOperator(op: string): boolean {
  const validOperators = new Set([
    // Value access
    'get',
    // Comparison
    '==',
    '!=',
    '>',
    '>=',
    '<',
    '<=',
    // Logical
    '!',
    'all',
    'any',
    // Arithmetic
    '+',
    '-',
    '*',
    '/',
    '%',
    // Conditional
    'case',
    'match',
    'coalesce',
    // String
    'concat',
    'upper',
    'lower',
    'trim',
    'slice',
    'split',
    'join',
    'matches',
    'replace',
    // Array
    'length',
    'at',
    'first',
    'last',
    'includes',
    'indexOf',
    'map',
    'filter',
    'every',
    'some',
    'reduce',
    'flatten',
    'unique',
    'sort',
    'reverse',
    // Number
    'sum',
    'min',
    'max',
    'avg',
    'count',
    'round',
    'floor',
    'ceil',
    'abs',
    'clamp',
    // Object
    'has',
    'keys',
    'values',
    'entries',
    'pick',
    'omit',
    // Type
    'isNull',
    'isNumber',
    'isString',
    'isArray',
    'isObject',
    'toNumber',
    'toString',
    // Date
    'now',
    'date',
    'year',
    'month',
    'day',
    'diff',
  ]);

  return validOperators.has(op);
}

/**
 * Get 표현식인지 확인
 */
export function isGetExpr(expr: Expression): expr is GetExpr {
  return Array.isArray(expr) && expr.length === 2 && expr[0] === 'get';
}

/**
 * Expression에서 모든 get 경로 추출
 */
export function extractPaths(expr: Expression): SemanticPath[] {
  const paths: SemanticPath[] = [];

  function traverse(e: Expression): void {
    if (e === null || typeof e !== 'object') return;
    if (!Array.isArray(e)) return;

    const [op, ...args] = e;
    if (op === 'get' && typeof args[0] === 'string') {
      paths.push(args[0]);
      return;
    }

    for (const arg of args) {
      if (isValidExpression(arg)) {
        traverse(arg);
      }
    }
  }

  traverse(expr);
  return paths;
}

/**
 * Expression을 JSON 문자열로 변환
 */
export function stringifyExpression(expr: Expression): string {
  return JSON.stringify(expr);
}

/**
 * JSON 문자열을 Expression으로 파싱
 */
export function parseExpression(json: string): ParseResult {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (isValidExpression(parsed)) {
      return { ok: true, expression: parsed };
    }
    return { ok: false, error: 'Invalid expression structure' };
  } catch (e) {
    return { ok: false, error: `JSON parse error: ${String(e)}` };
  }
}

/**
 * Expression을 사람이 읽을 수 있는 형태로 변환
 */
export function expressionToString(expr: Expression): string {
  if (expr === null) return 'null';
  if (typeof expr === 'string') return `"${expr}"`;
  if (typeof expr === 'number') return String(expr);
  if (typeof expr === 'boolean') return String(expr);

  const [op, ...args] = expr;

  switch (op) {
    case 'get':
      return `$${args[0]}`;
    case '==':
    case '!=':
    case '>':
    case '>=':
    case '<':
    case '<=':
    case '+':
    case '-':
    case '*':
    case '/':
    case '%':
      return `(${expressionToString(args[0] as Expression)} ${op} ${expressionToString(args[1] as Expression)})`;
    case '!':
      return `!${expressionToString(args[0] as Expression)}`;
    case 'all':
      return `(${args.map((a) => expressionToString(a as Expression)).join(' && ')})`;
    case 'any':
      return `(${args.map((a) => expressionToString(a as Expression)).join(' || ')})`;
    default:
      return `${op}(${args.map((a) => (isValidExpression(a) ? expressionToString(a) : String(a))).join(', ')})`;
  }
}
