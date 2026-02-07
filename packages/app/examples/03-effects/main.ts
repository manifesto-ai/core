/**
 * Example 03: Effects
 *
 * A user profile loader demonstrating effect handlers with success and error paths.
 * Demonstrates: effects config, EffectHandler signature, error-as-patches pattern
 *
 * Run: cd packages/app && pnpm exec tsx examples/03-effects/main.ts
 */

import { createApp, createSilentPolicyService } from "../../src/index.js";

// Mock user database
const mockUsers: Record<string, { id: string; name: string; email: string }> = {
  "123": { id: "123", name: "Alice", email: "alice@example.com" },
  "456": { id: "456", name: "Bob", email: "bob@example.com" },
};

const app = createApp({
  schema: `
    domain UserProfile {
      state {
        user: { id: string, name: string, email: string } | null = null
        status: string = "idle"
        error: string | null = null
      }

      action fetchUser(userId: string) {
        onceIntent {
          patch status = "loading"
          patch error = null
          effect api.fetchUser({ userId: userId })
        }
      }

      action resetProfile() {
        onceIntent {
          patch user = null
          patch status = "idle"
          patch error = null
        }
      }
    }
  `,
  effects: {
    "api.fetchUser": async (params, ctx) => {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      const userId = (params as { userId: string }).userId;
      const user = mockUsers[userId];

      if (!user) {
        return [
          { op: "set" as const, path: "status", value: "error" },
          { op: "set" as const, path: "error", value: `User ${userId} not found` },
        ];
      }

      return [
        { op: "set" as const, path: "user", value: user },
        { op: "set" as const, path: "status", value: "success" },
      ];
    },
  },
  policyService: createSilentPolicyService(),
});

async function main() {
  await app.ready();

  // Genesis defaults applied — verify initial state
  const initial = app.getState();
  console.log("Initial state:");
  console.log("  status:", initial.data.status);
  console.log("  user:", initial.data.user);
  console.log("  error:", initial.data.error);
  // → status: "idle"
  // → user: null
  // → error: null

  // Success case
  console.log("--- Fetching user 123 (exists) ---");
  await app.act("fetchUser", { userId: "123" }).done();

  const state1 = app.getState();
  console.log("Status:", state1.data.status);
  console.log("User:", state1.data.user);
  console.log("Error:", state1.data.error);

  // Reset before next fetch
  await app.act("resetProfile").done();
  console.log("\nAfter reset, status:", app.getState().data.status);

  // Error case
  console.log("\n--- Fetching user 999 (not found) ---");
  await app.act("fetchUser", { userId: "999" }).done();

  const state2 = app.getState();
  console.log("Status:", state2.data.status);
  console.log("User:", state2.data.user);
  console.log("Error:", state2.data.error);

  await app.dispose();
  console.log("\nDone!");
}

main().catch(console.error);
