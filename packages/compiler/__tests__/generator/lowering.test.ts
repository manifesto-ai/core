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

describe("Runtime Value Lowering", () => {
  describe("lowering with compile option", () => {
    it("does not lower by default", () => {
      const result = compile(`
        domain Test {
          state { id: string = "" }
          action generateId() {
            when true {
              patch id = $runtime.random.uuid
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (result.success) {
        // Without lowering, $runtime.random.uuid remains as-is
        const flow = result.schema.actions.generateId.flow;
        expect(JSON.stringify(flow)).toContain("$runtime.random.uuid");
      }
    });

    it("does not inject MEL-owned slots when compatibility hook is used", () => {
      const result = compile(
        `
        domain Test {
          state { id: string = "" }
          action generateId() {
            when true {
              patch id = $runtime.random.uuid
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
      expect(JSON.stringify(flow)).toContain("$runtime.random.uuid");
      expect(lowered.state.fields["$mel"]).toBeUndefined();
    });

    it("preserves dotted runtime keys without MEL namespace lowering", () => {
      const result = compile(
        `
        domain Test {
          state { createdAt: number = 0 }
          action create() {
            when true {
              patch createdAt = $runtime.time.timestamp
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

      expect(flowStr).toContain("$runtime.time.timestamp");
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

    it("does not add state slots for runtime values", () => {
      const schema = compileAndLower(`
        domain Test {
          state { id: string = "" }
          action create() {
            when true {
              patch id = $runtime.random.uuid
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
              patch id = $runtime.random.uuid
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
        expect(flowStr).toContain("$runtime.random.uuid");
      }
    });

    it("does not wrap flows in MEL readiness conditions", () => {
      const schema = compileAndLower(`
        domain Test {
          state { id: string = "" }
          action create() {
            when true {
              patch id = $runtime.random.uuid
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

    it("preserves multiple runtime values without namespace bookkeeping", () => {
      const schema = compileAndLower(`
        domain Test {
          state {
            id: string = ""
            createdAt: number = 0
          }
          action create() {
            when true {
              patch id = $runtime.random.uuid
              patch createdAt = $runtime.time.timestamp
            }
          }
        }
      `);

      expect(schema).not.toBeNull();
      if (schema) {
        const flowStr = JSON.stringify(schema.actions.create.flow);
        expect(flowStr).toContain("$runtime.random.uuid");
        expect(flowStr).toContain("$runtime.time.timestamp");
        expect(flowStr).not.toContain("$mel");
      }
    });

    it("keeps repeated runtime values on the deterministic expression path", () => {
      const schema = compileAndLower(`
        domain Test {
          state {
            id: string = ""
            otherId: string = ""
          }
          action create() {
            when true {
              patch id = $runtime.random.uuid
              patch otherId = $runtime.random.uuid
            }
          }
        }
      `);

      expect(schema).not.toBeNull();
      if (schema) {
        const flowStr = JSON.stringify(schema.actions.create.flow);
        expect(flowStr.match(/\$runtime\.random\.uuid/g)?.length).toBe(2);
        expect(flowStr).not.toContain("$mel");
      }
    });

    it("does not affect actions without runtime values", () => {
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
