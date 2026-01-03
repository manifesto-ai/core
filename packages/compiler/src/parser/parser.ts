/**
 * MEL Parser
 * Recursive descent parser with Pratt parsing for expressions
 * Based on MEL SPEC v0.3.3 Section 4
 */

import type { Diagnostic } from "../diagnostics/types.js";
import type { Token, TokenKind } from "../lexer/tokens.js";
import { createLocation, mergeLocations, type SourceLocation } from "../lexer/source-location.js";
import {
  type ProgramNode,
  type DomainNode,
  type DomainMember,
  type TypeDeclNode,    // v0.3.3
  type StateNode,
  type StateFieldNode,
  type ComputedNode,
  type ActionNode,
  type ParamNode,
  type GuardedStmtNode,
  type InnerStmtNode,
  type WhenStmtNode,
  type OnceStmtNode,
  type PatchStmtNode,
  type EffectStmtNode,
  type EffectArgNode,
  type FailStmtNode,   // v0.3.2
  type StopStmtNode,   // v0.3.2
  type TypeExprNode,
  type ObjectTypeNode,   // v0.3.3
  type TypeFieldNode,    // v0.3.3
  type ExprNode,
  type PathNode,
  type PathSegmentNode,
  type ObjectPropertyNode,
} from "./ast.js";
import {
  Precedence,
  getBinaryPrecedence,
  tokenToBinaryOp,
  isRightAssociative,
} from "./precedence.js";

/**
 * Result of parsing
 */
export interface ParseResult {
  program: ProgramNode | null;
  diagnostics: Diagnostic[];
}

/**
 * Parser for MEL source code
 */
export class Parser {
  private tokens: Token[];
  private current = 0;
  private diagnostics: Diagnostic[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Parse tokens into an AST
   */
  parse(): ParseResult {
    try {
      const program = this.parseProgram();
      return { program, diagnostics: this.diagnostics };
    } catch (e) {
      // Unrecoverable error
      return { program: null, diagnostics: this.diagnostics };
    }
  }

  // ============ Program Structure ============

  private parseProgram(): ProgramNode {
    const start = this.peek().location;
    const imports: ProgramNode["imports"] = [];

    // Parse imports (if any)
    while (this.check("IMPORT")) {
      imports.push(this.parseImport());
    }

    // Parse domain
    const domain = this.parseDomain();

    return {
      kind: "program",
      imports,
      domain,
      location: mergeLocations(start, domain.location),
    };
  }

  private parseImport(): ProgramNode["imports"][0] {
    const start = this.consume("IMPORT", "Expected 'import'").location;
    this.consume("LBRACE", "Expected '{' after 'import'");

    const names: string[] = [];
    do {
      names.push(this.consume("IDENTIFIER", "Expected identifier").lexeme);
    } while (this.match("COMMA"));

    this.consume("RBRACE", "Expected '}' after import names");
    this.consume("FROM", "Expected 'from' after import names");
    const fromToken = this.consume("STRING", "Expected string after 'from'");

    return {
      kind: "import",
      names,
      from: fromToken.value as string,
      location: mergeLocations(start, fromToken.location),
    };
  }

  private parseDomain(): DomainNode {
    const start = this.consume("DOMAIN", "Expected 'domain'").location;
    const name = this.consume("IDENTIFIER", "Expected domain name").lexeme;
    this.consume("LBRACE", "Expected '{' after domain name");

    // v0.3.3: Parse type declarations first
    const types: TypeDeclNode[] = [];
    while (this.check("TYPE") && !this.isAtEnd()) {
      types.push(this.parseTypeDecl());
    }

    const members: DomainMember[] = [];
    while (!this.check("RBRACE") && !this.isAtEnd()) {
      // v0.3.3: type declarations can appear anywhere in domain
      if (this.check("TYPE")) {
        types.push(this.parseTypeDecl());
      } else {
        const member = this.parseDomainMember();
        if (member) members.push(member);
      }
    }

    const end = this.consume("RBRACE", "Expected '}' to close domain").location;

    return {
      kind: "domain",
      name,
      types,
      members,
      location: mergeLocations(start, end),
    };
  }

  /**
   * v0.3.3: Parse type declaration
   * Syntax: type Name = TypeExpr
   */
  private parseTypeDecl(): TypeDeclNode {
    const start = this.consume("TYPE", "Expected 'type'").location;
    const name = this.consume("IDENTIFIER", "Expected type name").lexeme;
    this.consume("EQ", "Expected '=' after type name");
    const typeExpr = this.parseTypeExpr();

    return {
      kind: "typeDecl",
      name,
      typeExpr,
      location: mergeLocations(start, typeExpr.location),
    };
  }

  private parseDomainMember(): DomainMember | null {
    if (this.check("STATE")) return this.parseState();
    if (this.check("COMPUTED")) return this.parseComputed();
    if (this.check("ACTION")) return this.parseAction();

    this.error(`Unexpected token '${this.peek().lexeme}'. Expected 'state', 'computed', or 'action'.`);
    this.advance(); // Skip the bad token
    return null;
  }

  // ============ State ============

  private parseState(): StateNode {
    const start = this.consume("STATE", "Expected 'state'").location;
    this.consume("LBRACE", "Expected '{' after 'state'");

    const fields: StateFieldNode[] = [];
    while (!this.check("RBRACE") && !this.isAtEnd()) {
      fields.push(this.parseStateField());
    }

    const end = this.consume("RBRACE", "Expected '}' to close state block").location;

    return {
      kind: "state",
      fields,
      location: mergeLocations(start, end),
    };
  }

  private parseStateField(): StateFieldNode {
    const nameToken = this.consume("IDENTIFIER", "Expected field name");
    this.consume("COLON", "Expected ':' after field name");
    const typeExpr = this.parseTypeExpr();

    let initializer: ExprNode | undefined;
    if (this.match("EQ")) {
      initializer = this.parseExpression();
    }

    return {
      kind: "stateField",
      name: nameToken.lexeme,
      typeExpr,
      initializer,
      location: mergeLocations(
        nameToken.location,
        initializer?.location ?? typeExpr.location
      ),
    };
  }

  // ============ Computed ============

  private parseComputed(): ComputedNode {
    const start = this.consume("COMPUTED", "Expected 'computed'").location;
    const name = this.consume("IDENTIFIER", "Expected computed name").lexeme;
    this.consume("EQ", "Expected '=' after computed name");
    const expression = this.parseExpression();

    return {
      kind: "computed",
      name,
      expression,
      location: mergeLocations(start, expression.location),
    };
  }

  // ============ Action ============

  private parseAction(): ActionNode {
    const start = this.consume("ACTION", "Expected 'action'").location;
    const name = this.consume("IDENTIFIER", "Expected action name").lexeme;
    this.consume("LPAREN", "Expected '(' after action name");

    const params: ParamNode[] = [];
    if (!this.check("RPAREN")) {
      do {
        params.push(this.parseParam());
      } while (this.match("COMMA"));
    }

    this.consume("RPAREN", "Expected ')' after parameters");

    // v0.3.2: Parse optional 'available when <Expr>'
    let available: ExprNode | undefined;
    if (this.match("AVAILABLE")) {
      this.consume("WHEN", "Expected 'when' after 'available'");
      available = this.parseExpression();
    }

    this.consume("LBRACE", "Expected '{' to start action body");

    const body: GuardedStmtNode[] = [];
    while (!this.check("RBRACE") && !this.isAtEnd()) {
      const stmt = this.parseGuardedStmt();
      if (stmt) body.push(stmt);
    }

    const end = this.consume("RBRACE", "Expected '}' to close action").location;

    return {
      kind: "action",
      name,
      params,
      available,
      body,
      location: mergeLocations(start, end),
    };
  }

  private parseParam(): ParamNode {
    const nameToken = this.consume("IDENTIFIER", "Expected parameter name");
    this.consume("COLON", "Expected ':' after parameter name");
    const typeExpr = this.parseTypeExpr();

    return {
      kind: "param",
      name: nameToken.lexeme,
      typeExpr,
      location: mergeLocations(nameToken.location, typeExpr.location),
    };
  }

  // ============ Statements ============

  private parseGuardedStmt(): GuardedStmtNode | null {
    if (this.check("WHEN")) return this.parseWhenStmt();
    if (this.check("ONCE")) return this.parseOnceStmt();

    this.error(`Unexpected token '${this.peek().lexeme}'. Expected 'when' or 'once'.`);
    this.advance();
    return null;
  }

  private parseWhenStmt(): WhenStmtNode {
    const start = this.consume("WHEN", "Expected 'when'").location;
    const condition = this.parseExpression();
    this.consume("LBRACE", "Expected '{' after when condition");

    const body: InnerStmtNode[] = [];
    while (!this.check("RBRACE") && !this.isAtEnd()) {
      const stmt = this.parseInnerStmt();
      if (stmt) body.push(stmt);
    }

    const end = this.consume("RBRACE", "Expected '}' to close when block").location;

    return {
      kind: "when",
      condition,
      body,
      location: mergeLocations(start, end),
    };
  }

  private parseOnceStmt(): OnceStmtNode {
    const start = this.consume("ONCE", "Expected 'once'").location;
    this.consume("LPAREN", "Expected '(' after 'once'");
    const marker = this.parsePath();
    this.consume("RPAREN", "Expected ')' after marker");

    let condition: ExprNode | undefined;
    if (this.match("WHEN")) {
      condition = this.parseExpression();
    }

    this.consume("LBRACE", "Expected '{' to start once block");

    const body: InnerStmtNode[] = [];
    while (!this.check("RBRACE") && !this.isAtEnd()) {
      const stmt = this.parseInnerStmt();
      if (stmt) body.push(stmt);
    }

    const end = this.consume("RBRACE", "Expected '}' to close once block").location;

    return {
      kind: "once",
      marker,
      condition,
      body,
      location: mergeLocations(start, end),
    };
  }

  private parseInnerStmt(): InnerStmtNode | null {
    if (this.check("PATCH")) return this.parsePatchStmt();
    if (this.check("EFFECT")) return this.parseEffectStmt();
    if (this.check("WHEN")) return this.parseWhenStmt();
    if (this.check("ONCE")) return this.parseOnceStmt();
    if (this.check("FAIL")) return this.parseFailStmt();     // v0.3.2
    if (this.check("STOP")) return this.parseStopStmt();     // v0.3.2

    this.error(`Unexpected token '${this.peek().lexeme}'. Expected 'patch', 'effect', 'when', 'once', 'fail', or 'stop'.`);
    this.advance();
    return null;
  }

  private parsePatchStmt(): PatchStmtNode {
    const start = this.consume("PATCH", "Expected 'patch'").location;
    const path = this.parsePath();

    let op: "set" | "unset" | "merge";
    let value: ExprNode | undefined;
    let end: SourceLocation;

    if (this.match("UNSET")) {
      op = "unset";
      end = this.previous().location;
    } else if (this.match("MERGE")) {
      op = "merge";
      value = this.parseExpression();
      end = value.location;
    } else {
      this.consume("EQ", "Expected '=', 'unset', or 'merge' after path");
      op = "set";
      value = this.parseExpression();
      end = value.location;
    }

    return {
      kind: "patch",
      path,
      op,
      value,
      location: mergeLocations(start, end),
    };
  }

  private parseEffectStmt(): EffectStmtNode {
    const start = this.consume("EFFECT", "Expected 'effect'").location;

    // Effect type: identifier.identifier...
    let effectType = this.consume("IDENTIFIER", "Expected effect type").lexeme;
    while (this.match("DOT")) {
      effectType += "." + this.consume("IDENTIFIER", "Expected identifier after '.'").lexeme;
    }

    this.consume("LPAREN", "Expected '(' after effect type");
    this.consume("LBRACE", "Expected '{' for effect arguments");

    const args: EffectArgNode[] = [];
    while (!this.check("RBRACE") && !this.isAtEnd()) {
      args.push(this.parseEffectArg());
      this.match("COMMA"); // Optional trailing comma
    }

    this.consume("RBRACE", "Expected '}' after effect arguments");
    const end = this.consume("RPAREN", "Expected ')' to close effect").location;

    return {
      kind: "effect",
      effectType,
      args,
      location: mergeLocations(start, end),
    };
  }

  private parseEffectArg(): EffectArgNode {
    const nameToken = this.consume("IDENTIFIER", "Expected argument name");
    this.consume("COLON", "Expected ':' after argument name");

    // 'into', 'pass', 'fail' are path arguments
    const isPath = ["into", "pass", "fail"].includes(nameToken.lexeme);
    const value = isPath ? this.parsePath() : this.parseExpression();

    return {
      kind: "effectArg",
      name: nameToken.lexeme,
      value,
      isPath,
      location: mergeLocations(nameToken.location, value.location),
    };
  }

  /**
   * v0.3.2: Parse fail statement
   * FailStmt ::= 'fail' StringLiteral ('with' Expr)?
   */
  private parseFailStmt(): FailStmtNode {
    const start = this.consume("FAIL", "Expected 'fail'").location;
    const codeToken = this.consume("STRING", "Expected error code string after 'fail'");
    const code = codeToken.value as string;

    let message: ExprNode | undefined;
    let end = codeToken.location;

    if (this.match("WITH")) {
      message = this.parseExpression();
      end = message.location;
    }

    return {
      kind: "fail",
      code,
      message,
      location: mergeLocations(start, end),
    };
  }

  /**
   * v0.3.2: Parse stop statement
   * StopStmt ::= 'stop' StringLiteral
   */
  private parseStopStmt(): StopStmtNode {
    const start = this.consume("STOP", "Expected 'stop'").location;
    const reasonToken = this.consume("STRING", "Expected reason string after 'stop'");
    const reason = reasonToken.value as string;

    return {
      kind: "stop",
      reason,
      location: mergeLocations(start, reasonToken.location),
    };
  }

  // ============ Types ============

  private parseTypeExpr(): TypeExprNode {
    let type = this.parseBaseType();

    // Union type: T | U | V
    if (this.check("PIPE")) {
      const types: TypeExprNode[] = [type];
      while (this.match("PIPE")) {
        types.push(this.parseBaseType());
      }
      type = {
        kind: "unionType",
        types,
        location: mergeLocations(types[0].location, types[types.length - 1].location),
      };
    }

    return type;
  }

  private parseBaseType(): TypeExprNode {
    // v0.3.3: Object type: { field: Type, ... }
    if (this.check("LBRACE")) {
      return this.parseObjectType();
    }

    // Literal types: "string" | 42 | true
    if (this.check("STRING")) {
      const token = this.advance();
      return {
        kind: "literalType",
        value: token.value as string,
        location: token.location,
      };
    }
    if (this.check("NUMBER")) {
      const token = this.advance();
      return {
        kind: "literalType",
        value: token.value as number,
        location: token.location,
      };
    }
    if (this.check("TRUE") || this.check("FALSE")) {
      const token = this.advance();
      return {
        kind: "literalType",
        value: token.kind === "TRUE",
        location: token.location,
      };
    }
    if (this.check("NULL")) {
      const token = this.advance();
      return {
        kind: "literalType",
        value: null,
        location: token.location,
      };
    }

    // Named type: Array<T>, Record<K, V>, or simple type
    const nameToken = this.consume("IDENTIFIER", "Expected type name");

    if (this.match("LT")) {
      // Generic type
      if (nameToken.lexeme === "Array") {
        const elementType = this.parseTypeExpr();
        const end = this.consume("GT", "Expected '>' after array element type").location;
        return {
          kind: "arrayType",
          elementType,
          location: mergeLocations(nameToken.location, end),
        };
      } else if (nameToken.lexeme === "Record") {
        const keyType = this.parseTypeExpr();
        this.consume("COMMA", "Expected ',' between Record type parameters");
        const valueType = this.parseTypeExpr();
        const end = this.consume("GT", "Expected '>' after Record value type").location;
        return {
          kind: "recordType",
          keyType,
          valueType,
          location: mergeLocations(nameToken.location, end),
        };
      } else {
        this.error(`Unknown generic type '${nameToken.lexeme}'`);
        // Consume until >
        while (!this.check("GT") && !this.isAtEnd()) this.advance();
        this.match("GT");
      }
    }

    return {
      kind: "simpleType",
      name: nameToken.lexeme,
      location: nameToken.location,
    };
  }

  /**
   * v0.3.3: Parse object type
   * Syntax: { field: Type, field?: Type, ... }
   */
  private parseObjectType(): ObjectTypeNode {
    const start = this.consume("LBRACE", "Expected '{'").location;
    const fields: TypeFieldNode[] = [];

    while (!this.check("RBRACE") && !this.isAtEnd()) {
      const nameToken = this.consume("IDENTIFIER", "Expected field name");
      const optional = this.match("QUESTION");
      this.consume("COLON", "Expected ':' after field name");
      const typeExpr = this.parseTypeExpr();

      fields.push({
        kind: "typeField",
        name: nameToken.lexeme,
        typeExpr,
        optional,
        location: mergeLocations(nameToken.location, typeExpr.location),
      });

      // Optional comma between fields
      this.match("COMMA");
    }

    const end = this.consume("RBRACE", "Expected '}' to close object type").location;

    return {
      kind: "objectType",
      fields,
      location: mergeLocations(start, end),
    };
  }

  // ============ Expressions (Pratt Parser) ============

  private parseExpression(minPrecedence: Precedence = Precedence.NONE): ExprNode {
    let left = this.parsePrimary();

    while (true) {
      const precedence = getBinaryPrecedence(this.peek().kind);
      if (precedence <= minPrecedence) break;

      // Handle ternary specially
      if (this.peek().kind === "QUESTION") {
        left = this.parseTernary(left);
        continue;
      }

      const op = tokenToBinaryOp(this.peek().kind);
      if (!op) break;

      this.advance(); // Consume operator
      const nextPrecedence = isRightAssociative(this.previous().kind)
        ? precedence - 1
        : precedence;
      const right = this.parseExpression(nextPrecedence);

      left = {
        kind: "binary",
        operator: op,
        left,
        right,
        location: mergeLocations(left.location, right.location),
      };
    }

    return left;
  }

  private parseTernary(condition: ExprNode): ExprNode {
    this.consume("QUESTION", "Expected '?'");
    const consequent = this.parseExpression();
    this.consume("COLON", "Expected ':' in ternary expression");
    const alternate = this.parseExpression(Precedence.TERNARY - 1);

    return {
      kind: "ternary",
      condition,
      consequent,
      alternate,
      location: mergeLocations(condition.location, alternate.location),
    };
  }

  private parsePrimary(): ExprNode {
    // Unary operators
    if (this.check("BANG") || (this.check("MINUS") && this.isUnaryContext())) {
      const op = this.advance();
      const operand = this.parsePrimary();
      return {
        kind: "unary",
        operator: op.kind === "BANG" ? "!" : "-",
        operand,
        location: mergeLocations(op.location, operand.location),
      };
    }

    // Grouping
    if (this.match("LPAREN")) {
      const expr = this.parseExpression();
      this.consume("RPAREN", "Expected ')' after expression");
      return expr;
    }

    // Object literal
    if (this.check("LBRACE")) {
      return this.parseObjectLiteral();
    }

    // Array literal
    if (this.check("LBRACKET")) {
      return this.parseArrayLiteral();
    }

    // Literals
    if (this.check("NUMBER")) {
      const token = this.advance();
      return {
        kind: "literal",
        value: token.value,
        literalType: "number",
        location: token.location,
      };
    }

    if (this.check("STRING")) {
      const token = this.advance();
      return {
        kind: "literal",
        value: token.value,
        literalType: "string",
        location: token.location,
      };
    }

    if (this.check("TRUE") || this.check("FALSE")) {
      const token = this.advance();
      return {
        kind: "literal",
        value: token.kind === "TRUE",
        literalType: "boolean",
        location: token.location,
      };
    }

    if (this.check("NULL")) {
      const token = this.advance();
      return {
        kind: "literal",
        value: null,
        literalType: "null",
        location: token.location,
      };
    }

    // System identifiers
    if (this.check("SYSTEM_IDENT")) {
      const token = this.advance();
      // Parse $system.uuid → ["system", "uuid"]
      const path = token.lexeme.slice(1).split(".");
      return this.parsePostfix({
        kind: "systemIdent",
        path,
        location: token.location,
      });
    }

    // v0.3.2: $acc removed - reduce pattern deprecated
    if (this.check("ITEM")) {
      const token = this.advance();
      return this.parsePostfix({
        kind: "iterationVar",
        name: "item",
        location: token.location,
      });
    }

    // Identifier or function call
    if (this.check("IDENTIFIER")) {
      const token = this.advance();

      // Function call
      if (this.check("LPAREN")) {
        return this.parseFunctionCall(token);
      }

      // Plain identifier
      return this.parsePostfix({
        kind: "identifier",
        name: token.lexeme,
        location: token.location,
      });
    }

    this.error(`Unexpected token '${this.peek().lexeme}'`);
    return {
      kind: "literal",
      value: null,
      literalType: "null",
      location: this.peek().location,
    };
  }

  private parseFunctionCall(nameToken: Token): ExprNode {
    this.consume("LPAREN", "Expected '(' for function call");

    const args: ExprNode[] = [];
    if (!this.check("RPAREN")) {
      do {
        args.push(this.parseExpression());
      } while (this.match("COMMA"));
    }

    const end = this.consume("RPAREN", "Expected ')' after arguments").location;

    return this.parsePostfix({
      kind: "functionCall",
      name: nameToken.lexeme,
      args,
      location: mergeLocations(nameToken.location, end),
    });
  }

  private parsePostfix(expr: ExprNode): ExprNode {
    while (true) {
      if (this.match("DOT")) {
        const prop = this.consume("IDENTIFIER", "Expected property name after '.'");
        expr = {
          kind: "propertyAccess",
          object: expr,
          property: prop.lexeme,
          location: mergeLocations(expr.location, prop.location),
        };
      } else if (this.match("LBRACKET")) {
        const index = this.parseExpression();
        const end = this.consume("RBRACKET", "Expected ']' after index").location;
        expr = {
          kind: "indexAccess",
          object: expr,
          index,
          location: mergeLocations(expr.location, end),
        };
      } else {
        break;
      }
    }
    return expr;
  }

  private parseObjectLiteral(): ExprNode {
    const start = this.consume("LBRACE", "Expected '{'").location;
    const properties: ObjectPropertyNode[] = [];

    while (!this.check("RBRACE") && !this.isAtEnd()) {
      const keyToken = this.consume("IDENTIFIER", "Expected property name");
      this.consume("COLON", "Expected ':' after property name");
      const value = this.parseExpression();

      properties.push({
        kind: "objectProperty",
        key: keyToken.lexeme,
        value,
        location: mergeLocations(keyToken.location, value.location),
      });

      if (!this.check("RBRACE")) {
        this.consume("COMMA", "Expected ',' between properties");
      }
    }

    const end = this.consume("RBRACE", "Expected '}' to close object").location;

    return {
      kind: "objectLiteral",
      properties,
      location: mergeLocations(start, end),
    };
  }

  private parseArrayLiteral(): ExprNode {
    const start = this.consume("LBRACKET", "Expected '['").location;
    const elements: ExprNode[] = [];

    while (!this.check("RBRACKET") && !this.isAtEnd()) {
      elements.push(this.parseExpression());
      if (!this.check("RBRACKET")) {
        this.consume("COMMA", "Expected ',' between elements");
      }
    }

    const end = this.consume("RBRACKET", "Expected ']' to close array").location;

    return {
      kind: "arrayLiteral",
      elements,
      location: mergeLocations(start, end),
    };
  }

  // ============ Path ============

  private parsePath(): PathNode {
    const segments: PathSegmentNode[] = [];
    const start = this.peek().location;

    // First segment must be identifier
    const first = this.consume("IDENTIFIER", "Expected identifier");
    segments.push({
      kind: "propertySegment",
      name: first.lexeme,
      location: first.location,
    });

    // Subsequent segments: .prop or [index]
    while (true) {
      if (this.match("DOT")) {
        const prop = this.consume("IDENTIFIER", "Expected property name");
        segments.push({
          kind: "propertySegment",
          name: prop.lexeme,
          location: prop.location,
        });
      } else if (this.match("LBRACKET")) {
        const index = this.parseExpression();
        const end = this.consume("RBRACKET", "Expected ']'").location;
        segments.push({
          kind: "indexSegment",
          index,
          location: mergeLocations(index.location, end),
        });
      } else {
        break;
      }
    }

    const last = segments[segments.length - 1];
    return {
      kind: "path",
      segments,
      location: mergeLocations(start, last.location),
    };
  }

  // ============ Helpers ============

  private isUnaryContext(): boolean {
    // Minus is unary at start of expression or after operators
    if (this.current === 0) return true;
    const prev = this.previous();
    const unaryPrecedingTokens: TokenKind[] = [
      "LPAREN", "LBRACKET", "LBRACE", "COMMA", "COLON", "EQ",
      "PLUS", "MINUS", "STAR", "SLASH", "PERCENT",
      "EQ_EQ", "BANG_EQ", "LT", "LT_EQ", "GT", "GT_EQ",
      "AMP_AMP", "PIPE_PIPE", "BANG", "QUESTION", "QUESTION_QUESTION",
    ];
    return unaryPrecedingTokens.includes(prev.kind);
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.peek().kind === "EOF";
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private check(kind: TokenKind): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().kind === kind;
  }

  private match(...kinds: TokenKind[]): boolean {
    for (const kind of kinds) {
      if (this.check(kind)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(kind: TokenKind, message: string): Token {
    if (this.check(kind)) return this.advance();
    throw this.errorAtCurrent(message);
  }

  private error(message: string): void {
    this.diagnostics.push({
      severity: "error",
      code: "MEL_PARSER",
      message,
      location: this.previous().location,
    });
  }

  private errorAtCurrent(message: string): Error {
    this.diagnostics.push({
      severity: "error",
      code: "MEL_PARSER",
      message,
      location: this.peek().location,
    });
    return new Error(message);
  }
}

/**
 * Parse tokens into an AST
 */
export function parse(tokens: Token[]): ParseResult {
  const parser = new Parser(tokens);
  return parser.parse();
}
