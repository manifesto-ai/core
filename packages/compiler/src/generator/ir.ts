/**
 * IR Generator - Transforms MEL AST to Core DomainSchema
 * Based on MEL SPEC v0.3.3 Section 5
 */

import type { Diagnostic } from "../diagnostics/types.js";
import type { SourceLocation } from "../lexer/source-location.js";
import type {
  ProgramNode,
  DomainNode,
  TypeDeclNode,   // v0.3.3
  StateNode,
  StateFieldNode,
  ComputedNode,
  ActionNode,
  ExprNode,
  GuardedStmtNode,
  InnerStmtNode,
  WhenStmtNode,
  OnceStmtNode,
  OnceIntentStmtNode,
  PatchStmtNode,
  EffectStmtNode,
  FailStmtNode,   // v0.3.2
  StopStmtNode,   // v0.3.2
  PathNode,
  TypeExprNode,
  ObjectTypeNode, // v0.3.3
} from "../parser/ast.js";
import type { MelExprNode } from "../lowering/lower-expr.js";
import {
  getPathExpr,
  objExpr,
  sysPathExpr,
  toMelExpr,
} from "../lowering/to-mel-expr.js";
import {
  hashSchemaSync,
  semanticPathToPatchPath,
  sha256Sync,
  type ExprNode as RuntimeExprNode,
  type FlowNode as RuntimeFlowNode,
  type PatchPath,
} from "@manifesto-ai/core";
import { lowerCanonicalSchema } from "./runtime-lowering.js";

// ============ Core IR Types (matching @manifesto-ai/core) ============

/**
 * Core ExprNode types (simplified, matching core/schema/expr.ts)
 */
export type CoreExprNode = RuntimeExprNode;

export type CompilerExprNode = MelExprNode;

/**
 * Core FlowNode types (matching core/schema/flow.ts)
 */
export type CoreFlowNode = RuntimeFlowNode;

export type CompilerFlowNode =
  | { kind: "seq"; steps: CompilerFlowNode[] }
  | { kind: "if"; cond: CompilerExprNode; then: CompilerFlowNode; else?: CompilerFlowNode }
  | { kind: "patch"; op: "set" | "unset" | "merge"; path: PatchPath; value?: CompilerExprNode }
  | { kind: "effect"; type: string; params: Record<string, CompilerExprNode> }
  | { kind: "call"; flow: string }
  | { kind: "halt"; reason?: string }
  | { kind: "fail"; code: string; message?: CompilerExprNode };

/**
 * Field type definition
 */
export type FieldType =
  | "string" | "number" | "boolean" | "null" | "object" | "array"
  | { enum: readonly unknown[] };

/**
 * Field specification
 */
export interface FieldSpec {
  type: FieldType;
  required: boolean;
  default?: unknown;
  description?: string;
  fields?: Record<string, FieldSpec>;
  items?: FieldSpec;
}

/**
 * State specification
 */
export interface StateSpec {
  fields: Record<string, FieldSpec>;
  fieldTypes?: Record<string, TypeDefinition>;
}

/**
 * Computed field specification
 */
export interface ComputedFieldSpec {
  deps: string[];
  expr: CoreExprNode;
  description?: string;
}

export interface CompilerComputedFieldSpec {
  deps: string[];
  expr: CompilerExprNode;
  description?: string;
}

/**
 * Computed specification
 */
export interface ComputedSpec {
  fields: Record<string, ComputedFieldSpec>;
}

/**
 * Action specification
 */
export interface ActionSpec {
  flow: CoreFlowNode;
  input?: FieldSpec;
  inputType?: TypeDefinition;
  params?: readonly string[];
  available?: CoreExprNode;
  dispatchable?: CoreExprNode;
  description?: string;
}

export interface CompilerActionSpec {
  flow: CompilerFlowNode;
  input?: FieldSpec;
  inputType?: TypeDefinition;
  params?: readonly string[];
  available?: CompilerExprNode;
  dispatchable?: CompilerExprNode;
  description?: string;
}

/**
 * Domain schema (output IR)
 */
/**
 * v0.3.3: Type specification (named type declaration)
 */
export interface TypeSpec {
  name: string;
  definition: TypeDefinition;
}

/**
 * v0.3.3: Type definition structure
 */
export type TypeDefinition =
  | { kind: "primitive"; type: string }
  | { kind: "array"; element: TypeDefinition }
  | { kind: "record"; key: TypeDefinition; value: TypeDefinition }
  | { kind: "object"; fields: Record<string, { type: TypeDefinition; optional: boolean }> }
  | { kind: "union"; types: TypeDefinition[] }
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "ref"; name: string };

export interface DomainSchema {
  id: string;
  version: string;
  hash: string;
  /** v0.3.3: Named type declarations */
  types: Record<string, TypeSpec>;
  state: StateSpec;
  computed: ComputedSpec;
  actions: Record<string, ActionSpec>;
  meta?: {
    name?: string;
    description?: string;
    authors?: string[];
  };
}

export interface CanonicalDomainSchema {
  id: string;
  version: string;
  hash: string;
  types: Record<string, TypeSpec>;
  state: StateSpec;
  computed: { fields: Record<string, CompilerComputedFieldSpec> };
  actions: Record<string, CompilerActionSpec>;
  meta?: {
    name?: string;
    description?: string;
    authors?: string[];
  };
}

// ============ Generation Context ============

/**
 * Context for IR generation
 */
interface GeneratorContext {
  domainName: string;
  stateFields: Set<string>;
  computedFields: Set<string>;
  actionParams: Map<string, Set<string>>; // action -> params
  onceIntentCounters: Map<string, number>; // action -> onceIntent block index
  currentAction: string | null;
  diagnostics: Diagnostic[];
  /** v0.3.3: Type declarations for expanding user-defined types */
  typeDefs: Map<string, TypeDeclNode>;
  typeDefinitions: Map<string, TypeDefinition>;
  /** Track 2: State field specs for literal type validation in patches */
  stateFieldSpecs: Map<string, FieldSpec>;
  stateFieldTypes: Map<string, TypeDefinition>;
}

interface ComputedEntry {
  name: string;
  deps: string[];
  expr: CompilerExprNode;
  location: ComputedNode["location"];
  order: number;
}

function createContext(domainName: string): GeneratorContext {
  return {
    domainName,
    stateFields: new Set(),
    computedFields: new Set(),
    actionParams: new Map(),
    onceIntentCounters: new Map(),
    currentAction: null,
    diagnostics: [],
    typeDefs: new Map(),
    typeDefinitions: new Map(),
    stateFieldSpecs: new Map(),
    stateFieldTypes: new Map(),
  };
}

// ============ Generator Result ============

export interface GenerateResult {
  schema: DomainSchema | null;
  diagnostics: Diagnostic[];
}

export interface GenerateCanonicalResult {
  schema: CanonicalDomainSchema | null;
  diagnostics: Diagnostic[];
}

// ============ Main Generator ============

export function generateCanonical(program: ProgramNode): GenerateCanonicalResult {
  const ctx = createContext(program.domain.name);

  // First pass: collect state and computed field names
  collectFieldNames(program.domain, ctx);

  // v0.3.3: Generate types first
  const types = generateTypes(program.domain, ctx);

  // Generate schema parts
  const state = generateState(program.domain, ctx);
  const computed = generateComputed(program.domain, ctx);
  const actions = generateActions(program.domain, ctx);

  if (ctx.diagnostics.some(d => d.severity === "error")) {
    return {
      schema: null,
      diagnostics: ctx.diagnostics,
    };
  }

  // Create schema
  const schemaWithoutHash: Omit<CanonicalDomainSchema, "hash"> = {
    id: `mel:${program.domain.name.toLowerCase()}`,
    version: "1.0.0",
    types,
    state,
    computed,
    actions,
    meta: {
      name: program.domain.name,
    },
  };

  // Compute hash
  const hash = computeCanonicalHash(schemaWithoutHash);

  const schema: CanonicalDomainSchema = {
    ...schemaWithoutHash,
    hash,
  };

  return {
    schema,
    diagnostics: ctx.diagnostics,
  };
}

/**
 * Generate runtime-ready DomainSchema from MEL AST.
 */
export function generate(program: ProgramNode): GenerateResult {
  const canonical = generateCanonical(program);
  if (!canonical.schema) {
    return {
      schema: null,
      diagnostics: canonical.diagnostics,
    };
  }

  return {
    schema: lowerCanonicalSchema(canonical.schema),
    diagnostics: canonical.diagnostics,
  };
}

// ============ Field Collection ============

function collectFieldNames(domain: DomainNode, ctx: GeneratorContext): void {
  // Collect type declarations first
  for (const typeDecl of domain.types) {
    ctx.typeDefs.set(typeDecl.name, typeDecl);
  }

  for (const member of domain.members) {
    if (member.kind === "state") {
      for (const field of member.fields) {
        ctx.stateFields.add(field.name);
      }
    } else if (member.kind === "computed") {
      ctx.computedFields.add(member.name);
    } else if (member.kind === "flow") {
      // flow/include are removed before canonical IR generation
    }
  }
}

// ============ Type Generation (v0.3.3) ============

function generateTypes(domain: DomainNode, _ctx: GeneratorContext): Record<string, TypeSpec> {
  const types: Record<string, TypeSpec> = {};

  for (const typeDecl of domain.types) {
    const definition = typeExprToDefinition(typeDecl.typeExpr);
    _ctx.typeDefinitions.set(typeDecl.name, definition);
    types[typeDecl.name] = {
      name: typeDecl.name,
      definition,
    };
  }

  return types;
}

function typeExprToDefinition(typeExpr: TypeExprNode): TypeDefinition {
  switch (typeExpr.kind) {
    case "simpleType":
      // Primitive types vs type references
      if (["string", "number", "boolean", "null", "object", "array"].includes(typeExpr.name)) {
        return { kind: "primitive", type: typeExpr.name };
      }
      // User-defined type reference
      return { kind: "ref", name: typeExpr.name };

    case "arrayType":
      return {
        kind: "array",
        element: typeExprToDefinition(typeExpr.elementType),
      };

    case "recordType":
      return {
        kind: "record",
        key: typeExprToDefinition(typeExpr.keyType),
        value: typeExprToDefinition(typeExpr.valueType),
      };

    case "objectType":
      const fields: Record<string, { type: TypeDefinition; optional: boolean }> = {};
      for (const field of typeExpr.fields) {
        fields[field.name] = {
          type: typeExprToDefinition(field.typeExpr),
          optional: field.optional,
        };
      }
      return { kind: "object", fields };

    case "unionType":
      return {
        kind: "union",
        types: typeExpr.types.map(typeExprToDefinition),
      };

    case "literalType":
      return { kind: "literal", value: typeExpr.value };

    default:
      // Exhaustive check
      const _exhaustive: never = typeExpr;
      throw new Error(`Unknown type expression kind: ${(typeExpr as TypeExprNode).kind}`);
  }
}

// ============ State Generation ============

function generateState(domain: DomainNode, ctx: GeneratorContext): StateSpec {
  const fields: Record<string, FieldSpec> = {};
  const fieldTypes: Record<string, TypeDefinition> = {};

  for (const member of domain.members) {
    if (member.kind === "state") {
      for (const field of member.fields) {
        const typeDefinition = typeExprToDefinition(field.typeExpr);
        fieldTypes[field.name] = typeDefinition;
        ctx.stateFieldTypes.set(field.name, typeDefinition);
        const typeSpec = typeExprToFieldSpec(field.typeExpr, ctx);
        if (typeSpec) {
          ctx.stateFieldSpecs.set(field.name, typeSpec);
        }
        const fieldSpec = generateFieldSpec(field, ctx);
        if (fieldSpec) {
          fields[field.name] = fieldSpec;
        }
      }
    }
  }

  return { fields, fieldTypes };
}

function generateFieldSpec(field: StateFieldNode, ctx: GeneratorContext): FieldSpec | null {
  const spec = typeExprToFieldSpec(field.typeExpr, ctx);
  if (!spec) {
    return null;
  }
  const defaultValue = field.initializer
    ? evaluateInitializer(field.initializer, ctx)
    : undefined;

  // Track 2: validate literal default against the type-level spec
  // (before `required: true` override, which means "field must exist in state",
  //  not "field is non-nullable")
  if (defaultValue !== undefined) {
    validateLiteralAgainstTypeDefinition(
      defaultValue,
      typeExprToDefinition(field.typeExpr),
      field.name,
      field.location,
      ctx,
    );
  }

  return {
    ...spec,
    required: true,
    default: defaultValue,
  };
}

/**
 * Convert TypeExprNode to complete FieldSpec (including nested fields)
 * This is the full conversion that includes `fields` for object types
 */
function typeExprToFieldSpec(
  typeExpr: TypeExprNode,
  ctx: GeneratorContext,
  seenTypeRefs: readonly string[] = []
): FieldSpec | null {
  switch (typeExpr.kind) {
    case "simpleType":
      switch (typeExpr.name) {
        case "string": return { type: "string", required: true };
        case "number": return { type: "number", required: true };
        case "boolean": return { type: "boolean", required: true };
        case "null": return { type: "null", required: true };
        default: {
          // User-defined type - look up and expand
          const typeDef = ctx.typeDefs.get(typeExpr.name);
          if (typeDef) {
            if (seenTypeRefs.includes(typeExpr.name)) {
              pushSchemaTypeError(
                ctx,
                "E044",
                `Recursive type '${typeExpr.name}' cannot be lowered to FieldSpec in a schema position`,
                typeExpr.location
              );
              return null;
            }
            return typeExprToFieldSpec(typeDef.typeExpr, ctx, [...seenTypeRefs, typeExpr.name]);
          }
          // Unknown type - treat as opaque object
          return { type: "object", required: true };
        }
      }

    case "unionType": {
      const nonNullTypes = typeExpr.types.filter(
        (candidate) =>
          !(candidate.kind === "simpleType" && candidate.name === "null") &&
          !(candidate.kind === "literalType" && candidate.value === null)
      );
      const hasNull = nonNullTypes.length !== typeExpr.types.length;
      const enumValues: unknown[] = [];
      let isLiteralEnum = !hasNull;

      for (const candidate of nonNullTypes) {
        if (candidate.kind !== "literalType") {
          isLiteralEnum = false;
          break;
        }
        enumValues.push(candidate.value);
      }

      if (isLiteralEnum && enumValues.length > 0) {
        return { type: { enum: enumValues }, required: true };
      }

      if (hasNull && nonNullTypes.length === 1) {
        return typeExprToFieldSpec(nonNullTypes[0], ctx, seenTypeRefs);
      }

      pushSchemaTypeError(
        ctx,
        "E043",
        `Union type '${describeTypeExpr(typeExpr)}' cannot be soundly lowered to FieldSpec`,
        typeExpr.location
      );
      return null;
    }

    case "arrayType": {
      const itemSpec = typeExprToFieldSpec(typeExpr.elementType, ctx, seenTypeRefs);
      if (!itemSpec) {
        return null;
      }
      return {
        type: "array",
        required: true,
        items: itemSpec,
      };
    }

    case "recordType":
      return {
        type: "object",
        required: true,
      };

    case "literalType":
      // Single literal type - use its base type
      if (typeof typeExpr.value === "string") return { type: "string", required: true };
      if (typeof typeExpr.value === "number") return { type: "number", required: true };
      if (typeof typeExpr.value === "boolean") return { type: "boolean", required: true };
      return { type: "null", required: true };

    case "objectType": {
      // v0.3.3: Inline object type - expand to fields
      const objectFields: Record<string, FieldSpec> = {};
      for (const field of typeExpr.fields) {
        const fieldSpec = typeExprToFieldSpec(field.typeExpr, ctx, seenTypeRefs);
        if (!fieldSpec) {
          return null;
        }
        objectFields[field.name] = {
          ...fieldSpec,
          required: !field.optional,
        };
      }
      return {
        type: "object",
        required: true,
        fields: objectFields,
      };
    }
  }
}

/**
 * Simple type extraction (for backward compat with action input specs)
 */
function typeExprToFieldType(typeExpr: TypeExprNode, ctx: GeneratorContext): FieldType {
  const spec = typeExprToFieldSpec(typeExpr, ctx);
  return spec?.type ?? "object";
}

function pushSchemaTypeError(
  ctx: GeneratorContext,
  code: string,
  message: string,
  location: TypeExprNode["location"]
): void {
  ctx.diagnostics.push({
    severity: "error",
    code,
    message,
    location,
  });
}

function describeTypeExpr(typeExpr: TypeExprNode): string {
  switch (typeExpr.kind) {
    case "simpleType":
      return typeExpr.name;
    case "unionType":
      return typeExpr.types.map((member) => describeTypeExpr(member)).join(" | ");
    case "arrayType":
      return `Array<${describeTypeExpr(typeExpr.elementType)}>`;
    case "recordType":
      return `Record<${describeTypeExpr(typeExpr.keyType)}, ${describeTypeExpr(typeExpr.valueType)}>`;
    case "literalType":
      return JSON.stringify(typeExpr.value);
    case "objectType":
      return `{ ${typeExpr.fields.map((field) => `${field.name}${field.optional ? "?" : ""}: ${describeTypeExpr(field.typeExpr)}`).join("; ")} }`;
  }
}

// ============ Literal Type Validation (Track 2) ============

function resolveTypeDefinitionWithCtx(
  definition: TypeDefinition,
  ctx: GeneratorContext,
  seenRefs: readonly string[] = [],
): TypeDefinition | null {
  if (definition.kind !== "ref") {
    return definition;
  }

  if (seenRefs.includes(definition.name)) {
    return null;
  }

  const next = ctx.typeDefinitions.get(definition.name);
  if (!next) {
    return null;
  }

  return resolveTypeDefinitionWithCtx(next, ctx, [...seenRefs, definition.name]);
}

function isNullTypeDefinition(definition: TypeDefinition | null): boolean {
  return (definition?.kind === "primitive" && definition.type === "null")
    || (definition?.kind === "literal" && definition.value === null);
}

function getSingleNonNullUnionBranch(
  definition: TypeDefinition,
  ctx: GeneratorContext,
): TypeDefinition | null {
  const resolved = resolveTypeDefinitionWithCtx(definition, ctx);
  if (!resolved || resolved.kind !== "union") {
    return null;
  }

  const nonNullTypes = resolved.types.filter((candidate) => {
    const next = resolveTypeDefinitionWithCtx(candidate, ctx);
    return !isNullTypeDefinition(next);
  });

  return nonNullTypes.length === 1 ? nonNullTypes[0] : null;
}

function getPatchLiteralValidationTargetType(
  targetType: TypeDefinition,
  literalValue: unknown,
  ctx: GeneratorContext,
): TypeDefinition {
  if (literalValue === null || Array.isArray(literalValue) || typeof literalValue !== "object") {
    return targetType;
  }

  const nonNullBranch = getSingleNonNullUnionBranch(targetType, ctx);
  if (!nonNullBranch) {
    return targetType;
  }

  const resolvedNonNullBranch = resolveTypeDefinitionWithCtx(nonNullBranch, ctx);
  return resolvedNonNullBranch?.kind === "object"
    ? nonNullBranch
    : targetType;
}

function describeTypeDefinition(definition: TypeDefinition): string {
  switch (definition.kind) {
    case "primitive":
      return definition.type;
    case "array":
      return `Array<${describeTypeDefinition(definition.element)}>`;
    case "record":
      return `Record<${describeTypeDefinition(definition.key)}, ${describeTypeDefinition(definition.value)}>`;
    case "object":
      return `{ ${Object.entries(definition.fields)
        .map(([name, field]) => `${name}${field.optional ? "?" : ""}: ${describeTypeDefinition(field.type)}`)
        .join("; ")} }`;
    case "union":
      return definition.types.map((candidate) => describeTypeDefinition(candidate)).join(" | ");
    case "literal":
      return JSON.stringify(definition.value);
    case "ref":
      return definition.name;
  }
}

function literalMatchesTypeDefinition(
  value: unknown,
  definition: TypeDefinition,
  ctx: GeneratorContext,
): boolean {
  const resolved = resolveTypeDefinitionWithCtx(definition, ctx);
  if (!resolved) {
    return false;
  }

  switch (resolved.kind) {
    case "primitive":
      switch (resolved.type) {
        case "null":
          return value === null;
        case "string":
          return typeof value === "string";
        case "number":
          return typeof value === "number";
        case "boolean":
          return typeof value === "boolean";
        case "object":
          return value !== null && !Array.isArray(value) && typeof value === "object";
        case "array":
          return Array.isArray(value);
        default:
          return false;
      }

    case "literal":
      return Object.is(value, resolved.value);

    case "array":
      return Array.isArray(value)
        && value.every((item) => literalMatchesTypeDefinition(item, resolved.element, ctx));

    case "record":
      return value !== null
        && !Array.isArray(value)
        && typeof value === "object"
        && Object.values(value as Record<string, unknown>)
          .every((item) => literalMatchesTypeDefinition(item, resolved.value, ctx));

    case "object":
      if (value === null || Array.isArray(value) || typeof value !== "object") {
        return false;
      }
      for (const key of Object.keys(value as Record<string, unknown>)) {
        if (!(key in resolved.fields)) {
          return false;
        }
      }
      for (const [name, field] of Object.entries(resolved.fields)) {
        if (!(name in (value as Record<string, unknown>))) {
          if (!field.optional) {
            return false;
          }
          continue;
        }
        if (!literalMatchesTypeDefinition((value as Record<string, unknown>)[name], field.type, ctx)) {
          return false;
        }
      }
      return true;

    case "union":
      return resolved.types.some((candidate) => literalMatchesTypeDefinition(value, candidate, ctx));

    case "ref":
      return false;
  }
}

function validateLiteralAgainstTypeDefinition(
  value: unknown,
  definition: TypeDefinition,
  fieldName: string,
  location: SourceLocation,
  ctx: GeneratorContext,
): void {
  if (value === undefined) return;
  const resolved = resolveTypeDefinitionWithCtx(definition, ctx);
  if (!resolved) {
    ctx.diagnostics.push({
      severity: "error",
      code: "E_TYPE_MISMATCH",
      message: `Type mismatch: field '${fieldName}' expects ${describeTypeDefinition(definition)}, got ${JSON.stringify(value)}`,
      location,
    });
    return;
  }

  if (resolved.kind === "union") {
    if (literalMatchesTypeDefinition(value, resolved, ctx)) {
      return;
    }
    ctx.diagnostics.push({
      severity: "error",
      code: "E_TYPE_MISMATCH",
      message: `Type mismatch: field '${fieldName}' expects ${describeTypeDefinition(resolved)}, got ${JSON.stringify(value)}`,
      location,
    });
    return;
  }

  switch (resolved.kind) {
    case "primitive": {
      const actualType = Array.isArray(value)
        ? "array"
        : (value === null ? "null" : typeof value);
      switch (resolved.type) {
        case "null":
          if (value !== null) {
            emitTypeMismatch(ctx, fieldName, "null", actualType, location);
          }
          return;
        case "string":
        case "number":
        case "boolean":
          if (typeof value !== resolved.type) {
            emitTypeMismatch(ctx, fieldName, resolved.type, actualType, location);
          }
          return;
        case "object":
          if (value === null || Array.isArray(value) || typeof value !== "object") {
            emitTypeMismatch(ctx, fieldName, "object", actualType, location);
          }
          return;
        case "array":
          if (!Array.isArray(value)) {
            emitTypeMismatch(ctx, fieldName, "array", actualType, location);
          }
          return;
      }
      return;
    }

    case "literal":
      if (!Object.is(value, resolved.value)) {
        ctx.diagnostics.push({
          severity: "error",
          code: "E_TYPE_MISMATCH",
          message: `Type mismatch: field '${fieldName}' expects literal ${JSON.stringify(resolved.value)}, got ${JSON.stringify(value)}`,
          location,
        });
      }
      return;

    case "array":
      if (!Array.isArray(value)) {
        const actualType = value === null ? "null" : (typeof value === "object" ? "object" : typeof value);
        emitTypeMismatch(ctx, fieldName, "array", actualType, location);
        return;
      }
      for (let i = 0; i < value.length; i += 1) {
        validateLiteralAgainstTypeDefinition(value[i], resolved.element, `${fieldName}[${i}]`, location, ctx);
      }
      return;

    case "record":
      if (value === null || Array.isArray(value) || typeof value !== "object") {
        const actualType = Array.isArray(value) ? "array" : (value === null ? "null" : typeof value);
        emitTypeMismatch(ctx, fieldName, "object", actualType, location);
        return;
      }
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        validateLiteralAgainstTypeDefinition(entry, resolved.value, `${fieldName}.${key}`, location, ctx);
      }
      return;

    case "object":
      if (value === null || Array.isArray(value) || typeof value !== "object") {
        const actualType = Array.isArray(value) ? "array" : (value === null ? "null" : typeof value);
        emitTypeMismatch(ctx, fieldName, "object", actualType, location);
        return;
      }
      for (const key of Object.keys(value as Record<string, unknown>)) {
        if (!(key in resolved.fields)) {
          ctx.diagnostics.push({
            severity: "error",
            code: "E_TYPE_MISMATCH",
            message: `Type mismatch: field '${fieldName}.${key}' is not declared in ${describeTypeDefinition(resolved)}`,
            location,
          });
        }
      }
      for (const [name, field] of Object.entries(resolved.fields)) {
        if (!(name in (value as Record<string, unknown>))) {
          if (!field.optional) {
            ctx.diagnostics.push({
              severity: "error",
              code: "E_TYPE_MISMATCH",
              message: `Type mismatch: field '${fieldName}.${name}' is required`,
              location,
            });
          }
          continue;
        }
        validateLiteralAgainstTypeDefinition(
          (value as Record<string, unknown>)[name],
          field.type,
          `${fieldName}.${name}`,
          location,
          ctx,
        );
      }
      return;

    case "ref":
      ctx.diagnostics.push({
        severity: "error",
        code: "E_TYPE_MISMATCH",
        message: `Type mismatch: field '${fieldName}' expects ${describeTypeDefinition(definition)}, got ${JSON.stringify(value)}`,
        location,
      });
      return;
  }
}

/**
 * Validate a literal value against a FieldSpec, emitting E_TYPE_MISMATCH diagnostics.
 * Only checks statically-known literal values; complex expressions (undefined) are skipped.
 */
function validateLiteralAgainstSpec(
  value: unknown,
  spec: FieldSpec,
  fieldName: string,
  location: SourceLocation,
  ctx: GeneratorContext,
): void {
  if (value === undefined) return; // Complex expression, can't check statically

  // Null on required (non-nullable) field
  if (value === null) {
    if (spec.required !== false && !(typeof spec.type === "object" && "enum" in spec.type && (spec.type as {enum: unknown[]}).enum.includes(null))) {
      ctx.diagnostics.push({
        severity: "error",
        code: "E_TYPE_MISMATCH",
        message: `Type mismatch: field '${fieldName}' is not nullable, but initializer is null`,
        location,
      });
    }
    return;
  }

  const specType = spec.type;

  // Enum check
  if (typeof specType === "object" && "enum" in specType) {
    if (!specType.enum.some((e: unknown) => Object.is(e, value))) {
      ctx.diagnostics.push({
        severity: "error",
        code: "E_TYPE_MISMATCH",
        message: `Type mismatch: field '${fieldName}' expects one of [${specType.enum.join(", ")}], got ${JSON.stringify(value)}`,
        location,
      });
    }
    return;
  }

  // Primitive type check
  const actualType = Array.isArray(value) ? "array" : (typeof value === "object" ? "object" : typeof value);

  if (specType === "string" && typeof value !== "string") {
    emitTypeMismatch(ctx, fieldName, "string", actualType, location);
  } else if (specType === "number" && typeof value !== "number") {
    emitTypeMismatch(ctx, fieldName, "number", actualType, location);
  } else if (specType === "boolean" && typeof value !== "boolean") {
    emitTypeMismatch(ctx, fieldName, "boolean", actualType, location);
  } else if (specType === "array" && !Array.isArray(value)) {
    emitTypeMismatch(ctx, fieldName, "array", actualType, location);
  } else if (specType === "object" && (typeof value !== "object" || Array.isArray(value))) {
    emitTypeMismatch(ctx, fieldName, "object", actualType, location);
  }

  // Recursive object field validation
  if (specType === "object" && spec.fields && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const [key, fieldSpec] of Object.entries(spec.fields)) {
      if (key in obj) {
        validateLiteralAgainstSpec(obj[key], fieldSpec, `${fieldName}.${key}`, location, ctx);
      }
    }
  }

  // Recursive array item validation
  if (specType === "array" && spec.items && Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      validateLiteralAgainstSpec(value[i], spec.items, `${fieldName}[${i}]`, location, ctx);
    }
  }
}

function emitTypeMismatch(
  ctx: GeneratorContext,
  fieldName: string,
  expected: string,
  actual: string,
  location: SourceLocation,
): void {
  ctx.diagnostics.push({
    severity: "error",
    code: "E_TYPE_MISMATCH",
    message: `Type mismatch: field '${fieldName}' expects ${expected}, got ${actual}`,
    location,
  });
}

function evaluateInitializer(expr: ExprNode, ctx: GeneratorContext): unknown {
  // Only evaluate literals and simple expressions for default values
  switch (expr.kind) {
    case "literal":
      return expr.value;

    case "arrayLiteral":
      return expr.elements.map(e => evaluateInitializer(e, ctx));

    case "objectLiteral": {
      const obj: Record<string, unknown> = {};
      for (const prop of expr.properties) {
        if (prop.kind === "objectProperty") {
          obj[prop.key] = evaluateInitializer(prop.value, ctx);
          continue;
        }

        const spreadValue = evaluateInitializer(prop.expr, ctx);
        if (spreadValue !== null && !Array.isArray(spreadValue) && typeof spreadValue === "object") {
          Object.assign(obj, spreadValue);
        }
      }
      return obj;
    }

    default:
      // Complex expressions can't be evaluated statically
      return undefined;
  }
}

// ============ Computed Generation ============

function generateComputed(
  domain: DomainNode,
  ctx: GeneratorContext
): { fields: Record<string, CompilerComputedFieldSpec> } {
  const entries: ComputedEntry[] = [];
  let order = 0;

  for (const member of domain.members) {
    if (member.kind === "computed") {
      const expr = generateExpr(member.expression, ctx);
      const deps = extractDeps(expr);

      entries.push({
        name: member.name,
        deps,
        expr,
        location: member.location,
        order,
      });
      order += 1;
    }
  }

  const fields: Record<string, CompilerComputedFieldSpec> = {};
  for (const entry of topologicallyOrderComputedEntries(entries, ctx)) {
    fields[entry.name] = {
      deps: entry.deps,
      expr: entry.expr,
    };
  }

  return { fields };
}

function topologicallyOrderComputedEntries(entries: readonly ComputedEntry[], ctx: GeneratorContext): ComputedEntry[] {
  if (entries.length <= 1) {
    return [...entries];
  }

  const entryByName = new Map(entries.map((entry) => [entry.name, entry]));
  const computedDeps = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const entry of entries) {
    dependents.set(entry.name, []);
    inDegree.set(entry.name, 0);
  }

  for (const entry of entries) {
    const deps = Array.from(new Set(entry.deps.filter((dep) => entryByName.has(dep))));
    computedDeps.set(entry.name, deps);
    inDegree.set(entry.name, deps.length);

    for (const dep of deps) {
      dependents.get(dep)!.push(entry.name);
    }
  }

  const queue = entries
    .filter((entry) => (inDegree.get(entry.name) ?? 0) === 0)
    .map((entry) => entry.name);
  const sorted: ComputedEntry[] = [];

  while (queue.length > 0) {
    const name = queue.shift()!;
    sorted.push(entryByName.get(name)!);

    for (const dependent of dependents.get(name) ?? []) {
      const nextDegree = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, nextDegree);
      if (nextDegree === 0) {
        insertComputedQueue(queue, dependent, entryByName);
      }
    }
  }

  if (sorted.length !== entries.length) {
    const sortedNames = new Set(sorted.map((entry) => entry.name));
    const remaining = entries.filter((entry) => !sortedNames.has(entry.name));
    const cyclePath = findComputedCyclePath(remaining[0]!.name, computedDeps);
    const renderedCycle = cyclePath ? cyclePath.join(" -> ") : remaining.map((entry) => entry.name).join(", ");

    pushSchemaTypeError(
      ctx,
      "E040",
      `Circular computed dependency: ${renderedCycle}`,
      (cyclePath ? entryByName.get(cyclePath[0]) : remaining[0])!.location
    );

    return [...entries];
  }

  return sorted;
}

function insertComputedQueue(
  queue: string[],
  candidate: string,
  entryByName: Map<string, ComputedEntry>
): void {
  const candidateOrder = entryByName.get(candidate)?.order ?? Number.MAX_SAFE_INTEGER;
  let insertAt = queue.length;

  for (let index = 0; index < queue.length; index += 1) {
    const queuedOrder = entryByName.get(queue[index])?.order ?? Number.MAX_SAFE_INTEGER;
    if (candidateOrder < queuedOrder) {
      insertAt = index;
      break;
    }
  }

  queue.splice(insertAt, 0, candidate);
}

function findComputedCyclePath(start: string, graph: Map<string, string[]>): string[] | null {
  const visited = new Set<string>();
  const stack: string[] = [];
  const stackSet = new Set<string>();

  function visit(node: string): string[] | null {
    visited.add(node);
    stack.push(node);
    stackSet.add(node);

    for (const dep of graph.get(node) ?? []) {
      if (!visited.has(dep)) {
        const cycle = visit(dep);
        if (cycle) {
          return cycle;
        }
      } else if (stackSet.has(dep)) {
        const cycleStart = stack.indexOf(dep);
        return [...stack.slice(cycleStart), dep];
      }
    }

    stack.pop();
    stackSet.delete(node);
    return null;
  }

  return visit(start);
}

function extractDeps(expr: CompilerExprNode): string[] {
  const deps = new Set<string>();

  function visit(node: CompilerExprNode): void {
    switch (node.kind) {
      case "lit":
      case "sys":
      case "var":
        return;

      case "get":
        if (node.base === undefined) {
          deps.add(node.path.map((segment) => segment.name).join("."));
        } else {
          visit(node.base);
        }
        return;

      case "field":
        visit(node.object);
        return;

      case "call":
        for (const arg of node.args) {
          visit(arg);
        }
        return;

      case "obj":
        for (const field of node.fields) {
          visit(field.value);
        }
        return;

      case "arr":
        for (const element of node.elements) {
          visit(element);
        }
        return;
    }
  }

  visit(expr);
  return Array.from(deps);
}

// ============ Action Generation ============

function generateActions(domain: DomainNode, ctx: GeneratorContext): Record<string, CompilerActionSpec> {
  const actions: Record<string, CompilerActionSpec> = {};

  for (const member of domain.members) {
    if (member.kind === "action") {
      ctx.currentAction = member.name;
      ctx.onceIntentCounters.set(member.name, 0);

      // Collect params
      const params = new Set<string>();
      for (const param of member.params) {
        params.add(param.name);
      }
      ctx.actionParams.set(member.name, params);
      const declaredParams = member.params.map((param) => param.name);

      const flow = generateFlow(member.body, ctx);

      // Generate input spec if there are params
      let input: FieldSpec | undefined;
      let inputType: TypeDefinition | undefined;
      if (member.params.length > 0) {
        const inputFields: Record<string, FieldSpec> = {};
        const inputTypeFields: Record<string, { type: TypeDefinition; optional: boolean }> = {};
        for (const param of member.params) {
          const fieldSpec = typeExprToFieldSpec(param.typeExpr, ctx);
          if (!fieldSpec) {
            continue;
          }
          inputFields[param.name] = structuredClone(fieldSpec);
          inputTypeFields[param.name] = {
            type: typeExprToDefinition(param.typeExpr),
            optional: false,
          };
        }
        input = {
          type: "object",
          required: true,
          fields: inputFields,
        };
        inputType = {
          kind: "object",
          fields: inputTypeFields,
        };
      }

      // v0.3.2+: Generate availability/dispatchability conditions if present
      let available: CompilerExprNode | undefined;
      if (member.available) {
        available = generateExpr(member.available, ctx);
      }
      let dispatchable: CompilerExprNode | undefined;
      if (member.dispatchable) {
        dispatchable = generateExpr(member.dispatchable, ctx, {
          preferActionParams: true,
        });
      }

      actions[member.name] = {
        flow,
        input,
        inputType,
        params: declaredParams,
        available,
        dispatchable,
      };

      ctx.currentAction = null;
    }
  }

  return actions;
}

function generateFlow(
  stmts: (GuardedStmtNode | InnerStmtNode)[],
  ctx: GeneratorContext
): CompilerFlowNode {
  if (stmts.length === 0) {
    return { kind: "seq", steps: [] };
  }

  if (stmts.length === 1) {
    return generateStmt(stmts[0], ctx);
  }

  return {
    kind: "seq",
    steps: stmts.map(s => generateStmt(s, ctx)),
  };
}

function generateStmt(
  stmt: GuardedStmtNode | InnerStmtNode,
  ctx: GeneratorContext
): CompilerFlowNode {
  switch (stmt.kind) {
    case "when":
      return generateWhen(stmt, ctx);

    case "once":
      return generateOnce(stmt, ctx);

    case "onceIntent":
      return generateOnceIntent(stmt, ctx);

    case "patch":
      return generatePatch(stmt, ctx);

    case "effect":
      return generateEffect(stmt, ctx);

    case "fail":
      return generateFail(stmt, ctx);

    case "stop":
      return generateStop(stmt, ctx);

    case "include":
      return { kind: "seq", steps: [] };
  }
}

function generateWhen(stmt: WhenStmtNode, ctx: GeneratorContext): CompilerFlowNode {
  const cond = generateExpr(stmt.condition, ctx);
  const thenFlow = generateFlow(stmt.body, ctx);

  return {
    kind: "if",
    cond,
    then: thenFlow,
  };
}

function generateOnce(stmt: OnceStmtNode, ctx: GeneratorContext): CompilerFlowNode {
  // Desugar once(marker) { ... } to:
  // when neq(marker, $meta.intentId) { patch marker = $meta.intentId; ... }
  // Note: Core accesses $meta intent values via meta.*

  const markerPath = generatePath(stmt.marker, ctx);
  const intentIdExpr: CompilerExprNode = sysPathExpr("meta", "intentId");

  // Condition: marker != $meta.intentId
  let cond: CompilerExprNode = callExpr("neq", [getPathExpr(...pathToSegments(markerPath)), intentIdExpr]);

  // Add extra condition if present
  if (stmt.condition) {
    const extraCond = generateExpr(stmt.condition, ctx);
    cond = callExpr("and", [cond, extraCond]);
  }

  // Body: patch marker = $meta.intentId, then rest
  const markerPatch: CompilerFlowNode = {
    kind: "patch",
    op: "set",
    path: toPatchPath(markerPath),
    value: intentIdExpr,
  };

  const bodySteps = stmt.body.map(s => generateStmt(s, ctx));

  return {
    kind: "if",
    cond,
    then: {
      kind: "seq",
      steps: [markerPatch, ...bodySteps],
    },
  };
}

function generateOnceIntent(stmt: OnceIntentStmtNode, ctx: GeneratorContext): CompilerFlowNode {
  const actionName = ctx.currentAction ?? "unknown";
  const nextIndex = ctx.onceIntentCounters.get(actionName) ?? 0;
  ctx.onceIntentCounters.set(actionName, nextIndex + 1);

  const guardId = sha256Sync(`${actionName}:${nextIndex}:intent`);
  const guardPath = `$mel.guards.intent.${guardId}`;
  const intentIdExpr: CompilerExprNode = sysPathExpr("meta", "intentId");

  let cond: CompilerExprNode = callExpr("neq", [getPathExpr(...pathToSegments(guardPath)), intentIdExpr]);

  if (stmt.condition) {
    const extraCond = generateExpr(stmt.condition, ctx);
    cond = callExpr("and", [cond, extraCond]);
  }

  // Guard write: semantic target is guardPath, lowered as map-level merge.
  const markerPatch: CompilerFlowNode = {
    kind: "patch",
    op: "merge",
    path: toPatchPath("$mel.guards.intent"),
    value: objExpr({ [guardId]: intentIdExpr }),
  };

  const bodySteps = stmt.body.map(s => generateStmt(s, ctx));

  return {
    kind: "if",
    cond,
    then: {
      kind: "seq",
      steps: [markerPatch, ...bodySteps],
    },
  };
}

function generatePatch(stmt: PatchStmtNode, ctx: GeneratorContext): CompilerFlowNode {
  const path = generatePath(stmt.path, ctx);

  const result: CompilerFlowNode = {
    kind: "patch",
    op: stmt.op,
    path: toPatchPath(path),
  };

  if (stmt.value) {
    const valueExpr = generateExpr(stmt.value, ctx);
    (result as { kind: "patch"; op: "set" | "unset" | "merge"; path: PatchPath; value?: CompilerExprNode }).value = valueExpr;

    // Track 2: validate literal patch values against the target field's declared type
    if (stmt.op === "set") {
      const rootField = stmt.path.segments[0];
      if (rootField.kind === "propertySegment") {
        const fieldType = ctx.stateFieldTypes.get(rootField.name);
        if (fieldType) {
          // Resolve the target type for nested paths
          let targetType: TypeDefinition | null = fieldType;
          const segments = stmt.path.segments;
          for (let i = 1; i < segments.length; i++) {
            const seg = segments[i];
            const resolved: TypeDefinition | null = targetType
              ? resolveTypeDefinitionWithCtx(targetType, ctx)
              : null;
            if (!resolved) {
              targetType = null;
              break;
            }
            if (resolved.kind === "union") {
              const nonNullType = getSingleNonNullUnionBranch(targetType, ctx);
              if (!nonNullType) {
                targetType = null;
                break;
              }
              targetType = nonNullType;
              i -= 1;
              continue;
            }

            if (seg.kind === "propertySegment" && resolved.kind === "object" && resolved.fields[seg.name]) {
              targetType = resolved.fields[seg.name].type;
            } else if (seg.kind === "propertySegment" && resolved.kind === "record") {
              targetType = resolved.value;
            } else if (seg.kind === "indexSegment" && resolved.kind === "array") {
              targetType = resolved.element;
            } else {
              // Can't resolve further — skip validation
              targetType = null;
              break;
            }
          }
          if (targetType) {
            const literalValue = evaluatePatchLiteral(stmt.value, ctx);
            if (literalValue !== undefined) {
              const fieldName = stmt.path.segments.map(s =>
                s.kind === "propertySegment" ? s.name : "[*]"
              ).join(".");
              const validationTargetType = getPatchLiteralValidationTargetType(
                targetType,
                literalValue,
                ctx,
              );
              validateLiteralAgainstTypeDefinition(
                literalValue,
                validationTargetType,
                fieldName,
                stmt.location,
                ctx,
              );
            }
          }
        }
      }
    }
  }

  return result;
}

function generateEffect(stmt: EffectStmtNode, ctx: GeneratorContext): CompilerFlowNode {
  const params: Record<string, CompilerExprNode> = {};

  for (const arg of stmt.args) {
    if (arg.isPath) {
      // Path arguments like into:, pass:, fail:
      params[arg.name] = { kind: "lit", value: generatePath(arg.value as PathNode, ctx) };
    } else {
      params[arg.name] = generateExpr(arg.value as ExprNode, ctx);
    }
  }

  return {
    kind: "effect",
    type: stmt.effectType,
    params,
  };
}

/**
 * Try to evaluate a patch value expression as a literal.
 * Returns undefined for non-literal (dynamic) expressions.
 */
function evaluatePatchLiteral(expr: ExprNode, ctx: GeneratorContext): unknown {
  return evaluateInitializer(expr, ctx);
}

/**
 * v0.3.2: Generate fail statement
 * fail "CODE" with expr → { kind: "fail", code, message? }
 */
function generateFail(stmt: FailStmtNode, ctx: GeneratorContext): CompilerFlowNode {
  const result: CompilerFlowNode = {
    kind: "fail",
    code: stmt.code,
  };

  if (stmt.message) {
    (result as { kind: "fail"; code: string; message?: CompilerExprNode }).message = generateExpr(stmt.message, ctx);
  }

  return result;
}

/**
 * v0.3.2: Generate stop statement
 * stop "reason" → { kind: "halt", reason }
 */
function generateStop(stmt: StopStmtNode, ctx: GeneratorContext): CompilerFlowNode {
  return {
    kind: "halt",
    reason: stmt.reason,
  };
}

// ============ Path Generation ============

function escapePathSegment(segment: string): string {
  return segment.replaceAll("\\", "\\\\").replaceAll(".", "\\.");
}

function joinPathPreserveEmptySegments(...segments: string[]): string {
  return segments.map(escapePathSegment).join(".");
}

function generatePath(path: PathNode, ctx: GeneratorContext): string {
  const segments: string[] = [];

  for (const segment of path.segments) {
    if (segment.kind === "propertySegment") {
      segments.push(segment.name);
    } else {
      // Index segment - for now, stringify the index
      // In reality, this would need runtime evaluation
      const indexExpr = generateExpr(segment.index, ctx);
      if (indexExpr.kind === "lit") {
        segments.push(String(indexExpr.value));
      } else {
        // Dynamic index - use placeholder
        segments.push("*");
      }
    }
  }

  // Determine prefix based on first segment
  const first = segments[0];
  if (ctx.stateFields.has(first)) {
    // Core expects state paths without prefix (e.g., "count" not "data.count")
    return joinPathPreserveEmptySegments(...segments);
  }
  if (ctx.computedFields.has(first)) {
    return joinPathPreserveEmptySegments(...segments);
  }
  if (ctx.currentAction && ctx.actionParams.get(ctx.currentAction)?.has(first)) {
    return `input.${joinPathPreserveEmptySegments(...segments)}`;
  }

  // Default to plain path (state-like)
  return joinPathPreserveEmptySegments(...segments);
}

function toPatchPath(path: string): PatchPath {
  return semanticPathToPatchPath(path);
}

function callExpr(fn: string, args: CompilerExprNode[]): CompilerExprNode {
  return { kind: "call", fn, args };
}

function pathToSegments(path: string): string[] {
  return path.split(/(?<!\\)\./g).map((segment) => segment.replaceAll("\\.", ".").replaceAll("\\\\", "\\"));
}

// ============ Expression Generation ============

interface GenerateExprOptions {
  preferActionParams?: boolean;
}

function generateExpr(
  expr: ExprNode,
  ctx: GeneratorContext,
  options: GenerateExprOptions = {}
): CompilerExprNode {
  return toMelExpr(expr, {
    resolveIdentifier: (name) => resolveIdentifier(name, ctx, options),
    resolveSystemIdent: (path) => resolveSystemIdent(path, ctx),
  });
}

function resolveIdentifier(
  name: string,
  ctx: GeneratorContext,
  options: GenerateExprOptions = {}
): CompilerExprNode {
  if (
    options.preferActionParams
    && ctx.currentAction
    && ctx.actionParams.get(ctx.currentAction)?.has(name)
  ) {
    return getPathExpr("input", name);
  }

  if (ctx.stateFields.has(name) || ctx.computedFields.has(name)) {
    return getPathExpr(name);
  }

  if (ctx.currentAction && ctx.actionParams.get(ctx.currentAction)?.has(name)) {
    return getPathExpr("input", name);
  }

  ctx.diagnostics.push({
    severity: "error",
    code: "E_UNKNOWN_IDENT",
    message: `Unknown identifier '${name}'`,
    location: { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
  });

  return getPathExpr(name);
}

function resolveSystemIdent(path: string[], ctx: GeneratorContext): CompilerExprNode {
  const [namespace, ...rest] = path;

  switch (namespace) {
    case "system":
    case "meta":
    case "input":
      return sysPathExpr(namespace, ...rest);

    default:
      ctx.diagnostics.push({
        severity: "error",
        code: "E_INVALID_SYSTEM",
        message: `Invalid system identifier namespace '$${namespace}'`,
        location: { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
      });
      return { kind: "lit", value: null };
  }
}

// ============ Hash Computation ============

/**
 * Compute schema hash using browser-compatible SHA-256.
 * Uses @manifesto-ai/core's sha256Sync for universal compatibility.
 */
function computeCanonicalHash(schema: Omit<CanonicalDomainSchema, "hash">): string {
  return hashSchemaSync(schema as unknown as Omit<DomainSchema, "hash">);
}

function computeHash(schema: Omit<DomainSchema, "hash">): string {
  return hashSchemaSync(schema);
}
