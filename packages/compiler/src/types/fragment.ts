/**
 * Fragment Types - Intermediate Representation (IR)
 *
 * Fragments are the core IR of the compiler. Each fragment represents
 * a piece of the Manifesto domain that can be composed with others.
 *
 * Based on AGENT_README Section 4: IR Shape Definition
 */

import type { SemanticPath, Expression, Effect, ConditionRef, FieldPolicy } from '@manifesto-ai/core';
import type { Provenance, Evidence } from './provenance.js';

/** Unique identifier for a fragment */
export type FragmentId = string;

/** Compiler version string */
export type CompilerVersion = string;

/**
 * All possible fragment kinds
 */
export type FragmentKind =
  | 'SchemaFragment'
  | 'SourceFragment'
  | 'ExpressionFragment'
  | 'DerivedFragment'
  | 'PolicyFragment'
  | 'EffectFragment'
  | 'ActionFragment'
  | 'StatementFragment';

/**
 * Base interface that all fragments extend
 *
 * Every fragment has:
 * - id: Stable identifier for patch-first editing
 * - kind: Type discriminator
 * - requires: Semantic paths this fragment reads
 * - provides: Semantic paths/IDs this fragment defines
 * - origin: Where this fragment came from
 * - evidence: Why this fragment was created
 */
export interface FragmentBase {
  /** Stable unique identifier */
  id: FragmentId;
  /** Fragment type discriminator */
  kind: FragmentKind;

  /** Semantic paths this fragment depends on (reads) */
  requires: SemanticPath[];
  /**
   * What this fragment provides (defines)
   * Can be semantic paths (e.g., "data.hello", "derived.total")
   * or symbolic IDs (e.g., "action:checkout", "effect:doHello")
   */
  provides: string[];

  /** Provenance: where this fragment came from */
  origin: Provenance;
  /** Evidence: why this fragment was created */
  evidence: Evidence[];

  /** Confidence score (0-1) for LLM-generated fragments */
  confidence?: number;
  /** Compiler version that created this fragment */
  compilerVersion: CompilerVersion;
  /** Optional tags for filtering/grouping */
  tags?: string[];
}

// ============================================================================
// Schema-related Fragments
// ============================================================================

/**
 * Schema field type (MVP simplification)
 */
export type SchemaFieldType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null'
  | 'unknown';

/**
 * Schema field definition
 */
export interface SchemaField {
  /** Full semantic path (e.g., "data.user.name") */
  path: SemanticPath;
  /** Field type */
  type: SchemaFieldType;
  /** Whether the field is optional */
  optional?: boolean;
  /** Default value for the field */
  defaultValue?: unknown;
  /** Semantic metadata for AI understanding */
  semantic?: {
    type: string;
    description: string;
    writable?: boolean;
    readable?: boolean;
  };
}

/**
 * SchemaFragment - Defines data or state schema fields
 */
export interface SchemaFragment extends FragmentBase {
  kind: 'SchemaFragment';
  /** Namespace: data or state */
  namespace: 'data' | 'state';
  /** Schema fields defined by this fragment */
  fields: SchemaField[];
}

/**
 * SourceFragment - Defines a source (user input) field
 *
 * Similar to defineSource() in core
 */
export interface SourceFragment extends FragmentBase {
  kind: 'SourceFragment';
  /** Full semantic path (e.g., "data.couponCode") */
  path: SemanticPath;
  /** Schema definition for this source */
  schema?: SchemaField;
  /** Field policy for dynamic visibility/editability */
  policy?: FieldPolicy;
  /** Semantic metadata */
  semantic: {
    type: string;
    description: string;
    writable?: boolean;
    readable?: boolean;
  };
}

// ============================================================================
// Expression-related Fragments
// ============================================================================

/**
 * ExpressionFragment - A reusable expression
 *
 * Can be used as a condition, computation, or part of derived values.
 */
export interface ExpressionFragment extends FragmentBase {
  kind: 'ExpressionFragment';
  /** The Expression DSL AST */
  expr: Expression;
  /** Optional name for referencing */
  name?: string;
}

/**
 * DerivedFragment - Defines a derived (computed) value
 *
 * Similar to defineDerived() in core
 */
export interface DerivedFragment extends FragmentBase {
  kind: 'DerivedFragment';
  /** Full semantic path (e.g., "derived.total") */
  path: SemanticPath;
  /** Computation expression */
  expr: Expression;
  /**
   * Explicit dependencies (may be omitted by producers)
   * Linker/Verifier will derive/check this from expr
   */
  deps?: SemanticPath[];
  /** Semantic metadata */
  semantic?: {
    type: string;
    description: string;
  };
}

// ============================================================================
// Policy-related Fragments
// ============================================================================

/**
 * PolicyFragment - Defines preconditions or field policies
 *
 * Can target an action (preconditions) or a field (visibility/editability)
 */
export interface PolicyFragment extends FragmentBase {
  kind: 'PolicyFragment';
  /** What this policy applies to */
  target:
    | { kind: 'action'; actionId: string }
    | { kind: 'field'; path: SemanticPath };
  /** Preconditions for actions */
  preconditions?: ConditionRef[];
  /** Field-level policy for visibility/editability/required */
  fieldPolicy?: FieldPolicy;
}

// ============================================================================
// Effect-related Fragments
// ============================================================================

/**
 * Risk level for effects
 *
 * Used for safety gating (AGENT_README Invariant #5)
 */
export type EffectRisk = 'none' | 'low' | 'medium' | 'high' | 'critical';

/**
 * EffectFragment - Describes a side effect
 *
 * Effects are descriptions, not executions.
 * The compiler MUST NOT execute effects.
 */
export interface EffectFragment extends FragmentBase {
  kind: 'EffectFragment';
  /** The Effect AST (description only, never executed by compiler) */
  effect: Effect;
  /** Risk classification for safety gating */
  risk?: EffectRisk;
  /** Optional name for referencing */
  name?: string;
}

// ============================================================================
// Action-related Fragments
// ============================================================================

/**
 * ActionFragment - Defines a user-triggerable action
 *
 * Similar to defineAction() in core
 */
export interface ActionFragment extends FragmentBase {
  kind: 'ActionFragment';
  /** Unique action identifier */
  actionId: string;
  /** Reference to input schema fragment (optional) */
  inputSchemaRef?: string;
  /** Preconditions for action availability */
  preconditions?: ConditionRef[];
  /** Reference to effect fragment ID */
  effectRef?: string;
  /** Inline effect (alternative to effectRef) */
  effect?: Effect;
  /** Semantic metadata */
  semantic?: {
    verb: string;
    description: string;
    risk?: EffectRisk;
    reversible?: boolean;
  };
  /** Risk classification */
  risk?: EffectRisk;
}

// ============================================================================
// Statement-related Fragments
// ============================================================================

/**
 * Statement types that can be lowered to effects
 */
export type StatementType =
  | 'if'
  | 'assign'
  | 'call'
  | 'block'
  | 'return'
  | 'loop'
  | 'unknown';

/**
 * StatementFragment - Represents a code statement
 *
 * Used for "show me the exact construct" UX.
 * Can be lowered to EffectFragment for execution.
 */
export interface StatementFragment extends FragmentBase {
  kind: 'StatementFragment';
  /** Type of statement */
  statementType: StatementType;
  /** Reference to lowered effect fragment (if lowered) */
  loweredEffectRef?: string;
  /** Original source code (for display) */
  sourceCode?: string;
}

// ============================================================================
// Union Type and Type Guards
// ============================================================================

/**
 * Union type of all fragment kinds
 */
export type Fragment =
  | SchemaFragment
  | SourceFragment
  | ExpressionFragment
  | DerivedFragment
  | PolicyFragment
  | EffectFragment
  | ActionFragment
  | StatementFragment;

/**
 * Type guard for SchemaFragment
 */
export function isSchemaFragment(f: Fragment): f is SchemaFragment {
  return f.kind === 'SchemaFragment';
}

/**
 * Type guard for SourceFragment
 */
export function isSourceFragment(f: Fragment): f is SourceFragment {
  return f.kind === 'SourceFragment';
}

/**
 * Type guard for ExpressionFragment
 */
export function isExpressionFragment(f: Fragment): f is ExpressionFragment {
  return f.kind === 'ExpressionFragment';
}

/**
 * Type guard for DerivedFragment
 */
export function isDerivedFragment(f: Fragment): f is DerivedFragment {
  return f.kind === 'DerivedFragment';
}

/**
 * Type guard for PolicyFragment
 */
export function isPolicyFragment(f: Fragment): f is PolicyFragment {
  return f.kind === 'PolicyFragment';
}

/**
 * Type guard for EffectFragment
 */
export function isEffectFragment(f: Fragment): f is EffectFragment {
  return f.kind === 'EffectFragment';
}

/**
 * Type guard for ActionFragment
 */
export function isActionFragment(f: Fragment): f is ActionFragment {
  return f.kind === 'ActionFragment';
}

/**
 * Type guard for StatementFragment
 */
export function isStatementFragment(f: Fragment): f is StatementFragment {
  return f.kind === 'StatementFragment';
}
