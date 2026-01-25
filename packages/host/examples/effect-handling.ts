/**
 * Effect Handling Example
 *
 * Demonstrates effect handler registration and execution:
 * - Registering effect handlers
 * - Error handling patterns (errors as patches)
 * - Effect handler contract (never throw)
 * - State-guarded effects (re-entry safe)
 *
 * Run: cd packages/host && pnpm exec tsx examples/effect-handling.ts
 */

import { ManifestoHost } from "../src/index.js";
import { createTestSchema, createTestIntent } from "../src/__tests__/helpers/index.js";
import type { EffectHandler, Patch } from "../src/index.js";

// Create schema with effect actions
// IMPORTANT: Effects must be state-guarded for re-entry safety
const userSchema = createTestSchema({
  actions: {
    fetchUser: {
      flow: {
        kind: "seq",
        steps: [
          // Set loading state (guarded)
          {
            kind: "if",
            cond: { kind: "not", arg: { kind: "get", path: "loading" } },
            then: { kind: "patch", op: "set", path: "loading", value: { kind: "lit", value: true } },
          },
          // Call effect (guarded by checking if response is null)
          {
            kind: "if",
            cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
            then: {
              kind: "effect",
              type: "api.get",
              params: {
                userId: { kind: "get", path: "input.userId" },
              },
            },
          },
          // Clear loading state (after effect)
          {
            kind: "if",
            cond: { kind: "not", arg: { kind: "isNull", arg: { kind: "get", path: "response" } } },
            then: { kind: "patch", op: "set", path: "loading", value: { kind: "lit", value: false } },
          },
        ],
      },
    },
    delayedAction: {
      flow: {
        kind: "seq",
        steps: [
          // Effect guarded by result being null
          {
            kind: "if",
            cond: { kind: "isNull", arg: { kind: "get", path: "result" } },
            then: {
              kind: "effect",
              type: "timer.delay",
              params: {
                ms: { kind: "get", path: "input.ms" },
                value: { kind: "get", path: "input.value" },
              },
            },
          },
        ],
      },
    },
  },
});

// Mock user data
const mockUsers: Record<string, unknown> = {
  "123": { id: "123", name: "Alice", email: "alice@example.com" },
  "456": { id: "456", name: "Bob", email: "bob@example.com" },
};

async function main() {
  console.log("=== Effect Handling Example ===\n");

  // 1. Create host
  const host = new ManifestoHost(userSchema, {
    initialData: { loading: false, response: null, result: null },
  });

  // 2. Register effect handlers
  console.log("Registering effect handlers...");

  // Success handler - returns patches
  // IMPORTANT: Effect handlers must NEVER throw, always return Patch[]
  // Note: Patch paths don't include "data." prefix - they're relative to data root
  const apiGetHandler: EffectHandler = async (_type, params) => {
    // Simulate API call
    const userId = params.userId as string;
    const user = mockUsers[userId];

    if (user) {
      // Success: return patches that write the result
      return [
        { op: "set", path: "response", value: user },
      ] as Patch[];
    } else {
      // Not found: return error patches (NOT throwing!)
      return [
        { op: "set", path: "response", value: { error: `User ${userId} not found` } },
      ] as Patch[];
    }
  };
  host.registerEffect("api.get", apiGetHandler);

  // Timer delay handler - sets result after delay
  const timerDelayHandler: EffectHandler = async (_type, params) => {
    const ms = params.ms as number;
    const value = params.value as string;
    await new Promise((resolve) => setTimeout(resolve, ms));
    // Return patch to set the result (this makes the guard pass on next iteration)
    return [
      { op: "set", path: "result", value },
    ] as Patch[];
  };
  host.registerEffect("timer.delay", timerDelayHandler);

  console.log("Registered effects:", host.getEffectTypes().join(", "));

  // 3. Dispatch fetchUser action (success case)
  console.log("\nDispatching fetchUser action (userId: 123)...");
  const result1 = await host.dispatch(createTestIntent("fetchUser", { userId: "123" }));

  console.log("Result status:", result1.status);
  if (result1.error) {
    console.log("Error:", result1.error.code, result1.error.message);
  }
  console.log("Response data:", result1.snapshot.data.response);
  console.log("Loading:", result1.snapshot.data.loading);

  // 4. Dispatch fetchUser action (not found case)
  console.log("\nDispatching fetchUser action (userId: 999 - not found)...");

  // Reset state first
  host.reset({ loading: false, response: null, result: null });

  const result2 = await host.dispatch(createTestIntent("fetchUser", { userId: "999" }));

  console.log("Result status:", result2.status);
  if (result2.error) {
    console.log("Error:", result2.error.code, result2.error.message);
  }
  console.log("Response data:", result2.snapshot.data.response);

  // 5. Demonstrate timer delay effect
  console.log("\nDispatching delayedAction (100ms delay)...");

  host.reset({ loading: false, response: null, result: null });

  const startTime = Date.now();
  const result3 = await host.dispatch(createTestIntent("delayedAction", { ms: 100, value: "delayed-value" }));
  const elapsed = Date.now() - startTime;

  console.log("Result status:", result3.status);
  if (result3.error) {
    console.log("Error:", result3.error.code, result3.error.message);
  }
  console.log("Result value:", result3.snapshot.data.result);
  console.log(`Elapsed time: ~${elapsed}ms`);

  // 6. Demonstrate effect handler management
  console.log("\n--- Effect Handler Management ---");

  console.log("Has api.get:", host.hasEffect("api.get"));
  console.log("Has api.unknown:", host.hasEffect("api.unknown"));

  console.log("\nUnregistering timer.delay...");
  host.unregisterEffect("timer.delay");
  console.log("Registered effects:", host.getEffectTypes().join(", "));

  console.log("\nEffect handling complete!");
}

main().catch(console.error);
