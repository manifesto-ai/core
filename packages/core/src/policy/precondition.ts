import type { SemanticPath, ConditionRef, ActionDefinition } from '../domain/types.js';
import type { EvaluationContext } from '../expression/types.js';
import { evaluate } from '../expression/evaluator.js';

/**
 * PreconditionEvaluationResult: 전제조건 평가 결과
 */
export type PreconditionEvaluationResult = {
  /** 조건 참조 */
  condition: ConditionRef;
  /** 실제 평가된 값 */
  actualValue: unknown;
  /** 조건 충족 여부 */
  satisfied: boolean;
  /** 디버그 정보 */
  debug?: {
    path: SemanticPath;
    expectedBoolean: boolean;
    actualBoolean: boolean;
  };
};

/**
 * ActionAvailability: 액션 실행 가능성
 */
export type ActionAvailability = {
  /** 실행 가능 여부 */
  available: boolean;
  /** 충족되지 않은 조건들 */
  unsatisfiedConditions: PreconditionEvaluationResult[];
  /** 사람이 읽을 수 있는 이유 */
  reasons: string[];
  /** AI용 상세 설명 */
  explanation: string;
};

/**
 * 전제조건 평가
 */
export function evaluatePrecondition(
  condition: ConditionRef,
  ctx: EvaluationContext
): PreconditionEvaluationResult {
  const actualValue = ctx.get(condition.path);
  const actualBoolean = Boolean(actualValue);
  const expectedBoolean = condition.expect !== 'false';
  const satisfied = actualBoolean === expectedBoolean;

  return {
    condition,
    actualValue,
    satisfied,
    debug: {
      path: condition.path,
      expectedBoolean,
      actualBoolean,
    },
  };
}

/**
 * 모든 전제조건 평가
 */
export function evaluateAllPreconditions(
  conditions: ConditionRef[],
  ctx: EvaluationContext
): PreconditionEvaluationResult[] {
  return conditions.map((cond) => evaluatePrecondition(cond, ctx));
}

/**
 * 액션 실행 가능성 확인
 */
export function checkActionAvailability(
  action: ActionDefinition,
  ctx: EvaluationContext
): ActionAvailability {
  if (!action.preconditions || action.preconditions.length === 0) {
    return {
      available: true,
      unsatisfiedConditions: [],
      reasons: [],
      explanation: `Action "${action.semantic.verb}" is available with no preconditions.`,
    };
  }

  const results = evaluateAllPreconditions(action.preconditions, ctx);
  const unsatisfied = results.filter((r) => !r.satisfied);

  if (unsatisfied.length === 0) {
    return {
      available: true,
      unsatisfiedConditions: [],
      reasons: [],
      explanation: `Action "${action.semantic.verb}" is available. All ${results.length} preconditions are satisfied.`,
    };
  }

  const reasons = unsatisfied.map((r) => {
    if (r.condition.reason) {
      return r.condition.reason;
    }
    const expected = r.condition.expect !== 'false' ? 'true' : 'false';
    const actual = Boolean(r.actualValue) ? 'true' : 'false';
    return `${r.condition.path} should be ${expected}, but is ${actual}`;
  });

  const explanation = generateExplanation(action, unsatisfied);

  return {
    available: false,
    unsatisfiedConditions: unsatisfied,
    reasons,
    explanation,
  };
}

/**
 * AI용 설명 생성
 */
function generateExplanation(
  action: ActionDefinition,
  unsatisfied: PreconditionEvaluationResult[]
): string {
  const lines: string[] = [];

  lines.push(`Action "${action.semantic.verb}" is NOT available.`);
  lines.push('');
  lines.push('Unsatisfied preconditions:');

  for (const result of unsatisfied) {
    const cond = result.condition;
    const expected = cond.expect !== 'false' ? 'true' : 'false';
    const actual = Boolean(result.actualValue) ? 'true' : 'false';

    lines.push(`  - ${cond.path}`);
    lines.push(`    Expected: ${expected}`);
    lines.push(`    Actual: ${actual} (raw: ${JSON.stringify(result.actualValue)})`);

    if (cond.reason) {
      lines.push(`    Reason: ${cond.reason}`);
    }
  }

  lines.push('');
  lines.push('To enable this action:');

  for (const result of unsatisfied) {
    const cond = result.condition;
    const expected = cond.expect !== 'false';

    if (expected) {
      lines.push(`  - Make ${cond.path} evaluate to true`);
    } else {
      lines.push(`  - Make ${cond.path} evaluate to false`);
    }
  }

  return lines.join('\n');
}

/**
 * 전제조건 의존성 추출
 */
export function extractPreconditionDependencies(
  conditions: ConditionRef[]
): SemanticPath[] {
  return conditions.map((c) => c.path);
}

/**
 * 전제조건 충족을 위한 필요 변경 분석
 */
export function analyzePreconditionRequirements(
  unsatisfied: PreconditionEvaluationResult[]
): Array<{
  path: SemanticPath;
  currentValue: unknown;
  requiredValue: boolean;
  reason?: string;
}> {
  return unsatisfied.map((result) => ({
    path: result.condition.path,
    currentValue: result.actualValue,
    requiredValue: result.condition.expect !== 'false',
    reason: result.condition.reason,
  }));
}
