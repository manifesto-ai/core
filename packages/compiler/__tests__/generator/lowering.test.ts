import { describe, it, expect } from "vitest";
import { compile, lowerSystemValues, type DomainSchema, type CoreFlowNode } from "../../src/index.js";

describe("System Value Lowering", () => {
  describe("lowering with compile option", () => {
    it("does not lower by default", () => {
      const result = compile(`
        domain Test {
          state { id: string | null = null }
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

    it("lowers when option is set", () => {
      const result = compile(
        `
        domain Test {
          state { id: string | null = null }
          action generateId() {
            when true {
              patch id = $system.uuid
            }
          }
        }
      `,
        { lowerSystemValues: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        // After lowering, $system.uuid should be replaced with slot path
        const flow = result.schema.actions.generateId.flow;
        const hasSystemRef = JSON.stringify(flow).includes("$system.uuid");
        expect(hasSystemRef).toBe(false);

        // Should have the slot fields
        expect(result.schema.state.fields).toHaveProperty("__sys__generateId_uuid_value");
        expect(result.schema.state.fields).toHaveProperty("__sys__generateId_uuid_intent");
      }
    });
  });

  describe("lowerSystemValues function", () => {
    function compileAndLower(source: string): DomainSchema | null {
      const result = compile(source, { skipSemanticAnalysis: true });
      if (!result.success) return null;
      return lowerSystemValues(result.schema);
    }

    it("adds state slots for system values", () => {
      const schema = compileAndLower(`
        domain Test {
          state { id: string | null = null }
          action create() {
            when true {
              patch id = $system.uuid
            }
          }
        }
      `);

      expect(schema).not.toBeNull();
      if (schema) {
        expect(schema.state.fields).toHaveProperty("__sys__create_uuid_value");
        expect(schema.state.fields).toHaveProperty("__sys__create_uuid_intent");
      }
    });

    it("generates acquisition effects", () => {
      const schema = compileAndLower(`
        domain Test {
          state { id: string | null = null }
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

        // Should have system.get effect
        expect(flowStr).toContain("system.get");
        // Should reference the value slot
        expect(flowStr).toContain("__sys__create_uuid_value");
        // Should reference the intent slot
        expect(flowStr).toContain("__sys__create_uuid_intent");
      }
    });

    it("generates readiness conditions", () => {
      const schema = compileAndLower(`
        domain Test {
          state { id: string | null = null }
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

        // The flow should be wrapped with readiness check
        // seq: [acquisition, if(readiness, original_flow)]
        expect(flow.kind).toBe("seq");
        if (flow.kind === "seq") {
          expect(flow.steps.length).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it("handles multiple system values", () => {
      const schema = compileAndLower(`
        domain Test {
          state {
            id: string | null = null
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
        // Should have slots for both uuid and timestamp
        expect(schema.state.fields).toHaveProperty("__sys__create_uuid_value");
        expect(schema.state.fields).toHaveProperty("__sys__create_uuid_intent");
        expect(schema.state.fields).toHaveProperty("__sys__create_timestamp_value");
        expect(schema.state.fields).toHaveProperty("__sys__create_timestamp_intent");
      }
    });

    it("deduplicates same system value in same action", () => {
      const schema = compileAndLower(`
        domain Test {
          state {
            id: string | null = null
            otherId: string | null = null
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
        // Should have only one set of uuid slots
        const slotFields = Object.keys(schema.state.fields).filter(k =>
          k.startsWith("__sys__create_uuid")
        );
        expect(slotFields).toHaveLength(2); // value and intent
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
        // Should not have any __sys__ fields
        const sysFields = Object.keys(schema.state.fields).filter(k =>
          k.startsWith("__sys__")
        );
        expect(sysFields).toHaveLength(0);
      }
    });
  });
});
