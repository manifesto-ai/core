/**
 * Semantic Validator for MEL
 * Validates semantic rules beyond syntax
 * Based on MEL SPEC v0.3.3 and FDR-MEL-*
 */

import type {
  ProgramNode,
  DomainNode,
  ActionNode,
  StateNode,
  StateFieldNode,
  ExprNode,
  GuardedStmtNode,
  InnerStmtNode,
  WhenStmtNode,
  OnceStmtNode,
  OnceIntentStmtNode,
  PatchStmtNode,
  EffectStmtNode,
  FailStmtNode,
  StopStmtNode,
  TypeExprNode,
  PathNode,
} from "../parser/ast.js";
import type { Diagnostic } from "../diagnostics/types.js";
import { createWarning } from "../diagnostics/types.js";
import type { SourceLocation } from "../lexer/source-location.js";
import { validateEntityPrimitives } from "./entity-primitives.js";
import {
  classifySpreadOperandType,
  collectDomainTypeSymbols,
  createActionTypeEnv,
  getArrayElementType,
  getIndexType,
  getPropertyType,
  inferExprType,
  mayYieldArrayExpr,
  isNullType,
  resolveType,
  type DomainTypeSymbols,
  type TypeEnv,
} from "./expr-type-surface.js";

// ============ Validation Context ============

interface ValidationContext {
  inAction: boolean;
  inGuard: boolean;
  guardDepth: number;
  hasMarkerPatch: boolean; // For once() validation
  currentActionParamTypes: Map<string, TypeExprNode>;
  diagnostics: Diagnostic[];
}

function createContext(): ValidationContext {
  return {
    inAction: false,
    inGuard: false,
    guardDepth: 0,
    hasMarkerPatch: false,
    currentActionParamTypes: new Map(),
    diagnostics: [],
  };
}

const STOP_WAITING_REASON_PATTERN = /\b(await(?:ing)?|wait(?:ing)?|pending)\b/i;

type PrimitiveKind = "null" | "boolean" | "number" | "string";

function simpleTypeNode(name: PrimitiveKind, location: SourceLocation): TypeExprNode {
  return {
    kind: "simpleType",
    name,
    location,
  };
}

function isAssignableType(
  sourceType: TypeExprNode,
  targetType: TypeExprNode,
  symbols: DomainTypeSymbols
): boolean | null {
  const resolvedSource = resolveType(sourceType, symbols);
  const resolvedTarget = resolveType(targetType, symbols);
  if (!resolvedSource || !resolvedTarget) {
    return null;
  }

  if (resolvedTarget.kind === "unionType") {
    const sourceMembers = resolvedSource.kind === "unionType"
      ? resolvedSource.types
      : [resolvedSource];
    let sawUnknown = false;

    for (const member of sourceMembers) {
      const outcomes = resolvedTarget.types.map((candidate) =>
        isAssignableType(member, candidate, symbols)
      );
      if (outcomes.includes(true)) {
        continue;
      }
      if (outcomes.every((outcome) => outcome === false)) {
        return false;
      }
      sawUnknown = true;
    }

    return sawUnknown ? null : true;
  }

  if (resolvedSource.kind === "unionType") {
    let sawUnknown = false;
    for (const member of resolvedSource.types) {
      const outcome = isAssignableType(member, resolvedTarget, symbols);
      if (outcome === false) {
        return false;
      }
      if (outcome === null) {
        sawUnknown = true;
      }
    }
    return sawUnknown ? null : true;
  }

  if (resolvedTarget.kind === "simpleType") {
    if (resolvedSource.kind === "simpleType") {
      return resolvedSource.name === resolvedTarget.name;
    }
    if (resolvedSource.kind === "literalType") {
      if (resolvedTarget.name === "null") {
        return resolvedSource.value === null;
      }
      return typeof resolvedSource.value === resolvedTarget.name;
    }
  }

  if (resolvedTarget.kind === "literalType") {
    if (resolvedSource.kind !== "literalType") {
      return false;
    }
    return resolvedSource.value === resolvedTarget.value;
  }

  if (resolvedTarget.kind === "arrayType") {
    if (resolvedSource.kind !== "arrayType") {
      return false;
    }
    return isAssignableType(resolvedSource.elementType, resolvedTarget.elementType, symbols);
  }

  if (resolvedTarget.kind === "objectType") {
    if (resolvedSource.kind !== "objectType") {
      return false;
    }

    for (const targetField of resolvedTarget.fields) {
      const sourceField = resolvedSource.fields.find((candidate) => candidate.name === targetField.name);
      if (!sourceField) {
        if (targetField.optional) {
          continue;
        }
        return false;
      }
      if (sourceField.optional && !targetField.optional) {
        return false;
      }
      const fieldAssignable = isAssignableType(sourceField.typeExpr, targetField.typeExpr, symbols);
      if (fieldAssignable !== true) {
        return fieldAssignable;
      }
    }

    return true;
  }

  if (resolvedTarget.kind === "recordType") {
    if (resolvedSource.kind !== "recordType") {
      return null;
    }
    return isAssignableType(resolvedSource.valueType, resolvedTarget.valueType, symbols);
  }

  return null;
}

function describeTypeExpr(typeExpr: TypeExprNode | null, symbols: DomainTypeSymbols): string {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return "unknown";
  }

  switch (resolved.kind) {
    case "simpleType":
      return resolved.name;
    case "literalType":
      return JSON.stringify(resolved.value);
    case "arrayType":
      return `Array<${describeTypeExpr(resolved.elementType, symbols)}>`;
    case "recordType":
      return `Record<${describeTypeExpr(resolved.keyType, symbols)}, ${describeTypeExpr(resolved.valueType, symbols)}>`;
    case "objectType":
      return `{ ${resolved.fields.map((field) => `${field.name}${field.optional ? "?" : ""}: ${describeTypeExpr(field.typeExpr, symbols)}`).join("; ")} }`;
    case "unionType":
      return resolved.types.map((member) => describeTypeExpr(member, symbols)).join(" | ");
  }
}

function collectPrimitiveKinds(
  typeExpr: TypeExprNode | null,
  symbols: DomainTypeSymbols
): Set<PrimitiveKind> | "nonprimitive" | null {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return null;
  }

  switch (resolved.kind) {
    case "simpleType":
      if (
        resolved.name === "string" ||
        resolved.name === "number" ||
        resolved.name === "boolean" ||
        resolved.name === "null"
      ) {
        return new Set([resolved.name]);
      }
      return resolved.name === "object" ? "nonprimitive" : null;

    case "literalType":
      return new Set([
        resolved.value === null ? "null" : (typeof resolved.value as Exclude<PrimitiveKind, "null">),
      ]);

    case "arrayType":
    case "recordType":
    case "objectType":
      return "nonprimitive";

    case "unionType": {
      const kinds = new Set<PrimitiveKind>();
      for (const member of resolved.types) {
        const memberKinds = collectPrimitiveKinds(member, symbols);
        if (memberKinds === null) {
          return null;
        }
        if (memberKinds === "nonprimitive") {
          return "nonprimitive";
        }
        for (const kind of memberKinds) {
          kinds.add(kind);
        }
      }
      return kinds;
    }
  }
}

function getSingleNonNullPrimitiveKind(
  typeExpr: TypeExprNode | null,
  symbols: DomainTypeSymbols
): Exclude<PrimitiveKind, "null"> | "invalid" | null {
  const kinds = collectPrimitiveKinds(typeExpr, symbols);
  if (kinds === null) {
    return null;
  }
  if (kinds === "nonprimitive") {
    return "invalid";
  }

  const nonNullKinds = [...kinds].filter((kind): kind is Exclude<PrimitiveKind, "null"> => kind !== "null");
  if (nonNullKinds.length !== 1 || kinds.has("null")) {
    return "invalid";
  }
  return nonNullKinds[0]!;
}

function areComparableTypesCompatible(
  leftType: TypeExprNode | null,
  rightType: TypeExprNode | null,
  symbols: DomainTypeSymbols
): boolean | null {
  const leftKinds = collectPrimitiveKinds(leftType, symbols);
  const rightKinds = collectPrimitiveKinds(rightType, symbols);

  if (leftKinds === null || rightKinds === null) {
    return null;
  }
  if (leftKinds === "nonprimitive" || rightKinds === "nonprimitive") {
    return false;
  }
  if (!(leftKinds instanceof Set) || !(rightKinds instanceof Set)) {
    return null;
  }

  const leftNonNull = [...leftKinds].filter((kind) => kind !== "null");
  const rightNonNull = [...rightKinds].filter((kind) => kind !== "null");
  if (leftNonNull.length === 0 || rightNonNull.length === 0) {
    return true;
  }

  return leftNonNull.some((kind) => rightNonNull.includes(kind));
}

function stripNullType(typeExpr: TypeExprNode | null, symbols: DomainTypeSymbols): TypeExprNode | null {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved || isNullType(resolved)) {
    return null;
  }

  if (resolved.kind !== "unionType") {
    return resolved;
  }

  const members = resolved.types
    .map((member) => stripNullType(member, symbols))
    .filter((member): member is TypeExprNode => member !== null);
  if (members.length === 0) {
    return null;
  }
  const deduped: TypeExprNode[] = [];
  const seen = new Set<string>();
  for (const member of members) {
    const key = JSON.stringify(member);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(member);
  }
  if (deduped.length === 1) {
    return deduped[0];
  }

  return {
    kind: "unionType",
    types: deduped,
    location: resolved.location,
  };
}

function areTypesCompatible(
  leftType: TypeExprNode | null,
  rightType: TypeExprNode | null,
  symbols: DomainTypeSymbols
): boolean | null {
  if (!leftType || !rightType) {
    return null;
  }

  const leftToRight = isAssignableType(leftType, rightType, symbols);
  if (leftToRight === true) {
    return true;
  }

  const rightToLeft = isAssignableType(rightType, leftType, symbols);
  if (rightToLeft === true) {
    return true;
  }

  const comparable = areComparableTypesCompatible(leftType, rightType, symbols);
  if (comparable !== null) {
    return comparable;
  }

  if (leftToRight === false && rightToLeft === false) {
    return false;
  }

  return null;
}

function isMergeAssignableType(
  sourceType: TypeExprNode,
  targetType: TypeExprNode,
  symbols: DomainTypeSymbols
): boolean | null {
  const resolvedSource = resolveType(sourceType, symbols);
  const resolvedTarget = resolveType(targetType, symbols);
  if (!resolvedSource || !resolvedTarget) {
    return null;
  }

  if (resolvedTarget.kind === "unionType") {
    let sawUnknown = false;
    for (const member of resolvedTarget.types) {
      if (isNullType(member)) {
        continue;
      }
      const outcome = isMergeAssignableType(resolvedSource, member, symbols);
      if (outcome === true) {
        return true;
      }
      if (outcome === null) {
        sawUnknown = true;
      }
    }
    return sawUnknown ? null : false;
  }

  if (resolvedSource.kind === "unionType") {
    let sawUnknown = false;
    for (const member of resolvedSource.types) {
      const outcome = isMergeAssignableType(member, resolvedTarget, symbols);
      if (outcome === false) {
        return false;
      }
      if (outcome === null) {
        sawUnknown = true;
      }
    }
    return sawUnknown ? null : true;
  }

  if (resolvedTarget.kind !== "objectType") {
    return false;
  }

  if (resolvedSource.kind !== "objectType") {
    return false;
  }

  for (const sourceField of resolvedSource.fields) {
    const targetField = resolvedTarget.fields.find((candidate) => candidate.name === sourceField.name);
    if (!targetField) {
      return false;
    }

    const fieldAssignable = isAssignableType(sourceField.typeExpr, targetField.typeExpr, symbols);
    if (fieldAssignable !== true) {
      return fieldAssignable;
    }
  }

  return true;
}

function classifyArrayOperand(
  typeExpr: TypeExprNode | null,
  symbols: DomainTypeSymbols
): boolean | null {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return null;
  }

  if (resolved.kind === "unionType") {
    const outcomes = resolved.types.map((member) => classifyArrayOperand(member, symbols));
    if (outcomes.every((outcome) => outcome === true)) {
      return true;
    }
    return outcomes.some((outcome) => outcome === false) ? false : null;
  }

  return resolved.kind === "arrayType";
}

function classifyLenOperand(
  typeExpr: TypeExprNode | null,
  symbols: DomainTypeSymbols
): boolean | null {
  const resolved = resolveType(typeExpr, symbols);
  if (!resolved) {
    return null;
  }

  if (resolved.kind === "unionType") {
    const outcomes = resolved.types.map((member) => classifyLenOperand(member, symbols));
    if (outcomes.every((outcome) => outcome === true)) {
      return true;
    }
    return outcomes.some((outcome) => outcome === false) ? false : null;
  }

  if (resolved.kind === "arrayType" || resolved.kind === "recordType" || resolved.kind === "objectType") {
    return true;
  }

  if (resolved.kind === "literalType") {
    return typeof resolved.value === "string";
  }

  if (resolved.kind === "simpleType") {
    return resolved.name === "string" || resolved.name === "object";
  }

  return false;
}

function extendCollectionTypeEnv(baseEnv: TypeEnv, itemType: TypeExprNode): TypeEnv {
  const next = new Map(baseEnv);
  next.set("$item", itemType);
  return next;
}

function getLiteralPrimitiveValue(expr: ExprNode): string | number | boolean | null | undefined {
  const numericLiteral = getStaticNumericLiteralValue(expr);
  if (typeof numericLiteral === "number") {
    return numericLiteral;
  }
  if (expr.kind !== "literal") {
    return undefined;
  }
  return expr.literalType === "null"
    ? null
    : typeof expr.value === "string" || typeof expr.value === "number" || typeof expr.value === "boolean"
    ? expr.value
    : undefined;
}

function getStaticNumericLiteralValue(expr: ExprNode): number | undefined {
  if (expr.kind === "literal" && expr.literalType === "number" && typeof expr.value === "number") {
    return expr.value;
  }
  if (expr.kind === "unary" && expr.operator === "-") {
    const operand = getStaticNumericLiteralValue(expr.operand);
    return typeof operand === "number" ? -operand : undefined;
  }
  return undefined;
}

function resolvePathType(path: PathNode, symbols: DomainTypeSymbols): TypeExprNode | null {
  const [first, ...rest] = path.segments;
  if (!first || first.kind !== "propertySegment") {
    return null;
  }

  let current = symbols.stateTypes.get(first.name) ?? null;
  for (const segment of rest) {
    if (!current) {
      return null;
    }
    current = segment.kind === "propertySegment"
      ? getPropertyType(current, segment.name, symbols)
      : getIndexType(current, symbols);
  }

  return current;
}

function renderPath(path: PathNode): string {
  let result = "";

  for (const [index, segment] of path.segments.entries()) {
    if (segment.kind === "propertySegment") {
      result += index === 0 ? segment.name : `.${segment.name}`;
      continue;
    }

    if (segment.index.kind === "literal") {
      result += `[${JSON.stringify(segment.index.value)}]`;
    } else {
      result += "[*]";
    }
  }

  return result;
}

// ============ Semantic Validator ============

/**
 * Result of semantic validation
 */
export interface ValidationResult {
  valid: boolean;
  diagnostics: Diagnostic[];
}

/**
 * Semantic Validator
 */
export class SemanticValidator {
  private ctx: ValidationContext = createContext();
  private symbols: DomainTypeSymbols | null = null;

  /**
   * Validate a MEL program
   */
  validate(program: ProgramNode): ValidationResult {
    this.ctx = createContext();
    this.symbols = collectDomainTypeSymbols(program.domain);
    this.validateDomain(program.domain);
    this.symbols = null;

    return {
      valid: !this.ctx.diagnostics.some(d => d.severity === "error"),
      diagnostics: this.ctx.diagnostics,
    };
  }

  private validateDomain(domain: DomainNode): void {
    // Validate domain name
    if (domain.name.startsWith("__")) {
      this.error(
        "Domain name cannot start with '__' (reserved prefix)",
        domain.location,
        "E_RESERVED_NAME"
      );
    }

    // Validate members
    for (const member of domain.members) {
      switch (member.kind) {
        case "state":
          this.validateState(member);
          break;
        case "computed":
          this.validateExpr(member.expression, "computed");
          break;
        case "action":
          this.validateAction(member);
          break;
        case "flow":
          break;
      }
    }
  }

  /**
   * v0.3.3: Validate state fields for W012 (anonymous object types)
   */
  private validateState(state: StateNode): void {
    const seen = new Map<string, SourceLocation>();
    for (const field of state.fields) {
      const prev = seen.get(field.name);
      if (prev) {
        this.error(
          `Duplicate state field '${field.name}'. First declared at line ${prev.start.line}`,
          field.location,
          "E_DUPLICATE_FIELD"
        );
      } else {
        seen.set(field.name, field.location);
      }
      this.validateStateField(field);
    }
  }

  /**
   * v0.3.3: Validate state field - check for anonymous object types (W012)
   */
  private validateStateField(field: StateFieldNode): void {
    this.checkAnonymousObjectType(field.typeExpr, field.location);
    if (field.initializer) {
      this.validateStateInitializer(field.initializer);
    }
  }

  private validateStateInitializer(expr: ExprNode): void {
    switch (expr.kind) {
      case "literal":
        return;

      case "identifier":
      case "iterationVar":
        this.error(
          "State initializers must be compile-time constants",
          expr.location,
          "E042"
        );
        return;

      case "systemIdent":
        if (expr.path[0] === "system") {
          this.error(
            "$system.* cannot be used in state initializers",
            expr.location,
            "E002"
          );
        } else {
          this.error(
            "State initializers must be compile-time constants",
            expr.location,
            "E042"
          );
        }
        return;

      case "objectLiteral":
        for (const prop of expr.properties) {
          if (prop.kind === "objectProperty") {
            this.validateStateInitializer(prop.value);
            continue;
          }

          const before = this.ctx.diagnostics.length;
          this.validateStateInitializer(prop.expr);
          if (before === this.ctx.diagnostics.length) {
            this.requireSpreadOperand(this.inferType(prop.expr, new Map()), prop.location, prop.expr);
          }
        }
        return;

      case "arrayLiteral":
        for (const elem of expr.elements) {
          this.validateStateInitializer(elem);
        }
        return;

      case "functionCall": {
        const before = this.ctx.diagnostics.length;
        for (const arg of expr.args) {
          this.validateStateInitializer(arg);
        }
        if (this.ctx.diagnostics.length === before) {
          this.error(
            "State initializers must be compile-time constants",
            expr.location,
            "E042"
          );
        }
        return;
      }

      case "binary": {
        const before = this.ctx.diagnostics.length;
        this.validateStateInitializer(expr.left);
        this.validateStateInitializer(expr.right);
        if (this.ctx.diagnostics.length === before) {
          this.error(
            "State initializers must be compile-time constants",
            expr.location,
            "E042"
          );
        }
        return;
      }

      case "unary": {
        const before = this.ctx.diagnostics.length;
        this.validateStateInitializer(expr.operand);
        if (this.ctx.diagnostics.length === before) {
          this.error(
            "State initializers must be compile-time constants",
            expr.location,
            "E042"
          );
        }
        return;
      }

      case "ternary": {
        const before = this.ctx.diagnostics.length;
        this.validateStateInitializer(expr.condition);
        this.validateStateInitializer(expr.consequent);
        this.validateStateInitializer(expr.alternate);
        if (this.ctx.diagnostics.length === before) {
          this.error(
            "State initializers must be compile-time constants",
            expr.location,
            "E042"
          );
        }
        return;
      }

      case "propertyAccess": {
        const before = this.ctx.diagnostics.length;
        this.validateStateInitializer(expr.object);
        if (this.ctx.diagnostics.length === before) {
          this.error(
            "State initializers must be compile-time constants",
            expr.location,
            "E042"
          );
        }
        return;
      }

      case "indexAccess": {
        const before = this.ctx.diagnostics.length;
        this.validateStateInitializer(expr.object);
        this.validateStateInitializer(expr.index);
        if (this.ctx.diagnostics.length === before) {
          this.error(
            "State initializers must be compile-time constants",
            expr.location,
            "E042"
          );
        }
        return;
      }
    }
  }

  /**
   * v0.3.3: Check if a type expression contains anonymous object types
   * Issues W012 warning for inline object types in state fields
   */
  private checkAnonymousObjectType(typeExpr: TypeExprNode, fieldLocation: SourceLocation): void {
    switch (typeExpr.kind) {
      case "objectType":
        // W012: Anonymous object type in state field
        this.ctx.diagnostics.push(
          createWarning(
            "W012",
            "Anonymous object type in state field. Use a named type declaration instead: type MyType = { ... }",
            typeExpr.location,
            {
              suggestion: "Define this type using 'type TypeName = { ... }' and reference it by name",
            }
          )
        );
        // Also check nested types
        for (const f of typeExpr.fields) {
          this.checkAnonymousObjectType(f.typeExpr, fieldLocation);
        }
        break;

      case "arrayType":
        this.checkAnonymousObjectType(typeExpr.elementType, fieldLocation);
        break;

      case "recordType":
        this.checkAnonymousObjectType(typeExpr.keyType, fieldLocation);
        this.checkAnonymousObjectType(typeExpr.valueType, fieldLocation);
        break;

      case "unionType":
        for (const t of typeExpr.types) {
          this.checkAnonymousObjectType(t, fieldLocation);
        }
        break;

      // simpleType and literalType are OK
    }
  }

  private validateAction(action: ActionNode): void {
    this.ctx.inAction = true;
    this.ctx.currentActionParamTypes = createActionTypeEnv(action.params);

    // v0.3.3: E005 - available expression must be pure
    if (action.available) {
      this.validateAvailableExpr(action.available);
    }
    if (action.dispatchable) {
      this.validateDispatchableExpr(action.dispatchable);
    }

    // FDR-MEL-020: All patch/effect must be inside guards.
    // fail/stop are parsed permissively at top-level and narrowed here.
    for (const stmt of action.body) {
      this.validateGuardedStmt(stmt);
    }

    this.ctx.inAction = false;
    this.ctx.currentActionParamTypes = new Map();
  }

  /**
   * v0.3.3: Validate available expression is pure (E005)
   * No $system.*, no effects, no $input.*
   */
  private validateAvailableExpr(expr: ExprNode): void {
    switch (expr.kind) {
      case "identifier":
        if (this.ctx.currentActionParamTypes.has(expr.name)) {
          this.error(
            "Action parameters cannot be used in available condition",
            expr.location,
            "E005"
          );
        }
        break;

      case "systemIdent":
        // E005: $system.* not allowed in available
        if (expr.path[0] === "system") {
          this.error(
            "$system.* cannot be used in available condition (must be pure expression)",
            expr.location,
            "E005"
          );
        }
        // E005: $input.* not allowed in available (no input at availability check)
        if (expr.path[0] === "input") {
          this.error(
            "$input.* cannot be used in available condition (parameters not available at availability check)",
            expr.location,
            "E005"
          );
        }
        if (expr.path[0] === "meta") {
          this.error(
            "$meta.* cannot be used in available condition (availability is schema-context only)",
            expr.location,
            "E005"
          );
        }
        break;

      case "functionCall":
        // Check for effect-like function calls (this is a basic check)
        // In practice, effects are in statements, not expressions
        // Recursively validate arguments
        for (const arg of expr.args) {
          this.validateAvailableExpr(arg);
        }
        break;

      case "binary":
        this.validateAvailableExpr(expr.left);
        this.validateAvailableExpr(expr.right);
        break;

      case "unary":
        this.validateAvailableExpr(expr.operand);
        break;

      case "ternary":
        this.validateAvailableExpr(expr.condition);
        this.validateAvailableExpr(expr.consequent);
        this.validateAvailableExpr(expr.alternate);
        break;

      case "propertyAccess":
        this.validateAvailableExpr(expr.object);
        break;

      case "indexAccess":
        this.validateAvailableExpr(expr.object);
        this.validateAvailableExpr(expr.index);
        break;

      case "objectLiteral":
        for (const prop of expr.properties) {
          this.validateAvailableExpr(prop.kind === "objectProperty" ? prop.value : prop.expr);
        }
        break;

      case "arrayLiteral":
        for (const elem of expr.elements) {
          this.validateAvailableExpr(elem);
        }
        break;

      // literal, identifier, iterationVar are OK
    }
  }

  /**
   * v0.9.0: Validate dispatchable expression is pure (E047)
   * Allows state/computed/action params, but forbids direct $input.*, $meta.*, and $system.*.
   */
  private validateDispatchableExpr(expr: ExprNode): void {
    switch (expr.kind) {
      case "systemIdent":
        if (expr.path[0] === "system") {
          this.error(
            "$system.* cannot be used in dispatchable condition (must be pure expression)",
            expr.location,
            "E047"
          );
        }
        if (expr.path[0] === "input") {
          this.error(
            "$input.* cannot be used in dispatchable condition (use bare action parameter names)",
            expr.location,
            "E047"
          );
        }
        if (expr.path[0] === "meta") {
          this.error(
            "$meta.* cannot be used in dispatchable condition (dispatchability is snapshot + bound-input only)",
            expr.location,
            "E047"
          );
        }
        break;

      case "functionCall":
        for (const arg of expr.args) {
          this.validateDispatchableExpr(arg);
        }
        break;

      case "binary":
        this.validateDispatchableExpr(expr.left);
        this.validateDispatchableExpr(expr.right);
        break;

      case "unary":
        this.validateDispatchableExpr(expr.operand);
        break;

      case "ternary":
        this.validateDispatchableExpr(expr.condition);
        this.validateDispatchableExpr(expr.consequent);
        this.validateDispatchableExpr(expr.alternate);
        break;

      case "propertyAccess":
        this.validateDispatchableExpr(expr.object);
        break;

      case "indexAccess":
        this.validateDispatchableExpr(expr.object);
        this.validateDispatchableExpr(expr.index);
        break;

      case "objectLiteral":
        for (const prop of expr.properties) {
          this.validateDispatchableExpr(prop.kind === "objectProperty" ? prop.value : prop.expr);
        }
        break;

      case "arrayLiteral":
        for (const elem of expr.elements) {
          this.validateDispatchableExpr(elem);
        }
        break;

      // literal, identifier, iterationVar are OK
    }
  }

  private validateGuardedStmt(stmt: GuardedStmtNode | InnerStmtNode): void {
    switch (stmt.kind) {
      case "when":
        this.validateWhen(stmt);
        break;
      case "once":
        this.validateOnce(stmt);
        break;
      case "onceIntent":
        this.validateOnceIntent(stmt);
        break;
      case "patch":
        this.validatePatch(stmt);
        break;
      case "effect":
        this.validateEffect(stmt);
        break;
      case "include":
        break;
      case "fail":
        this.validateFail(stmt);
        break;
      case "stop":
        this.validateStop(stmt);
        break;
    }
  }

  private validateWhen(stmt: WhenStmtNode): void {
    this.ctx.inGuard = true;
    this.ctx.guardDepth++;

    // FDR-MEL-025: Condition must be boolean
    this.validateCondition(stmt.condition, "when");

    for (const inner of stmt.body) {
      this.validateGuardedStmt(inner);
    }

    this.ctx.guardDepth--;
    if (this.ctx.guardDepth === 0) {
      this.ctx.inGuard = false;
    }
  }

  private validateOnce(stmt: OnceStmtNode): void {
    this.ctx.inGuard = true;
    this.ctx.guardDepth++;
    this.ctx.hasMarkerPatch = false;

    // Validate extra condition if present
    if (stmt.condition) {
      this.validateCondition(stmt.condition, "once");
    }

    // FDR-MEL-044: First statement should be marker patch
    // The compiler auto-inserts this, but we can warn if user adds it manually
    for (const inner of stmt.body) {
      this.validateGuardedStmt(inner);
    }

    this.ctx.guardDepth--;
    if (this.ctx.guardDepth === 0) {
      this.ctx.inGuard = false;
    }
  }

  private validateOnceIntent(stmt: OnceIntentStmtNode): void {
    this.ctx.inGuard = true;
    this.ctx.guardDepth++;

    if (stmt.condition) {
      this.validateCondition(stmt.condition, "onceIntent");
    }

    for (const inner of stmt.body) {
      this.validateGuardedStmt(inner);
    }

    this.ctx.guardDepth--;
    if (this.ctx.guardDepth === 0) {
      this.ctx.inGuard = false;
    }
  }

  private validatePatch(stmt: PatchStmtNode): void {
    // Patch must be inside a guard
    if (!this.ctx.inGuard) {
      this.error(
        "Patch must be inside a guard (when, once, or onceIntent)",
        stmt.location,
        "E_UNGUARDED_PATCH"
      );
    }

    // Validate value expression
    if (stmt.value) {
      const before = this.ctx.diagnostics.length;
      const valueType = this.validateExpr(stmt.value, "action");
      if (!this.symbols || before !== this.ctx.diagnostics.length) {
        return;
      }

      const targetType = resolvePathType(stmt.path, this.symbols);
      if (!targetType || !valueType) {
        return;
      }

      const assignable = stmt.op === "merge"
        ? isMergeAssignableType(valueType, targetType, this.symbols)
        : isAssignableType(valueType, targetType, this.symbols);
      if (assignable === false) {
        this.error(
          `Patch value for '${renderPath(stmt.path)}' must be assignable to ${describeTypeExpr(targetType, this.symbols)}, got ${describeTypeExpr(valueType, this.symbols)}`,
          stmt.value.location,
          "E_TYPE_MISMATCH"
        );
      }
    }
  }

  private validateEffect(stmt: EffectStmtNode): void {
    // Effect must be inside a guard
    if (!this.ctx.inGuard) {
      this.error(
        "Effect must be inside a guard (when, once, or onceIntent)",
        stmt.location,
        "E_UNGUARDED_EFFECT"
      );
    }

    // FDR-MEL-018: No nested effects (effects can't contain effects)
    // This is naturally enforced by the parser

    // Validate effect arguments
    for (const arg of stmt.args) {
      if (!arg.isPath) {
        this.validateExpr(arg.value as ExprNode, "action");
      }
    }
  }

  private validateFail(stmt: FailStmtNode): void {
    if (!this.ctx.inGuard) {
      this.error(
        "fail must be inside a guard (when, once, or onceIntent)",
        stmt.location,
        "E006"
      );
    }

    if (stmt.message) {
      this.validateExpr(stmt.message, "action");
    }
  }

  private validateStop(stmt: StopStmtNode): void {
    if (!this.ctx.inGuard) {
      this.error(
        "stop must be inside a guard (when, once, or onceIntent)",
        stmt.location,
        "E007"
      );
    }

    if (STOP_WAITING_REASON_PATTERN.test(stmt.reason)) {
      this.error(
        "stop message suggests waiting/pending - use 'Already processed' style instead",
        stmt.location,
        "E008"
      );
    }
  }

  private validateCondition(expr: ExprNode, guardType: "when" | "once" | "onceIntent"): void {
    const before = this.ctx.diagnostics.length;
    const conditionType = this.validateExpr(expr, "action");
    if (before === this.ctx.diagnostics.length) {
      this.requireAssignable(
        conditionType,
        simpleTypeNode("boolean", expr.location),
        expr.location,
        `Condition in ${guardType} must evaluate to boolean`
      );
    }
  }

  private validateExpr(
    expr: ExprNode,
    context: "computed" | "action",
    env: TypeEnv = this.ctx.currentActionParamTypes
  ): TypeExprNode | null {
    switch (expr.kind) {
      case "functionCall":
        this.validateFunctionCall(expr, context, env);
        return this.inferType(expr, env);

      case "binary":
        {
          const before = this.ctx.diagnostics.length;
          const leftType = this.validateExpr(expr.left, context, env);
          const rightType = this.validateExpr(expr.right, context, env);
          const hadInnerErrors = before !== this.ctx.diagnostics.length;

          if (!hadInnerErrors) {
            switch (expr.operator) {
              case "==":
              case "!=":
                this.validatePrimitiveEquality(expr.left, expr.right, leftType, rightType, expr.location);
                break;
              case "<":
              case "<=":
              case ">":
              case ">=":
                this.requireAssignable(
                  leftType,
                  simpleTypeNode("number", expr.left.location),
                  expr.left.location,
                  `Operator '${expr.operator}' requires a numeric left operand`
                );
                this.requireAssignable(
                  rightType,
                  simpleTypeNode("number", expr.right.location),
                  expr.right.location,
                  `Operator '${expr.operator}' requires a numeric right operand`
                );
                break;
              case "&&":
              case "||":
                this.requireAssignable(
                  leftType,
                  simpleTypeNode("boolean", expr.left.location),
                  expr.left.location,
                  `Operator '${expr.operator}' requires a boolean left operand`
                );
                this.requireAssignable(
                  rightType,
                  simpleTypeNode("boolean", expr.right.location),
                  expr.right.location,
                  `Operator '${expr.operator}' requires a boolean right operand`
                );
                break;
              case "+":
              case "-":
              case "*":
              case "/":
              case "%":
                this.requireAssignable(
                  leftType,
                  simpleTypeNode("number", expr.left.location),
                  expr.left.location,
                  `Operator '${expr.operator}' requires a numeric left operand`
                );
                this.requireAssignable(
                  rightType,
                  simpleTypeNode("number", expr.right.location),
                  expr.right.location,
                  `Operator '${expr.operator}' requires a numeric right operand`
                );
                break;
              case "??":
                this.validateCoalesceTypes([leftType, rightType], expr.location);
                break;
            }
          }

          return this.inferType(expr, env);
        }

      case "unary":
        {
          const before = this.ctx.diagnostics.length;
          const operandType = this.validateExpr(expr.operand, context, env);
          if (before === this.ctx.diagnostics.length) {
            this.requireAssignable(
              operandType,
              simpleTypeNode(expr.operator === "!" ? "boolean" : "number", expr.operand.location),
              expr.operand.location,
              expr.operator === "!"
                ? "Unary '!' requires a boolean operand"
                : "Unary '-' requires a numeric operand"
            );
          }
          return this.inferType(expr, env);
        }

      case "ternary":
        {
          const before = this.ctx.diagnostics.length;
          const conditionType = this.validateExpr(expr.condition, context, env);
          this.validateExpr(expr.consequent, context, env);
          this.validateExpr(expr.alternate, context, env);
          if (before === this.ctx.diagnostics.length) {
            this.requireAssignable(
              conditionType,
              simpleTypeNode("boolean", expr.condition.location),
              expr.condition.location,
              "Ternary condition must evaluate to boolean"
            );
          }
          return this.inferType(expr, env);
        }

      case "propertyAccess":
        this.validateExpr(expr.object, context, env);
        return this.inferType(expr, env);

      case "indexAccess":
        this.validateExpr(expr.object, context, env);
        this.validateExpr(expr.index, context, env);
        return this.inferType(expr, env);

      case "objectLiteral":
        for (const prop of expr.properties) {
          if (prop.kind === "objectProperty") {
            this.validateExpr(prop.value, context, env);
            continue;
          }

          const spreadType = this.validateExpr(prop.expr, context, env);
          if (this.symbols) {
            this.requireSpreadOperand(spreadType, prop.location, prop.expr);
          }
        }
        return this.inferType(expr, env);

      case "arrayLiteral":
        for (const elem of expr.elements) {
          this.validateExpr(elem, context, env);
        }
        return this.inferType(expr, env);

      case "systemIdent":
        // E001: $system.* in computed — handled by scope analysis (analyzeScope)
        // No duplicate check here to avoid double-reporting
        return this.inferType(expr, env);

      case "literal":
      case "identifier":
      case "iterationVar":
        return this.inferType(expr, env);
    }
  }

  private validateFunctionCall(
    expr: { kind: "functionCall"; name: string; args: ExprNode[]; location: SourceLocation },
    context: "computed" | "action",
    env: TypeEnv
  ): void {
    const { name, args, location } = expr;

    // v0.3.3: E011 - reduce/fold/scan is forbidden
    if (["reduce", "fold", "foldl", "foldr", "scan"].includes(name)) {
      this.error(
        `Function '${name}' is forbidden. Use sum(), min(), max() for aggregation instead`,
        location,
        "E011"
      );
    }

    // v0.3.3: E009/E010 - Primitive aggregation constraints
    // sum(array), min(array), max(array) with single arg = array aggregation
    if (["sum", "min", "max"].includes(name) && args.length === 1) {
      // E009: Array aggregation only in computed
      if (context === "action") {
        this.error(
          `Primitive aggregation '${name}()' can only be used in computed expressions, not in actions`,
          location,
          "E009"
        );
      }

      // E010: No composition - argument must be simple reference
      const arg = args[0];
      if (arg.kind === "functionCall") {
        this.error(
          `Primitive aggregation '${name}()' does not allow composition. Use a direct reference, not '${arg.name}()'`,
          location,
          "E010"
        );
      }
    }

    // Validate known function signatures
    switch (name) {
      // FDR-MEL-042: eq/neq on primitives only
      case "eq":
      case "neq":
        break;

      // FDR-MEL-026: len() on Array only
      case "len":
      // v0.3.3: sum() for array aggregation
      case "sum":
        if (args.length !== 1) {
          this.error(
            `Function '${name}' expects 1 argument, got ${args.length}`,
            location,
            "E_ARG_COUNT"
          );
        }
        break;

      // Binary functions need exactly 2 args
      case "add":
      case "sub":
      case "mul":
      case "div":
      case "mod":
      case "absDiff":
      case "idiv":
      case "gt":
      case "gte":
      case "lt":
      case "lte":
        if (args.length !== 2) {
          this.error(
            `Function '${name}' expects 2 arguments, got ${args.length}`,
            location,
            "E_ARG_COUNT"
          );
        }
        break;

      // Unary functions need exactly 1 arg
      case "not":
      case "neg":
      case "abs":
      case "floor":
      case "ceil":
      case "round":
      case "sqrt":
      case "isNull":
      case "isNotNull":
      case "trim":
      case "lower":
      case "upper":
      case "strlen":
      case "keys":
      case "values":
      case "entries":
      case "first":
      case "last":
      case "typeof":
      case "toString":
      case "toNumber":
      case "toBoolean":
      case "reverse":
      case "unique":
      case "flat":
      case "fromEntries":
        if (args.length !== 1) {
          this.error(
            `Function '${name}' expects 1 argument, got ${args.length}`,
            location,
            "E_ARG_COUNT"
          );
        }
        break;

      // Binary functions need exactly 2 args
      case "pow":
      case "findById":
      case "existsById":
      case "filter":
      case "map":
      case "find":
      case "every":
      case "some":
      case "at":
      case "includes":
      case "field":
      case "hasKey":
      case "pick":
      case "omit":
      case "startsWith":
      case "endsWith":
      case "strIncludes":
      case "indexOf":
        if (args.length !== 2) {
          this.error(
            `Function '${name}' expects 2 arguments, got ${args.length}`,
            location,
            "E_ARG_COUNT"
          );
        }
        break;

      case "updateById":
      case "clamp":
        if (args.length !== 3) {
          this.error(
            `Function '${name}' expects 3 arguments, got ${args.length}`,
            location,
            "E_ARG_COUNT"
          );
        }
        break;

      case "removeById":
      case "streak":
        if (args.length !== 2) {
          this.error(
            `Function '${name}' expects 2 arguments, got ${args.length}`,
            location,
            "E_ARG_COUNT"
          );
        }
        break;

      // 2-3 arg functions
      case "slice":
      case "substring":
      case "substr":
      case "replace":
        if (args.length < 2 || args.length > 3) {
          this.error(
            `Function '${name}' expects 2-3 arguments, got ${args.length}`,
            location,
            "E_ARG_COUNT"
          );
        }
        break;

      // split(str, delimiter)
      case "split":
        if (args.length !== 2) {
          this.error(
            `Function '${name}' expects 2 arguments, got ${args.length}`,
            location,
            "E_ARG_COUNT"
          );
        }
        break;

      // Variadic functions (at least 1 arg)
      case "and":
      case "or":
      case "concat":
      case "min":
      case "max":
      case "merge":
      case "coalesce":
      case "append":
        if (args.length < 1) {
          this.error(
            `Function '${name}' expects at least 1 argument`,
            location,
            "E_ARG_COUNT"
          );
        }
        break;

      case "match":
        if (args.length < 3) {
          this.error(
            "Function 'match' expects a selector, at least one [key, value] arm, and a default value",
            location,
            "E050"
          );
        }
        break;

      case "argmax":
      case "argmin":
        if (args.length < 2) {
          this.error(
            `Function '${name}' expects at least one [label, eligible, score] candidate and a tie-break literal`,
            location,
            "E052"
          );
        }
        break;

      // Conditional needs exactly 3 args
      case "if":
      case "cond":
        if (args.length !== 3) {
          this.error(
            `Function '${name}' expects 3 arguments, got ${args.length}`,
            location,
            "E_ARG_COUNT"
          );
        }
        break;

      default:
        this.error(
          `Unknown function '${name}'. Check spelling or see MEL builtin function reference`,
          location,
          "E_UNKNOWN_FN"
        );
        break;
    }

    const argTypes: Array<TypeExprNode | null> = [];
    if (["filter", "map", "find", "every", "some"].includes(name) && args.length > 0) {
      const sourceType = this.validateExpr(args[0], context, env);
      argTypes.push(sourceType);

      let callbackEnv = env;
      if (this.symbols) {
        const itemType = getArrayElementType(sourceType, this.symbols);
        if (itemType) {
          callbackEnv = extendCollectionTypeEnv(env, itemType);
        }
      }

      for (let index = 1; index < args.length; index += 1) {
        argTypes.push(this.validateExpr(args[index], context, index === 1 ? callbackEnv : env));
      }
    } else {
      for (const arg of args) {
        argTypes.push(this.validateExpr(arg, context, env));
      }
    }

    if (!this.symbols) {
      return;
    }

    switch (name) {
      case "eq":
      case "neq":
        if (args.length === 2) {
          this.validatePrimitiveEquality(args[0], args[1], argTypes[0], argTypes[1], location);
        }
        break;

      case "add":
      case "sub":
      case "mul":
      case "div":
      case "mod":
      case "absDiff":
      case "idiv":
      case "pow":
        if (args.length === 2) {
          this.requireAssignable(
            argTypes[0],
            simpleTypeNode("number", args[0].location),
            args[0].location,
            `Function '${name}' expects a numeric first argument`
          );
          this.requireAssignable(
            argTypes[1],
            simpleTypeNode("number", args[1].location),
            args[1].location,
            `Function '${name}' expects a numeric second argument`
          );
        }
        break;

      case "gt":
      case "gte":
      case "lt":
      case "lte":
        if (args.length === 2) {
          this.requireAssignable(
            argTypes[0],
            simpleTypeNode("number", args[0].location),
            args[0].location,
            `Function '${name}' expects a numeric first argument`
          );
          this.requireAssignable(
            argTypes[1],
            simpleTypeNode("number", args[1].location),
            args[1].location,
            `Function '${name}' expects a numeric second argument`
          );
        }
        break;

      case "and":
      case "or":
        for (const [index, arg] of args.entries()) {
          this.requireAssignable(
            argTypes[index],
            simpleTypeNode("boolean", arg.location),
            arg.location,
            `Function '${name}' expects boolean arguments`
          );
        }
        break;

      case "not":
        if (args.length === 1) {
          this.requireAssignable(
            argTypes[0],
            simpleTypeNode("boolean", args[0].location),
            args[0].location,
            "Function 'not' expects a boolean argument"
          );
        }
        break;

      case "neg":
      case "abs":
      case "floor":
      case "ceil":
      case "round":
      case "sqrt":
        if (args.length === 1) {
          this.requireAssignable(
            argTypes[0],
            simpleTypeNode("number", args[0].location),
            args[0].location,
            `Function '${name}' expects a numeric argument`
          );
        }
        break;

      case "clamp":
        if (args.length === 3) {
          this.requireAssignable(
            argTypes[0],
            simpleTypeNode("number", args[0].location),
            args[0].location,
            "Function 'clamp' expects a numeric first argument"
          );
          this.requireAssignable(
            argTypes[1],
            simpleTypeNode("number", args[1].location),
            args[1].location,
            "Function 'clamp' expects a numeric second argument"
          );
          this.requireAssignable(
            argTypes[2],
            simpleTypeNode("number", args[2].location),
            args[2].location,
            "Function 'clamp' expects a numeric third argument"
          );
          const clampLoLiteral = getStaticNumericLiteralValue(args[1]);
          const clampHiLiteral = getStaticNumericLiteralValue(args[2]);
          if (
            typeof clampLoLiteral === "number" &&
            typeof clampHiLiteral === "number" &&
            clampLoLiteral > clampHiLiteral
          ) {
            this.error(
              "Function 'clamp' requires literal bounds in lo, hi order",
              location,
              "E049"
            );
          }
        }
        break;

      case "streak":
        if (args.length === 2) {
          this.requireAssignable(
            argTypes[0],
            simpleTypeNode("number", args[0].location),
            args[0].location,
            "Function 'streak' expects a numeric first argument"
          );
          this.requireAssignable(
            argTypes[1],
            simpleTypeNode("boolean", args[1].location),
            args[1].location,
            "Function 'streak' expects a boolean second argument"
          );
        }
        break;

      case "trim":
      case "lower":
      case "upper":
      case "strlen":
        if (args.length === 1) {
          this.requireAssignable(
            argTypes[0],
            simpleTypeNode("string", args[0].location),
            args[0].location,
            `Function '${name}' expects a string argument`
          );
        }
        break;

      case "startsWith":
      case "endsWith":
      case "strIncludes":
      case "indexOf":
      case "split":
        if (args.length === 2) {
          this.requireAssignable(
            argTypes[0],
            simpleTypeNode("string", args[0].location),
            args[0].location,
            `Function '${name}' expects a string first argument`
          );
          this.requireAssignable(
            argTypes[1],
            simpleTypeNode("string", args[1].location),
            args[1].location,
            `Function '${name}' expects a string second argument`
          );
        }
        break;

      case "replace":
        if (args.length >= 2) {
          this.requireAssignable(
            argTypes[0],
            simpleTypeNode("string", args[0].location),
            args[0].location,
            "Function 'replace' expects a string first argument"
          );
          this.requireAssignable(
            argTypes[1],
            simpleTypeNode("string", args[1].location),
            args[1].location,
            "Function 'replace' expects a string second argument"
          );
        }
        if (args.length === 3) {
          this.requireAssignable(
            argTypes[2],
            simpleTypeNode("string", args[2].location),
            args[2].location,
            "Function 'replace' expects a string replacement argument"
          );
        }
        break;

      case "substring":
      case "substr":
        if (args.length >= 2) {
          this.requireAssignable(
            argTypes[0],
            simpleTypeNode("string", args[0].location),
            args[0].location,
            `Function '${name}' expects a string first argument`
          );
          this.requireAssignable(
            argTypes[1],
            simpleTypeNode("number", args[1].location),
            args[1].location,
            `Function '${name}' expects a numeric second argument`
          );
        }
        if (args.length === 3) {
          this.requireAssignable(
            argTypes[2],
            simpleTypeNode("number", args[2].location),
            args[2].location,
            `Function '${name}' expects a numeric third argument`
          );
        }
        break;

      case "len":
        if (args.length === 1) {
          this.requireLenCompatible(argTypes[0], args[0].location);
        }
        break;

      case "filter":
      case "find":
      case "every":
      case "some":
        if (args.length === 2) {
          this.requireArrayCompatible(argTypes[0], args[0].location, name);
          this.requireAssignable(
            argTypes[1],
            simpleTypeNode("boolean", args[1].location),
            args[1].location,
            `Function '${name}' requires a boolean-valued callback`
          );
        }
        break;

      case "map":
        if (args.length === 2) {
          this.requireArrayCompatible(argTypes[0], args[0].location, name);
        }
        break;

      case "merge":
        for (const [index, arg] of args.entries()) {
          this.requireSpreadOperand(argTypes[index], arg.location, arg);
        }
        break;

      case "coalesce":
        this.validateCoalesceTypes(argTypes, location);
        break;

      case "match":
        this.validateMatchCall(args, argTypes, location, env);
        break;

      case "argmax":
      case "argmin":
        this.validateArgSelectionCall(name, args, location, env);
        break;

      case "if":
      case "cond":
        if (args.length === 3) {
          this.requireAssignable(
            argTypes[0],
            simpleTypeNode("boolean", args[0].location),
            args[0].location,
            `Function '${name}' expects a boolean condition`
          );
        }
        break;
    }
  }

  private validatePrimitiveEquality(
    leftExpr: ExprNode,
    rightExpr: ExprNode,
    leftType: TypeExprNode | null,
    rightType: TypeExprNode | null,
    location: SourceLocation
  ): void {
    if (!this.symbols) {
      return;
    }

    if (
      leftExpr.kind === "objectLiteral" ||
      leftExpr.kind === "arrayLiteral" ||
      rightExpr.kind === "objectLiteral" ||
      rightExpr.kind === "arrayLiteral"
    ) {
      this.error(
        "eq/neq operands must be compatible primitive types, not object or array literals",
        location,
        "E_TYPE_MISMATCH"
      );
      return;
    }

    const compatible = areComparableTypesCompatible(leftType, rightType, this.symbols);
    if (compatible === false) {
      this.error(
        `eq/neq operands must be compatible primitive types, got ${describeTypeExpr(leftType, this.symbols)} and ${describeTypeExpr(rightType, this.symbols)}`,
        location,
        "E_TYPE_MISMATCH"
      );
    }
  }

  private inferType(expr: ExprNode, env: TypeEnv): TypeExprNode | null {
    if (!this.symbols) {
      return null;
    }

    return inferExprType(expr, env, this.symbols);
  }

  private requireAssignable(
    actualType: TypeExprNode | null,
    expectedType: TypeExprNode,
    location: SourceLocation,
    message: string
  ): void {
    if (!this.symbols || !actualType) {
      return;
    }

    const assignable = isAssignableType(actualType, expectedType, this.symbols);
    if (assignable === false) {
      this.error(
        `${message}, got ${describeTypeExpr(actualType, this.symbols)}`,
        location,
        "E_TYPE_MISMATCH"
      );
    }
  }

  private requireArrayCompatible(
    actualType: TypeExprNode | null,
    location: SourceLocation,
    fnName: string
  ): void {
    if (!this.symbols || !actualType) {
      return;
    }

    const outcome = classifyArrayOperand(actualType, this.symbols);
    if (outcome === false) {
      this.error(
        `Function '${fnName}' expects an array first argument, got ${describeTypeExpr(actualType, this.symbols)}`,
        location,
        "E_TYPE_MISMATCH"
      );
    }
  }

  private requireLenCompatible(actualType: TypeExprNode | null, location: SourceLocation): void {
    if (!this.symbols || !actualType) {
      return;
    }

    const outcome = classifyLenOperand(actualType, this.symbols);
    if (outcome === false) {
      this.error(
        `Function 'len' expects a string, array, object, or record argument, got ${describeTypeExpr(actualType, this.symbols)}`,
        location,
        "E_TYPE_MISMATCH"
      );
    }
  }

  private requireSpreadOperand(
    actualType: TypeExprNode | null,
    location: SourceLocation,
    expr?: ExprNode
  ): void {
    if (!this.symbols) {
      return;
    }

    const outcome = mayYieldArrayExpr(expr)
      ? "invalid"
      : actualType === null
      ? "unknown"
      : classifySpreadOperandType(actualType, this.symbols);

    if (outcome === "invalid") {
      this.error(
        `Object spread operands must be object-shaped or T | null where T is object-shaped, got ${describeTypeExpr(actualType, this.symbols)}`,
        location,
        "E_TYPE_MISMATCH"
      );
    }
  }

  private validateCoalesceTypes(types: Array<TypeExprNode | null>, location: SourceLocation): void {
    if (!this.symbols) {
      return;
    }

    const concreteTypes = types
      .map((typeExpr) => stripNullType(typeExpr, this.symbols!))
      .filter((typeExpr): typeExpr is TypeExprNode => typeExpr !== null);

    for (let i = 0; i < concreteTypes.length; i += 1) {
      for (let j = i + 1; j < concreteTypes.length; j += 1) {
        const compatible = areTypesCompatible(concreteTypes[i], concreteTypes[j], this.symbols);
        if (compatible === false) {
          this.error(
            `coalesce arguments must have compatible non-null types, got ${describeTypeExpr(concreteTypes[i], this.symbols)} and ${describeTypeExpr(concreteTypes[j], this.symbols)}`,
            location,
            "E_TYPE_MISMATCH"
          );
          return;
        }
      }
    }
  }

  private validateMatchCall(
    args: ExprNode[],
    argTypes: Array<TypeExprNode | null>,
    location: SourceLocation,
    env: TypeEnv
  ): void {
    if (!this.symbols || args.length < 3) {
      return;
    }

    const selectorType = argTypes[0];
    const selectorKind = getSingleNonNullPrimitiveKind(selectorType, this.symbols);
    if (selectorKind === "invalid") {
      this.error(
        `Function 'match' requires a selector of type string, number, or boolean, got ${describeTypeExpr(selectorType, this.symbols)}`,
        args[0]!.location,
        "E_TYPE_MISMATCH"
      );
    }
    const seenKeys = new Set<string>();
    const valueTypes: Array<TypeExprNode | null> = [];

    for (let index = 1; index < args.length - 1; index += 1) {
      const arm = args[index];
      if (arm.kind !== "arrayLiteral" || arm.elements.length !== 2) {
        this.error(
          "Function 'match' requires each arm to be an inline [key, value] array literal",
          arm.location,
          "E050"
        );
        continue;
      }

      const [keyExpr, valueExpr] = arm.elements;
      const literalKey = getLiteralPrimitiveValue(keyExpr);
      if (literalKey === undefined || literalKey === null) {
        this.error(
          "Function 'match' requires literal string, number, or boolean arm keys",
          keyExpr.location,
          "E050"
        );
      } else {
        const dedupeKey = `${typeof literalKey}:${String(literalKey)}`;
        if (seenKeys.has(dedupeKey)) {
          this.error(
            `Function 'match' has duplicate arm key ${JSON.stringify(literalKey)}`,
            keyExpr.location,
            "E051"
          );
        } else {
          seenKeys.add(dedupeKey);
        }
      }

      const keyType = this.inferType(keyExpr, env);
      const keyKind = getSingleNonNullPrimitiveKind(keyType, this.symbols);
      if (keyKind === "invalid" || (selectorKind !== null && keyKind !== null && selectorKind !== keyKind)) {
        this.error(
          `Function 'match' selector and arm keys must use the same primitive type, got ${describeTypeExpr(selectorType, this.symbols)} and ${describeTypeExpr(keyType, this.symbols)}`,
          keyExpr.location,
          "E_TYPE_MISMATCH"
        );
      }

      valueTypes.push(this.inferType(valueExpr, env));
    }

    valueTypes.push(argTypes[argTypes.length - 1]);
    for (let i = 0; i < valueTypes.length; i += 1) {
      for (let j = i + 1; j < valueTypes.length; j += 1) {
        const compatible = areTypesCompatible(valueTypes[i], valueTypes[j], this.symbols);
        if (compatible === false) {
          this.error(
            `Function 'match' arm values and default must have compatible types, got ${describeTypeExpr(valueTypes[i], this.symbols)} and ${describeTypeExpr(valueTypes[j], this.symbols)}`,
            location,
            "E_TYPE_MISMATCH"
          );
          return;
        }
      }
    }
  }

  private validateArgSelectionCall(
    fnName: "argmax" | "argmin",
    args: ExprNode[],
    location: SourceLocation,
    env: TypeEnv
  ): void {
    if (!this.symbols || args.length < 2) {
      return;
    }

    const tieBreakExpr = args[args.length - 1];
    const tieBreakValue = getLiteralPrimitiveValue(tieBreakExpr);
    if (tieBreakValue !== "first" && tieBreakValue !== "last") {
      this.error(
        `Function '${fnName}' requires a final tie-break literal of "first" or "last"`,
        tieBreakExpr.location,
        "E052"
      );
    }

    const labelTypes: Array<TypeExprNode | null> = [];
    let labelKind: Exclude<PrimitiveKind, "null"> | null = null;
    for (let index = 0; index < args.length - 1; index += 1) {
      const candidate = args[index];
      if (candidate.kind !== "arrayLiteral" || candidate.elements.length !== 3) {
        this.error(
          `Function '${fnName}' requires inline [label, eligible, score] array literal candidates`,
          candidate.location,
          "E052"
        );
        continue;
      }

      const [labelExpr, eligibleExpr, scoreExpr] = candidate.elements;
      const labelType = this.inferType(labelExpr, env);
      const candidateLabelKind = getSingleNonNullPrimitiveKind(labelType, this.symbols);
      if (candidateLabelKind === "invalid") {
        this.error(
          `Function '${fnName}' requires labels with exactly one primitive scalar type, got ${describeTypeExpr(labelType, this.symbols)}`,
          labelExpr.location,
          "E_TYPE_MISMATCH"
        );
      } else if (labelKind === null) {
        labelKind = candidateLabelKind;
      } else if (candidateLabelKind !== null && candidateLabelKind !== labelKind) {
        this.error(
          `Function '${fnName}' candidate labels must share one primitive scalar type, got ${labelKind} and ${candidateLabelKind}`,
          labelExpr.location,
          "E_TYPE_MISMATCH"
        );
      }

      this.requireAssignable(
        this.inferType(eligibleExpr, env),
        simpleTypeNode("boolean", eligibleExpr.location),
        eligibleExpr.location,
        `Function '${fnName}' expects a boolean eligible value`
      );
      this.requireAssignable(
        this.inferType(scoreExpr, env),
        simpleTypeNode("number", scoreExpr.location),
        scoreExpr.location,
        `Function '${fnName}' expects a numeric score value`
      );

      labelTypes.push(labelType);
    }

    for (let i = 0; i < labelTypes.length; i += 1) {
      for (let j = i + 1; j < labelTypes.length; j += 1) {
        const compatible = areTypesCompatible(labelTypes[i], labelTypes[j], this.symbols);
        if (compatible === false) {
          this.error(
            `Function '${fnName}' candidate labels must have compatible scalar types, got ${describeTypeExpr(labelTypes[i], this.symbols)} and ${describeTypeExpr(labelTypes[j], this.symbols)}`,
            location,
            "E_TYPE_MISMATCH"
          );
          return;
        }
      }
    }
  }

  private error(message: string, location: SourceLocation, code: string): void {
    this.ctx.diagnostics.push({
      severity: "error",
      code,
      message,
      location,
    });
  }

  private warn(message: string, location: SourceLocation, code: string): void {
    this.ctx.diagnostics.push({
      severity: "warning",
      code,
      message,
      location,
    });
  }
}

/**
 * Validate a MEL program semantically
 */
export function validateSemantics(program: ProgramNode): ValidationResult {
  const validator = new SemanticValidator();
  const result = validator.validate(program);
  const entityDiagnostics = validateEntityPrimitives(program);
  const diagnostics = [...result.diagnostics, ...entityDiagnostics];

  return {
    valid: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    diagnostics,
  };
}
