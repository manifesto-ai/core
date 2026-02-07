/**
 * Example 01: Counter
 *
 * The simplest Manifesto app — a counter with increment, decrement, and reset.
 * Demonstrates: createApp, act(), getState(), ready()/dispose()
 *
 * Run: cd packages/app && pnpm exec tsx examples/01-counter/main.ts
 */

import { createApp, createSilentPolicyService } from "../../src/index.js";

const app = createApp({
  schema: `
    domain Counter {
      state {
        count: number = 0
      }

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

      action reset() {
        onceIntent {
          patch count = 0
        }
      }
    }
  `,
  effects: {},
  policyService: createSilentPolicyService(),
});

async function main() {
  await app.ready();

  console.log("Initial count:", app.getState().data.count);
  // → Initial count: 0

  await app.act("increment").done();
  await app.act("increment").done();
  await app.act("increment").done();
  console.log("After 3 increments:", app.getState().data.count);
  // → After 3 increments: 3

  await app.act("decrement").done();
  console.log("After decrement:", app.getState().data.count);
  // → After decrement: 2

  await app.act("reset").done();
  console.log("After reset:", app.getState().data.count);
  // → After reset: 0

  await app.dispose();
  console.log("Done!");
}

main().catch(console.error);
