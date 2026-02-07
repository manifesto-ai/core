/**
 * Example 04: Subscriptions
 *
 * Reactive state observation with selectors and unsubscribe.
 * Demonstrates: subscribe(), selector functions, computed subscriptions, unsubscribe
 *
 * Run: cd packages/app && pnpm exec tsx examples/04-subscriptions/main.ts
 */

import { createApp, createSilentPolicyService } from "../../src/index.js";

const app = createApp({
  schema: `
    domain Counter {
      state {
        count: number = 0
      }

      computed doubled = mul(count, 2)
      computed isPositive = gt(count, 0)

      action increment() {
        onceIntent {
          patch count = add(count, 1)
        }
      }

      action decrement() {
        onceIntent {
          patch count = sub(count, 1)
        }
      }
    }
  `,
  effects: {},
  policyService: createSilentPolicyService(),
});

async function main() {
  await app.ready();

  // Genesis defaults applied — verify initial state
  console.log("Initial count:", app.getState().data.count);
  // → Initial count: 0

  // Subscribe to count changes
  const unsubCount = app.subscribe(
    (state) => state.data.count,
    (count) => console.log(`  [count] ${count}`)
  );

  // Subscribe to doubled computed
  const unsubDoubled = app.subscribe(
    (state) => state.computed["computed.doubled"],
    (doubled) => console.log(`  [doubled] ${doubled}`)
  );

  console.log("Incrementing 3 times:");
  await app.act("increment").done();
  // → [count] 1
  // → [doubled] 2

  await app.act("increment").done();
  // → [count] 2
  // → [doubled] 4

  await app.act("increment").done();
  // → [count] 3
  // → [doubled] 6

  // Unsubscribe from doubled
  unsubDoubled();
  console.log("\nUnsubscribed from doubled. Decrementing:");

  await app.act("decrement").done();
  // → [count] 2
  // (no doubled output)

  // Unsubscribe from count too
  unsubCount();
  console.log("\nUnsubscribed from count. Incrementing (silent):");

  await app.act("increment").done();
  // (no output — both unsubscribed)

  // Manual state read still works
  const state = app.getState();
  console.log("\nFinal state (manual read):");
  console.log("  count:", state.data.count);
  console.log("  doubled:", state.computed["computed.doubled"]);
  console.log("  isPositive:", state.computed["computed.isPositive"]);

  await app.dispose();
  console.log("\nDone!");
}

main().catch(console.error);
