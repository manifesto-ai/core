/**
 * Core Integration Tests
 * Verifies that compiled MEL schemas work with @manifesto-ai/core
 */

import { describe, it, expect } from "vitest";
import { compile, type DomainSchema as MelDomainSchema } from "../../src/index.js";
import {
  createCore,
  createSnapshot,
  createIntent,
  type DomainSchema as CoreDomainSchema,
  type Snapshot,
} from "@manifesto-ai/core";

// Helper to adapt MEL schema to Core schema if needed
function adaptSchema(melSchema: MelDomainSchema): CoreDomainSchema {
  // Currently our generated schema should be directly compatible
  // This function exists for any necessary adaptations
  return melSchema as unknown as CoreDomainSchema;
}

const HOST_CONTEXT = { now: 0, randomSeed: "seed" };
let intentCounter = 0;
const nextIntentId = () => `intent-${intentCounter++}`;
const createTestIntent = (type: string, input?: unknown) =>
  input === undefined
    ? createIntent(type, nextIntentId())
    : createIntent(type, input, nextIntentId());
const createTestSnapshot = (data: unknown, schemaHash: string) =>
  createSnapshot(data, schemaHash, HOST_CONTEXT);
const computeWithContext = (
  core: ReturnType<typeof createCore>,
  schema: CoreDomainSchema,
  snapshot: Snapshot,
  intent: ReturnType<typeof createIntent>
) => core.compute(schema, snapshot, intent, HOST_CONTEXT);

describe("Core Integration", () => {
  describe("Schema Type Compatibility", () => {
    it("generates valid Core DomainSchema structure", () => {
      const result = compile(`
        domain Counter {
          state {
            count: number = 0
          }
          computed doubled = mul(count, 2)
          action increment() {
            when true {
              patch count = add(count, 1)
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const schema = result.schema;

      // Verify required DomainSchema fields
      expect(schema).toHaveProperty("id");
      expect(schema).toHaveProperty("version");
      expect(schema).toHaveProperty("hash");
      expect(schema).toHaveProperty("state");
      expect(schema).toHaveProperty("computed");
      expect(schema).toHaveProperty("actions");

      // Verify StateSpec structure
      expect(schema.state).toHaveProperty("fields");
      expect(schema.state.fields.count).toHaveProperty("type");
      expect(schema.state.fields.count).toHaveProperty("required");

      // Verify ComputedSpec structure
      expect(schema.computed).toHaveProperty("fields");
      const doubledSpec = schema.computed.fields["computed.doubled"];
      expect(doubledSpec).toHaveProperty("deps");
      expect(doubledSpec).toHaveProperty("expr");

      // Verify ActionSpec structure
      expect(schema.actions.increment).toHaveProperty("flow");
      expect(schema.actions.increment.flow).toHaveProperty("kind");
    });

    it("generates valid FlowNode kinds", () => {
      const result = compile(`
        domain Test {
          state { x: number = 0 }
          computed isPositive = gt(x, 0)
          action test() {
            when gt(x, 0) {
              patch x = 0
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const flow = result.schema.actions.test.flow;
      // when -> if flow
      expect(flow.kind).toBe("if");
    });

    it("generates valid ExprNode kinds", () => {
      const result = compile(`
        domain Test {
          state { x: number = 0 }
          computed a = add(x, 1)
          computed b = mul(x, 2)
          computed c = gt(x, 0)
          computed d = and(c, true)
        }
      `);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const computed = result.schema.computed.fields;
      expect(computed["computed.a"].expr.kind).toBe("add");
      expect(computed["computed.b"].expr.kind).toBe("mul");
      expect(computed["computed.c"].expr.kind).toBe("gt");
      expect(computed["computed.d"].expr.kind).toBe("and");
    });
  });

  describe("Core Execution", () => {
    it("executes simple increment action", async () => {
      const result = compile(`
        domain Counter {
          state {
            count: number = 0
          }
          computed countValue = count
          action increment() {
            when true {
              patch count = add(count, 1)
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const schema = adaptSchema(result.schema);
      const core = createCore();
      const snapshot = createTestSnapshot({ count: 0 }, schema.hash);
      const intent = createTestIntent("increment");

      const computeResult = await computeWithContext(core, schema, snapshot, intent);

      expect(computeResult.status).toBe("complete");
      expect(computeResult.snapshot.data.count).toBe(1);
    });

    it("executes action with parameters", async () => {
      const result = compile(`
        domain Counter {
          state {
            count: number = 0
          }
          computed countValue = count
          action add(amount: number) {
            when true {
              patch count = add(count, amount)
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const schema = adaptSchema(result.schema);
      const core = createCore();
      const snapshot = createTestSnapshot({ count: 5 }, schema.hash);
      const intent = createTestIntent("add", { amount: 10 });

      const computeResult = await computeWithContext(core, schema, snapshot, intent);

      expect(computeResult.status).toBe("complete");
      expect(computeResult.snapshot.data.count).toBe(15);
    });

    it("respects when guard conditions", async () => {
      const result = compile(`
        domain Counter {
          state {
            count: number = 0
          }
          computed isPositive = gt(count, 0)
          action decrement() {
            when gt(count, 0) {
              patch count = sub(count, 1)
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const schema = adaptSchema(result.schema);
      const core = createCore();

      // When count is 0, guard should prevent decrement
      const snapshot1 = createTestSnapshot({ count: 0 }, schema.hash);
      const intent1 = createTestIntent("decrement");
      const result1 = await computeWithContext(core, schema, snapshot1, intent1);
      expect(result1.snapshot.data.count).toBe(0); // Should not change

      // When count is positive, decrement should work
      const snapshot2 = createTestSnapshot({ count: 5 }, schema.hash);
      const intent2 = createTestIntent("decrement");
      const result2 = await computeWithContext(core, schema, snapshot2, intent2);
      expect(result2.snapshot.data.count).toBe(4);
    });

    it("computes computed values", async () => {
      const result = compile(`
        domain Counter {
          state {
            count: number = 0
          }
          computed doubled = mul(count, 2)
          computed isPositive = gt(count, 0)
          action increment() {
            when true {
              patch count = add(count, 1)
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const schema = adaptSchema(result.schema);
      const core = createCore();
      const snapshot = createTestSnapshot({ count: 5 }, schema.hash);
      const intent = createTestIntent("increment");

      const computeResult = await computeWithContext(core, schema, snapshot, intent);

      expect(computeResult.status).toBe("complete");
      expect(computeResult.snapshot.data.count).toBe(6);
      expect(computeResult.snapshot.computed["computed.doubled"]).toBe(12);
      expect(computeResult.snapshot.computed["computed.isPositive"]).toBe(true);
    });

    it("handles once guard (idempotency)", async () => {
      const result = compile(`
        domain Counter {
          state {
            count: number = 0
            lastIntent: string | null = null
          }
          computed lastIntentValue = lastIntent
          action increment() {
            once(lastIntent) {
              patch count = add(count, 1)
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const schema = adaptSchema(result.schema);
      const core = createCore();

      // First call should increment
      // Note: Core exposes intentId via meta for once() guards
      const snapshot1 = createTestSnapshot({ count: 0, lastIntent: null }, schema.hash);
      const intent1 = createIntent("increment", "intent-1");
      const result1 = await computeWithContext(core, schema, snapshot1, intent1);
      expect(result1.snapshot.data.count).toBe(1);
      expect(result1.snapshot.data.lastIntent).toBe("intent-1");

      // Second call with same intent should NOT increment (idempotent)
      const result2 = await computeWithContext(core, schema, result1.snapshot, intent1);
      expect(result2.snapshot.data.count).toBe(1); // Still 1

      // Call with different intent should increment
      const intent2 = createIntent("increment", "intent-2");
      const result3 = await computeWithContext(core, schema, result2.snapshot, intent2);
      expect(result3.snapshot.data.count).toBe(2);
    });

    it("handles multiple patches in sequence", async () => {
      const result = compile(`
        domain MultiPatch {
          state {
            a: number = 0
            b: number = 0
            c: number = 0
          }
          computed sum = add(a, b)
          action setAll() {
            when true {
              patch a = 1
              patch b = 2
              patch c = 3
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const schema = adaptSchema(result.schema);
      const core = createCore();
      const snapshot = createTestSnapshot({ a: 0, b: 0, c: 0 }, schema.hash);
      const intent = createTestIntent("setAll");

      const computeResult = await computeWithContext(core, schema, snapshot, intent);

      expect(computeResult.status).toBe("complete");
      expect(computeResult.snapshot.data.a).toBe(1);
      expect(computeResult.snapshot.data.b).toBe(2);
      expect(computeResult.snapshot.data.c).toBe(3);
    });

    it("handles nested when guards", async () => {
      const result = compile(`
        domain Nested {
          state {
            x: number = 0
            y: number = 0
          }
          computed total = add(x, y)
          action update() {
            when gt(x, 0) {
              when gt(y, 0) {
                patch x = add(x, y)
              }
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const schema = adaptSchema(result.schema);
      const core = createCore();

      // Both x and y are 0 - should not update
      const snapshot1 = createTestSnapshot({ x: 0, y: 0 }, schema.hash);
      const result1 = await computeWithContext(core, schema, snapshot1, createTestIntent("update"));
      expect(result1.snapshot.data.x).toBe(0);

      // Only x > 0 - should not update (inner guard fails)
      const snapshot2 = createTestSnapshot({ x: 5, y: 0 }, schema.hash);
      const result2 = await computeWithContext(core, schema, snapshot2, createTestIntent("update"));
      expect(result2.snapshot.data.x).toBe(5);

      // Both x > 0 and y > 0 - should update
      const snapshot3 = createTestSnapshot({ x: 5, y: 3 }, schema.hash);
      const result3 = await computeWithContext(core, schema, snapshot3, createTestIntent("update"));
      expect(result3.snapshot.data.x).toBe(8);
    });
  });

  describe("Complex Domain Examples", () => {
    it("executes TodoList domain", async () => {
      const result = compile(`
        domain TodoList {
          state {
            nextId: number = 1
            items: Array<object> = []
          }

          computed itemCount = len(items)

          action addTodo(title: string) {
            when neq(title, "") {
              patch items = append(items, { id: nextId, title: title, done: false })
              patch nextId = add(nextId, 1)
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const schema = adaptSchema(result.schema);
      const core = createCore();
      const snapshot = createTestSnapshot({ nextId: 1, items: [] }, schema.hash);

      // Add first todo
      const result1 = await computeWithContext(core, 
        schema,
        snapshot,
        createTestIntent("addTodo", { title: "Buy milk" })
      );

      expect(result1.status).toBe("complete");
      expect(result1.snapshot.data.items).toHaveLength(1);
      expect((result1.snapshot.data.items as any[])[0]).toMatchObject({
        id: 1,
        title: "Buy milk",
        done: false,
      });
      expect(result1.snapshot.computed["computed.itemCount"]).toBe(1);

      // Add second todo
      const result2 = await computeWithContext(core, 
        schema,
        result1.snapshot,
        createTestIntent("addTodo", { title: "Walk dog" })
      );

      expect(result2.snapshot.data.items).toHaveLength(2);
      expect(result2.snapshot.computed["computed.itemCount"]).toBe(2);
    });

    it("handles ternary expressions in computed", async () => {
      const result = compile(`
        domain Grade {
          state {
            score: number = 0
          }
          computed grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : "F"
          action setScore(value: number) {
            when true {
              patch score = value
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const schema = adaptSchema(result.schema);
      const core = createCore();

      const test = async (score: number, expectedGrade: string) => {
        const snapshot = createTestSnapshot({ score: 0 }, schema.hash);
        const r = await computeWithContext(core, 
          schema,
          snapshot,
          createTestIntent("setScore", { value: score })
        );
        expect(r.snapshot.computed["computed.grade"]).toBe(expectedGrade);
      };

      await test(95, "A");
      await test(85, "B");
      await test(75, "C");
      await test(50, "F");
    });
  });

  describe("Error Cases", () => {
    it("handles unknown action gracefully", async () => {
      const result = compile(`
        domain Test {
          state { x: number = 0 }
          action known() {
            when true {
              patch x = 1
            }
          }
        }
      `);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const schema = adaptSchema(result.schema);
      const core = createCore();
      const snapshot = createTestSnapshot({ x: 0 }, schema.hash);
      const intent = createTestIntent("unknown");

      const computeResult = await computeWithContext(core, schema, snapshot, intent);

      // Should return error status
      expect(computeResult.status).toBe("error");
    });
  });
});
