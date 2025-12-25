/**
 * Expression Lowering Pass
 *
 * binary_expression 및 if_statement의 condition Finding을 분석하여
 * Expression DSL로 변환하고 ExpressionFragment 또는 DerivedFragment를 생성합니다.
 *
 * Priority: 200
 * Category: lowering
 * Depends on: code-ast-extractor
 *
 * PASS_OWNERSHIP: 조건/표현식만 담당, Effect는 Effect Pass가 처리
 */

import type { Expression, SemanticPath } from '@manifesto-ai/core';
import { analyzeExpression } from '@manifesto-ai/core';
import type { Artifact } from '../types/artifact.js';
import { isCodeArtifact } from '../types/artifact.js';
import type { ExpressionFragment, DerivedFragment } from '../types/fragment.js';
import type {
  Pass,
  PassContext,
  Finding,
  BinaryExpressionData,
  IfStatementData,
} from './base.js';
import {
  createExpressionFragment,
  createDerivedFragment,
  type CreateExpressionFragmentOptions,
  type CreateDerivedFragmentOptions,
} from '../fragment/index.js';

// ============================================================================
// Operator Mapping
// ============================================================================

/**
 * Map JavaScript operators to Expression DSL operators
 */
const BINARY_OPERATOR_MAP: Record<string, string> = {
  // Comparison
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  '===': '==',
  '!==': '!=',
  '==': '==',
  '!=': '!=',
  // Arithmetic
  '+': '+',
  '-': '-',
  '*': '*',
  '/': '/',
  '%': '%',
};

/**
 * Map logical operators
 */
const LOGICAL_OPERATOR_MAP: Record<string, string> = {
  '&&': 'all',
  '||': 'any',
};

// ============================================================================
// Expression Conversion
// ============================================================================

/**
 * Convert AST expression value to Expression DSL
 */
function convertToExpressionDSL(value: unknown): Expression {
  if (value === null) return null;
  if (value === undefined) return null;

  // Primitives
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value;

  // Objects (from AST extraction)
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    // Identifier → get expression
    if (obj.type === 'identifier' && typeof obj.name === 'string') {
      const path = inferSemanticPath(obj.name);
      return ['get', path] as Expression;
    }

    // Binary expression
    if (obj.type === 'binary') {
      const operator = obj.operator as string;
      const left = convertToExpressionDSL(obj.left);
      const right = convertToExpressionDSL(obj.right);

      // Handle logical operators (variadic)
      if (operator === '&&') {
        return ['all', left, right] as Expression;
      }
      if (operator === '||') {
        return ['any', left, right] as Expression;
      }

      // Handle other binary operators
      const dslOperator = BINARY_OPERATOR_MAP[operator];
      if (dslOperator) {
        return [dslOperator, left, right] as Expression;
      }

      // Unknown operator - return as-is
      return [operator, left, right] as Expression;
    }

    // Member expression → get expression
    if (obj.type === 'member' && typeof obj.path === 'string') {
      const path = inferSemanticPath(obj.path);
      return ['get', path] as Expression;
    }

    // Other expression types - wrap as unknown
    return null;
  }

  return null;
}

/**
 * Infer semantic path from identifier/member expression
 *
 * Simple heuristic:
 * - If already has namespace prefix (data., state., derived.), keep it
 * - Otherwise, assume data namespace
 */
function inferSemanticPath(name: string): SemanticPath {
  // Check if already has namespace
  if (
    name.startsWith('data.') ||
    name.startsWith('state.') ||
    name.startsWith('derived.')
  ) {
    return name as SemanticPath;
  }

  // Default to data namespace
  return `data.${name}` as SemanticPath;
}

/**
 * Generate a unique expression ID
 */
function generateExpressionId(artifactId: string, index: number): string {
  return `${artifactId}_expr_${index}`;
}

// ============================================================================
// Expression Lowering Pass
// ============================================================================

/**
 * Expression Lowering Pass
 *
 * Converts binary expressions and conditions to Expression DSL.
 */
export const expressionLoweringPass: Pass = {
  name: 'expression-lowering',
  priority: 200,
  dependsOn: ['code-ast-extractor'],
  category: 'lowering',

  supports(artifact: Artifact): boolean {
    return isCodeArtifact(artifact);
  },

  analyze(ctx: PassContext): Finding[] {
    // Filter binary_expression and if_statement findings
    return ctx.previousFindings.filter(
      (f) => f.kind === 'binary_expression' || f.kind === 'if_statement'
    );
  },

  compile(findings: Finding[], ctx: PassContext): (ExpressionFragment | DerivedFragment)[] {
    const fragments: (ExpressionFragment | DerivedFragment)[] = [];
    let expressionIndex = 0;

    for (const finding of findings) {
      let expression: Expression | null = null;
      let sourceCode = '';

      if (finding.kind === 'binary_expression') {
        const data = finding.data as BinaryExpressionData;
        expression = convertBinaryExpression(data);
        sourceCode = data.sourceCode;
      } else if (finding.kind === 'if_statement') {
        const data = finding.data as IfStatementData;
        expression = convertToExpressionDSL(data.condition);
        sourceCode = extractConditionSource(data.sourceCode);
      }

      if (!expression) continue;

      // Analyze expression to get dependencies
      let deps: SemanticPath[] = [];
      try {
        const analysis = analyzeExpression(expression);
        deps = analysis.directDeps;
      } catch {
        // If analysis fails, continue without deps
        ctx.log('warn', `Failed to analyze expression from ${finding.id}`);
      }

      // Generate a semantic path for this expression
      const exprId = generateExpressionId(ctx.artifact.id, expressionIndex++);
      const exprPath = `derived.${exprId}` as SemanticPath;

      // Create DerivedFragment (expressions that compute values)
      const options: CreateDerivedFragmentOptions = {
        path: exprPath,
        expr: expression,
        deps,
        requires: deps,
        origin: finding.provenance,
        evidence: [
          {
            kind: 'ast_node',
            ref: finding.id,
            excerpt: sourceCode,
          },
        ],
      };

      const fragment = createDerivedFragment(options);
      fragments.push(fragment);
    }

    return fragments;
  },
};

/**
 * Convert BinaryExpressionData to Expression DSL
 */
function convertBinaryExpression(data: BinaryExpressionData): Expression {
  const operator = data.operator;
  const left = convertToExpressionDSL(data.left);
  const right = convertToExpressionDSL(data.right);

  // Handle logical operators
  if (operator === '&&') {
    return ['all', left, right] as Expression;
  }
  if (operator === '||') {
    return ['any', left, right] as Expression;
  }

  // Handle comparison and arithmetic operators
  const dslOperator = BINARY_OPERATOR_MAP[operator];
  if (dslOperator) {
    return [dslOperator, left, right] as Expression;
  }

  // Unknown operator - return as-is
  return [operator, left, right] as Expression;
}

/**
 * Extract condition source from if statement source code
 */
function extractConditionSource(sourceCode: string): string {
  // Extract the condition from "if (condition) {"
  const match = /if\s*\((.+?)\)\s*\{/.exec(sourceCode);
  return match?.[1] ?? sourceCode;
}

// ============================================================================
// Export
// ============================================================================

export default expressionLoweringPass;

/**
 * Helper to convert JS expression to Expression DSL
 */
export { convertToExpressionDSL, inferSemanticPath };
