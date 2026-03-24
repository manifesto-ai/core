import { describe, it, expect } from "vitest";
import { createManifesto } from "../index.js";
import { CompileError, ManifestoError } from "../errors.js";

/**
 * #187: MEL compile errors must expose diagnostic info (line, column, source context).
 */

describe("CompileError diagnostics (#187)", () => {
  it("throws CompileError for invalid MEL syntax", () => {
    expect(() =>
      createManifesto({
        schema: `domain Bad { bad syntax here }`,
        effects: {},
      }),
    ).toThrow(CompileError);
  });

  it("CompileError extends ManifestoError (backward compatible catch)", () => {
    try {
      createManifesto({ schema: `domain Bad { bad syntax`, effects: {} });
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestoError);
      expect(e).toBeInstanceOf(CompileError);
    }
  });

  it("exposes diagnostics array with location info", () => {
    try {
      createManifesto({
        schema: `domain Test {\n  state {\n    count number = 0\n  }\n}`,
        effects: {},
      });
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(CompileError);
      const err = e as CompileError;
      expect(err.diagnostics.length).toBeGreaterThan(0);

      const d = err.diagnostics[0];
      expect(d.code).toBeDefined();
      expect(d.message).toBeDefined();
      expect(d.location).toBeDefined();
      expect(d.location.start.line).toBeGreaterThan(0);
      expect(d.location.start.column).toBeGreaterThan(0);
    }
  });

  it("error message includes line:column info", () => {
    try {
      createManifesto({
        schema: `domain Test {\n  bad syntax\n}`,
        effects: {},
      });
      expect.unreachable("should throw");
    } catch (e) {
      const err = e as CompileError;
      // Message should contain location like "(2:3)" or similar
      expect(err.message).toContain("MEL compilation failed:");
      // Should have line number somewhere in the formatted output
      expect(err.message).toMatch(/\(\d+:\d+\)/);
    }
  });

  it("has code COMPILE_ERROR", () => {
    try {
      createManifesto({ schema: `not valid mel`, effects: {} });
      expect.unreachable("should throw");
    } catch (e) {
      const err = e as CompileError;
      expect(err.code).toBe("COMPILE_ERROR");
    }
  });

  it("preserves all diagnostics for multiple errors", () => {
    try {
      createManifesto({
        schema: `domain Multi {\n  state {\n    x number\n    y string\n  }\n}`,
        effects: {},
      });
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(CompileError);
      const err = e as CompileError;
      expect(err.diagnostics.length).toBeGreaterThanOrEqual(1);
    }
  });
});
