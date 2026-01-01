/**
 * Operator Precedence for MEL Parser
 * Based on MEL SPEC v0.3.1 Section 4.9
 */

import type { TokenKind } from "../lexer/tokens.js";
import type { BinaryOperator } from "./ast.js";

/**
 * Precedence levels (higher = binds tighter)
 */
export const enum Precedence {
  NONE = 0,
  TERNARY = 1,      // ? :
  NULLISH = 2,      // ??
  OR = 3,           // ||
  AND = 4,          // &&
  EQUALITY = 5,     // == !=
  COMPARISON = 6,   // < <= > >=
  ADDITIVE = 7,     // + -
  MULTIPLICATIVE = 8, // * / %
  UNARY = 9,        // ! -
  CALL = 10,        // ()
  ACCESS = 11,      // . []
}

/**
 * Get the precedence of a binary operator token
 */
export function getBinaryPrecedence(kind: TokenKind): Precedence {
  switch (kind) {
    case "QUESTION": return Precedence.TERNARY;
    case "QUESTION_QUESTION": return Precedence.NULLISH;
    case "PIPE_PIPE": return Precedence.OR;
    case "AMP_AMP": return Precedence.AND;
    case "EQ_EQ":
    case "BANG_EQ": return Precedence.EQUALITY;
    case "LT":
    case "LT_EQ":
    case "GT":
    case "GT_EQ": return Precedence.COMPARISON;
    case "PLUS":
    case "MINUS": return Precedence.ADDITIVE;
    case "STAR":
    case "SLASH":
    case "PERCENT": return Precedence.MULTIPLICATIVE;
    default: return Precedence.NONE;
  }
}

/**
 * Map token kind to binary operator
 */
export function tokenToBinaryOp(kind: TokenKind): BinaryOperator | null {
  switch (kind) {
    case "PLUS": return "+";
    case "MINUS": return "-";
    case "STAR": return "*";
    case "SLASH": return "/";
    case "PERCENT": return "%";
    case "EQ_EQ": return "==";
    case "BANG_EQ": return "!=";
    case "LT": return "<";
    case "LT_EQ": return "<=";
    case "GT": return ">";
    case "GT_EQ": return ">=";
    case "AMP_AMP": return "&&";
    case "PIPE_PIPE": return "||";
    case "QUESTION_QUESTION": return "??";
    default: return null;
  }
}

/**
 * Check if a token is a binary operator
 */
export function isBinaryOp(kind: TokenKind): boolean {
  return getBinaryPrecedence(kind) !== Precedence.NONE;
}

/**
 * Check if a token is a unary operator
 */
export function isUnaryOp(kind: TokenKind): boolean {
  return kind === "BANG" || kind === "MINUS";
}

/**
 * Check if operators are right-associative
 */
export function isRightAssociative(kind: TokenKind): boolean {
  // Ternary and nullish are right-associative
  return kind === "QUESTION" || kind === "QUESTION_QUESTION";
}
