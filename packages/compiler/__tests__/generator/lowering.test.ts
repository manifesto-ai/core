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

function getSystemSlotFields(schema: DomainSchema, actionName: string, key: string) {
  return schema.state.fields["$mel"]?.fields?.["sys"]?.fields?.[actionName]?.fields?.[key]?.fields;
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

    it("lowers when option is set", () => {
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

      // After lowering, $system.uuid should be replaced with slot path
      const flow = lowered.actions.generateId.flow;
      const hasSystemRef = JSON.stringify(flow).includes("$system.uuid");
      expect(hasSystemRef).toBe(false);

      // Should have the slot fields
      expect(getSystemSlotFields(lowered, "generateId", "uuid")).toMatchObject({
        value: expect.objectContaining({ default: null }),
        intent: expect.objectContaining({ default: null }),
      });
    });

    it("normalizes dotted system keys when lowering", () => {
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

      expect(flowStr).not.toContain("$system.time.now");
      expect(flowStr).toContain("system.get");
      expect(flowStr).toContain("$mel.sys.create.time_now.value");
      expect(flowStr).toContain("$mel.sys.create.time_now.intent");
      expect(getSystemSlotFields(lowered, "create", "time_now")).toMatchObject({
        value: expect.objectContaining({ default: null }),
        intent: expect.objectContaining({ default: null }),
      });
    });
  });

  describe("lowerSystemValues function", () => {
    function compileAndLower(source: string): DomainSchema | null {
      const result = compile(source);
      if (!result.success) return null;
      return lowerSystemValues(result.schema);
    }

    it("adds state slots for system values", () => {
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
        expect(getSystemSlotFields(schema, "create", "uuid")).toMatchObject({
          value: expect.objectContaining({ default: null }),
          intent: expect.objectContaining({ default: null }),
        });
      }
    });

    it("generates acquisition effects", () => {
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

        // Should have system.get effect
        expect(flowStr).toContain("system.get");
        // Should reference the value slot
        expect(flowStr).toContain("$mel.sys.create.uuid.value");
        // Should reference the intent slot
        expect(flowStr).toContain("$mel.sys.create.uuid.intent");
      }
    });

    it("generates readiness conditions", () => {
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
        // Should have slots for both uuid and timestamp
        expect(getSystemSlotFields(schema, "create", "uuid")).toMatchObject({
          value: expect.objectContaining({ default: null }),
          intent: expect.objectContaining({ default: null }),
        });
        expect(getSystemSlotFields(schema, "create", "timestamp")).toMatchObject({
          value: expect.objectContaining({ default: null }),
          intent: expect.objectContaining({ default: null }),
        });
      }
    });

    it("deduplicates same system value in same action", () => {
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
        // Should have only one set of uuid slots
        const slotFields = Object.keys(getSystemSlotFields(schema, "create", "uuid") ?? {});
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
        expect(schema.state.fields["$mel"]).toBeUndefined();
      }
    });
  });
});
