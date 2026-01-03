/**
 * AST Node Types for MEL Parser
 * Based on MEL SPEC v0.3.3 Section 4
 */

import type { SourceLocation } from "../lexer/source-location.js";

// ============ Base Types ============

/**
 * Base interface for all AST nodes
 */
export interface ASTNode {
  location: SourceLocation;
}

// ============ Program Structure ============

/**
 * Root node of a MEL program
 */
export interface ProgramNode extends ASTNode {
  kind: "program";
  imports: ImportNode[];
  domain: DomainNode;
}

/**
 * Import declaration
 */
export interface ImportNode extends ASTNode {
  kind: "import";
  names: string[];
  from: string;
}

/**
 * Domain declaration
 */
export interface DomainNode extends ASTNode {
  kind: "domain";
  name: string;
  /** v0.3.3: Named type declarations */
  types: TypeDeclNode[];
  members: DomainMember[];
}

/**
 * Domain member types
 */
export type DomainMember = StateNode | ComputedNode | ActionNode;

/**
 * Type declaration (v0.3.3)
 * Syntax: type Name = TypeExpr
 */
export interface TypeDeclNode extends ASTNode {
  kind: "typeDecl";
  name: string;
  typeExpr: TypeExprNode;
}

// ============ State ============

/**
 * State block declaration
 */
export interface StateNode extends ASTNode {
  kind: "state";
  fields: StateFieldNode[];
}

/**
 * State field declaration
 */
export interface StateFieldNode extends ASTNode {
  kind: "stateField";
  name: string;
  typeExpr: TypeExprNode;
  initializer?: ExprNode;
}

// ============ Computed ============

/**
 * Computed value declaration
 */
export interface ComputedNode extends ASTNode {
  kind: "computed";
  name: string;
  expression: ExprNode;
}

// ============ Action ============

/**
 * Action declaration
 */
export interface ActionNode extends ASTNode {
  kind: "action";
  name: string;
  params: ParamNode[];
  /** v0.3.2: Optional availability condition */
  available?: ExprNode;
  body: GuardedStmtNode[];
}

/**
 * Parameter declaration
 */
export interface ParamNode extends ASTNode {
  kind: "param";
  name: string;
  typeExpr: TypeExprNode;
}

// ============ Statements ============

/**
 * Guarded statement types (top-level in action body)
 */
export type GuardedStmtNode = WhenStmtNode | OnceStmtNode;

/**
 * Inner statement types (inside guards)
 */
export type InnerStmtNode = PatchStmtNode | EffectStmtNode | WhenStmtNode | OnceStmtNode | FailStmtNode | StopStmtNode;

/**
 * When guard statement
 */
export interface WhenStmtNode extends ASTNode {
  kind: "when";
  condition: ExprNode;
  body: InnerStmtNode[];
}

/**
 * Once guard statement (per-intent idempotency)
 */
export interface OnceStmtNode extends ASTNode {
  kind: "once";
  marker: PathNode;
  condition?: ExprNode;
  body: InnerStmtNode[];
}

/**
 * Patch statement
 */
export interface PatchStmtNode extends ASTNode {
  kind: "patch";
  path: PathNode;
  op: "set" | "unset" | "merge";
  value?: ExprNode;
}

/**
 * Effect statement
 */
export interface EffectStmtNode extends ASTNode {
  kind: "effect";
  effectType: string;
  args: EffectArgNode[];
}

/**
 * Effect argument
 */
export interface EffectArgNode extends ASTNode {
  kind: "effectArg";
  name: string;
  value: ExprNode | PathNode;
  isPath: boolean; // true for into:, pass:, fail:
}

/**
 * Fail statement (v0.3.2) - terminates flow with error
 * Compiles to FlowNode { kind: "fail", code, message }
 */
export interface FailStmtNode extends ASTNode {
  kind: "fail";
  code: string;
  message?: ExprNode;
}

/**
 * Stop statement (v0.3.2) - early exit, no error
 * Compiles to FlowNode { kind: "halt", reason }
 */
export interface StopStmtNode extends ASTNode {
  kind: "stop";
  reason: string;
}

// ============ Types ============

/**
 * Type expression node
 */
export type TypeExprNode =
  | SimpleTypeNode
  | UnionTypeNode
  | ArrayTypeNode
  | RecordTypeNode
  | LiteralTypeNode
  | ObjectTypeNode;

export interface SimpleTypeNode extends ASTNode {
  kind: "simpleType";
  name: string;
}

export interface UnionTypeNode extends ASTNode {
  kind: "unionType";
  types: TypeExprNode[];
}

export interface ArrayTypeNode extends ASTNode {
  kind: "arrayType";
  elementType: TypeExprNode;
}

export interface RecordTypeNode extends ASTNode {
  kind: "recordType";
  keyType: TypeExprNode;
  valueType: TypeExprNode;
}

export interface LiteralTypeNode extends ASTNode {
  kind: "literalType";
  value: string | number | boolean | null;
}

/**
 * Object type node (v0.3.3)
 * Represents inline object types: { field: Type, ... }
 * Note: In state fields, this triggers W012 warning (use named type instead)
 */
export interface ObjectTypeNode extends ASTNode {
  kind: "objectType";
  fields: TypeFieldNode[];
}

/**
 * Type field within an object type
 */
export interface TypeFieldNode extends ASTNode {
  kind: "typeField";
  name: string;
  typeExpr: TypeExprNode;
  optional: boolean;
}

// ============ Expressions ============

/**
 * All expression types
 */
export type ExprNode =
  | LiteralExprNode
  | IdentifierExprNode
  | SystemIdentExprNode
  | IterationVarExprNode
  | PropertyAccessExprNode
  | IndexAccessExprNode
  | FunctionCallExprNode
  | UnaryExprNode
  | BinaryExprNode
  | TernaryExprNode
  | ObjectLiteralExprNode
  | ArrayLiteralExprNode;

/**
 * Literal expression (number, string, boolean, null)
 */
export interface LiteralExprNode extends ASTNode {
  kind: "literal";
  value: unknown;
  literalType: "number" | "string" | "boolean" | "null";
}

/**
 * Identifier expression
 */
export interface IdentifierExprNode extends ASTNode {
  kind: "identifier";
  name: string;
}

/**
 * System identifier expression ($system.*, $meta.*, $input.*)
 */
export interface SystemIdentExprNode extends ASTNode {
  kind: "systemIdent";
  path: string[]; // e.g., ["system", "uuid"] for $system.uuid
}

/**
 * Iteration variable expression ($item only)
 * v0.3.2: $acc removed - reduce pattern deprecated
 */
export interface IterationVarExprNode extends ASTNode {
  kind: "iterationVar";
  name: "item";
}

/**
 * Property access expression (a.b)
 */
export interface PropertyAccessExprNode extends ASTNode {
  kind: "propertyAccess";
  object: ExprNode;
  property: string;
}

/**
 * Index access expression (a[b])
 */
export interface IndexAccessExprNode extends ASTNode {
  kind: "indexAccess";
  object: ExprNode;
  index: ExprNode;
}

/**
 * Function call expression
 */
export interface FunctionCallExprNode extends ASTNode {
  kind: "functionCall";
  name: string;
  args: ExprNode[];
}

/**
 * Unary expression (!a, -a)
 */
export interface UnaryExprNode extends ASTNode {
  kind: "unary";
  operator: "!" | "-";
  operand: ExprNode;
}

/**
 * Binary operators
 */
export type BinaryOperator =
  | "+" | "-" | "*" | "/" | "%"
  | "==" | "!=" | "<" | "<=" | ">" | ">="
  | "&&" | "||" | "??";

/**
 * Binary expression (a + b, a && b, etc.)
 */
export interface BinaryExprNode extends ASTNode {
  kind: "binary";
  operator: BinaryOperator;
  left: ExprNode;
  right: ExprNode;
}

/**
 * Ternary expression (a ? b : c)
 */
export interface TernaryExprNode extends ASTNode {
  kind: "ternary";
  condition: ExprNode;
  consequent: ExprNode;
  alternate: ExprNode;
}

/**
 * Object literal expression ({ a: 1, b: 2 })
 */
export interface ObjectLiteralExprNode extends ASTNode {
  kind: "objectLiteral";
  properties: ObjectPropertyNode[];
}

export interface ObjectPropertyNode extends ASTNode {
  kind: "objectProperty";
  key: string;
  value: ExprNode;
}

/**
 * Array literal expression ([1, 2, 3])
 */
export interface ArrayLiteralExprNode extends ASTNode {
  kind: "arrayLiteral";
  elements: ExprNode[];
}

// ============ Path ============

/**
 * Path node for patch targets and effect destinations
 */
export interface PathNode extends ASTNode {
  kind: "path";
  segments: PathSegmentNode[];
}

export type PathSegmentNode = PropertySegmentNode | IndexSegmentNode;

export interface PropertySegmentNode extends ASTNode {
  kind: "propertySegment";
  name: string;
}

export interface IndexSegmentNode extends ASTNode {
  kind: "indexSegment";
  index: ExprNode;
}

// ============ Helpers ============

/**
 * Check if a node is an expression
 */
export function isExprNode(node: ASTNode): node is ExprNode {
  const exprKinds = [
    "literal", "identifier", "systemIdent", "iterationVar",
    "propertyAccess", "indexAccess", "functionCall",
    "unary", "binary", "ternary", "objectLiteral", "arrayLiteral"
  ];
  return exprKinds.includes((node as ExprNode).kind);
}

/**
 * Check if a node is a statement
 */
export function isStmtNode(node: ASTNode): node is InnerStmtNode {
  const stmtKinds = ["when", "once", "patch", "effect", "fail", "stop"];
  return stmtKinds.includes((node as InnerStmtNode).kind);
}
