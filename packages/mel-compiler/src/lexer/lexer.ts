/**
 * MEL Lexer
 * Tokenizes MEL source code based on SPEC v0.3.1 Section 3
 */

import type { Diagnostic } from "../diagnostics/types.js";
import { createPosition, createLocation, type Position, type SourceLocation } from "./source-location.js";
import {
  type Token,
  type TokenKind,
  createToken,
  getKeywordKind,
  isReserved,
} from "./tokens.js";

/**
 * Result of lexical analysis
 */
export interface LexResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

/**
 * Lexer for MEL source code
 */
export class Lexer {
  private source: string;
  private sourcePath?: string;
  private tokens: Token[] = [];
  private diagnostics: Diagnostic[] = [];

  // Current position
  private start = 0; // Start of current token
  private current = 0; // Current character
  private line = 1;
  private column = 1;
  private lineStart = 0; // Offset of current line start

  constructor(source: string, sourcePath?: string) {
    this.source = source;
    this.sourcePath = sourcePath;
  }

  /**
   * Tokenize the source code
   */
  tokenize(): LexResult {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.scanToken();
    }

    // Add EOF token
    this.tokens.push(
      createToken("EOF", "", this.currentLocation())
    );

    return {
      tokens: this.tokens,
      diagnostics: this.diagnostics,
    };
  }

  private scanToken(): void {
    const c = this.advance();

    switch (c) {
      // Single-character tokens
      case "(": this.addToken("LPAREN"); break;
      case ")": this.addToken("RPAREN"); break;
      case "{": this.addToken("LBRACE"); break;
      case "}": this.addToken("RBRACE"); break;
      case "[": this.addToken("LBRACKET"); break;
      case "]": this.addToken("RBRACKET"); break;
      case ",": this.addToken("COMMA"); break;
      case ";": this.addToken("SEMICOLON"); break;
      case ".": this.addToken("DOT"); break;
      case "+": this.addToken("PLUS"); break;
      case "-": this.addToken("MINUS"); break;
      case "*": this.addToken("STAR"); break;
      case "%": this.addToken("PERCENT"); break;
      case ":": this.addToken("COLON"); break;

      // Two-character tokens
      case "=":
        this.addToken(this.match("=") ? "EQ_EQ" : "EQ");
        break;
      case "!":
        this.addToken(this.match("=") ? "BANG_EQ" : "BANG");
        break;
      case "<":
        this.addToken(this.match("=") ? "LT_EQ" : "LT");
        break;
      case ">":
        this.addToken(this.match("=") ? "GT_EQ" : "GT");
        break;
      case "&":
        if (this.match("&")) {
          this.addToken("AMP_AMP");
        } else {
          this.error("Expected '&&' for logical AND");
        }
        break;
      case "|":
        if (this.match("|")) {
          this.addToken("PIPE_PIPE");
        } else {
          this.addToken("PIPE");
        }
        break;
      case "?":
        this.addToken(this.match("?") ? "QUESTION_QUESTION" : "QUESTION");
        break;

      // Slash or comment
      case "/":
        if (this.match("/")) {
          this.lineComment();
        } else if (this.match("*")) {
          this.blockComment();
        } else {
          this.addToken("SLASH");
        }
        break;

      // Whitespace
      case " ":
      case "\r":
      case "\t":
        // Ignore whitespace
        break;
      case "\n":
        this.newline();
        break;

      // String literals
      case '"':
        this.string('"');
        break;
      case "'":
        this.string("'");
        break;

      // System identifiers ($...)
      case "$":
        this.systemIdentifier();
        break;

      default:
        if (this.isDigit(c)) {
          this.number();
        } else if (this.isAlpha(c)) {
          this.identifier();
        } else {
          this.error(`Unexpected character '${c}'`);
        }
    }
  }

  // ============ Token Scanners ============

  private lineComment(): void {
    // Skip until end of line
    while (this.peek() !== "\n" && !this.isAtEnd()) {
      this.advance();
    }
  }

  private blockComment(): void {
    const startLine = this.line;
    const startColumn = this.column - 2; // Account for /*

    while (!this.isAtEnd()) {
      if (this.peek() === "*" && this.peekNext() === "/") {
        this.advance(); // *
        this.advance(); // /
        return;
      }
      if (this.peek() === "\n") {
        this.newline();
      }
      this.advance();
    }

    // Unterminated block comment
    this.error(`Unterminated block comment starting at line ${startLine}:${startColumn}`);
  }

  private string(quote: string): void {
    const startLine = this.line;
    const startColumn = this.column - 1;
    let value = "";

    while (this.peek() !== quote && !this.isAtEnd()) {
      if (this.peek() === "\n") {
        this.error("Unterminated string literal");
        return;
      }

      if (this.peek() === "\\") {
        this.advance(); // Skip backslash
        const escaped = this.advance();
        switch (escaped) {
          case "n": value += "\n"; break;
          case "r": value += "\r"; break;
          case "t": value += "\t"; break;
          case "\\": value += "\\"; break;
          case "'": value += "'"; break;
          case '"': value += '"'; break;
          case "0": value += "\0"; break;
          default:
            this.error(`Invalid escape sequence '\\${escaped}'`);
            value += escaped;
        }
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      this.error(`Unterminated string starting at line ${startLine}:${startColumn}`);
      return;
    }

    // Closing quote
    this.advance();
    this.addToken("STRING", value);
  }

  private number(): void {
    // Check for hex
    if (this.source[this.start] === "0" && (this.peek() === "x" || this.peek() === "X")) {
      this.advance(); // x
      while (this.isHexDigit(this.peek())) {
        this.advance();
      }
      const hexStr = this.source.slice(this.start + 2, this.current);
      const value = parseInt(hexStr, 16);
      this.addToken("NUMBER", value);
      return;
    }

    // Decimal part
    while (this.isDigit(this.peek())) {
      this.advance();
    }

    // Fractional part
    if (this.peek() === "." && this.isDigit(this.peekNext())) {
      this.advance(); // .
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }

    // Exponent part
    if (this.peek() === "e" || this.peek() === "E") {
      this.advance();
      if (this.peek() === "+" || this.peek() === "-") {
        this.advance();
      }
      if (!this.isDigit(this.peek())) {
        this.error("Invalid number: expected digits after exponent");
        return;
      }
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }

    const value = parseFloat(this.source.slice(this.start, this.current));
    this.addToken("NUMBER", value);
  }

  private identifier(): void {
    while (this.isAlphaNumeric(this.peek())) {
      // Check for $ in middle of identifier (forbidden by A17)
      if (this.peek() === "$") {
        this.advance();
        this.error("'$' is forbidden in identifiers (MEL A17)");
        continue;
      }
      this.advance();
    }

    const lexeme = this.source.slice(this.start, this.current);

    // Check for __sys__ prefix (reserved for compiler, A26)
    if (lexeme.startsWith("__sys__")) {
      this.error("'__sys__' prefix is reserved for compiler-generated identifiers (MEL A26)");
      this.addToken("ERROR");
      return;
    }

    // Check for reserved words
    if (isReserved(lexeme)) {
      this.error(`'${lexeme}' is a reserved keyword and cannot be used`);
      this.addToken("ERROR");
      return;
    }

    // Check if keyword
    const keywordKind = getKeywordKind(lexeme);
    if (keywordKind) {
      this.addToken(keywordKind);
    } else {
      this.addToken("IDENTIFIER");
    }
  }

  private systemIdentifier(): void {
    // $system.*, $meta.*, $input.*, $item
    // v0.3.2: $acc removed - reduce pattern deprecated
    if (!this.isAlpha(this.peek())) {
      this.error("Expected identifier after '$'");
      this.addToken("ERROR");
      return;
    }

    // First, read only the initial identifier part (no dots)
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }

    const initialLexeme = this.source.slice(this.start, this.current);

    // Special case: $item is an iteration variable
    // It should NOT consume the dot, allowing property access to be parsed separately
    if (initialLexeme === "$item") {
      this.addToken("ITEM");
      return;
    }

    // For $system, $meta, $input - continue reading dot-separated path
    if (initialLexeme === "$system" || initialLexeme === "$meta" || initialLexeme === "$input") {
      // Read any following .identifier segments
      while (this.peek() === "." && this.isAlpha(this.peekNext())) {
        this.advance(); // consume .
        while (this.isAlphaNumeric(this.peek())) {
          this.advance();
        }
      }
      this.addToken("SYSTEM_IDENT");
      return;
    }

    // Invalid system identifier
    this.error(`Invalid system identifier '${initialLexeme}'. Expected $system.*, $meta.*, $input.*, or $item`);
    this.addToken("ERROR");
  }

  // ============ Helpers ============

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private advance(): string {
    const c = this.source[this.current];
    this.current++;
    this.column++;
    return c;
  }

  private peek(): string {
    if (this.isAtEnd()) return "\0";
    return this.source[this.current];
  }

  private peekNext(): string {
    if (this.current + 1 >= this.source.length) return "\0";
    return this.source[this.current + 1];
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source[this.current] !== expected) return false;
    this.current++;
    this.column++;
    return true;
  }

  private newline(): void {
    this.line++;
    this.column = 1;
    this.lineStart = this.current;
  }

  private isDigit(c: string): boolean {
    return c >= "0" && c <= "9";
  }

  private isHexDigit(c: string): boolean {
    return this.isDigit(c) || (c >= "a" && c <= "f") || (c >= "A" && c <= "F");
  }

  private isAlpha(c: string): boolean {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  private currentLocation(): SourceLocation {
    const startPos = this.positionAt(this.start);
    const endPos = this.positionAt(this.current);
    return createLocation(startPos, endPos, this.sourcePath);
  }

  private positionAt(offset: number): Position {
    // Calculate line and column for the given offset
    let line = 1;
    let lineStart = 0;
    for (let i = 0; i < offset; i++) {
      if (this.source[i] === "\n") {
        line++;
        lineStart = i + 1;
      }
    }
    return createPosition(line, offset - lineStart + 1, offset);
  }

  private addToken(kind: TokenKind, value?: unknown): void {
    const lexeme = this.source.slice(this.start, this.current);
    this.tokens.push(createToken(kind, lexeme, this.currentLocation(), value));
  }

  private error(message: string): void {
    const location = this.currentLocation();
    this.diagnostics.push({
      severity: "error",
      code: "MEL_LEXER",
      message,
      location,
      source: this.getSourceLine(location.start.line),
    });
  }

  private getSourceLine(lineNumber: number): string {
    const lines = this.source.split("\n");
    return lines[lineNumber - 1] ?? "";
  }
}

/**
 * Tokenize MEL source code
 */
export function tokenize(source: string, sourcePath?: string): LexResult {
  const lexer = new Lexer(source, sourcePath);
  return lexer.tokenize();
}
