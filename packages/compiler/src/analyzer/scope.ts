/**
 * Scope Analysis for MEL
 * Tracks variable scopes and resolves identifiers
 * Based on MEL SPEC v0.3.1 Section 4.10
 */

import type {
  ProgramNode,
  DomainNode,
  StateFieldNode,
  ComputedNode,
  ActionNode,
  ParamNode,
  ExprNode,
  GuardedStmtNode,
  InnerStmtNode,
} from "../parser/ast.js";
import type { Diagnostic } from "../diagnostics/types.js";
import type { SourceLocation } from "../lexer/source-location.js";

// ============ Scope Types ============

/**
 * Symbol kinds
 */
export type SymbolKind = "state" | "computed" | "param" | "action" | "iteration";

/**
 * Symbol information
 */
export interface Symbol {
  name: string;
  kind: SymbolKind;
  location: SourceLocation;
  type?: string; // Optional type information
}

/**
 * Scope represents a lexical scope
 */
export class Scope {
  readonly parent: Scope | null;
  readonly symbols: Map<string, Symbol> = new Map();
  readonly kind: "domain" | "action" | "guard";

  constructor(kind: "domain" | "action" | "guard", parent: Scope | null = null) {
    this.kind = kind;
    this.parent = parent;
  }

  /**
   * Define a new symbol in this scope
   */
  define(symbol: Symbol): void {
    this.symbols.set(symbol.name, symbol);
  }

  /**
   * Look up a symbol, searching parent scopes if not found
   */
  lookup(name: string): Symbol | undefined {
    const symbol = this.symbols.get(name);
    if (symbol) return symbol;
    return this.parent?.lookup(name);
  }

  /**
   * Check if a symbol is defined in this scope (not parent scopes)
   */
  isDefined(name: string): boolean {
    return this.symbols.has(name);
  }
}

// ============ Scope Analyzer ============

/**
 * Result of scope analysis
 */
export interface ScopeAnalysisResult {
  scopes: Map<string, Scope>; // Maps scope path to scope
  diagnostics: Diagnostic[];
}

/**
 * Scope Analyzer - builds scope tree and checks for errors
 */
export class ScopeAnalyzer {
  private diagnostics: Diagnostic[] = [];
  private scopes: Map<string, Scope> = new Map();
  private currentScope: Scope | null = null;
  private domainScope: Scope | null = null;

  /**
   * Analyze a MEL program
   */
  analyze(program: ProgramNode): ScopeAnalysisResult {
    this.diagnostics = [];
    this.scopes = new Map();
    this.currentScope = null;
    this.domainScope = null;

    this.analyzeDomain(program.domain);

    return {
      scopes: this.scopes,
      diagnostics: this.diagnostics,
    };
  }

  private analyzeDomain(domain: DomainNode): void {
    // Create domain scope
    const scope = new Scope("domain");
    this.domainScope = scope;
    this.currentScope = scope;
    this.scopes.set("domain", scope);

    // First pass: collect all state and computed names
    for (const member of domain.members) {
      if (member.kind === "state") {
        for (const field of member.fields) {
          this.defineSymbol({
            name: field.name,
            kind: "state",
            location: field.location,
          });
        }
      } else if (member.kind === "computed") {
        this.defineSymbol({
          name: member.name,
          kind: "computed",
          location: member.location,
        });
      } else if (member.kind === "action") {
        this.defineSymbol({
          name: member.name,
          kind: "action",
          location: member.location,
        });
      }
    }

    // Second pass: analyze expressions and bodies
    for (const member of domain.members) {
      if (member.kind === "computed") {
        this.analyzeComputedExpr(member);
      } else if (member.kind === "action") {
        this.analyzeAction(member);
      }
    }
  }

  private analyzeComputedExpr(computed: ComputedNode): void {
    // Computed expressions have access to state and other computed values
    this.analyzeExpr(computed.expression, "computed");
  }

  private analyzeAction(action: ActionNode): void {
    // Create action scope with params
    const scope = new Scope("action", this.domainScope);
    this.currentScope = scope;
    this.scopes.set(`action.${action.name}`, scope);

    // Define parameters
    for (const param of action.params) {
      scope.define({
        name: param.name,
        kind: "param",
        location: param.location,
      });
    }

    // Analyze body
    for (const stmt of action.body) {
      this.analyzeStmt(stmt);
    }

    this.currentScope = this.domainScope;
  }

  private analyzeStmt(stmt: GuardedStmtNode | InnerStmtNode): void {
    switch (stmt.kind) {
      case "when":
        this.analyzeExpr(stmt.condition, "action");
        for (const inner of stmt.body) {
          this.analyzeStmt(inner);
        }
        break;

      case "once":
        // Marker is a path, need to validate
        this.validatePath(stmt.marker);
        if (stmt.condition) {
          this.analyzeExpr(stmt.condition, "action");
        }
        for (const inner of stmt.body) {
          this.analyzeStmt(inner);
        }
        break;

      case "patch":
        this.validatePath(stmt.path);
        if (stmt.value) {
          this.analyzeExpr(stmt.value, "action");
        }
        break;

      case "effect":
        for (const arg of stmt.args) {
          if (arg.isPath) {
            this.validatePath(arg.value as any);
          } else {
            this.analyzeExpr(arg.value as ExprNode, "action");
          }
        }
        break;
    }
  }

  private analyzeExpr(expr: ExprNode, context: "computed" | "action"): void {
    switch (expr.kind) {
      case "identifier":
        this.checkIdentifier(expr.name, expr.location, context);
        break;

      case "systemIdent":
        this.checkSystemIdent(expr.path, expr.location, context);
        break;

      case "propertyAccess":
        this.analyzeExpr(expr.object, context);
        break;

      case "indexAccess":
        this.analyzeExpr(expr.object, context);
        this.analyzeExpr(expr.index, context);
        break;

      case "functionCall":
        for (const arg of expr.args) {
          this.analyzeExpr(arg, context);
        }
        break;

      case "binary":
        this.analyzeExpr(expr.left, context);
        this.analyzeExpr(expr.right, context);
        break;

      case "unary":
        this.analyzeExpr(expr.operand, context);
        break;

      case "ternary":
        this.analyzeExpr(expr.condition, context);
        this.analyzeExpr(expr.consequent, context);
        this.analyzeExpr(expr.alternate, context);
        break;

      case "objectLiteral":
        for (const prop of expr.properties) {
          this.analyzeExpr(prop.value, context);
        }
        break;

      case "arrayLiteral":
        for (const elem of expr.elements) {
          this.analyzeExpr(elem, context);
        }
        break;

      case "iterationVar":
        // v0.3.2: $item only (reduce pattern deprecated, $acc removed)
        // $item is valid in filter/map predicates
        // For now, we don't validate the context
        break;

      case "literal":
        // Nothing to check
        break;
    }
  }

  private checkIdentifier(name: string, location: SourceLocation, context: "computed" | "action"): void {
    const symbol = this.currentScope?.lookup(name);

    if (!symbol) {
      this.error(`Undefined identifier '${name}'`, location, "E_UNDEFINED");
      return;
    }

    // Check access rules
    if (context === "computed") {
      // Computed can only access state and other computed values
      if (symbol.kind === "param") {
        this.error(
          `Cannot access parameter '${name}' in computed expression`,
          location,
          "E_INVALID_ACCESS"
        );
      }
    }
  }

  private checkSystemIdent(path: string[], location: SourceLocation, context: "computed" | "action"): void {
    const [namespace, ...rest] = path;

    // E001: $system.* in computed
    if (namespace === "system" && context === "computed") {
      this.error(
        `Cannot use $system.* in computed expressions (non-deterministic)`,
        location,
        "E001"
      );
    }

    // E003: Invalid $system reference
    if (namespace === "system") {
      const validKeys = ["uuid", "timestamp", "random"];
      const key = rest[0];
      if (key && !validKeys.includes(key)) {
        this.error(
          `Invalid system value '$system.${key}'. Valid values: ${validKeys.join(", ")}`,
          location,
          "E003"
        );
      }
    }

    // E003: Invalid $meta reference
    if (namespace === "meta") {
      const validKeys = ["intentId", "actionName", "timestamp"];
      const key = rest[0];
      if (key && !validKeys.includes(key)) {
        this.error(
          `Invalid meta value '$meta.${key}'. Valid values: ${validKeys.join(", ")}`,
          location,
          "E003"
        );
      }
    }
  }

  private validatePath(path: any): void {
    if (!path || !path.segments) return;

    // Check first segment is a valid identifier
    const first = path.segments[0];
    if (first?.kind === "propertySegment") {
      const symbol = this.currentScope?.lookup(first.name);
      if (!symbol) {
        this.error(
          `Undefined identifier '${first.name}' in path`,
          path.location,
          "E_UNDEFINED"
        );
      }
    }
  }

  private defineSymbol(symbol: Symbol): void {
    if (!this.currentScope) return;

    if (this.currentScope.isDefined(symbol.name)) {
      this.error(
        `Duplicate identifier '${symbol.name}'`,
        symbol.location,
        "E_DUPLICATE"
      );
      return;
    }

    this.currentScope.define(symbol);
  }

  private error(message: string, location: SourceLocation, code: string): void {
    this.diagnostics.push({
      severity: "error",
      code,
      message,
      location,
    });
  }
}

/**
 * Analyze a MEL program for scope issues
 */
export function analyzeScope(program: ProgramNode): ScopeAnalysisResult {
  const analyzer = new ScopeAnalyzer();
  return analyzer.analyze(program);
}
