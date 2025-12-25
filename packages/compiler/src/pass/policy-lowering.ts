/**
 * Policy Lowering Pass
 *
 * if_statement Finding에서 early return guard 패턴을 감지하여
 * PolicyFragment를 생성합니다.
 *
 * Priority: 400
 * Category: lowering
 * Depends on: code-ast-extractor, expression-lowering
 *
 * PASS_OWNERSHIP: 참조만 생성, 조건 자체는 Expression Pass가 처리
 */

import type { SemanticPath, ConditionRef, FieldPolicy } from '@manifesto-ai/core';
import type { Artifact } from '../types/artifact.js';
import { isCodeArtifact } from '../types/artifact.js';
import type { PolicyFragment } from '../types/fragment.js';
import type {
  Pass,
  PassContext,
  Finding,
  IfStatementData,
  FunctionDeclarationData,
} from './base.js';
import {
  createPolicyFragment,
  type CreatePolicyFragmentOptions,
} from '../fragment/index.js';
import { inferSemanticPath, convertToExpressionDSL } from './expression-lowering.js';

// ============================================================================
// Pattern Detection Types
// ============================================================================

/**
 * Detected policy pattern
 */
type PolicyPattern =
  | EarlyReturnGuard
  | ConditionalRender
  | FieldGuard;

/**
 * Early return guard pattern
 * e.g., if (!canSubmit) return;
 */
interface EarlyReturnGuard {
  kind: 'early_return_guard';
  condition: ConditionRef;
  actionContext?: string; // e.g., "submit" from parent function
}

/**
 * Conditional render pattern
 * e.g., {showField && <Input />}
 */
interface ConditionalRender {
  kind: 'conditional_render';
  fieldPath: SemanticPath;
  condition: ConditionRef;
}

/**
 * Field guard pattern
 * e.g., if (field.enabled) { ... }
 */
interface FieldGuard {
  kind: 'field_guard';
  fieldPath: SemanticPath;
  condition: ConditionRef;
}

// ============================================================================
// Pattern Detection
// ============================================================================

/**
 * Detect early return guard pattern from if statement
 *
 * Patterns detected:
 * - if (!condition) return;
 * - if (condition) return;
 * - if (invalid) return;
 */
function detectEarlyReturnGuard(data: IfStatementData, ctx: PassContext): EarlyReturnGuard | null {
  // Check if consequent is a return statement (early return)
  const hasReturnInConsequent = data.consequentFindings.some((findingId) => {
    const finding = ctx.previousFindings.find((f) => f.id === findingId);
    return finding?.kind === 'return_statement';
  });

  if (!hasReturnInConsequent) {
    return null;
  }

  // Extract condition
  const conditionRef = extractConditionRef(data.condition);
  if (!conditionRef) {
    return null;
  }

  // Try to infer action context from parent function
  const actionContext = inferActionContext(data, ctx);

  return {
    kind: 'early_return_guard',
    condition: conditionRef,
    actionContext,
  };
}

/**
 * Extract ConditionRef from AST condition
 */
function extractConditionRef(condition: unknown): ConditionRef | null {
  if (!condition || typeof condition !== 'object') {
    return null;
  }

  const obj = condition as Record<string, unknown>;

  // Handle negation: !condition → expect: 'true' (guard blocks when false)
  if (obj.type === 'unary' && obj.operator === '!' && obj.argument) {
    const innerPath = extractPathFromCondition(obj.argument);
    if (innerPath) {
      return {
        path: innerPath,
        expect: 'true', // The guard triggers when condition is false
        reason: `Guard requires ${innerPath} to be true`,
      };
    }
  }

  // Handle direct condition: condition → expect: 'false' (guard blocks when true)
  const directPath = extractPathFromCondition(condition);
  if (directPath) {
    return {
      path: directPath,
      expect: 'false', // The guard triggers when condition is true
      reason: `Guard requires ${directPath} to be false`,
    };
  }

  // Handle binary comparison: a === false → expect: 'true'
  if (obj.type === 'binary') {
    const operator = obj.operator as string;

    // Check for comparison with boolean literals
    if (operator === '===' || operator === '==' || operator === '!==' || operator === '!=') {
      const leftPath = extractPathFromCondition(obj.left);
      const rightPath = extractPathFromCondition(obj.right);

      if (leftPath) {
        const isNegation = operator === '!==' || operator === '!=';
        const rightValue = obj.right;

        if (rightValue === false || rightValue === 'false') {
          // a === false → expect: 'true'
          // a !== false → expect: 'false'
          return {
            path: leftPath,
            expect: isNegation ? 'false' : 'true',
          };
        }

        if (rightValue === true || rightValue === 'true') {
          // a === true → expect: 'false'
          // a !== true → expect: 'true'
          return {
            path: leftPath,
            expect: isNegation ? 'true' : 'false',
          };
        }
      }
    }
  }

  return null;
}

/**
 * Extract semantic path from condition expression
 */
function extractPathFromCondition(condition: unknown): SemanticPath | null {
  if (!condition || typeof condition !== 'object') {
    return null;
  }

  const obj = condition as Record<string, unknown>;

  // Identifier
  if (obj.type === 'identifier' && typeof obj.name === 'string') {
    return inferSemanticPath(obj.name) as SemanticPath;
  }

  // Member expression
  if (obj.type === 'member' && typeof obj.path === 'string') {
    return inferSemanticPath(obj.path) as SemanticPath;
  }

  return null;
}

/**
 * Infer action context from parent function name
 */
function inferActionContext(data: IfStatementData, ctx: PassContext): string | undefined {
  // Look for a function_declaration that might be the parent
  const functionFinding = ctx.previousFindings.find(
    (f) => f.kind === 'function_declaration'
  );

  if (functionFinding) {
    const funcData = functionFinding.data as FunctionDeclarationData;
    return extractActionVerb(funcData.name);
  }

  return undefined;
}

/**
 * Extract action verb from function name
 */
function extractActionVerb(functionName: string): string {
  // Common patterns: handleSubmit → submit, onSave → save
  const patterns = [
    { prefix: 'handle', replacement: '' },
    { prefix: 'on', replacement: '' },
    { prefix: 'do', replacement: '' },
  ];

  let name = functionName;
  for (const pattern of patterns) {
    if (name.toLowerCase().startsWith(pattern.prefix.toLowerCase())) {
      name = name.slice(pattern.prefix.length);
      break;
    }
  }

  // Convert to lowercase first letter
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Invert condition expectation
 * Early return guards check the inverse condition
 */
function invertExpectation(expect: 'true' | 'false' | undefined): 'true' | 'false' {
  return expect === 'true' ? 'false' : 'true';
}

// ============================================================================
// Policy Lowering Pass
// ============================================================================

/**
 * Policy Lowering Pass
 *
 * Detects guard patterns and creates PolicyFragments.
 */
export const policyLoweringPass: Pass = {
  name: 'policy-lowering',
  priority: 400,
  dependsOn: ['code-ast-extractor', 'expression-lowering'],
  category: 'lowering',

  supports(artifact: Artifact): boolean {
    return isCodeArtifact(artifact);
  },

  analyze(ctx: PassContext): Finding[] {
    // Filter if_statement findings
    return ctx.previousFindings.filter((f) => f.kind === 'if_statement');
  },

  compile(findings: Finding[], ctx: PassContext): PolicyFragment[] {
    const fragments: PolicyFragment[] = [];

    for (const finding of findings) {
      const data = finding.data as IfStatementData;

      // Detect early return guard pattern
      const guard = detectEarlyReturnGuard(data, ctx);
      if (guard) {
        // Create precondition for the action
        // The precondition should be the INVERTED condition
        // because early return means "block when condition is true"
        const precondition: ConditionRef = {
          path: guard.condition.path,
          expect: invertExpectation(guard.condition.expect),
          reason: guard.condition.reason?.replace('Guard requires', 'Action requires'),
        };

        const actionId = guard.actionContext ?? 'unknown';

        const options: CreatePolicyFragmentOptions = {
          target: {
            kind: 'action',
            actionId,
          },
          preconditions: [precondition],
          origin: finding.provenance,
          evidence: [
            {
              kind: 'ast_node',
              ref: finding.id,
              excerpt: data.sourceCode,
            },
          ],
        };

        const fragment = createPolicyFragment(options);
        fragments.push(fragment);
      }
    }

    return fragments;
  },
};

// ============================================================================
// Export
// ============================================================================

export default policyLoweringPass;

/**
 * Helper exports for testing
 */
export {
  detectEarlyReturnGuard,
  extractConditionRef,
  extractPathFromCondition,
  extractActionVerb,
  invertExpectation,
};
