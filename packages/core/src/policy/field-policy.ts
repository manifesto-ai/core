import type { SemanticPath, ConditionRef, FieldPolicy } from '../domain/types.js';
import type { EvaluationContext } from '../expression/types.js';

/**
 * FieldPolicyEvaluation: 필드 정책 평가 결과
 */
export type FieldPolicyEvaluation = {
  /** 이 필드가 현재 의미있는지 (표시할지) */
  relevant: boolean;
  relevantReason?: string;
  relevantConditions?: ConditionEvaluationDetail[];

  /** 이 필드가 현재 수정 가능한지 */
  editable: boolean;
  editableReason?: string;
  editableConditions?: ConditionEvaluationDetail[];

  /** 이 필드가 현재 필수인지 */
  required: boolean;
  requiredReason?: string;
  requiredConditions?: ConditionEvaluationDetail[];
};

/**
 * ConditionEvaluationDetail: 조건 평가 상세
 */
export type ConditionEvaluationDetail = {
  condition: ConditionRef;
  actualValue: unknown;
  satisfied: boolean;
};

/**
 * 필드 정책 평가
 */
export function evaluateFieldPolicy(
  policy: FieldPolicy | undefined,
  ctx: EvaluationContext
): FieldPolicyEvaluation {
  if (!policy) {
    return {
      relevant: true,
      editable: true,
      required: false,
    };
  }

  const relevantResult = evaluateConditionList(policy.relevantWhen, ctx, true);
  const editableResult = evaluateConditionList(policy.editableWhen, ctx, true);
  const requiredResult = evaluateConditionList(policy.requiredWhen, ctx, false);

  return {
    relevant: relevantResult.satisfied,
    relevantReason: relevantResult.reason,
    relevantConditions: relevantResult.details,

    editable: editableResult.satisfied,
    editableReason: editableResult.reason,
    editableConditions: editableResult.details,

    required: requiredResult.satisfied,
    requiredReason: requiredResult.reason,
    requiredConditions: requiredResult.details,
  };
}

/**
 * 조건 목록 평가
 */
function evaluateConditionList(
  conditions: ConditionRef[] | undefined,
  ctx: EvaluationContext,
  defaultValue: boolean
): {
  satisfied: boolean;
  reason?: string;
  details: ConditionEvaluationDetail[];
} {
  if (!conditions || conditions.length === 0) {
    return { satisfied: defaultValue, details: [] };
  }

  const details: ConditionEvaluationDetail[] = [];
  let firstUnsatisfiedReason: string | undefined;

  for (const condition of conditions) {
    const actualValue = ctx.get(condition.path);
    const actualBoolean = Boolean(actualValue);
    const expectedBoolean = condition.expect !== 'false';
    const satisfied = actualBoolean === expectedBoolean;

    details.push({
      condition,
      actualValue,
      satisfied,
    });

    if (!satisfied && !firstUnsatisfiedReason) {
      firstUnsatisfiedReason = condition.reason;
    }
  }

  const allSatisfied = details.every((d) => d.satisfied);

  return {
    satisfied: allSatisfied,
    reason: allSatisfied ? undefined : firstUnsatisfiedReason,
    details,
  };
}

/**
 * UI 표현을 위한 필드 상태
 */
export type FieldUIState = {
  /** 보여야 하는지 */
  visible: boolean;
  /** 활성화 상태인지 */
  enabled: boolean;
  /** 필수 표시를 보여야 하는지 */
  showRequired: boolean;
  /** 비활성화 이유 (있으면) */
  disabledReason?: string;
  /** 숨김 이유 (있으면) */
  hiddenReason?: string;
};

/**
 * 필드 정책을 UI 상태로 변환
 */
export function policyToUIState(evaluation: FieldPolicyEvaluation): FieldUIState {
  return {
    visible: evaluation.relevant,
    enabled: evaluation.relevant && evaluation.editable,
    showRequired: evaluation.relevant && evaluation.required,
    disabledReason: evaluation.editable ? undefined : evaluation.editableReason,
    hiddenReason: evaluation.relevant ? undefined : evaluation.relevantReason,
  };
}

/**
 * 필드 정책의 의존성 추출
 */
export function extractFieldPolicyDependencies(policy: FieldPolicy): SemanticPath[] {
  const deps = new Set<SemanticPath>();

  for (const cond of policy.relevantWhen ?? []) {
    deps.add(cond.path);
  }

  for (const cond of policy.editableWhen ?? []) {
    deps.add(cond.path);
  }

  for (const cond of policy.requiredWhen ?? []) {
    deps.add(cond.path);
  }

  return [...deps];
}

/**
 * 다중 필드 정책 평가 (배치)
 */
export function evaluateMultipleFieldPolicies(
  policies: Record<SemanticPath, FieldPolicy | undefined>,
  ctx: EvaluationContext
): Record<SemanticPath, FieldPolicyEvaluation> {
  const results: Record<SemanticPath, FieldPolicyEvaluation> = {};

  for (const [path, policy] of Object.entries(policies)) {
    results[path] = evaluateFieldPolicy(policy, ctx);
  }

  return results;
}

/**
 * AI용 필드 정책 설명 생성
 */
export function explainFieldPolicy(
  path: SemanticPath,
  evaluation: FieldPolicyEvaluation
): string {
  const lines: string[] = [];

  lines.push(`Field: ${path}`);
  lines.push('');

  // Relevance
  lines.push(`Relevant: ${evaluation.relevant ? 'Yes' : 'No'}`);
  if (!evaluation.relevant) {
    lines.push(`  Reason: ${evaluation.relevantReason ?? 'Condition not met'}`);
    if (evaluation.relevantConditions) {
      for (const detail of evaluation.relevantConditions) {
        if (!detail.satisfied) {
          lines.push(`  - ${detail.condition.path}: expected ${detail.condition.expect ?? 'true'}, got ${Boolean(detail.actualValue)}`);
        }
      }
    }
  }

  // Editable
  lines.push(`Editable: ${evaluation.editable ? 'Yes' : 'No'}`);
  if (!evaluation.editable) {
    lines.push(`  Reason: ${evaluation.editableReason ?? 'Condition not met'}`);
    if (evaluation.editableConditions) {
      for (const detail of evaluation.editableConditions) {
        if (!detail.satisfied) {
          lines.push(`  - ${detail.condition.path}: expected ${detail.condition.expect ?? 'true'}, got ${Boolean(detail.actualValue)}`);
        }
      }
    }
  }

  // Required
  lines.push(`Required: ${evaluation.required ? 'Yes' : 'No'}`);
  if (evaluation.required && evaluation.requiredConditions) {
    lines.push('  Because:');
    for (const detail of evaluation.requiredConditions) {
      if (detail.satisfied) {
        lines.push(`  - ${detail.condition.path} = ${JSON.stringify(detail.actualValue)}`);
      }
    }
  }

  return lines.join('\n');
}
