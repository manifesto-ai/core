/**
 * Basic Counter Example
 *
 * Demonstrates basic ManifestoHost usage:
 * - Creating a host with schema
 * - Dispatching intents
 * - Reading snapshot state
 *
 * Run: cd packages/host && pnpm exec tsx examples/basic-counter.ts
 */

import { ManifestoHost, createHost } from "../src/index.js";
import { createTestSchema, createTestIntent } from "../src/__tests__/helpers/index.js";

// Create a test schema with counter actions
const counterSchema = createTestSchema({
  actions: {
    increment: {
      flow: {
        kind: "patch",
        op: "set",
        path: "count",
        value: {
          kind: "add",
          left: { kind: "coalesce", args: [{ kind: "get", path: "count" }, { kind: "lit", value: 0 }] },
          right: { kind: "lit", value: 1 },
        },
      },
    },
    decrement: {
      flow: {
        kind: "patch",
        op: "set",
        path: "count",
        value: {
          kind: "add",
          left: { kind: "coalesce", args: [{ kind: "get", path: "count" }, { kind: "lit", value: 0 }] },
          right: { kind: "lit", value: -1 },
        },
      },
    },
    addAmount: {
      flow: {
        kind: "patch",
        op: "set",
        path: "count",
        value: {
          kind: "add",
          left: { kind: "coalesce", args: [{ kind: "get", path: "count" }, { kind: "lit", value: 0 }] },
          right: { kind: "get", path: "input.amount" },
        },
      },
    },
  },
});

async function main() {
  console.log("=== Basic Counter Example ===\n");

  // 1. Create host with initial data
  const host = new ManifestoHost(counterSchema, {
    initialData: { count: 0 },
  });

  // 2. Check initial state
  const initialSnapshot = host.getSnapshot();
  console.log("Initial state:", initialSnapshot?.data);

  // 3. Dispatch increment intent
  console.log("\nDispatching increment...");
  const result1 = await host.dispatch(createTestIntent("increment"));

  console.log("Result status:", result1.status);
  console.log("Snapshot data:", result1.snapshot.data);

  // 4. Dispatch increment again
  console.log("\nDispatching increment again...");
  const result2 = await host.dispatch(createTestIntent("increment"));

  console.log("Result status:", result2.status);
  console.log("Snapshot data:", result2.snapshot.data);

  // 5. Dispatch addAmount with input
  console.log("\nDispatching addAmount with amount: 10...");
  const result3 = await host.dispatch(createTestIntent("addAmount", { amount: 10 }));

  console.log("Result status:", result3.status);
  console.log("Snapshot data:", result3.snapshot.data);

  // 6. Dispatch decrement
  console.log("\nDispatching decrement...");
  const result4 = await host.dispatch(createTestIntent("decrement"));

  console.log("Result status:", result4.status);
  console.log("Snapshot data:", result4.snapshot.data);

  // 7. Final state
  console.log("\nFinal state via getSnapshot():", host.getSnapshot()?.data);

  console.log("\nDone!");
}

main().catch(console.error);
