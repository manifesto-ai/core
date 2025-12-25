/**
 * Action Pass
 *
 * function_declaration Finding에서 액션 패턴을 감지하고
 * 관련 Effect/Policy Fragment 참조를 수집하여 ActionFragment를 조립합니다.
 *
 * Priority: 500
 * Category: lowering
 * Depends on: effect-lowering, policy-lowering
 *
 * PASS_OWNERSHIP: 조립만 담당, 새 Effect/Policy 생성 금지
 */

import type { SemanticPath, ConditionRef, Effect } from '@manifesto-ai/core';
import type { Artifact } from '../types/artifact.js';
import { isCodeArtifact } from '../types/artifact.js';
import type { ActionFragment, EffectFragment, PolicyFragment, EffectRisk } from '../types/fragment.js';
import type {
  Pass,
  PassContext,
  Finding,
  FunctionDeclarationData,
} from './base.js';
import {
  createActionFragment,
  type CreateActionFragmentOptions,
} from '../fragment/index.js';

// ============================================================================
// Action Pattern Detection
// ============================================================================

/**
 * Handler function name patterns
 */
const HANDLER_PATTERNS = [
  { prefix: 'handle', extractVerb: true },
  { prefix: 'on', extractVerb: true },
  { prefix: 'do', extractVerb: true },
];

/**
 * Common action verb patterns
 */
const ACTION_VERBS = [
  'submit',
  'save',
  'delete',
  'remove',
  'create',
  'update',
  'edit',
  'add',
  'cancel',
  'confirm',
  'reset',
  'clear',
  'send',
  'login',
  'logout',
  'register',
  'subscribe',
  'unsubscribe',
  'click',
  'toggle',
  'open',
  'close',
  'show',
  'hide',
  'load',
  'fetch',
  'refresh',
  'retry',
];

/**
 * Check if a function name represents an action handler
 */
function isActionHandler(name: string): boolean {
  const lowerName = name.toLowerCase();

  // Check for handler pattern prefixes
  for (const pattern of HANDLER_PATTERNS) {
    if (lowerName.startsWith(pattern.prefix.toLowerCase())) {
      return true;
    }
  }

  // Check for action verb patterns
  for (const verb of ACTION_VERBS) {
    if (lowerName.includes(verb)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract action ID from function name
 *
 * Examples:
 * - handleSubmit → submit
 * - onSave → save
 * - doDelete → delete
 * - submitForm → submitForm
 */
function extractActionId(name: string): string {
  const lowerName = name.toLowerCase();

  // Try to extract verb from handler patterns
  for (const pattern of HANDLER_PATTERNS) {
    if (lowerName.startsWith(pattern.prefix.toLowerCase())) {
      const verb = name.slice(pattern.prefix.length);
      if (verb.length > 0) {
        // Lowercase first letter
        return verb.charAt(0).toLowerCase() + verb.slice(1);
      }
    }
  }

  // Use the function name as-is (lowercase first letter)
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Extract semantic verb from action ID
 */
function extractSemanticVerb(actionId: string): string {
  // Extract the first word or known verb
  for (const verb of ACTION_VERBS) {
    if (actionId.toLowerCase().startsWith(verb)) {
      return verb;
    }
  }

  // Use first word (before camelCase or underscore)
  const match = actionId.match(/^[a-z]+/);
  return match?.[0] ?? actionId;
}

// ============================================================================
// Fragment Reference Collection
// ============================================================================

/**
 * Find related effect fragments for an action
 */
function findRelatedEffects(
  actionId: string,
  functionName: string,
  ctx: PassContext
): EffectFragment[] {
  const effects: EffectFragment[] = [];

  for (const fragment of ctx.existingFragments) {
    if (fragment.kind !== 'EffectFragment') continue;

    const effectFragment = fragment as EffectFragment;

    // Check if effect name contains action context
    if (effectFragment.name) {
      const effectName = effectFragment.name.toLowerCase();
      if (
        effectName.includes(actionId.toLowerCase()) ||
        effectName.includes(functionName.toLowerCase())
      ) {
        effects.push(effectFragment);
      }
    }
  }

  return effects;
}

/**
 * Find related policy fragments for an action
 */
function findRelatedPolicies(
  actionId: string,
  ctx: PassContext
): PolicyFragment[] {
  const policies: PolicyFragment[] = [];

  for (const fragment of ctx.existingFragments) {
    if (fragment.kind !== 'PolicyFragment') continue;

    const policyFragment = fragment as PolicyFragment;

    // Check if policy targets this action
    if (
      policyFragment.target.kind === 'action' &&
      policyFragment.target.actionId === actionId
    ) {
      policies.push(policyFragment);
    }
  }

  return policies;
}

/**
 * Collect preconditions from related policy fragments
 */
function collectPreconditions(policies: PolicyFragment[]): ConditionRef[] {
  const preconditions: ConditionRef[] = [];

  for (const policy of policies) {
    if (policy.preconditions) {
      preconditions.push(...policy.preconditions);
    }
  }

  // Remove duplicates by path
  const seen = new Set<string>();
  return preconditions.filter((cond) => {
    if (seen.has(cond.path)) return false;
    seen.add(cond.path);
    return true;
  });
}

/**
 * Get effect reference or inline effect from related effects
 */
function getEffectReference(effects: EffectFragment[]): {
  effectRef?: string;
  effect?: Effect;
} {
  if (effects.length === 0) {
    return {};
  }

  // Use first effect as reference
  const firstEffect = effects[0];
  if (firstEffect) {
    return {
      effectRef: firstEffect.id,
      effect: firstEffect.effect,
    };
  }

  return {};
}

/**
 * Determine max risk level from effects
 */
function determineMaxRisk(effects: EffectFragment[]): EffectRisk {
  const riskOrder: Record<EffectRisk, number> = {
    none: 0,
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  let maxRisk: EffectRisk = 'none';

  for (const effect of effects) {
    const currentRisk = effect.risk ?? 'none';
    if (riskOrder[currentRisk] > riskOrder[maxRisk]) {
      maxRisk = currentRisk;
    }
  }

  return maxRisk;
}

/**
 * Collect requires from effects and policies
 */
function collectRequires(
  effects: EffectFragment[],
  policies: PolicyFragment[]
): SemanticPath[] {
  const requires: SemanticPath[] = [];

  for (const effect of effects) {
    requires.push(...effect.requires);
  }

  for (const policy of policies) {
    requires.push(...policy.requires);
  }

  // Remove duplicates
  return [...new Set(requires)];
}

// ============================================================================
// Action Pass
// ============================================================================

/**
 * Action Pass
 *
 * Assembles ActionFragments from function declarations and related fragments.
 */
export const actionPass: Pass = {
  name: 'action-pass',
  priority: 500,
  dependsOn: ['effect-lowering', 'policy-lowering'],
  category: 'lowering',

  supports(artifact: Artifact): boolean {
    return isCodeArtifact(artifact);
  },

  analyze(ctx: PassContext): Finding[] {
    // Filter function_declaration findings that are action handlers
    return ctx.previousFindings.filter((f) => {
      if (f.kind !== 'function_declaration') return false;

      const data = f.data as FunctionDeclarationData;
      return isActionHandler(data.name);
    });
  },

  compile(findings: Finding[], ctx: PassContext): ActionFragment[] {
    const fragments: ActionFragment[] = [];

    for (const finding of findings) {
      const data = finding.data as FunctionDeclarationData;

      // Extract action ID from function name
      const actionId = extractActionId(data.name);

      // Find related effects and policies
      const effects = findRelatedEffects(actionId, data.name, ctx);
      const policies = findRelatedPolicies(actionId, ctx);

      // Collect preconditions
      const preconditions = collectPreconditions(policies);

      // Get effect reference
      const { effectRef, effect } = getEffectReference(effects);

      // Determine risk level
      const risk = determineMaxRisk(effects);

      // Collect requires
      const requires = collectRequires(effects, policies);

      // Extract semantic verb
      const verb = extractSemanticVerb(actionId);

      // Create ActionFragment
      const options: CreateActionFragmentOptions = {
        actionId,
        requires,
        preconditions: preconditions.length > 0 ? preconditions : undefined,
        effectRef,
        effect,
        semantic: {
          verb,
          description: `Action: ${verb} (from ${data.name})`,
          risk,
          reversible: risk !== 'critical',
        },
        risk,
        origin: finding.provenance,
        evidence: [
          {
            kind: 'ast_node',
            ref: finding.id,
            excerpt: data.sourceCode,
          },
        ],
      };

      const fragment = createActionFragment(options);
      fragments.push(fragment);
    }

    return fragments;
  },
};

// ============================================================================
// Export
// ============================================================================

export default actionPass;

/**
 * Helper exports for testing
 */
export {
  isActionHandler,
  extractActionId,
  extractSemanticVerb,
  findRelatedEffects,
  findRelatedPolicies,
  collectPreconditions,
  determineMaxRisk,
};
