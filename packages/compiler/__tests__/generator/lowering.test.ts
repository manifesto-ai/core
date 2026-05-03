import { describe, it, expect } from "vitest";
import {
  compileMelDomain,
  lowerSystemValues,
  type CompileMelDomainResult,
  type DomainSchema,
} from "../../src/index.js";

function compile(source: string): CompileMelDomainResult & { success: boolean } {
  const result = compileMelDomain(source, { mode: "domain" });
  return {
    ...result,
    success: result.errors.length === 0 && result.schema !== null,
  };
}

describe("System Value Lowering", () => {
  describe("lowering with compile option", () => {
    it("does not lower by default", () => {
      const result = compile(`
        domain Test {
          state { id: string = "" }
          action generateId() {
            when true {
              patch id = $system.uuid
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (result.success) {
        // Without lowering, $system.uuid remains as-is
        const flow = result.schema.actions.generateId.flow;
        const hasSystemRef = JSON.stringify(flow).includes("$system.uuid");
        expect(hasSystemRef).toBe(true);
      }
    });

    it("does not inject MEL-owned slots when compatibility hook is used", () => {
      const result = compile(
        `
        domain Test {
          state { id: string = "" }
          action generateId() {
            when true {
              patch id = $system.uuid
            }
          }
        }
      `
      );

      const lowered = result.success
        ? lowerSystemValues(result.schema)
        : null;
      expect(lowered).not.toBeNull();
      if (!lowered) return;

      const flow = lowered.actions.generateId.flow;
      const hasSystemRef = JSON.stringify(flow).includes("$system.uuid");
      expect(hasSystemRef).toBe(true);
      expect(lowered.state.fields["$mel"]).toBeUndefined();
    });

    it("preserves dotted system keys without MEL namespace lowering", () => {
      const result = compile(
        `
        domain Test {
          state { createdAt: number = 0 }
          action create() {
            when true {
              patch createdAt = $system.time.now
            }
          }
        }
      `);

      const lowered = result.success
        ? lowerSystemValues(result.schema)
        : null;
      expect(lowered).not.toBeNull();
      if (!lowered) return;

      const flow = lowered.actions.create.flow;
      const flowStr = JSON.stringify(flow);

      expect(flowStr).toContain("$system.time.now");
      expect(flowStr).not.toContain("system.get");
      expect(flowStr).not.toContain("$mel");
      expect(lowered.state.fields["$mel"]).toBeUndefined();
    });
  });

  describe("lowerSystemValues function", () => {
    function compileAndLower(source: string): DomainSchema | null {
      const result = compile(source);
      if (!result.success) return null;
      return lowerSystemValues(result.schema);
    }

    it("does not add state slots for system values", () => {
      const schema = compileAndLower(`
        domain Test {
          state { id: string = "" }
          action create() {
            when true {
              patch id = $system.uuid
            }
          }
        }
      `);

      expect(schema).not.toBeNull();
      if (schema) {
        expect(schema.state.fields["$mel"]).toBeUndefined();
      }
    });

    it("does not generate acquisition effects", () => {
      const schema = compileAndLower(`
        domain Test {
          state { id: string = "" }
          action create() {
            when true {
              patch id = $system.uuid
            }
          }
        }
      `);

      expect(schema).not.toBeNull();
      if (schema) {
        const flow = schema.actions.create.flow;
        const flowStr = JSON.stringify(flow);

        expect(flowStr).not.toContain("system.get");
        expect(flowStr).not.toContain("$mel");
        expect(flowStr).toContain("$system.uuid");
      }
    });

    it("does not wrap flows in MEL readiness conditions", () => {
      const schema = compileAndLower(`
        domain Test {
          state { id: string = "" }
          action create() {
            when true {
              patch id = $system.uuid
            }
          }
        }
      `);

      expect(schema).not.toBeNull();
      if (schema) {
        const flow = schema.actions.create.flow;

        expect(flow.kind).toBe("if");
        expect(JSON.stringify(flow)).not.toContain("$mel");
      }
    });

    it("preserves multiple system values without namespace bookkeeping", () => {
      const schema = compileAndLower(`
        domain Test {
          state {
            id: string = ""
            createdAt: number = 0
          }
          action create() {
            when true {
              patch id = $system.uuid
              patch createdAt = $system.timestamp
            }
          }
        }
      `);

      expect(schema).not.toBeNull();
      if (schema) {
        const flowStr = JSON.stringify(schema.actions.create.flow);
        expect(flowStr).toContain("$system.uuid");
        expect(flowStr).toContain("$system.timestamp");
        expect(flowStr).not.toContain("$mel");
      }
    });

    it("keeps repeated system values on the deterministic expression path", () => {
      const schema = compileAndLower(`
        domain Test {
          state {
            id: string = ""
            otherId: string = ""
          }
          action create() {
            when true {
              patch id = $system.uuid
              patch otherId = $system.uuid
            }
          }
        }
      `);

      expect(schema).not.toBeNull();
      if (schema) {
        const flowStr = JSON.stringify(schema.actions.create.flow);
        expect(flowStr.match(/\$system\.uuid/g)?.length).toBe(2);
        expect(flowStr).not.toContain("$mel");
      }
    });

    it("does not affect actions without system values", () => {
      const schema = compileAndLower(`
        domain Counter {
          state { count: number = 0 }
          action increment() {
            when true {
              patch count = add(count, 1)
            }
          }
        }
      `);

      expect(schema).not.toBeNull();
      if (schema) {
        expect(schema.state.fields["$mel"]).toBeUndefined();
      }
    });
  });
});
