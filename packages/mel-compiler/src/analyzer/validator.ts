/**
 * Semantic Validator for MEL
 * Validates semantic rules beyond syntax
 * Based on MEL SPEC v0.3.1 and FDR-MEL-*
 */

import type {
  ProgramNode,
  DomainNode,
  ActionNode,
  ExprNode,
  GuardedStmtNode,
  InnerStmtNode,
  WhenStmtNode,
  OnceStmtNode,
  PatchStmtNode,
  EffectStmtNode,
} from "../parser/ast.js";
import type { Diagnostic } from "../diagnostics/types.js";
import type { SourceLocation } from "../lexer/source-location.js";

// ============ Validation Context ============

interface ValidationContext {
  inAction: boolean;
  inGuard: boolean;
  guardDepth: number;
  hasMarkerPatch: boolean; // For once() validation
  diagnostics: Diagnostic[];
}

function createContext(): ValidationContext {
  return {
    inAction: false,
    inGuard: false,
    guardDepth: 0,
    hasMarkerPatch: false,
    diagnostics: [],
  };
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

  /**
   * Validate a MEL program
   */
  validate(program: ProgramNode): ValidationResult {
    this.ctx = createContext();
    this.validateDomain(program.domain);

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
        case "computed":
          this.validateExpr(member.expression, "computed");
          break;
        case "action":
          this.validateAction(member);
          break;
      }
    }
  }

  private validateAction(action: ActionNode): void {
    this.ctx.inAction = true;

    // FDR-MEL-020: All patch/effect must be inside guards
    // Action body should only contain when/once statements
    for (const stmt of action.body) {
      this.validateGuardedStmt(stmt);
    }

    this.ctx.inAction = false;
  }

  private validateGuardedStmt(stmt: GuardedStmtNode | InnerStmtNode): void {
    switch (stmt.kind) {
      case "when":
        this.validateWhen(stmt);
        break;
      case "once":
        this.validateOnce(stmt);
        break;
      case "patch":
        this.validatePatch(stmt);
        break;
      case "effect":
        this.validateEffect(stmt);
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

  private validatePatch(stmt: PatchStmtNode): void {
    // Patch must be inside a guard
    if (!this.ctx.inGuard) {
      this.error(
        "Patch must be inside a guard (when or once)",
        stmt.location,
        "E_UNGUARDED_PATCH"
      );
    }

    // Validate value expression
    if (stmt.value) {
      this.validateExpr(stmt.value, "action");
    }
  }

  private validateEffect(stmt: EffectStmtNode): void {
    // Effect must be inside a guard
    if (!this.ctx.inGuard) {
      this.error(
        "Effect must be inside a guard (when or once)",
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

  private validateCondition(expr: ExprNode, guardType: "when" | "once"): void {
    // FDR-MEL-025: Condition must return boolean
    // We can do basic static analysis for obvious non-boolean expressions
    this.validateExpr(expr, "action");

    // Warn about literals that aren't boolean
    if (expr.kind === "literal" && typeof expr.value !== "boolean") {
      this.warn(
        `Condition in ${guardType} is a non-boolean literal. Consider using a boolean expression`,
        expr.location,
        "W_NON_BOOL_COND"
      );
    }
  }

  private validateExpr(expr: ExprNode, context: "computed" | "action"): void {
    switch (expr.kind) {
      case "functionCall":
        this.validateFunctionCall(expr, context);
        break;

      case "binary":
        this.validateExpr(expr.left, context);
        this.validateExpr(expr.right, context);
        break;

      case "unary":
        this.validateExpr(expr.operand, context);
        break;

      case "ternary":
        this.validateExpr(expr.condition, context);
        this.validateExpr(expr.consequent, context);
        this.validateExpr(expr.alternate, context);
        break;

      case "propertyAccess":
        this.validateExpr(expr.object, context);
        break;

      case "indexAccess":
        this.validateExpr(expr.object, context);
        this.validateExpr(expr.index, context);
        break;

      case "objectLiteral":
        for (const prop of expr.properties) {
          this.validateExpr(prop.value, context);
        }
        break;

      case "arrayLiteral":
        for (const elem of expr.elements) {
          this.validateExpr(elem, context);
        }
        break;

      case "systemIdent":
        // E001: $system.* in computed
        if (context === "computed" && expr.path[0] === "system") {
          this.error(
            "Cannot use $system.* in computed expressions (non-deterministic)",
            expr.location,
            "E001"
          );
        }
        break;
    }
  }

  private validateFunctionCall(
    expr: { kind: "functionCall"; name: string; args: ExprNode[]; location: SourceLocation },
    context: "computed" | "action"
  ): void {
    const { name, args, location } = expr;

    // Validate known function signatures
    switch (name) {
      // FDR-MEL-042: eq/neq on primitives only
      case "eq":
      case "neq":
        // We can't fully type-check at compile time, but we can note the requirement
        break;

      // FDR-MEL-026: len() on Array only
      case "len":
        if (args.length !== 1) {
          this.error(
            `Function 'len' expects 1 argument, got ${args.length}`,
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
      case "isNull":
      case "isNotNull":
      case "trim":
      case "lower":
      case "upper":
      case "keys":
      case "values":
      case "entries":
      case "first":
      case "last":
        if (args.length !== 1) {
          this.error(
            `Function '${name}' expects 1 argument, got ${args.length}`,
            location,
            "E_ARG_COUNT"
          );
        }
        break;

      // Collection predicates need exactly 2 args
      case "filter":
      case "map":
      case "find":
      case "every":
      case "some":
      case "at":
      case "includes":
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
        if (args.length < 1) {
          this.error(
            `Function '${name}' expects at least 1 argument`,
            location,
            "E_ARG_COUNT"
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
        // Unknown function - this might be caught by scope analysis
        // or could be a user-defined function we don't know about
        break;
    }

    // Recursively validate arguments
    for (const arg of args) {
      this.validateExpr(arg, context);
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
  return validator.validate(program);
}
