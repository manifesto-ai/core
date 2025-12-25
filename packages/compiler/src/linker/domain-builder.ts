/**
 * Domain Builder
 *
 * Implements Principle C: Schema Materialization → Zod directly.
 *
 * This module transforms Fragment[] into a DomainDraft with:
 * - dataSchema/stateSchema as z.object({...}) - NOT Record<string, unknown>
 * - Unknown types become z.unknown() with Issue recorded
 * - Runtime-executable output
 */

import { z, type ZodTypeAny, type ZodObject, type ZodRawShape } from 'zod';
import type {
  SemanticPath,
  SourceDefinition,
  DerivedDefinition,
  ActionDefinition,
  SemanticMeta,
  ActionSemanticMeta,
  ConditionRef,
  Effect,
} from '@manifesto-ai/core';
import type {
  Fragment,
  FragmentId,
  SchemaFragment,
  SourceFragment,
  DerivedFragment,
  ActionFragment,
  EffectFragment,
  PolicyFragment,
  SchemaField,
  SchemaFieldType,
} from '../types/fragment.js';
import type { DomainDraft } from '../types/session.js';
import type { Issue } from '../types/issue.js';
import { createIssueId } from '../types/issue.js';
import { sortFragmentsByStableId } from './normalizer.js';

// Re-export SchemaFieldType for backward compatibility
export type { SchemaFieldType } from '../types/fragment.js';

/**
 * Domain build options
 */
export interface DomainBuildOptions {
  /** Domain ID */
  domainId?: string;
  /** Domain name */
  domainName?: string;
  /** Domain description */
  domainDescription?: string;
  /** Default initial state values */
  defaultInitialState?: Record<string, unknown>;
  /** Sort fragments by stableId (Principle E: determinism) */
  sortByStableId?: boolean;
}

/**
 * Result of building a domain (Principle C: isExecutable flag)
 */
export interface DomainBuildResult {
  /** Built domain draft */
  domain: DomainDraft;
  /** Build issues */
  issues: Issue[];
  /** Whether the domain is immediately runtime-executable */
  isExecutable: boolean;
  /** Generated Zod schemas (for direct use) */
  zodSchemas: {
    data: ZodObject<ZodRawShape>;
    state: ZodObject<ZodRawShape>;
  };
  /** Statistics */
  stats: DomainBuildStats;
}

/**
 * Build statistics
 */
export interface DomainBuildStats {
  /** Number of sources created */
  sourcesCount: number;
  /** Number of derived created */
  derivedCount: number;
  /** Number of actions created */
  actionsCount: number;
  /** Number of unknown types (requiring review) */
  unknownTypesCount: number;
}

// ============================================================================
// Type Mapping (Principle C: Zod directly)
// ============================================================================

/**
 * Map fragment type string to Zod type (Principle C)
 *
 * @param fieldType - Type string from SchemaFragment
 * @param issues - Array to collect unknown type issues
 * @param context - Context for issue reporting
 * @returns Zod type
 */
export function fragmentTypeToZod(
  fieldType: string,
  issues: Issue[],
  context: { path?: string; fragmentId?: string } = {}
): ZodTypeAny {
  switch (fieldType.toLowerCase()) {
    case 'string':
      return z.string();

    case 'number':
    case 'integer':
    case 'float':
      return z.number();

    case 'boolean':
    case 'bool':
      return z.boolean();

    case 'object':
      return z.record(z.unknown());

    case 'array':
      return z.array(z.unknown());

    case 'null':
      return z.null();

    case 'any':
    case 'unknown':
    default:
      // Record issue for unknown type (Principle C)
      issues.push({
        id: createIssueId(),
        code: 'UNKNOWN_TYPE',
        severity: 'warning',
        message: `Unknown type "${fieldType}" for ${context.path || 'field'}. Using z.unknown()`,
        path: context.path as SemanticPath,
        relatedFragments: context.fragmentId ? [context.fragmentId] : [],
        context: { originalType: fieldType },
      });
      return z.unknown();
  }
}

/**
 * Map fragment type string with additional constraints
 */
export function fragmentTypeToZodWithConstraints(
  fieldType: string,
  constraints: {
    nullable?: boolean;
    optional?: boolean;
    default?: unknown;
  },
  issues: Issue[],
  context: { path?: string; fragmentId?: string } = {}
): ZodTypeAny {
  let zodType = fragmentTypeToZod(fieldType, issues, context);

  if (constraints.nullable) {
    zodType = zodType.nullable();
  }

  if (constraints.optional) {
    zodType = zodType.optional();
  }

  if (constraints.default !== undefined) {
    zodType = zodType.default(constraints.default);
  }

  return zodType;
}

// ============================================================================
// Schema Building (Principle C)
// ============================================================================

/**
 * Build data schema from SchemaFragments (Principle C: z.object directly)
 */
export function buildDataSchema(
  fragments: SchemaFragment[],
  issues: Issue[]
): ZodObject<ZodRawShape> {
  const shape: ZodRawShape = {};

  // Filter to data namespace schemas
  const dataSchemas = fragments.filter((f) => f.namespace === 'data');

  for (const schema of dataSchemas) {
    for (const field of schema.fields) {
      // Extract local name from path (e.g., "data.count" -> "count")
      const localName = field.path.startsWith('data.')
        ? field.path.slice(5)
        : field.path;

      const zodType = fragmentTypeToZod(field.type, issues, {
        path: field.path,
        fragmentId: schema.id,
      });

      shape[localName] = zodType;
    }
  }

  return z.object(shape);
}

/**
 * Build state schema from SchemaFragments (Principle C: z.object directly)
 */
export function buildStateSchema(
  fragments: SchemaFragment[],
  issues: Issue[]
): ZodObject<ZodRawShape> {
  const shape: ZodRawShape = {};

  // Filter to state namespace schemas
  const stateSchemas = fragments.filter((f) => f.namespace === 'state');

  for (const schema of stateSchemas) {
    for (const field of schema.fields) {
      // Extract local name from path (e.g., "state.loading" -> "loading")
      const localName = field.path.startsWith('state.')
        ? field.path.slice(6)
        : field.path;

      const zodType = fragmentTypeToZod(field.type, issues, {
        path: field.path,
        fragmentId: schema.id,
      });

      shape[localName] = zodType;
    }
  }

  return z.object(shape);
}

// ============================================================================
// Definition Building
// ============================================================================

/**
 * Build source definitions from SourceFragments
 */
export function buildSources(
  fragments: SourceFragment[],
  issues: Issue[]
): Record<SemanticPath, SourceDefinition> {
  const sources: Record<SemanticPath, SourceDefinition> = {};

  for (const fragment of fragments) {
    const path = fragment.path as SemanticPath;

    // Get type from fragment schema or semantic
    const fieldType = fragment.schema?.type || 'unknown';
    const schema = fragmentTypeToZod(fieldType, issues, {
      path,
      fragmentId: fragment.id,
    });

    // Build semantic meta
    const semantic: SemanticMeta = {
      type: fragment.semantic.type || fieldType,
      description: fragment.semantic.description || `Source: ${path}`,
      writable: fragment.semantic.writable,
      readable: fragment.semantic.readable,
    };

    sources[path] = {
      schema,
      defaultValue: fragment.schema?.defaultValue,
      semantic,
    };
  }

  return sources;
}

/**
 * Build derived definitions from DerivedFragments
 */
export function buildDerived(
  fragments: DerivedFragment[],
  issues: Issue[]
): Record<SemanticPath, DerivedDefinition> {
  const derived: Record<SemanticPath, DerivedDefinition> = {};

  for (const fragment of fragments) {
    const path = fragment.path as SemanticPath;

    // Build semantic meta
    const semantic: SemanticMeta = {
      type: fragment.semantic?.type || 'derived',
      description: fragment.semantic?.description || `Derived: ${path}`,
      ...fragment.semantic,
    };

    derived[path] = {
      deps: fragment.requires as SemanticPath[],
      expr: fragment.expr,
      semantic,
    };
  }

  return derived;
}

/**
 * Build action definitions from ActionFragments, EffectFragments, and PolicyFragments
 */
export function buildActions(
  actionFragments: ActionFragment[],
  effectFragments: EffectFragment[],
  policyFragments: PolicyFragment[],
  issues: Issue[]
): Record<string, ActionDefinition> {
  const actions: Record<string, ActionDefinition> = {};

  // Create effect lookup map - use fragment id or name as key
  const effectMap = new Map<string, Effect>();
  for (const effectFrag of effectFragments) {
    // Use fragment id as primary key, and also name if present
    effectMap.set(effectFrag.id, effectFrag.effect);
    if (effectFrag.name) {
      effectMap.set(effectFrag.name, effectFrag.effect);
    }
  }

  // Create policy lookup map
  const policyByAction = new Map<string, PolicyFragment[]>();
  for (const policy of policyFragments) {
    if (policy.target.kind === 'action') {
      const actionId = policy.target.actionId!;
      const existing = policyByAction.get(actionId) || [];
      existing.push(policy);
      policyByAction.set(actionId, existing);
    }
  }

  for (const fragment of actionFragments) {
    const actionId = fragment.actionId;

    // Get effect - either inline or referenced
    let effect: Effect;
    if (fragment.effect) {
      effect = fragment.effect;
    } else if (fragment.effectRef) {
      const refEffect = effectMap.get(fragment.effectRef);
      if (refEffect) {
        effect = refEffect;
      } else {
        issues.push({
          id: createIssueId(),
          code: 'MISSING_EFFECT_REF',
          severity: 'error',
          message: `Action "${actionId}" references effect "${fragment.effectRef}" which doesn't exist`,
          relatedFragments: [fragment.id],
        });
        continue;
      }
    } else {
      issues.push({
        id: createIssueId(),
        code: 'MISSING_ACTION_EFFECT',
        severity: 'error',
        message: `Action "${actionId}" has no effect defined`,
        relatedFragments: [fragment.id],
      });
      continue;
    }

    // Collect preconditions from ActionFragment and PolicyFragments
    const preconditions: ConditionRef[] = [];

    if (fragment.preconditions) {
      preconditions.push(...fragment.preconditions);
    }

    const actionPolicies = policyByAction.get(actionId) || [];
    for (const policy of actionPolicies) {
      if (policy.preconditions) {
        preconditions.push(...policy.preconditions);
      }
    }

    // Build action semantic meta
    const semantic: ActionSemanticMeta = {
      type: 'action',
      description: fragment.semantic?.description || `Action: ${actionId}`,
      verb: fragment.semantic?.verb || actionId,
      risk: fragment.semantic?.risk,
      reversible: fragment.semantic?.reversible,
      ...fragment.semantic,
    };

    // Note: inputSchemaRef would be resolved by the linker if needed
    // For now, we skip input schema building since it requires schema fragment lookup
    const input: ZodTypeAny | undefined = undefined;

    actions[actionId] = {
      deps: fragment.requires as SemanticPath[],
      input,
      effect,
      preconditions: preconditions.length > 0 ? preconditions : undefined,
      semantic,
    };
  }

  return actions;
}

// ============================================================================
// Main Build Function
// ============================================================================

/**
 * Build domain draft from fragments (Principle C: Zod directly)
 *
 * This is the main entry point for domain building.
 *
 * @param fragments - All fragments to include
 * @param options - Build options
 * @returns DomainBuildResult with domain, issues, and executability flag
 */
export function buildDomainDraft(
  fragments: Fragment[],
  options: DomainBuildOptions = {}
): DomainBuildResult {
  const {
    domainId,
    domainName,
    domainDescription,
    defaultInitialState = {},
    sortByStableId = true,
  } = options;

  const issues: Issue[] = [];

  // Sort for determinism (Principle E)
  const workingFragments = sortByStableId
    ? sortFragmentsByStableId(fragments)
    : [...fragments];

  // Separate fragments by kind
  const schemaFragments = workingFragments.filter(
    (f): f is SchemaFragment => f.kind === 'SchemaFragment'
  );
  const sourceFragments = workingFragments.filter(
    (f): f is SourceFragment => f.kind === 'SourceFragment'
  );
  const derivedFragments = workingFragments.filter(
    (f): f is DerivedFragment => f.kind === 'DerivedFragment'
  );
  const actionFragments = workingFragments.filter(
    (f): f is ActionFragment => f.kind === 'ActionFragment'
  );
  const effectFragments = workingFragments.filter(
    (f): f is EffectFragment => f.kind === 'EffectFragment'
  );
  const policyFragments = workingFragments.filter(
    (f): f is PolicyFragment => f.kind === 'PolicyFragment'
  );

  // Build Zod schemas (Principle C)
  const dataSchema = buildDataSchema(schemaFragments, issues);
  const stateSchema = buildStateSchema(schemaFragments, issues);

  // Build definitions
  const sources = buildSources(sourceFragments, issues);
  const derived = buildDerived(derivedFragments, issues);
  const actions = buildActions(
    actionFragments,
    effectFragments,
    policyFragments,
    issues
  );

  // Determine initial state
  const stateSchemaFields = schemaFragments
    .filter((f) => f.namespace === 'state')
    .flatMap((f) => f.fields);

  const initialState: Record<string, unknown> = { ...defaultInitialState };
  for (const field of stateSchemaFields) {
    const localName = field.path.startsWith('state.')
      ? field.path.slice(6)
      : field.path;
    if (!(localName in initialState)) {
      // Use default value or type default
      initialState[localName] = getTypeDefault(field.type);
    }
  }

  // Calculate statistics
  const unknownTypesCount = issues.filter(
    (i) => i.code === 'UNKNOWN_TYPE'
  ).length;
  const errorCount = issues.filter((i) => i.severity === 'error').length;

  // Domain is executable if no errors (Principle C)
  const isExecutable = errorCount === 0;

  // Build domain draft
  const domain: DomainDraft = {
    id: domainId,
    name: domainName,
    description: domainDescription,
    dataSchema: zodSchemaToPlainObject(dataSchema),
    stateSchema: zodSchemaToPlainObject(stateSchema),
    sources,
    derived,
    actions,
    initialState,
  };

  return {
    domain,
    issues,
    isExecutable,
    zodSchemas: {
      data: dataSchema,
      state: stateSchema,
    },
    stats: {
      sourcesCount: Object.keys(sources).length,
      derivedCount: Object.keys(derived).length,
      actionsCount: Object.keys(actions).length,
      unknownTypesCount,
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get default value for a type
 */
function getTypeDefault(type: string): unknown {
  switch (type.toLowerCase()) {
    case 'string':
      return '';
    case 'number':
    case 'integer':
    case 'float':
      return 0;
    case 'boolean':
    case 'bool':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    case 'null':
      return null;
    default:
      return undefined;
  }
}

/**
 * Convert Zod schema to plain object representation
 *
 * This is for DomainDraft storage - the actual Zod schema
 * is returned separately in zodSchemas.
 */
function zodSchemaToPlainObject(
  schema: ZodObject<ZodRawShape>
): Record<string, unknown> {
  const shape = schema.shape;
  const result: Record<string, unknown> = {};

  for (const [key, zodType] of Object.entries(shape)) {
    result[key] = zodTypeDescription(zodType as ZodTypeAny);
  }

  return result;
}

/**
 * Get a string description of a Zod type
 */
function zodTypeDescription(zodType: ZodTypeAny): string {
  // Get the Zod type name
  const typeName = zodType._def?.typeName || 'unknown';

  switch (typeName) {
    case 'ZodString':
      return 'string';
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodArray':
      return 'array';
    case 'ZodObject':
      return 'object';
    case 'ZodRecord':
      return 'object';
    case 'ZodNull':
      return 'null';
    case 'ZodUnknown':
      return 'unknown';
    case 'ZodOptional':
      return `${zodTypeDescription((zodType as any)._def.innerType)}?`;
    case 'ZodNullable':
      return `${zodTypeDescription((zodType as any)._def.innerType)} | null`;
    default:
      return 'unknown';
  }
}

/**
 * Merge multiple SchemaFragments' fields
 */
export function mergeSchemaFields(
  fragments: SchemaFragment[]
): Map<string, SchemaField> {
  const fields = new Map<string, SchemaField>();

  for (const fragment of fragments) {
    for (const field of fragment.fields) {
      // Later fragments override earlier ones
      fields.set(field.path, field);
    }
  }

  return fields;
}

/**
 * Extract all paths defined in fragments
 */
export function extractAllPaths(fragments: Fragment[]): Set<SemanticPath> {
  const paths = new Set<SemanticPath>();

  for (const fragment of fragments) {
    for (const provide of fragment.provides) {
      if (!provide.startsWith('action:') && !provide.startsWith('effect:')) {
        paths.add(provide as SemanticPath);
      }
    }
  }

  return paths;
}

/**
 * Validate that domain draft has all required components
 */
export function validateDomainDraft(draft: DomainDraft): Issue[] {
  const issues: Issue[] = [];

  // Check for empty schemas
  if (Object.keys(draft.dataSchema).length === 0) {
    issues.push({
      id: createIssueId(),
      code: 'EMPTY_DATA_SCHEMA',
      severity: 'warning',
      message: 'Domain has no data schema fields defined',
    });
  }

  // Check for actions without effects
  for (const [actionId, action] of Object.entries(draft.actions)) {
    if (!action.effect) {
      issues.push({
        id: createIssueId(),
        code: 'ACTION_WITHOUT_EFFECT',
        severity: 'error',
        message: `Action "${actionId}" has no effect`,
      });
    }
  }

  return issues;
}

export default {
  buildDomainDraft,
  buildDataSchema,
  buildStateSchema,
  buildSources,
  buildDerived,
  buildActions,
  fragmentTypeToZod,
  fragmentTypeToZodWithConstraints,
  mergeSchemaFields,
  extractAllPaths,
  validateDomainDraft,
};
