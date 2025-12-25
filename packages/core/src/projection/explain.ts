/**
 * Explain Functions
 *
 * Generate human-readable explanations for values, actions, and fields
 */

import type { SemanticPath, ManifestoDomain } from '../domain/types.js';
import type { DomainRuntime, ExplanationTree } from '../runtime/runtime.js';
import type { Expression } from '../expression/types.js';
import { expressionToString } from '../expression/parser.js';
import type {
  ExplainValueResult,
  ExplainActionResult,
  ExplainFieldResult,
} from './types.js';

/**
 * Generate a natural language summary for an expression
 */
function summarizeExpression(expr: Expression | undefined, value: unknown): string {
  if (!expr) {
    return `Value is ${JSON.stringify(value)}`;
  }

  const exprStr = expressionToString(expr);
  return `Computed as ${exprStr} = ${JSON.stringify(value)}`;
}

/**
 * Generate a natural language summary for an explanation tree
 */
function generateSummary(tree: ExplanationTree): string {
  const { path, value, dependencies, expression } = tree;

  if (dependencies.length === 0) {
    return `${path} = ${JSON.stringify(value)} (source value)`;
  }

  const depList = dependencies
    .map((d) => `${d.path}=${JSON.stringify(d.value)}`)
    .join(', ');

  if (expression) {
    const exprStr = expressionToString(expression);
    return `${path} = ${exprStr} [where ${depList}] = ${JSON.stringify(value)}`;
  }

  return `${path} = ${JSON.stringify(value)} [depends on: ${depList}]`;
}

/**
 * Explain a value at a path
 *
 * @param runtime - Domain runtime
 * @param path - Path to explain
 * @returns Explanation with natural language summary
 *
 * @example
 * ```typescript
 * const explanation = explainValue(runtime, 'derived.total');
 * console.log(explanation.summary);
 * // "derived.total = subtotal - discount [where subtotal=100, discount=10] = 90"
 * ```
 */
export function explainValue<TData, TState>(
  runtime: DomainRuntime<TData, TState>,
  path: SemanticPath
): ExplainValueResult {
  const tree = runtime.explain(path);
  const summary = generateSummary(tree);

  return {
    ...tree,
    summary,
  };
}

/**
 * Explain an action
 *
 * @param runtime - Domain runtime
 * @param domain - Domain definition
 * @param actionId - Action to explain
 * @returns Action explanation with dependencies, preconditions, and impact
 *
 * @example
 * ```typescript
 * const explanation = explainAction(runtime, domain, 'submitOrder');
 * console.log(explanation.summary);
 * // "Action 'submitOrder' requires cartNotEmpty=true (currently true),
 * //  will affect: derived.orderTotal, async.submitResult"
 * ```
 */
export function explainAction<TData, TState>(
  runtime: DomainRuntime<TData, TState>,
  domain: ManifestoDomain<TData, TState>,
  actionId: string
): ExplainActionResult {
  const action = domain.actions[actionId];
  if (!action) {
    throw new Error(`Action not found: ${actionId}`);
  }

  // Explain dependencies
  const dependencies: ExplainValueResult[] = action.deps.map((dep) =>
    explainValue(runtime, dep)
  );

  // Explain preconditions
  const preconditionStatuses = runtime.getPreconditions(actionId);
  const preconditions = preconditionStatuses.map((p) => {
    const statusStr = p.satisfied ? 'satisfied' : 'NOT satisfied';
    const expectStr = p.expect === 'true' ? 'true' : 'false';
    const explanation = `${p.path} should be ${expectStr}, currently ${p.actual} (${statusStr})${p.reason ? `: ${p.reason}` : ''}`;
    return { ...p, explanation };
  });

  // Estimate impact
  const estimatedImpact = action.deps.flatMap((dep) => {
    const impactPaths = runtime.getImpact(dep);
    return impactPaths.map((path) => ({
      path,
      semantic: runtime.getSemantic(path),
    }));
  });

  // Generate summary
  const isAvailable = preconditions.every((p) => p.satisfied);
  const statusStr = isAvailable ? 'available' : 'blocked';

  const precondStr = preconditions.length > 0
    ? preconditions.map((p) => `${p.path}=${p.actual}`).join(', ')
    : 'none';

  const impactStr = estimatedImpact.length > 0
    ? estimatedImpact.map((i) => i.path).join(', ')
    : 'none';

  const summary = `Action '${actionId}' is ${statusStr}. Preconditions: [${precondStr}]. Estimated impact: [${impactStr}].`;

  return {
    actionId,
    semantic: action.semantic,
    dependencies,
    preconditions,
    estimatedImpact,
    summary,
  };
}

/**
 * Explain a field's policy
 *
 * @param runtime - Domain runtime
 * @param domain - Domain definition
 * @param path - Field path
 * @returns Field explanation with policy details
 *
 * @example
 * ```typescript
 * const explanation = explainField(runtime, domain, 'data.discountCode');
 * console.log(explanation.summary);
 * // "Field 'data.discountCode' is visible, editable, optional"
 * ```
 */
export function explainField<TData, TState>(
  runtime: DomainRuntime<TData, TState>,
  domain: ManifestoDomain<TData, TState>,
  path: SemanticPath
): ExplainFieldResult {
  const value = runtime.get(path);
  const semantic = runtime.getSemantic(path);
  const policy = runtime.getFieldPolicy(path);

  // Generate policy explanations
  const policyExplanation = {
    relevant: policy.relevant
      ? 'Field is currently visible/relevant'
      : `Field is hidden${policy.relevantReason ? `: ${policy.relevantReason}` : ''}`,
    editable: policy.editable
      ? 'Field is currently editable'
      : `Field is read-only${policy.editableReason ? `: ${policy.editableReason}` : ''}`,
    required: policy.required
      ? `Field is required${policy.requiredReason ? `: ${policy.requiredReason}` : ''}`
      : 'Field is optional',
  };

  // Generate summary
  const visibilityStr = policy.relevant ? 'visible' : 'hidden';
  const editableStr = policy.editable ? 'editable' : 'read-only';
  const requiredStr = policy.required ? 'required' : 'optional';

  const summary = `Field '${path}' is ${visibilityStr}, ${editableStr}, ${requiredStr}. Current value: ${JSON.stringify(value)}`;

  return {
    path,
    value,
    semantic,
    policy,
    policyExplanation,
    summary,
  };
}
