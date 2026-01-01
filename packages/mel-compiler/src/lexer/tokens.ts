/**
 * Token Types for MEL Lexer
 * Based on MEL SPEC v0.3.2 Section 3
 */

import type { SourceLocation } from "./source-location.js";

/**
 * All token kinds in MEL
 */
export type TokenKind =
  // Keywords
  | "DOMAIN"
  | "STATE"
  | "COMPUTED"
  | "ACTION"
  | "EFFECT"
  | "WHEN"
  | "ONCE"
  | "PATCH"
  | "UNSET"
  | "MERGE"
  | "TRUE"
  | "FALSE"
  | "NULL"
  | "AS"
  | "AVAILABLE"   // v0.3.2
  | "FAIL"        // v0.3.2
  | "STOP"        // v0.3.2
  | "WITH"        // v0.3.2
  | "IMPORT"
  | "FROM"
  | "EXPORT"
  // Operators
  | "PLUS" // +
  | "MINUS" // -
  | "STAR" // *
  | "SLASH" // /
  | "PERCENT" // %
  | "EQ_EQ" // ==
  | "BANG_EQ" // !=
  | "LT" // <
  | "LT_EQ" // <=
  | "GT" // >
  | "GT_EQ" // >=
  | "AMP_AMP" // &&
  | "PIPE_PIPE" // ||
  | "BANG" // !
  | "QUESTION_QUESTION" // ??
  | "QUESTION" // ?
  | "COLON" // :
  | "EQ" // =
  // Delimiters
  | "LPAREN" // (
  | "RPAREN" // )
  | "LBRACE" // {
  | "RBRACE" // }
  | "LBRACKET" // [
  | "RBRACKET" // ]
  | "COMMA" // ,
  | "SEMICOLON" // ;
  | "DOT" // .
  | "PIPE" // |
  // Literals
  | "NUMBER"
  | "STRING"
  | "IDENTIFIER"
  // System identifiers (reserved)
  | "SYSTEM_IDENT" // $system.*, $meta.*, $input.*
  | "ITEM" // $item
  // v0.3.2: ACC removed - reduce pattern deprecated
  // Special
  | "EOF"
  | "ERROR";

/**
 * A token produced by the lexer
 */
export interface Token {
  kind: TokenKind;
  /** The raw text of the token */
  lexeme: string;
  /** Parsed value for literals */
  value?: unknown;
  /** Location in source */
  location: SourceLocation;
}

/**
 * Keywords lookup table
 */
export const KEYWORDS: Record<string, TokenKind> = {
  domain: "DOMAIN",
  state: "STATE",
  computed: "COMPUTED",
  action: "ACTION",
  effect: "EFFECT",
  when: "WHEN",
  once: "ONCE",
  patch: "PATCH",
  unset: "UNSET",
  merge: "MERGE",
  true: "TRUE",
  false: "FALSE",
  null: "NULL",
  as: "AS",
  available: "AVAILABLE",  // v0.3.2
  fail: "FAIL",            // v0.3.2
  stop: "STOP",            // v0.3.2
  with: "WITH",            // v0.3.2
  import: "IMPORT",
  from: "FROM",
  export: "EXPORT",
};

/**
 * Reserved keywords (JS keywords that are forbidden in MEL)
 */
export const RESERVED_KEYWORDS = new Set([
  // Control flow (forbidden)
  "function", "var", "let", "const", "if", "else",
  "for", "while", "do", "switch", "case", "break",
  "continue", "return", "throw", "try", "catch", "finally",
  "new", "delete", "typeof", "instanceof", "void",
  // NOTE: "with" removed - now a MEL keyword in v0.3.2
  "debugger", "this", "super", "arguments", "eval",
  // Reserved for future
  "async", "await", "yield", "class", "extends",
  "interface", "type", "enum", "namespace", "module",
]);

/**
 * Check if a token is a keyword
 */
export function isKeyword(lexeme: string): boolean {
  return lexeme in KEYWORDS;
}

/**
 * Check if a token is a reserved word
 */
export function isReserved(lexeme: string): boolean {
  return RESERVED_KEYWORDS.has(lexeme);
}

/**
 * Get keyword token kind, or undefined if not a keyword
 * Note: Uses Object.hasOwn to avoid prototype pollution (e.g., "toString")
 */
export function getKeywordKind(lexeme: string): TokenKind | undefined {
  return Object.hasOwn(KEYWORDS, lexeme) ? KEYWORDS[lexeme] : undefined;
}

/**
 * Create a token
 */
export function createToken(
  kind: TokenKind,
  lexeme: string,
  location: SourceLocation,
  value?: unknown
): Token {
  return { kind, lexeme, location, value };
}
