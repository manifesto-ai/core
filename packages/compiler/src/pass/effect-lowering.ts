/**
 * Effect Lowering Pass
 *
 * assignment 및 function_call Finding을 분석하여
 * Effect로 변환하고 EffectFragment를 생성합니다.
 *
 * Priority: 300
 * Category: lowering
 * Depends on: code-ast-extractor
 *
 * PASS_OWNERSHIP: 부수효과만 담당, 조건은 Expression Pass가 처리
 */

import type { Effect, SetValueEffect, SetStateEffect, EmitEventEffect, ApiCallEffect, SemanticPath, Expression } from '@manifesto-ai/core';
import type { Artifact } from '../types/artifact.js';
import { isCodeArtifact } from '../types/artifact.js';
import type { EffectFragment, EffectRisk } from '../types/fragment.js';
import type {
  Pass,
  PassContext,
  Finding,
  AssignmentData,
  FunctionCallData,
} from './base.js';
import {
  createEffectFragment,
  type CreateEffectFragmentOptions,
} from '../fragment/index.js';
import { inferSemanticPath, convertToExpressionDSL } from './expression-lowering.js';

// ============================================================================
// Effect Pattern Detection
// ============================================================================

/**
 * Known emit-like function patterns
 */
const EMIT_PATTERNS = [
  'emit',
  'dispatch',
  'trigger',
  'notify',
  'publish',
  'send',
  'broadcast',
];

/**
 * Known API call patterns
 */
const API_PATTERNS = [
  'fetch',
  'axios',
  'api',
  'http',
  'request',
  'get',
  'post',
  'put',
  'patch',
  'delete',
];

/**
 * Determine if a function call is an emit-like effect
 */
function isEmitPattern(callee: string): boolean {
  const lowerCallee = callee.toLowerCase();
  return EMIT_PATTERNS.some((p) => lowerCallee.includes(p));
}

/**
 * Determine if a function call is an API call
 */
function isApiPattern(callee: string): boolean {
  const lowerCallee = callee.toLowerCase();
  return API_PATTERNS.some((p) => lowerCallee.includes(p));
}

/**
 * Determine HTTP method from function name
 */
function inferHttpMethod(callee: string): 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' {
  const lowerCallee = callee.toLowerCase();
  if (lowerCallee.includes('post')) return 'POST';
  if (lowerCallee.includes('put')) return 'PUT';
  if (lowerCallee.includes('patch')) return 'PATCH';
  if (lowerCallee.includes('delete')) return 'DELETE';
  return 'GET';
}

// ============================================================================
// Effect Conversion
// ============================================================================

/**
 * Convert assignment to SetValue/SetState Effect
 */
function convertAssignment(data: AssignmentData): Effect {
  const path = inferSemanticPath(data.target) as SemanticPath;
  const value = convertToExpressionDSL(data.value);

  // Determine if this is state or data
  const isState = path.startsWith('state.');

  if (isState) {
    return {
      _tag: 'SetState',
      path,
      value,
      description: `Set ${path} to new value`,
    } satisfies SetStateEffect;
  }

  return {
    _tag: 'SetValue',
    path,
    value,
    description: `Set ${path} to new value`,
  } satisfies SetValueEffect;
}

/**
 * Convert function call to Effect
 */
function convertFunctionCall(data: FunctionCallData): Effect | null {
  const callee = data.callee;

  // Check for emit pattern
  if (isEmitPattern(callee)) {
    const eventType = data.arguments[0];
    const eventData = data.arguments[1];

    return {
      _tag: 'EmitEvent',
      channel: 'domain',
      payload: {
        type: typeof eventType === 'string' ? eventType : String(eventType ?? 'unknown'),
        data: eventData,
      },
      description: `Emit ${callee} event`,
    } satisfies EmitEventEffect;
  }

  // Check for API pattern
  if (isApiPattern(callee)) {
    const method = inferHttpMethod(callee);
    const endpoint = data.arguments[0];

    const effect: ApiCallEffect = {
      _tag: 'ApiCall',
      endpoint: typeof endpoint === 'string' ? endpoint : String(endpoint ?? '/'),
      method,
      description: `${method} API call via ${callee}`,
    };

    // Add body for non-GET requests if second argument exists
    if (method !== 'GET' && data.arguments[1]) {
      effect.body = data.arguments[1] as Record<string, Expression>;
    }

    return effect;
  }

  // Unknown function call - skip (not an effect we recognize)
  return null;
}

// ============================================================================
// Risk Assessment
// ============================================================================

/**
 * Determine risk level for an effect
 */
function determineRisk(effect: Effect): EffectRisk {
  switch (effect._tag) {
    case 'SetValue':
      return 'low';
    case 'SetState':
      return 'low';
    case 'EmitEvent':
      return 'low';
    case 'Navigate':
      return 'low';
    case 'Delay':
      return 'none';
    case 'ApiCall': {
      const apiEffect = effect as ApiCallEffect;
      switch (apiEffect.method) {
        case 'GET':
          return 'medium';
        case 'POST':
        case 'PUT':
        case 'PATCH':
          return 'high';
        case 'DELETE':
          return 'critical';
        default:
          return 'medium';
      }
    }
    case 'Sequence':
    case 'Parallel':
      return 'medium'; // Composite effects need individual assessment
    case 'Conditional':
      return 'medium';
    case 'Catch':
      return 'medium';
    default:
      return 'medium';
  }
}

/**
 * Generate effect name from data
 */
function generateEffectName(data: AssignmentData | FunctionCallData, index: number): string {
  if (data.kind === 'assignment') {
    return `set_${(data as AssignmentData).target.replace(/\./g, '_')}_${index}`;
  }
  return `call_${(data as FunctionCallData).callee.replace(/\./g, '_')}_${index}`;
}

// ============================================================================
// Effect Lowering Pass
// ============================================================================

/**
 * Effect Lowering Pass
 *
 * Converts assignments and function calls to Effects.
 */
export const effectLoweringPass: Pass = {
  name: 'effect-lowering',
  priority: 300,
  dependsOn: ['code-ast-extractor'],
  category: 'lowering',

  supports(artifact: Artifact): boolean {
    return isCodeArtifact(artifact);
  },

  analyze(ctx: PassContext): Finding[] {
    // Filter assignment and function_call findings
    return ctx.previousFindings.filter(
      (f) => f.kind === 'assignment' || f.kind === 'function_call'
    );
  },

  compile(findings: Finding[], ctx: PassContext): EffectFragment[] {
    const fragments: EffectFragment[] = [];
    let effectIndex = 0;

    for (const finding of findings) {
      let effect: Effect | null = null;
      let sourceCode = '';

      if (finding.kind === 'assignment') {
        const data = finding.data as AssignmentData;
        effect = convertAssignment(data);
        sourceCode = data.sourceCode;
      } else if (finding.kind === 'function_call') {
        const data = finding.data as FunctionCallData;
        effect = convertFunctionCall(data);
        sourceCode = data.sourceCode;
      }

      if (!effect) continue;

      // Determine risk level
      const risk = determineRisk(effect);

      // Generate effect name
      const effectName = generateEffectName(
        finding.data as AssignmentData | FunctionCallData,
        effectIndex++
      );

      // Extract requires from effect
      const requires = extractEffectRequires(effect);

      // Create EffectFragment
      const options: CreateEffectFragmentOptions = {
        effect,
        requires,
        risk,
        name: effectName,
        origin: finding.provenance,
        evidence: [
          {
            kind: 'ast_node',
            ref: finding.id,
            excerpt: sourceCode,
          },
        ],
      };

      const fragment = createEffectFragment(options);
      fragments.push(fragment);
    }

    return fragments;
  },
};

/**
 * Extract requires (dependencies) from an effect
 */
function extractEffectRequires(effect: Effect): SemanticPath[] {
  const requires: SemanticPath[] = [];

  // Extract paths from effect based on type
  switch (effect._tag) {
    case 'SetValue':
    case 'SetState': {
      // Value might reference other paths
      extractPathsFromExpression(effect.value, requires);
      break;
    }
    case 'ApiCall': {
      // Body and query might reference paths
      if (effect.body) {
        for (const value of Object.values(effect.body)) {
          extractPathsFromExpression(value, requires);
        }
      }
      if (effect.query) {
        for (const value of Object.values(effect.query)) {
          extractPathsFromExpression(value, requires);
        }
      }
      break;
    }
    case 'Conditional': {
      extractPathsFromExpression(effect.condition, requires);
      requires.push(...extractEffectRequires(effect.then));
      if (effect.else) {
        requires.push(...extractEffectRequires(effect.else));
      }
      break;
    }
    case 'Sequence':
    case 'Parallel': {
      for (const e of effect.effects) {
        requires.push(...extractEffectRequires(e));
      }
      break;
    }
    case 'Catch': {
      requires.push(...extractEffectRequires(effect.try));
      requires.push(...extractEffectRequires(effect.catch));
      if (effect.finally) {
        requires.push(...extractEffectRequires(effect.finally));
      }
      break;
    }
    // EmitEvent, Navigate, Delay don't typically have dependencies
  }

  // Remove duplicates
  return [...new Set(requires)];
}

/**
 * Extract semantic paths from an expression
 */
function extractPathsFromExpression(expr: Expression, paths: SemanticPath[]): void {
  if (expr === null || expr === undefined) return;
  if (typeof expr === 'number' || typeof expr === 'string' || typeof expr === 'boolean') return;

  if (Array.isArray(expr)) {
    const [op, ...args] = expr;
    if (op === 'get' && typeof args[0] === 'string') {
      paths.push(args[0] as SemanticPath);
    } else {
      for (const arg of args) {
        extractPathsFromExpression(arg as Expression, paths);
      }
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export default effectLoweringPass;

/**
 * Helper exports for testing
 */
export {
  convertAssignment,
  convertFunctionCall,
  determineRisk,
  extractEffectRequires,
  isEmitPattern,
  isApiPattern,
};
