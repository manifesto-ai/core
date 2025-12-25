/**
 * Schema Pass
 *
 * variable_declaration Finding을 분석하여 SchemaFragment를 생성합니다.
 * 변수명을 semantic path로 매핑하고, TypeScript 타입을 SchemaFieldType으로 변환합니다.
 *
 * Priority: 100
 * Category: lowering
 * Depends on: code-ast-extractor
 */

import type { Artifact } from '../types/artifact.js';
import { isCodeArtifact } from '../types/artifact.js';
import type { SchemaFragment, SchemaFieldType } from '../types/fragment.js';

/** Namespace type for schema (SchemaFragment only supports data and state) */
type SchemaNamespace = 'data' | 'state';
import type {
  Pass,
  PassContext,
  Finding,
  VariableDeclarationData,
} from './base.js';
import {
  createSchemaFragment,
  type CreateSchemaFragmentOptions,
} from '../fragment/index.js';

// ============================================================================
// Type Mapping
// ============================================================================

/**
 * TypeScript type annotation to SchemaFieldType mapping
 */
const TYPE_MAPPING: Record<string, SchemaFieldType> = {
  // Primitives
  number: 'number',
  string: 'string',
  boolean: 'boolean',
  // Objects
  object: 'object',
  Object: 'object',
  // Arrays
  Array: 'array',
  array: 'array',
  // Special
  null: 'null',
  undefined: 'unknown',
  any: 'unknown',
  unknown: 'unknown',
  void: 'unknown',
  never: 'unknown',
  // Date
  Date: 'string', // Dates are typically serialized as strings
};

/**
 * Infer SchemaFieldType from a value
 */
function inferTypeFromValue(value: unknown): SchemaFieldType {
  if (value === null) return 'null';
  if (value === undefined) return 'unknown';

  const type = typeof value;
  switch (type) {
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'object':
      if (Array.isArray(value)) return 'array';
      return 'object';
    default:
      return 'unknown';
  }
}

/**
 * Map TypeScript type annotation to SchemaFieldType
 */
function mapTypeAnnotation(typeAnnotation: string | undefined): SchemaFieldType {
  if (!typeAnnotation) return 'unknown';

  // Handle array types (e.g., "number[]", "Array<number>")
  if (typeAnnotation.endsWith('[]') || typeAnnotation.startsWith('Array<')) {
    return 'array';
  }

  // Handle union types (e.g., "string | null") - take first type
  if (typeAnnotation.includes('|')) {
    const firstType = typeAnnotation.split('|')[0]?.trim();
    return mapTypeAnnotation(firstType);
  }

  // Handle generic types (e.g., "Promise<string>") - use base type
  if (typeAnnotation.includes('<')) {
    const baseType = typeAnnotation.split('<')[0]?.trim();
    return TYPE_MAPPING[baseType ?? ''] ?? 'unknown';
  }

  return TYPE_MAPPING[typeAnnotation] ?? 'unknown';
}

// ============================================================================
// Namespace Detection
// ============================================================================

/**
 * Determine namespace from variable name patterns
 *
 * Rules:
 * - Variables starting with "state" or using useState pattern → state.*
 * - Variables starting with "derived" or "computed" → skip (handled by Expression Pass)
 * - Everything else → data.*
 *
 * Returns null if this variable should not be a SchemaFragment
 */
function determineNamespace(name: string, sourceCode: string): SchemaNamespace | null {
  // Check for React useState pattern
  if (sourceCode.includes('useState')) {
    return 'state';
  }

  // Check name prefixes
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith('state')) {
    return 'state';
  }
  // Skip derived/computed - they should be DerivedFragments, not SchemaFragments
  if (lowerName.startsWith('derived') || lowerName.startsWith('computed')) {
    return null;
  }

  // Default to data namespace
  return 'data';
}

/**
 * Generate semantic path from variable name
 */
function generateSemanticPath(name: string, namespace: SchemaNamespace): string {
  return `${namespace}.${name}`;
}

// ============================================================================
// Schema Pass Implementation
// ============================================================================

/**
 * Schema Pass
 *
 * Converts variable declarations to SchemaFragments.
 */
export const schemaPass: Pass = {
  name: 'schema-pass',
  priority: 100,
  dependsOn: ['code-ast-extractor'],
  category: 'lowering',

  supports(artifact: Artifact): boolean {
    return isCodeArtifact(artifact);
  },

  analyze(ctx: PassContext): Finding[] {
    // Filter variable_declaration findings from previous passes
    return ctx.previousFindings.filter(
      (f) => f.kind === 'variable_declaration'
    );
  },

  compile(findings: Finding[], ctx: PassContext): SchemaFragment[] {
    const fragments: SchemaFragment[] = [];

    for (const finding of findings) {
      const data = finding.data as VariableDeclarationData;

      // Determine namespace - returns null for derived/computed variables
      const namespace = determineNamespace(data.name, data.sourceCode);
      if (namespace === null) {
        // Skip - this should be a DerivedFragment, not SchemaFragment
        continue;
      }

      const path = generateSemanticPath(data.name, namespace);

      // Determine field type
      let fieldType: SchemaFieldType;
      if (data.typeAnnotation) {
        fieldType = mapTypeAnnotation(data.typeAnnotation);
      } else if (data.initialValue !== undefined) {
        fieldType = inferTypeFromValue(data.initialValue);
      } else {
        fieldType = 'unknown';
      }

      // Check if path already exists in existing fragments
      const existingPath = ctx.existingPaths.includes(path);
      if (existingPath) {
        ctx.log('info', `Path ${path} already exists, skipping`);
        continue;
      }

      // Create SchemaFragment
      const options: CreateSchemaFragmentOptions = {
        namespace,
        fields: [
          {
            path,
            type: fieldType,
            defaultValue: data.initialValue,
          },
        ],
        origin: finding.provenance,
        evidence: [
          {
            kind: 'ast_node',
            ref: `${finding.artifactId}:${data.name}`,
            excerpt: data.sourceCode,
          },
        ],
      };

      const fragment = createSchemaFragment(options);
      fragments.push(fragment);
    }

    return fragments;
  },
};

// ============================================================================
// Export
// ============================================================================

export default schemaPass;

/**
 * Helper to determine type from both annotation and value
 */
export function determineSchemaFieldType(
  typeAnnotation: string | undefined,
  initialValue: unknown
): SchemaFieldType {
  if (typeAnnotation) {
    return mapTypeAnnotation(typeAnnotation);
  }
  if (initialValue !== undefined) {
    return inferTypeFromValue(initialValue);
  }
  return 'unknown';
}
