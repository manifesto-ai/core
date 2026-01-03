/**
 * IR Generator - Transforms MEL AST to Core DomainSchema
 * Based on MEL SPEC v0.3.3 Section 5
 */

import type { Diagnostic } from "../diagnostics/types.js";
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
  PatchStmtNode,
  EffectStmtNode,
  FailStmtNode,   // v0.3.2
  StopStmtNode,   // v0.3.2
  PathNode,
  TypeExprNode,
  ObjectTypeNode, // v0.3.3
  BinaryOperator,
} from "../parser/ast.js";
import { normalizeExpr, normalizeFunctionCall } from "./normalizer.js";
import { createHash } from "crypto";
import { toCanonical } from "@manifesto-ai/core";

// ============ Core IR Types (matching @manifesto-ai/core) ============

/**
 * Core ExprNode types (simplified, matching core/schema/expr.ts)
 */
export type CoreExprNode =
  | { kind: "lit"; value: unknown }
  | { kind: "get"; path: string }
  | { kind: "eq"; left: CoreExprNode; right: CoreExprNode }
  | { kind: "neq"; left: CoreExprNode; right: CoreExprNode }
  | { kind: "gt"; left: CoreExprNode; right: CoreExprNode }
  | { kind: "gte"; left: CoreExprNode; right: CoreExprNode }
  | { kind: "lt"; left: CoreExprNode; right: CoreExprNode }
  | { kind: "lte"; left: CoreExprNode; right: CoreExprNode }
  | { kind: "and"; args: CoreExprNode[] }
  | { kind: "or"; args: CoreExprNode[] }
  | { kind: "not"; arg: CoreExprNode }
  | { kind: "if"; cond: CoreExprNode; then: CoreExprNode; else: CoreExprNode }
  | { kind: "add"; left: CoreExprNode; right: CoreExprNode }
  | { kind: "sub"; left: CoreExprNode; right: CoreExprNode }
  | { kind: "mul"; left: CoreExprNode; right: CoreExprNode }
  | { kind: "div"; left: CoreExprNode; right: CoreExprNode }
  | { kind: "mod"; left: CoreExprNode; right: CoreExprNode }
  | { kind: "neg"; arg: CoreExprNode }
  | { kind: "abs"; arg: CoreExprNode }
  | { kind: "min"; args: CoreExprNode[] }
  | { kind: "max"; args: CoreExprNode[] }
  // v0.3.2: Array aggregation functions
  | { kind: "sumArray"; array: CoreExprNode }
  | { kind: "minArray"; array: CoreExprNode }
  | { kind: "maxArray"; array: CoreExprNode }
  | { kind: "floor"; arg: CoreExprNode }
  | { kind: "ceil"; arg: CoreExprNode }
  | { kind: "round"; arg: CoreExprNode }
  | { kind: "sqrt"; arg: CoreExprNode }
  | { kind: "pow"; base: CoreExprNode; exponent: CoreExprNode }
  | { kind: "concat"; args: CoreExprNode[] }
  | { kind: "trim"; str: CoreExprNode }
  | { kind: "toLowerCase"; str: CoreExprNode }
  | { kind: "toUpperCase"; str: CoreExprNode }
  | { kind: "strLen"; str: CoreExprNode }
  | { kind: "substring"; str: CoreExprNode; start: CoreExprNode; end?: CoreExprNode }
  | { kind: "len"; arg: CoreExprNode }
  | { kind: "at"; array: CoreExprNode; index: CoreExprNode }
  | { kind: "first"; array: CoreExprNode }
  | { kind: "last"; array: CoreExprNode }
  | { kind: "slice"; array: CoreExprNode; start: CoreExprNode; end?: CoreExprNode }
  | { kind: "includes"; array: CoreExprNode; item: CoreExprNode }
  | { kind: "filter"; array: CoreExprNode; predicate: CoreExprNode }
  | { kind: "map"; array: CoreExprNode; mapper: CoreExprNode }
  | { kind: "find"; array: CoreExprNode; predicate: CoreExprNode }
  | { kind: "every"; array: CoreExprNode; predicate: CoreExprNode }
  | { kind: "some"; array: CoreExprNode; predicate: CoreExprNode }
  | { kind: "append"; array: CoreExprNode; items: CoreExprNode[] }
  | { kind: "object"; fields: Record<string, CoreExprNode> }
  | { kind: "keys"; obj: CoreExprNode }
  | { kind: "values"; obj: CoreExprNode }
  | { kind: "entries"; obj: CoreExprNode }
  | { kind: "merge"; objects: CoreExprNode[] }
  | { kind: "typeof"; arg: CoreExprNode }
  | { kind: "isNull"; arg: CoreExprNode }
  | { kind: "coalesce"; args: CoreExprNode[] }
  | { kind: "toString"; arg: CoreExprNode };

/**
 * Core FlowNode types (matching core/schema/flow.ts)
 */
export type CoreFlowNode =
  | { kind: "seq"; steps: CoreFlowNode[] }
  | { kind: "if"; cond: CoreExprNode; then: CoreFlowNode; else?: CoreFlowNode }
  | { kind: "patch"; op: "set" | "unset" | "merge"; path: string; value?: CoreExprNode }
  | { kind: "effect"; type: string; params: Record<string, CoreExprNode> }
  | { kind: "call"; flow: string }
  | { kind: "halt"; reason?: string }
  | { kind: "fail"; code: string; message?: CoreExprNode };

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
}

/**
 * Computed field specification
 */
export interface ComputedFieldSpec {
  deps: string[];
  expr: CoreExprNode;
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
  available?: CoreExprNode;
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

// ============ Generation Context ============

/**
 * Context for IR generation
 */
interface GeneratorContext {
  domainName: string;
  stateFields: Set<string>;
  computedFields: Set<string>;
  actionParams: Map<string, Set<string>>; // action -> params
  currentAction: string | null;
  diagnostics: Diagnostic[];
}

function createContext(domainName: string): GeneratorContext {
  return {
    domainName,
    stateFields: new Set(),
    computedFields: new Set(),
    actionParams: new Map(),
    currentAction: null,
    diagnostics: [],
  };
}

// ============ Generator Result ============

export interface GenerateResult {
  schema: DomainSchema | null;
  diagnostics: Diagnostic[];
}

// ============ Main Generator ============

/**
 * Generate Core DomainSchema from MEL AST
 */
export function generate(program: ProgramNode): GenerateResult {
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
  const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
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
  const hash = computeHash(schemaWithoutHash);

  const schema: DomainSchema = {
    ...schemaWithoutHash,
    hash,
  };

  return {
    schema,
    diagnostics: ctx.diagnostics,
  };
}

// ============ Field Collection ============

function collectFieldNames(domain: DomainNode, ctx: GeneratorContext): void {
  for (const member of domain.members) {
    if (member.kind === "state") {
      for (const field of member.fields) {
        ctx.stateFields.add(field.name);
      }
    } else if (member.kind === "computed") {
      ctx.computedFields.add(member.name);
    }
  }
}

// ============ Type Generation (v0.3.3) ============

function generateTypes(domain: DomainNode, _ctx: GeneratorContext): Record<string, TypeSpec> {
  const types: Record<string, TypeSpec> = {};

  for (const typeDecl of domain.types) {
    types[typeDecl.name] = {
      name: typeDecl.name,
      definition: typeExprToDefinition(typeDecl.typeExpr),
    };
  }

  return types;
}

function typeExprToDefinition(typeExpr: TypeExprNode): TypeDefinition {
  switch (typeExpr.kind) {
    case "simpleType":
      // Primitive types vs type references
      if (["string", "number", "boolean", "null"].includes(typeExpr.name)) {
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

  for (const member of domain.members) {
    if (member.kind === "state") {
      for (const field of member.fields) {
        fields[field.name] = generateFieldSpec(field, ctx);
      }
    }
  }

  return { fields };
}

function generateFieldSpec(field: StateFieldNode, ctx: GeneratorContext): FieldSpec {
  const type = typeExprToFieldType(field.typeExpr, ctx);
  const defaultValue = field.initializer
    ? evaluateInitializer(field.initializer, ctx)
    : undefined;

  return {
    type,
    required: true,
    default: defaultValue,
  };
}

function typeExprToFieldType(typeExpr: TypeExprNode, ctx: GeneratorContext): FieldType {
  switch (typeExpr.kind) {
    case "simpleType":
      switch (typeExpr.name) {
        case "string": return "string";
        case "number": return "number";
        case "boolean": return "boolean";
        case "null": return "null";
        default:
          // User-defined type - treat as object
          return "object";
      }

    case "unionType": {
      // Check if it's a literal union (enum)
      const literals: unknown[] = [];
      let isLiteralUnion = true;

      for (const t of typeExpr.types) {
        if (t.kind === "literalType") {
          literals.push(t.value);
        } else if (t.kind === "simpleType" && t.name === "null") {
          literals.push(null);
        } else {
          isLiteralUnion = false;
          break;
        }
      }

      if (isLiteralUnion && literals.length > 0) {
        return { enum: literals };
      }

      // Mixed union - default to first non-null type
      for (const t of typeExpr.types) {
        if (t.kind !== "simpleType" || t.name !== "null") {
          return typeExprToFieldType(t, ctx);
        }
      }
      return "null";
    }

    case "arrayType":
      return "array";

    case "recordType":
      return "object";

    case "literalType":
      // Single literal type - use its base type
      if (typeof typeExpr.value === "string") return "string";
      if (typeof typeExpr.value === "number") return "number";
      if (typeof typeExpr.value === "boolean") return "boolean";
      return "null";

    case "objectType":
      // v0.3.3: Inline object type
      return "object";
  }
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
        obj[prop.key] = evaluateInitializer(prop.value, ctx);
      }
      return obj;
    }

    default:
      // Complex expressions can't be evaluated statically
      return undefined;
  }
}

// ============ Computed Generation ============

function generateComputed(domain: DomainNode, ctx: GeneratorContext): ComputedSpec {
  const fields: Record<string, ComputedFieldSpec> = {};

  for (const member of domain.members) {
    if (member.kind === "computed") {
      const expr = generateExpr(member.expression, ctx);
      const deps = extractDeps(expr);

      fields[`computed.${member.name}`] = {
        deps,
        expr,
      };
    }
  }

  return { fields };
}

function extractDeps(expr: CoreExprNode): string[] {
  const deps = new Set<string>();

  function visit(node: CoreExprNode): void {
    if (node.kind === "get") {
      deps.add(node.path);
    } else {
      // Visit all nested expressions
      for (const value of Object.values(node)) {
        if (typeof value === "object" && value !== null) {
          if (Array.isArray(value)) {
            for (const item of value) {
              if (typeof item === "object" && item !== null && "kind" in item) {
                visit(item as CoreExprNode);
              }
            }
          } else if ("kind" in value) {
            visit(value as CoreExprNode);
          }
        }
      }
    }
  }

  visit(expr);
  return Array.from(deps);
}

// ============ Action Generation ============

function generateActions(domain: DomainNode, ctx: GeneratorContext): Record<string, ActionSpec> {
  const actions: Record<string, ActionSpec> = {};

  for (const member of domain.members) {
    if (member.kind === "action") {
      ctx.currentAction = member.name;

      // Collect params
      const params = new Set<string>();
      for (const param of member.params) {
        params.add(param.name);
      }
      ctx.actionParams.set(member.name, params);

      const flow = generateFlow(member.body, ctx);

      // Generate input spec if there are params
      let input: FieldSpec | undefined;
      if (member.params.length > 0) {
        const inputFields: Record<string, FieldSpec> = {};
        for (const param of member.params) {
          inputFields[param.name] = {
            type: typeExprToFieldType(param.typeExpr, ctx),
            required: true,
          };
        }
        input = {
          type: "object",
          required: true,
          fields: inputFields,
        };
      }

      // v0.3.2: Generate available condition if present
      let available: CoreExprNode | undefined;
      if (member.available) {
        available = generateExpr(member.available, ctx);
      }

      actions[member.name] = {
        flow,
        input,
        available,
      };

      ctx.currentAction = null;
    }
  }

  return actions;
}

function generateFlow(stmts: (GuardedStmtNode | InnerStmtNode)[], ctx: GeneratorContext): CoreFlowNode {
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

function generateStmt(stmt: GuardedStmtNode | InnerStmtNode, ctx: GeneratorContext): CoreFlowNode {
  switch (stmt.kind) {
    case "when":
      return generateWhen(stmt, ctx);

    case "once":
      return generateOnce(stmt, ctx);

    case "patch":
      return generatePatch(stmt, ctx);

    case "effect":
      return generateEffect(stmt, ctx);

    case "fail":
      return generateFail(stmt, ctx);

    case "stop":
      return generateStop(stmt, ctx);
  }
}

function generateWhen(stmt: WhenStmtNode, ctx: GeneratorContext): CoreFlowNode {
  const cond = generateExpr(stmt.condition, ctx);
  const thenFlow = generateFlow(stmt.body, ctx);

  return {
    kind: "if",
    cond,
    then: thenFlow,
  };
}

function generateOnce(stmt: OnceStmtNode, ctx: GeneratorContext): CoreFlowNode {
  // Desugar once(marker) { ... } to:
  // when neq(marker, $meta.intentId) { patch marker = $meta.intentId; ... }
  // Note: Core accesses $meta intent values via meta.*

  const markerPath = generatePath(stmt.marker, ctx);
  const intentIdExpr: CoreExprNode = { kind: "get", path: "meta.intentId" };

  // Condition: marker != $meta.intentId
  let cond: CoreExprNode = {
    kind: "neq",
    left: { kind: "get", path: markerPath },
    right: intentIdExpr,
  };

  // Add extra condition if present
  if (stmt.condition) {
    const extraCond = generateExpr(stmt.condition, ctx);
    cond = {
      kind: "and",
      args: [cond, extraCond],
    };
  }

  // Body: patch marker = $meta.intentId, then rest
  const markerPatch: CoreFlowNode = {
    kind: "patch",
    op: "set",
    path: markerPath,
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

function generatePatch(stmt: PatchStmtNode, ctx: GeneratorContext): CoreFlowNode {
  const path = generatePath(stmt.path, ctx);

  const result: CoreFlowNode = {
    kind: "patch",
    op: stmt.op,
    path,
  };

  if (stmt.value) {
    (result as { kind: "patch"; op: "set" | "unset" | "merge"; path: string; value?: CoreExprNode }).value = generateExpr(stmt.value, ctx);
  }

  return result;
}

function generateEffect(stmt: EffectStmtNode, ctx: GeneratorContext): CoreFlowNode {
  const params: Record<string, CoreExprNode> = {};

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
 * v0.3.2: Generate fail statement
 * fail "CODE" with expr → { kind: "fail", code, message? }
 */
function generateFail(stmt: FailStmtNode, ctx: GeneratorContext): CoreFlowNode {
  const result: CoreFlowNode = {
    kind: "fail",
    code: stmt.code,
  };

  if (stmt.message) {
    (result as { kind: "fail"; code: string; message?: CoreExprNode }).message = generateExpr(stmt.message, ctx);
  }

  return result;
}

/**
 * v0.3.2: Generate stop statement
 * stop "reason" → { kind: "halt", reason }
 */
function generateStop(stmt: StopStmtNode, ctx: GeneratorContext): CoreFlowNode {
  return {
    kind: "halt",
    reason: stmt.reason,
  };
}

// ============ Path Generation ============

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
    return segments.join(".");
  }
  if (ctx.computedFields.has(first)) {
    return `computed.${segments.join(".")}`;
  }
  if (ctx.currentAction && ctx.actionParams.get(ctx.currentAction)?.has(first)) {
    return `input.${segments.join(".")}`;
  }

  // Default to plain path (state-like)
  return segments.join(".");
}

// ============ Expression Generation ============

function generateExpr(expr: ExprNode, ctx: GeneratorContext): CoreExprNode {
  switch (expr.kind) {
    case "literal":
      return { kind: "lit", value: expr.value };

    case "identifier":
      return generateIdentifier(expr.name, ctx);

    case "systemIdent":
      return generateSystemIdent(expr.path, ctx);

    case "iterationVar":
      // v0.3.2: $item only (reduce pattern deprecated, $acc removed)
      // $item is used in filter/map expressions
      return { kind: "get", path: `$${expr.name}` };

    case "propertyAccess":
      return generatePropertyAccess(expr, ctx);

    case "indexAccess":
      return {
        kind: "at",
        array: generateExpr(expr.object, ctx),
        index: generateExpr(expr.index, ctx),
      };

    case "functionCall":
      return normalizeFunctionCall(
        expr.name,
        expr.args.map(a => generateExpr(a, ctx))
      );

    case "binary":
      return normalizeExpr(
        expr.operator,
        generateExpr(expr.left, ctx),
        generateExpr(expr.right, ctx)
      );

    case "unary":
      if (expr.operator === "!") {
        return { kind: "not", arg: generateExpr(expr.operand, ctx) };
      } else {
        return { kind: "neg", arg: generateExpr(expr.operand, ctx) };
      }

    case "ternary":
      return {
        kind: "if",
        cond: generateExpr(expr.condition, ctx),
        then: generateExpr(expr.consequent, ctx),
        else: generateExpr(expr.alternate, ctx),
      };

    case "objectLiteral": {
      const fields: Record<string, CoreExprNode> = {};
      for (const prop of expr.properties) {
        fields[prop.key] = generateExpr(prop.value, ctx);
      }
      return { kind: "object", fields };
    }

    case "arrayLiteral":
      // For array literals, we build using append
      if (expr.elements.length === 0) {
        return { kind: "lit", value: [] };
      }
      // Check if all elements are literals
      const allLiterals = expr.elements.every(e => e.kind === "literal");
      if (allLiterals) {
        return { kind: "lit", value: expr.elements.map(e => (e as { kind: "literal"; value: unknown }).value) };
      }
      // Otherwise use append
      return {
        kind: "append",
        array: { kind: "lit", value: [] },
        items: expr.elements.map(e => generateExpr(e, ctx)),
      };
  }
}

function generateIdentifier(name: string, ctx: GeneratorContext): CoreExprNode {
  // Resolve identifier to path
  if (ctx.stateFields.has(name)) {
    // Core expects state paths without prefix (e.g., "count" not "data.count")
    return { kind: "get", path: name };
  }
  if (ctx.computedFields.has(name)) {
    return { kind: "get", path: `computed.${name}` };
  }
  if (ctx.currentAction && ctx.actionParams.get(ctx.currentAction)?.has(name)) {
    return { kind: "get", path: `input.${name}` };
  }

  // Unknown identifier - report error and default to plain path
  ctx.diagnostics.push({
    severity: "error",
    code: "E_UNKNOWN_IDENT",
    message: `Unknown identifier '${name}'`,
    location: { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
  });

  return { kind: "get", path: name };
}

function generateSystemIdent(path: string[], ctx: GeneratorContext): CoreExprNode {
  // $system.uuid -> will be lowered later
  // $meta.intentId -> meta.intentId
  // $input.* -> input.*

  const [namespace, ...rest] = path;

  switch (namespace) {
    case "system":
      // $system values are placeholders - will be lowered in the lowering pass
      return { kind: "get", path: `$system.${rest.join(".")}` };

    case "meta":
      return { kind: "get", path: `meta.${rest.join(".")}` };

    case "input":
      return { kind: "get", path: `input.${rest.join(".")}` };

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

function generatePropertyAccess(expr: { kind: "propertyAccess"; object: ExprNode; property: string }, ctx: GeneratorContext): CoreExprNode {
  // Handle chained property access
  const objectExpr = generateExpr(expr.object, ctx);

  // If the object is a get expression, we can extend the path
  if (objectExpr.kind === "get") {
    return { kind: "get", path: `${objectExpr.path}.${expr.property}` };
  }

  // For other expressions, we need to use at with a string index
  // This is a simplification - in reality, we'd need a proper property access expression
  return {
    kind: "at",
    array: objectExpr,
    index: { kind: "lit", value: expr.property },
  };
}

// ============ Hash Computation ============

function computeHash(schema: Omit<DomainSchema, "hash">): string {
  const canonical = toCanonical(schema);
  return createHash("sha256").update(canonical).digest("hex");
}
