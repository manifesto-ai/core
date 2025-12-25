/**
 * Base Fragment Helpers
 *
 * Factory functions for creating fragments with proper defaults.
 */

import type { SemanticPath, Expression, Effect, ConditionRef, FieldPolicy } from '@manifesto-ai/core';
import type {
  FragmentKind,
  FragmentBase,
  Fragment,
  SchemaFragment,
  SchemaField,
  SourceFragment,
  ExpressionFragment,
  DerivedFragment,
  PolicyFragment,
  EffectFragment,
  EffectRisk,
  ActionFragment,
  StatementFragment,
  StatementType,
} from '../types/fragment.js';
import type { Provenance, Evidence } from '../types/provenance.js';
import { generateStableFragmentId, generateRandomFragmentId } from './stable-id.js';

/** Current compiler version */
export const COMPILER_VERSION = '0.1.0';

// ============================================================================
// Base Fragment Creation
// ============================================================================

/**
 * Options for creating a fragment
 */
export interface CreateFragmentOptions {
  /** Use random ID instead of stable ID */
  useRandomId?: boolean;
  /** Additional salt for stable ID */
  idSalt?: string;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Tags for filtering/grouping */
  tags?: string[];
  /** Custom compiler version */
  compilerVersion?: string;
}

/**
 * Create base fragment fields
 */
function createBaseFragment(
  kind: FragmentKind,
  origin: Provenance,
  evidence: Evidence[],
  requires: SemanticPath[],
  provides: string[],
  options?: CreateFragmentOptions
): FragmentBase {
  const id = options?.useRandomId
    ? generateRandomFragmentId(kind)
    : generateStableFragmentId(kind, origin, requires, provides, options?.idSalt);

  return {
    id,
    kind,
    requires,
    provides,
    origin,
    evidence,
    confidence: options?.confidence,
    compilerVersion: options?.compilerVersion ?? COMPILER_VERSION,
    tags: options?.tags,
  };
}

// ============================================================================
// SchemaFragment
// ============================================================================

/**
 * Options for creating a SchemaFragment
 */
export interface CreateSchemaFragmentOptions extends CreateFragmentOptions {
  namespace: 'data' | 'state';
  fields: SchemaField[];
  origin: Provenance;
  evidence: Evidence[];
}

/**
 * Create a SchemaFragment
 */
export function createSchemaFragment(options: CreateSchemaFragmentOptions): SchemaFragment {
  const provides = options.fields.map((f) => f.path);
  const base = createBaseFragment(
    'SchemaFragment',
    options.origin,
    options.evidence,
    [], // SchemaFragment has no requires
    provides,
    options
  );

  return {
    ...base,
    kind: 'SchemaFragment',
    namespace: options.namespace,
    fields: options.fields,
  };
}

// ============================================================================
// SourceFragment
// ============================================================================

/**
 * Options for creating a SourceFragment
 */
export interface CreateSourceFragmentOptions extends CreateFragmentOptions {
  path: SemanticPath;
  schema?: SchemaField;
  policy?: FieldPolicy;
  semantic: {
    type: string;
    description: string;
    writable?: boolean;
    readable?: boolean;
  };
  origin: Provenance;
  evidence: Evidence[];
}

/**
 * Create a SourceFragment
 */
export function createSourceFragment(options: CreateSourceFragmentOptions): SourceFragment {
  // Extract requires from policy conditions
  const requires: SemanticPath[] = [];
  if (options.policy) {
    for (const cond of options.policy.relevantWhen ?? []) {
      requires.push(cond.path);
    }
    for (const cond of options.policy.editableWhen ?? []) {
      requires.push(cond.path);
    }
    for (const cond of options.policy.requiredWhen ?? []) {
      requires.push(cond.path);
    }
  }
  const uniqueRequires = [...new Set(requires)];

  const base = createBaseFragment(
    'SourceFragment',
    options.origin,
    options.evidence,
    uniqueRequires,
    [options.path],
    options
  );

  return {
    ...base,
    kind: 'SourceFragment',
    path: options.path,
    schema: options.schema,
    policy: options.policy,
    semantic: options.semantic,
  };
}

// ============================================================================
// ExpressionFragment
// ============================================================================

/**
 * Options for creating an ExpressionFragment
 */
export interface CreateExpressionFragmentOptions extends CreateFragmentOptions {
  expr: Expression;
  requires: SemanticPath[];
  name?: string;
  origin: Provenance;
  evidence: Evidence[];
}

/**
 * Create an ExpressionFragment
 */
export function createExpressionFragment(options: CreateExpressionFragmentOptions): ExpressionFragment {
  const provides = options.name ? [`expr:${options.name}`] : [];

  const base = createBaseFragment(
    'ExpressionFragment',
    options.origin,
    options.evidence,
    options.requires,
    provides,
    options
  );

  return {
    ...base,
    kind: 'ExpressionFragment',
    expr: options.expr,
    name: options.name,
  };
}

// ============================================================================
// DerivedFragment
// ============================================================================

/**
 * Options for creating a DerivedFragment
 */
export interface CreateDerivedFragmentOptions extends CreateFragmentOptions {
  path: SemanticPath;
  expr: Expression;
  deps?: SemanticPath[];
  requires: SemanticPath[];
  semantic?: {
    type: string;
    description: string;
  };
  origin: Provenance;
  evidence: Evidence[];
}

/**
 * Create a DerivedFragment
 */
export function createDerivedFragment(options: CreateDerivedFragmentOptions): DerivedFragment {
  const base = createBaseFragment(
    'DerivedFragment',
    options.origin,
    options.evidence,
    options.requires,
    [options.path],
    options
  );

  return {
    ...base,
    kind: 'DerivedFragment',
    path: options.path,
    expr: options.expr,
    deps: options.deps,
    semantic: options.semantic,
  };
}

// ============================================================================
// PolicyFragment
// ============================================================================

/**
 * Options for creating a PolicyFragment
 */
export interface CreatePolicyFragmentOptions extends CreateFragmentOptions {
  target:
    | { kind: 'action'; actionId: string }
    | { kind: 'field'; path: SemanticPath };
  preconditions?: ConditionRef[];
  fieldPolicy?: FieldPolicy;
  origin: Provenance;
  evidence: Evidence[];
}

/**
 * Create a PolicyFragment
 */
export function createPolicyFragment(options: CreatePolicyFragmentOptions): PolicyFragment {
  // Extract requires from all conditions
  const requires: SemanticPath[] = [];
  for (const cond of options.preconditions ?? []) {
    requires.push(cond.path);
  }
  if (options.fieldPolicy) {
    for (const cond of options.fieldPolicy.relevantWhen ?? []) {
      requires.push(cond.path);
    }
    for (const cond of options.fieldPolicy.editableWhen ?? []) {
      requires.push(cond.path);
    }
    for (const cond of options.fieldPolicy.requiredWhen ?? []) {
      requires.push(cond.path);
    }
  }
  const uniqueRequires = [...new Set(requires)];

  const provides =
    options.target.kind === 'action'
      ? [`policy:action:${options.target.actionId}`]
      : [`policy:field:${options.target.path}`];

  const base = createBaseFragment(
    'PolicyFragment',
    options.origin,
    options.evidence,
    uniqueRequires,
    provides,
    options
  );

  return {
    ...base,
    kind: 'PolicyFragment',
    target: options.target,
    preconditions: options.preconditions,
    fieldPolicy: options.fieldPolicy,
  };
}

// ============================================================================
// EffectFragment
// ============================================================================

/**
 * Options for creating an EffectFragment
 */
export interface CreateEffectFragmentOptions extends CreateFragmentOptions {
  effect: Effect;
  requires: SemanticPath[];
  risk?: EffectRisk;
  name?: string;
  origin: Provenance;
  evidence: Evidence[];
}

/**
 * Create an EffectFragment
 */
export function createEffectFragment(options: CreateEffectFragmentOptions): EffectFragment {
  const provides = options.name ? [`effect:${options.name}`] : [];

  const base = createBaseFragment(
    'EffectFragment',
    options.origin,
    options.evidence,
    options.requires,
    provides,
    options
  );

  return {
    ...base,
    kind: 'EffectFragment',
    effect: options.effect,
    risk: options.risk ?? 'none',
    name: options.name,
  };
}

// ============================================================================
// ActionFragment
// ============================================================================

/**
 * Options for creating an ActionFragment
 */
export interface CreateActionFragmentOptions extends CreateFragmentOptions {
  actionId: string;
  requires: SemanticPath[];
  inputSchemaRef?: string;
  preconditions?: ConditionRef[];
  effectRef?: string;
  effect?: Effect;
  semantic?: {
    verb: string;
    description: string;
    risk?: EffectRisk;
    reversible?: boolean;
  };
  risk?: EffectRisk;
  origin: Provenance;
  evidence: Evidence[];
}

/**
 * Create an ActionFragment
 */
export function createActionFragment(options: CreateActionFragmentOptions): ActionFragment {
  // Add precondition paths to requires
  const requires = [...options.requires];
  for (const cond of options.preconditions ?? []) {
    if (!requires.includes(cond.path)) {
      requires.push(cond.path);
    }
  }

  const base = createBaseFragment(
    'ActionFragment',
    options.origin,
    options.evidence,
    requires,
    [`action:${options.actionId}`],
    options
  );

  return {
    ...base,
    kind: 'ActionFragment',
    actionId: options.actionId,
    inputSchemaRef: options.inputSchemaRef,
    preconditions: options.preconditions,
    effectRef: options.effectRef,
    effect: options.effect,
    semantic: options.semantic,
    risk: options.risk ?? 'none',
  };
}

// ============================================================================
// StatementFragment
// ============================================================================

/**
 * Options for creating a StatementFragment
 */
export interface CreateStatementFragmentOptions extends CreateFragmentOptions {
  statementType: StatementType;
  requires: SemanticPath[];
  loweredEffectRef?: string;
  sourceCode?: string;
  origin: Provenance;
  evidence: Evidence[];
}

/**
 * Create a StatementFragment
 */
export function createStatementFragment(options: CreateStatementFragmentOptions): StatementFragment {
  const base = createBaseFragment(
    'StatementFragment',
    options.origin,
    options.evidence,
    options.requires,
    [], // StatementFragment typically doesn't provide paths
    options
  );

  return {
    ...base,
    kind: 'StatementFragment',
    statementType: options.statementType,
    loweredEffectRef: options.loweredEffectRef,
    sourceCode: options.sourceCode,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clone a fragment with a new ID
 */
export function cloneFragment<T extends Fragment>(fragment: T, newOrigin?: Provenance): T {
  const origin = newOrigin ?? fragment.origin;

  // Clone은 새 인스턴스이므로 랜덤 ID 사용
  // (구조가 같더라도 다른 fragment로 구분해야 함)
  const newId = generateRandomFragmentId(fragment.kind);

  return {
    ...fragment,
    id: newId,
    origin,
  };
}

/**
 * Update fragment requires and regenerate ID if needed
 */
export function updateFragmentRequires<T extends Fragment>(
  fragment: T,
  requires: SemanticPath[]
): T {
  const newId = generateStableFragmentId(
    fragment.kind,
    fragment.origin,
    requires,
    fragment.provides
  );

  return {
    ...fragment,
    id: newId,
    requires,
  };
}

/**
 * Add evidence to a fragment
 */
export function addEvidence<T extends Fragment>(fragment: T, evidence: Evidence): T {
  return {
    ...fragment,
    evidence: [...fragment.evidence, evidence],
  };
}

/**
 * Set fragment confidence
 */
export function setConfidence<T extends Fragment>(fragment: T, confidence: number): T {
  return {
    ...fragment,
    confidence: Math.max(0, Math.min(1, confidence)), // Clamp to [0, 1]
  };
}
