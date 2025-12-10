import type { Expression } from './types.js';
import type { SemanticPath } from '../domain/types.js';
import { extractPaths, isValidExpression } from './parser.js';

/**
 * 의존성 분석 결과
 */
export type DependencyAnalysis = {
  /** 직접 의존하는 경로들 */
  directDeps: SemanticPath[];

  /** 사용된 연산자들 */
  operators: string[];

  /** 표현식의 복잡도 (노드 수) */
  complexity: number;

  /** 부분 표현식에서 사용되는 컨텍스트 변수 */
  usesContext: boolean;
};

/**
 * Expression 의존성 분석
 */
export function analyzeExpression(expr: Expression): DependencyAnalysis {
  const directDeps = extractPaths(expr);
  const operators = new Set<string>();
  let complexity = 0;
  let usesContext = false;

  function traverse(e: Expression): void {
    complexity++;

    if (e === null || typeof e !== 'object') return;
    if (!Array.isArray(e)) return;

    const [op, ...args] = e;
    operators.add(op);

    // 컨텍스트 변수 사용 확인
    if (op === 'get') {
      const path = args[0] as string;
      if (path.startsWith('$')) {
        usesContext = true;
      }
    }

    for (const arg of args) {
      if (isValidExpression(arg)) {
        traverse(arg);
      }
    }
  }

  traverse(expr);

  return {
    directDeps,
    operators: [...operators],
    complexity,
    usesContext,
  };
}

/**
 * Expression이 순수한지 확인 (부수효과 없음)
 * 모든 Expression은 순수해야 하지만, 추가 검증용
 */
export function isPureExpression(expr: Expression): boolean {
  // 현재 모든 Expression 연산자는 순수함
  // 향후 사용자 정의 함수 허용 시 검증 필요
  return isValidExpression(expr);
}

/**
 * Expression이 상수인지 확인 (의존성 없음)
 */
export function isConstantExpression(expr: Expression): boolean {
  const analysis = analyzeExpression(expr);
  return analysis.directDeps.length === 0 && !analysis.usesContext;
}

/**
 * 두 Expression이 동일한지 확인 (구조적 동등성)
 */
export function areExpressionsEqual(a: Expression, b: Expression): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const aItem = a[i];
    const bItem = b[i];
    if (isValidExpression(aItem) && isValidExpression(bItem)) {
      if (!areExpressionsEqual(aItem, bItem)) return false;
    } else if (aItem !== bItem) {
      return false;
    }
  }

  return true;
}

/**
 * Expression 최적화 (기본적인 상수 폴딩)
 */
export function optimizeExpression(expr: Expression): Expression {
  if (expr === null || typeof expr !== 'object') return expr;
  if (!Array.isArray(expr)) return expr;

  const [op, ...args] = expr;

  // 재귀적으로 자식 최적화
  const optimizedArgs = args.map((arg) =>
    isValidExpression(arg) ? optimizeExpression(arg) : arg
  );

  // 상수 폴딩: 모든 인자가 리터럴이면 미리 계산
  const allLiterals = optimizedArgs.every(
    (arg) => !Array.isArray(arg) && typeof arg !== 'object'
  );

  if (allLiterals && canFoldOperator(op)) {
    // 상수 폴딩은 현재 생략 (런타임에 평가)
    // 향후 빌드 타임 최적화로 구현 가능
  }

  // all/any 단축 평가
  if (op === 'all') {
    // all에서 false 리터럴이 있으면 false
    if (optimizedArgs.some((arg) => arg === false)) {
      return false;
    }
    // all에서 모든 인자가 true면 true
    if (optimizedArgs.every((arg) => arg === true)) {
      return true;
    }
  }

  if (op === 'any') {
    // any에서 true 리터럴이 있으면 true
    if (optimizedArgs.some((arg) => arg === true)) {
      return true;
    }
    // any에서 모든 인자가 false면 false
    if (optimizedArgs.every((arg) => arg === false)) {
      return false;
    }
  }

  return [op, ...optimizedArgs] as Expression;
}

/**
 * 상수 폴딩이 가능한 연산자인지 확인
 */
function canFoldOperator(op: string): boolean {
  const foldableOps = new Set([
    '+',
    '-',
    '*',
    '/',
    '%',
    '==',
    '!=',
    '>',
    '>=',
    '<',
    '<=',
    '!',
    'concat',
    'upper',
    'lower',
    'trim',
  ]);
  return foldableOps.has(op);
}

/**
 * Expression에서 특정 경로에 대한 의존성 제거
 * (경로가 상수로 대체되었을 때 사용)
 */
export function substitutePathWithValue(
  expr: Expression,
  path: SemanticPath,
  value: Expression
): Expression {
  if (expr === null || typeof expr !== 'object') return expr;
  if (!Array.isArray(expr)) return expr;

  const [op, ...args] = expr;

  if (op === 'get' && args[0] === path) {
    return value;
  }

  return [
    op,
    ...args.map((arg) =>
      isValidExpression(arg) ? substitutePathWithValue(arg, path, value) : arg
    ),
  ] as Expression;
}
