/**
 * Draft Lowering
 *
 * FragmentDraft를 결정론적으로 검증하고 Fragment로 변환합니다.
 *
 * AGENT_README Invariant #2: LLM은 비신뢰 제안자
 * - Draft의 rawExpr/rawEffect를 검증
 * - provisionalRequires를 Expression 분석으로 검증/보정
 * - 검증 통과 시 Fragment 생성
 */

import type { Expression, SemanticPath } from '@manifesto-ai/core';
import { analyzeExpression, isEffect } from '@manifesto-ai/core';
import type { Fragment, SchemaField, SchemaFieldType } from '../types/fragment.js';
import type {
  FragmentDraft,
  SchemaDraft,
  DerivedDraft,
  ExpressionDraft,
  EffectDraft,
  ActionDraft,
  PolicyDraft,
  SourceDraft,
  StatementDraft,
  DraftLoweringResult,
  DraftValidationError,
  DraftValidationWarning,
} from '../types/fragment-draft.js';
import {
  createSchemaFragment,
  createSourceFragment,
  createExpressionFragment,
  createDerivedFragment,
  createPolicyFragment,
  createEffectFragment,
  createActionFragment,
  createStatementFragment,
} from '../fragment/index.js';

// ============================================================================
// Expression Validation
// ============================================================================

/**
 * Validate an expression and extract dependencies
 */
function validateExpression(rawExpr: unknown): {
  valid: boolean;
  expr?: Expression;
  deps?: SemanticPath[];
  errors?: DraftValidationError[];
} {
  // Handle primitives
  if (rawExpr === null || rawExpr === undefined) {
    return { valid: true, expr: null, deps: [] };
  }

  if (typeof rawExpr === 'number' || typeof rawExpr === 'string' || typeof rawExpr === 'boolean') {
    return { valid: true, expr: rawExpr, deps: [] };
  }

  // Handle arrays (Expression DSL)
  if (Array.isArray(rawExpr)) {
    try {
      // Try to analyze the expression
      const expr = rawExpr as Expression;
      const analysis = analyzeExpression(expr);
      return {
        valid: true,
        expr,
        deps: analysis.directDeps,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            code: 'INVALID_EXPRESSION',
            message: `Invalid expression: ${error instanceof Error ? error.message : 'unknown error'}`,
          },
        ],
      };
    }
  }

  // Unknown format
  return {
    valid: false,
    errors: [
      {
        code: 'INVALID_EXPRESSION',
        message: `Unsupported expression type: ${typeof rawExpr}`,
      },
    ],
  };
}

/**
 * Validate an effect
 */
function validateEffect(rawEffect: unknown): {
  valid: boolean;
  effect?: import('@manifesto-ai/core').Effect;
  errors?: DraftValidationError[];
} {
  if (!rawEffect) {
    return {
      valid: false,
      errors: [
        {
          code: 'INVALID_EFFECT',
          message: 'Effect is null or undefined',
        },
      ],
    };
  }

  if (isEffect(rawEffect)) {
    return { valid: true, effect: rawEffect };
  }

  return {
    valid: false,
    errors: [
      {
        code: 'INVALID_EFFECT',
        message: 'Invalid effect structure',
      },
    ],
  };
}

// ============================================================================
// Draft Validation
// ============================================================================

/**
 * Validate a draft's structure and content
 */
function validateDraft(draft: FragmentDraft): {
  valid: boolean;
  errors: DraftValidationError[];
  warnings: DraftValidationWarning[];
} {
  const errors: DraftValidationError[] = [];
  const warnings: DraftValidationWarning[] = [];

  // Check confidence
  if (draft.confidence < 0.3) {
    warnings.push({
      code: 'LOW_CONFIDENCE',
      message: `Draft has low confidence: ${draft.confidence}`,
    });
  }

  // Kind-specific validation
  switch (draft.kind) {
    case 'SchemaFragment': {
      const schemaDraft = draft as SchemaDraft;
      if (!schemaDraft.fields || schemaDraft.fields.length === 0) {
        errors.push({
          code: 'MISSING_FIELD',
          message: 'Schema draft has no fields',
          path: 'fields',
        });
      }
      for (const field of schemaDraft.fields || []) {
        if (!field.path) {
          errors.push({
            code: 'MISSING_FIELD',
            message: 'Schema field missing path',
            path: 'fields[].path',
          });
        }
      }
      break;
    }

    case 'DerivedFragment': {
      const derivedDraft = draft as DerivedDraft;
      if (!derivedDraft.path) {
        errors.push({
          code: 'MISSING_FIELD',
          message: 'Derived draft missing path',
          path: 'path',
        });
      }
      if (derivedDraft.rawExpr === undefined) {
        errors.push({
          code: 'MISSING_FIELD',
          message: 'Derived draft missing rawExpr',
          path: 'rawExpr',
        });
      }
      break;
    }

    case 'ExpressionFragment': {
      const exprDraft = draft as ExpressionDraft;
      if (exprDraft.rawExpr === undefined) {
        errors.push({
          code: 'MISSING_FIELD',
          message: 'Expression draft missing rawExpr',
          path: 'rawExpr',
        });
      }
      break;
    }

    case 'EffectFragment': {
      const effectDraft = draft as EffectDraft;
      if (!effectDraft.rawEffect) {
        errors.push({
          code: 'MISSING_FIELD',
          message: 'Effect draft missing rawEffect',
          path: 'rawEffect',
        });
      }
      break;
    }

    case 'ActionFragment': {
      const actionDraft = draft as ActionDraft;
      if (!actionDraft.actionId) {
        errors.push({
          code: 'MISSING_FIELD',
          message: 'Action draft missing actionId',
          path: 'actionId',
        });
      }
      break;
    }

    case 'SourceFragment': {
      const sourceDraft = draft as SourceDraft;
      if (!sourceDraft.path) {
        errors.push({
          code: 'MISSING_FIELD',
          message: 'Source draft missing path',
          path: 'path',
        });
      }
      break;
    }

    case 'PolicyFragment': {
      // Policy drafts are more flexible
      break;
    }

    case 'StatementFragment': {
      // Statement drafts are more flexible
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Draft Lowering
// ============================================================================

/**
 * Lower a SchemaDraft to SchemaFragment
 */
function lowerSchemaDraft(draft: SchemaDraft): DraftLoweringResult {
  const validation = validateDraft(draft);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  const fields: SchemaField[] = draft.fields.map((f) => ({
    path: f.path as SemanticPath,
    type: (f.type || 'unknown') as SchemaFieldType,
    optional: f.optional,
    defaultValue: f.defaultValue,
    semantic: f.semantic ? {
      type: f.semantic.type || 'unknown',
      description: f.semantic.description || '',
    } : undefined,
  }));

  const fragment = createSchemaFragment({
    namespace: draft.namespace,
    fields,
    origin: draft.origin,
    evidence: [],
    confidence: draft.confidence,
  });

  return {
    success: true,
    fragment,
    warnings: validation.warnings,
  };
}

/**
 * Lower a SourceDraft to SourceFragment
 */
function lowerSourceDraft(draft: SourceDraft): DraftLoweringResult {
  const validation = validateDraft(draft);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  const fragment = createSourceFragment({
    path: draft.path as SemanticPath,
    semantic: {
      type: draft.semantic.type || 'unknown',
      description: draft.semantic.description || '',
      writable: draft.semantic.writable,
    },
    origin: draft.origin,
    evidence: [],
    confidence: draft.confidence,
  });

  return {
    success: true,
    fragment,
    warnings: validation.warnings,
  };
}

/**
 * Lower an ExpressionDraft to ExpressionFragment
 */
function lowerExpressionDraft(draft: ExpressionDraft): DraftLoweringResult {
  const validation = validateDraft(draft);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  // Validate and parse expression
  const exprResult = validateExpression(draft.rawExpr);
  if (!exprResult.valid) {
    return {
      success: false,
      errors: [...validation.errors, ...(exprResult.errors || [])],
      warnings: validation.warnings,
    };
  }

  const fragment = createExpressionFragment({
    expr: exprResult.expr!,
    requires: exprResult.deps || [],
    name: draft.name,
    origin: draft.origin,
    evidence: [],
    confidence: draft.confidence,
  });

  return {
    success: true,
    fragment,
    warnings: validation.warnings,
  };
}

/**
 * Lower a DerivedDraft to DerivedFragment
 */
function lowerDerivedDraft(draft: DerivedDraft): DraftLoweringResult {
  const validation = validateDraft(draft);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  // Validate and parse expression
  const exprResult = validateExpression(draft.rawExpr);
  if (!exprResult.valid) {
    return {
      success: false,
      errors: [...validation.errors, ...(exprResult.errors || [])],
      warnings: validation.warnings,
    };
  }

  const fragment = createDerivedFragment({
    path: draft.path as SemanticPath,
    expr: exprResult.expr!,
    deps: exprResult.deps,
    requires: exprResult.deps || [],
    semantic: draft.semantic ? {
      type: draft.semantic.type || 'unknown',
      description: draft.semantic.description || '',
    } : undefined,
    origin: draft.origin,
    evidence: [],
    confidence: draft.confidence,
  });

  return {
    success: true,
    fragment,
    warnings: validation.warnings,
  };
}

/**
 * Lower a PolicyDraft to PolicyFragment
 */
function lowerPolicyDraft(draft: PolicyDraft): DraftLoweringResult {
  const validation = validateDraft(draft);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  // Convert raw preconditions to validated ones
  const preconditions = draft.validatedPreconditions || draft.rawPreconditions?.map((p) => ({
    path: p.path as SemanticPath,
    expect: (p.expect === 'false' ? 'false' : 'true') as 'true' | 'false',
    reason: p.reason,
  }));

  const fragment = createPolicyFragment({
    target: draft.target.kind === 'action'
      ? { kind: 'action', actionId: draft.target.actionId }
      : { kind: 'field', path: draft.target.path as SemanticPath },
    preconditions,
    fieldPolicy: draft.validatedFieldPolicy,
    origin: draft.origin,
    evidence: [],
    confidence: draft.confidence,
  });

  return {
    success: true,
    fragment,
    warnings: validation.warnings,
  };
}

/**
 * Lower an EffectDraft to EffectFragment
 */
function lowerEffectDraft(draft: EffectDraft): DraftLoweringResult {
  const validation = validateDraft(draft);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  // Validate effect
  const effectResult = validateEffect(draft.rawEffect);
  if (!effectResult.valid) {
    return {
      success: false,
      errors: [...validation.errors, ...(effectResult.errors || [])],
      warnings: validation.warnings,
    };
  }

  const fragment = createEffectFragment({
    effect: effectResult.effect!,
    requires: draft.provisionalRequires as SemanticPath[],
    risk: draft.risk,
    name: draft.name,
    origin: draft.origin,
    evidence: [],
    confidence: draft.confidence,
  });

  return {
    success: true,
    fragment,
    warnings: validation.warnings,
  };
}

/**
 * Lower an ActionDraft to ActionFragment
 */
function lowerActionDraft(draft: ActionDraft): DraftLoweringResult {
  const validation = validateDraft(draft);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  // Convert preconditions
  const preconditions = draft.validatedPreconditions || draft.rawPreconditions?.map((p) => ({
    path: p.path as SemanticPath,
    expect: (p.expect === 'false' ? 'false' : 'true') as 'true' | 'false',
    reason: p.reason,
  }));

  // Validate effect if present
  let effect: import('@manifesto-ai/core').Effect | undefined;
  if (draft.rawEffect) {
    const effectResult = validateEffect(draft.rawEffect);
    if (!effectResult.valid) {
      return {
        success: false,
        errors: [...validation.errors, ...(effectResult.errors || [])],
        warnings: validation.warnings,
      };
    }
    effect = effectResult.effect;
  }

  const fragment = createActionFragment({
    actionId: draft.actionId,
    requires: draft.provisionalRequires as SemanticPath[],
    preconditions,
    effectRef: draft.effectRef,
    effect: effect || draft.validatedEffect,
    semantic: draft.semantic ? {
      verb: draft.semantic.verb || draft.actionId,
      description: draft.semantic.description || `${draft.actionId} action`,
      risk: draft.semantic.risk,
    } : {
      verb: draft.actionId,
      description: `${draft.actionId} action`,
    },
    risk: draft.risk,
    origin: draft.origin,
    evidence: [],
    confidence: draft.confidence,
  });

  return {
    success: true,
    fragment,
    warnings: validation.warnings,
  };
}

/**
 * Lower a StatementDraft to StatementFragment
 */
function lowerStatementDraft(draft: StatementDraft): DraftLoweringResult {
  const validation = validateDraft(draft);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  const fragment = createStatementFragment({
    statementType: draft.statementType === 'unknown' ? 'unknown' : draft.statementType,
    requires: draft.provisionalRequires as SemanticPath[],
    sourceCode: draft.sourceCode,
    origin: draft.origin,
    evidence: [],
    confidence: draft.confidence,
  });

  return {
    success: true,
    fragment,
    warnings: validation.warnings,
  };
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Lower a FragmentDraft to Fragment
 *
 * This is the deterministic conversion that validates LLM output
 * and produces verified Fragments.
 */
export function lowerDraft(draft: FragmentDraft): DraftLoweringResult {
  switch (draft.kind) {
    case 'SchemaFragment':
      return lowerSchemaDraft(draft as SchemaDraft);
    case 'SourceFragment':
      return lowerSourceDraft(draft as SourceDraft);
    case 'ExpressionFragment':
      return lowerExpressionDraft(draft as ExpressionDraft);
    case 'DerivedFragment':
      return lowerDerivedDraft(draft as DerivedDraft);
    case 'PolicyFragment':
      return lowerPolicyDraft(draft as PolicyDraft);
    case 'EffectFragment':
      return lowerEffectDraft(draft as EffectDraft);
    case 'ActionFragment':
      return lowerActionDraft(draft as ActionDraft);
    case 'StatementFragment':
      return lowerStatementDraft(draft as StatementDraft);
    default:
      return {
        success: false,
        errors: [
          {
            code: 'TYPE_MISMATCH',
            message: `Unknown draft kind: ${(draft as FragmentDraft).kind}`,
          },
        ],
      };
  }
}

/**
 * Lower multiple drafts and collect results
 */
export function lowerDrafts(drafts: FragmentDraft[]): {
  fragments: Fragment[];
  results: DraftLoweringResult[];
} {
  const fragments: Fragment[] = [];
  const results: DraftLoweringResult[] = [];

  for (const draft of drafts) {
    const result = lowerDraft(draft);
    results.push(result);

    if (result.success && result.fragment) {
      fragments.push(result.fragment);
    }
  }

  return { fragments, results };
}

// ============================================================================
// Export
// ============================================================================

export {
  validateDraft,
  validateExpression,
  validateEffect,
};
