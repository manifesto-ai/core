import { describe, it, expect } from "vitest";
import { tokenize, type Token } from "../../src/lexer/index.js";

describe("Lexer", () => {
  describe("keywords", () => {
    it("tokenizes MEL keywords", () => {
      const { tokens } = tokenize("domain state computed action effect when once patch unset merge");
      const kinds = tokens.map((t) => t.kind);
      expect(kinds).toEqual([
        "DOMAIN", "STATE", "COMPUTED", "ACTION", "EFFECT",
        "WHEN", "ONCE", "PATCH", "UNSET", "MERGE", "EOF"
      ]);
    });

    it("tokenizes boolean and null literals", () => {
      const { tokens } = tokenize("true false null");
      expect(tokens.map((t) => t.kind)).toEqual(["TRUE", "FALSE", "NULL", "EOF"]);
    });

    it("tokenizes v0.3.2 keywords (available, fail, stop, with)", () => {
      const { tokens } = tokenize("available fail stop with");
      expect(tokens.map((t) => t.kind)).toEqual([
        "AVAILABLE", "FAIL", "STOP", "WITH", "EOF"
      ]);
    });
  });

  describe("operators", () => {
    it("tokenizes arithmetic operators", () => {
      const { tokens } = tokenize("+ - * / %");
      expect(tokens.map((t) => t.kind)).toEqual([
        "PLUS", "MINUS", "STAR", "SLASH", "PERCENT", "EOF"
      ]);
    });

    it("tokenizes comparison operators", () => {
      const { tokens } = tokenize("== != < <= > >=");
      expect(tokens.map((t) => t.kind)).toEqual([
        "EQ_EQ", "BANG_EQ", "LT", "LT_EQ", "GT", "GT_EQ", "EOF"
      ]);
    });

    it("tokenizes logical operators", () => {
      const { tokens } = tokenize("&& || !");
      expect(tokens.map((t) => t.kind)).toEqual([
        "AMP_AMP", "PIPE_PIPE", "BANG", "EOF"
      ]);
    });

    it("tokenizes nullish and ternary operators", () => {
      const { tokens } = tokenize("?? ? :");
      expect(tokens.map((t) => t.kind)).toEqual([
        "QUESTION_QUESTION", "QUESTION", "COLON", "EOF"
      ]);
    });

    it("tokenizes assignment operator", () => {
      const { tokens } = tokenize("=");
      expect(tokens.map((t) => t.kind)).toEqual(["EQ", "EOF"]);
    });
  });

  describe("delimiters", () => {
    it("tokenizes brackets and braces", () => {
      const { tokens } = tokenize("( ) { } [ ]");
      expect(tokens.map((t) => t.kind)).toEqual([
        "LPAREN", "RPAREN", "LBRACE", "RBRACE", "LBRACKET", "RBRACKET", "EOF"
      ]);
    });

    it("tokenizes separators", () => {
      const { tokens } = tokenize(", ; .");
      expect(tokens.map((t) => t.kind)).toEqual([
        "COMMA", "SEMICOLON", "DOT", "EOF"
      ]);
    });
  });

  describe("literals", () => {
    it("tokenizes integer numbers", () => {
      const { tokens } = tokenize("42 0 123");
      expect(tokens.filter((t) => t.kind === "NUMBER").map((t) => t.value)).toEqual([42, 0, 123]);
    });

    it("tokenizes decimal numbers", () => {
      const { tokens } = tokenize("3.14 0.5 10.0");
      expect(tokens.filter((t) => t.kind === "NUMBER").map((t) => t.value)).toEqual([3.14, 0.5, 10.0]);
    });

    it("tokenizes hex numbers", () => {
      const { tokens } = tokenize("0xFF 0x10");
      expect(tokens.filter((t) => t.kind === "NUMBER").map((t) => t.value)).toEqual([255, 16]);
    });

    it("tokenizes scientific notation", () => {
      const { tokens } = tokenize("1e10 2.5e-3 3E+2");
      expect(tokens.filter((t) => t.kind === "NUMBER").map((t) => t.value)).toEqual([1e10, 2.5e-3, 3e2]);
    });

    it("tokenizes double-quoted strings", () => {
      const { tokens } = tokenize('"hello" "world"');
      expect(tokens.filter((t) => t.kind === "STRING").map((t) => t.value)).toEqual(["hello", "world"]);
    });

    it("tokenizes single-quoted strings", () => {
      const { tokens } = tokenize("'hello' 'world'");
      expect(tokens.filter((t) => t.kind === "STRING").map((t) => t.value)).toEqual(["hello", "world"]);
    });

    it("handles escape sequences in strings", () => {
      const { tokens } = tokenize('"hello\\nworld" "tab\\there"');
      expect(tokens.filter((t) => t.kind === "STRING").map((t) => t.value)).toEqual([
        "hello\nworld", "tab\there"
      ]);
    });
  });

  describe("identifiers", () => {
    it("tokenizes valid identifiers", () => {
      const { tokens } = tokenize("foo bar_baz camelCase PascalCase _private");
      expect(tokens.filter((t) => t.kind === "IDENTIFIER").map((t) => t.lexeme)).toEqual([
        "foo", "bar_baz", "camelCase", "PascalCase", "_private"
      ]);
    });
  });

  describe("system identifiers", () => {
    // v0.3.2: $acc removed - reduce pattern deprecated
    it("tokenizes $item", () => {
      const { tokens } = tokenize("$item");
      expect(tokens.map((t) => t.kind)).toEqual(["ITEM", "EOF"]);
    });

    it("rejects $acc (v0.3.2 deprecated)", () => {
      const { tokens, diagnostics } = tokenize("$acc");
      // $acc is now an invalid system identifier
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(tokens.some((t) => t.kind === "ERROR")).toBe(true);
    });

    it("tokenizes $system.* identifiers", () => {
      const { tokens } = tokenize("$system.uuid $system.time.now");
      expect(tokens.map((t) => t.kind)).toEqual(["SYSTEM_IDENT", "SYSTEM_IDENT", "EOF"]);
      expect(tokens[0].lexeme).toBe("$system.uuid");
      expect(tokens[1].lexeme).toBe("$system.time.now");
    });

    it("tokenizes $meta.* identifiers", () => {
      const { tokens } = tokenize("$meta.intentId $meta.actor");
      expect(tokens.map((t) => t.kind)).toEqual(["SYSTEM_IDENT", "SYSTEM_IDENT", "EOF"]);
    });

    it("tokenizes $input.* identifiers", () => {
      const { tokens } = tokenize("$input.title $input.data");
      expect(tokens.map((t) => t.kind)).toEqual(["SYSTEM_IDENT", "SYSTEM_IDENT", "EOF"]);
    });
  });

  describe("comments", () => {
    it("ignores line comments", () => {
      const { tokens } = tokenize("foo // this is a comment\nbar");
      expect(tokens.map((t) => t.kind)).toEqual(["IDENTIFIER", "IDENTIFIER", "EOF"]);
    });

    it("ignores block comments", () => {
      const { tokens } = tokenize("foo /* block comment */ bar");
      expect(tokens.map((t) => t.kind)).toEqual(["IDENTIFIER", "IDENTIFIER", "EOF"]);
    });

    it("handles multi-line block comments", () => {
      const { tokens } = tokenize("foo /* line1\nline2\nline3 */ bar");
      expect(tokens.map((t) => t.kind)).toEqual(["IDENTIFIER", "IDENTIFIER", "EOF"]);
    });
  });

  describe("source locations", () => {
    it("tracks line and column", () => {
      const { tokens } = tokenize("foo\nbar");
      expect(tokens[0].location.start.line).toBe(1);
      expect(tokens[0].location.start.column).toBe(1);
      expect(tokens[1].location.start.line).toBe(2);
      expect(tokens[1].location.start.column).toBe(1);
    });

    it("tracks column accurately", () => {
      const { tokens } = tokenize("  foo  bar");
      expect(tokens[0].location.start.column).toBe(3);
      expect(tokens[1].location.start.column).toBe(8);
    });
  });

  describe("error handling", () => {
    it("rejects $ in user identifiers (A17)", () => {
      const { diagnostics } = tokenize("my$var");
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("$");
    });

    it("rejects __sys__ prefix (A26)", () => {
      const { diagnostics } = tokenize("__sys__myVar");
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("__sys__");
    });

    it("rejects reserved JavaScript keywords", () => {
      const { diagnostics } = tokenize("function");
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("reserved");
    });

    it("reports unterminated strings", () => {
      const { diagnostics } = tokenize('"hello');
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("Unterminated");
    });

    it("reports unterminated block comments", () => {
      const { diagnostics } = tokenize("/* comment");
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("Unterminated");
    });

    it("reports invalid system identifiers", () => {
      const { diagnostics } = tokenize("$foo");
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("Invalid system identifier");
    });
  });

  describe("complex expressions", () => {
    it("tokenizes a complete domain skeleton", () => {
      const source = `
        domain Counter {
          state {
            count: number = 0
          }
          computed doubled = mul(count, 2)
          action increment() {
            patch count = add(count, 1)
          }
        }
      `;
      const { tokens, diagnostics } = tokenize(source);
      expect(diagnostics).toHaveLength(0);
      expect(tokens.some((t) => t.kind === "DOMAIN")).toBe(true);
      expect(tokens.some((t) => t.kind === "STATE")).toBe(true);
      expect(tokens.some((t) => t.kind === "COMPUTED")).toBe(true);
      expect(tokens.some((t) => t.kind === "ACTION")).toBe(true);
    });

    it("tokenizes an action with once() and effect", () => {
      const source = `
        action addTask(title: string) {
          once(adding) when isNotNull(trim(title)) {
            patch adding = $meta.intentId
            patch tasks[$system.uuid] = { id: $system.uuid, title: title }
          }
        }
      `;
      const { tokens, diagnostics } = tokenize(source);
      expect(diagnostics).toHaveLength(0);
      expect(tokens.some((t) => t.kind === "ONCE")).toBe(true);
      expect(tokens.some((t) => t.kind === "WHEN")).toBe(true);
      expect(tokens.some((t) => t.kind === "SYSTEM_IDENT")).toBe(true);
    });
  });
});
