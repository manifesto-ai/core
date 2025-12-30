import { describe, it, expect } from "vitest";
import { CompilerDomain, INITIAL_STATE } from "../domain/domain.js";
import { CompilerStateSchema } from "../domain/schema.js";

describe("CompilerDomain", () => {
  describe("schema", () => {
    it("should have valid schema structure", () => {
      expect(CompilerDomain.schema).toBeDefined();
      expect(CompilerDomain.schema.id).toBe("manifesto:compiler");
      expect(CompilerDomain.schema.version).toBe("1.0.0");
    });

    it("should have all required actions", () => {
      const actionNames = Object.keys(CompilerDomain.schema.actions);
      expect(actionNames).toContain("start");
      expect(actionNames).toContain("receiveSegments");
      expect(actionNames).toContain("receiveIntents");
      expect(actionNames).toContain("receiveDraft");
      expect(actionNames).toContain("receiveValidation");
      expect(actionNames).toContain("requestResolution");
      expect(actionNames).toContain("resolve");
      expect(actionNames).toContain("discard");
      expect(actionNames).toContain("reset");
    });

    it("should have all required computed values", () => {
      const computedNames = Object.keys(CompilerDomain.schema.computed.fields);
      expect(computedNames).toContain("computed.isIdle");
      expect(computedNames).toContain("computed.isSegmenting");
      expect(computedNames).toContain("computed.isNormalizing");
      expect(computedNames).toContain("computed.isProposing");
      expect(computedNames).toContain("computed.isValidating");
      expect(computedNames).toContain("computed.isAwaitingResolution");
      expect(computedNames).toContain("computed.isTerminal");
      expect(computedNames).toContain("computed.canRetry");
    });
  });

  describe("initial state", () => {
    it("should validate against schema", () => {
      const result = CompilerStateSchema.safeParse(INITIAL_STATE);
      expect(result.success).toBe(true);
    });

    it("should have correct default values", () => {
      expect(INITIAL_STATE.status).toBe("idle");
      expect(INITIAL_STATE.maxRetries).toBe(5);
      expect(INITIAL_STATE.traceDrafts).toBe(false);
      expect(INITIAL_STATE.attemptCount).toBe(0);
      expect(INITIAL_STATE.input).toBeNull();
      expect(INITIAL_STATE.result).toBeNull();
    });
  });

  describe("diagnostics", () => {
    it("should have valid diagnostics", () => {
      expect(CompilerDomain.diagnostics).toBeDefined();
      expect(CompilerDomain.diagnostics.valid).toBe(true);
    });
  });
});
