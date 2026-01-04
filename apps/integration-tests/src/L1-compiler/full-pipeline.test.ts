/**
 * L1: Compiler Full Pipeline Integration Tests
 *
 * Tests MEL text → DomainSchema compilation pipeline.
 * Uses the existing counter.mel fixture file to test the full pipeline.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  tokenize,
  parse,
  generate,
} from "@manifesto-ai/compiler";

const __dirname = dirname(fileURLToPath(import.meta.url));

// =============================================================================
// Helper function to compile MEL to schema
// =============================================================================

function compileMel(mel: string) {
  const { tokens, diagnostics: lexDiagnostics } = tokenize(mel);
  const { program, diagnostics: parseDiagnostics } = parse(tokens);

  return {
    tokens,
    lexDiagnostics,
    program,
    parseDiagnostics,
  };
}

// =============================================================================
// L1: Full Pipeline Tests
// =============================================================================

describe("L1: Compiler Pipeline Integration", () => {
  describe("MEL text → DomainSchema", () => {
    it("should compile a simple counter domain from fixture", () => {
      // Read the fixture MEL file
      const counterMel = readFileSync(
        join(__dirname, "../fixtures/schemas/counter.mel"),
        "utf-8"
      );

      // 1. Tokenize & Parse
      const { tokens, lexDiagnostics, program, parseDiagnostics } = compileMel(counterMel);

      expect(tokens.length).toBeGreaterThan(0);
      expect(lexDiagnostics).toHaveLength(0);
      expect(program).toBeDefined();
      expect(parseDiagnostics).toHaveLength(0);
      expect(program?.domain.name).toBe("Counter");

      // 2. Generate
      const { schema, diagnostics: genDiagnostics } = generate(program!);
      expect(schema).toBeDefined();
      expect(genDiagnostics).toHaveLength(0);
      expect(schema?.id).toContain("counter");
      expect(schema?.hash).toBeDefined();
      expect(schema?.hash.length).toBeGreaterThan(0);
    });

    it("should generate deterministic schema hash", () => {
      const counterMel = readFileSync(
        join(__dirname, "../fixtures/schemas/counter.mel"),
        "utf-8"
      );

      // Generate schema twice
      const result1 = compileMel(counterMel);
      const { schema: schema1 } = generate(result1.program!);

      const result2 = compileMel(counterMel);
      const { schema: schema2 } = generate(result2.program!);

      // Hashes should be identical
      expect(schema1?.hash).toBe(schema2?.hash);
    });

    it("should include state fields in schema", () => {
      const counterMel = readFileSync(
        join(__dirname, "../fixtures/schemas/counter.mel"),
        "utf-8"
      );
      const { program } = compileMel(counterMel);
      const { schema } = generate(program!);

      expect(schema?.state).toBeDefined();
      expect(schema?.state.fields).toBeDefined();
      expect(schema?.state.fields.count).toBeDefined();
    });

    it("should include computed fields in schema", () => {
      const counterMel = readFileSync(
        join(__dirname, "../fixtures/schemas/counter.mel"),
        "utf-8"
      );
      const { program } = compileMel(counterMel);
      const { schema } = generate(program!);

      expect(schema?.computed).toBeDefined();
      expect(schema?.computed.fields).toBeDefined();
      // Computed fields have "computed." prefix in the key
      expect(schema?.computed.fields["computed.doubled"]).toBeDefined();
      expect(schema?.computed.fields["computed.isPositive"]).toBeDefined();
    });

    it("should include actions in schema", () => {
      const counterMel = readFileSync(
        join(__dirname, "../fixtures/schemas/counter.mel"),
        "utf-8"
      );
      const { program } = compileMel(counterMel);
      const { schema } = generate(program!);

      expect(schema?.actions).toBeDefined();
      expect(schema?.actions.increment).toBeDefined();
      expect(schema?.actions.decrement).toBeDefined();
      expect(schema?.actions.reset).toBeDefined();
    });
  });

  describe("Lexer", () => {
    it("should tokenize MEL keywords", () => {
      const mel = "domain Test { state { x: number = 0 } }";
      const { tokens, diagnostics } = tokenize(mel);

      expect(diagnostics).toHaveLength(0);

      // Should have domain, state keywords
      const tokenKinds = tokens.map((t) => t.kind);
      expect(tokenKinds).toContain("DOMAIN");
      expect(tokenKinds).toContain("STATE");
      expect(tokenKinds).toContain("IDENTIFIER");
      expect(tokenKinds).toContain("NUMBER");
    });
  });

  describe("Parser", () => {
    it("should parse empty domain", () => {
      const { program, diagnostics } = parse(tokenize("domain Empty {}").tokens);

      expect(diagnostics).toHaveLength(0);
      expect(program?.domain.name).toBe("Empty");
      expect(program?.domain.members).toHaveLength(0);
    });

    it("should parse domain with state", () => {
      const mel = `
        domain Counter {
          state {
            count: number = 0
          }
        }
      `;
      const { program, diagnostics } = parse(tokenize(mel).tokens);

      expect(diagnostics).toHaveLength(0);
      expect(program?.domain.members).toHaveLength(1);
      expect(program?.domain.members[0].kind).toBe("state");
    });

    it("should parse domain with computed", () => {
      const mel = `
        domain Counter {
          computed doubled = mul(count, 2)
        }
      `;
      const { program, diagnostics } = parse(tokenize(mel).tokens);

      expect(diagnostics).toHaveLength(0);
      const computed = program?.domain.members[0];
      expect(computed?.kind).toBe("computed");
    });

    it("should parse domain with action", () => {
      const mel = `
        domain Counter {
          action increment() {
            when gt(count, 0) {
              patch count = add(count, 1)
            }
          }
        }
      `;
      const { program, diagnostics } = parse(tokenize(mel).tokens);

      expect(diagnostics).toHaveLength(0);
      const action = program?.domain.members[0];
      expect(action?.kind).toBe("action");
    });
  });

  describe("Generator", () => {
    it("should generate valid DomainSchema JSON", () => {
      const mel = "domain Test { state { x: number = 0 } }";
      const { program } = parse(tokenize(mel).tokens);
      const { schema } = generate(program!);

      expect(schema).toBeDefined();

      // Should be serializable
      const json = JSON.stringify(schema);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBe(schema?.id);
      expect(parsed.hash).toBe(schema?.hash);
    });
  });

  describe("Error Handling", () => {
    it("should report syntax errors", () => {
      // Missing colon in state field
      const invalidMel = "domain Test { state { x number = 0 } }";
      const { diagnostics, program } = parse(tokenize(invalidMel).tokens);

      // Either diagnostics or null program indicates an error
      expect(diagnostics.length > 0 || program === null).toBe(true);
    });
  });
});
