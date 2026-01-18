/**
 * Golden Test: Complex Effect Scenarios
 *
 * Tests complex effect execution patterns:
 * - Single effect with success
 * - Sequential effects
 * - Conditional effects
 * - Effect with state updates
 *
 * Verifies:
 * - Effect execution order
 * - State updates from effects
 * - Effect result application
 * - Requirement lifecycle
 *
 * @see host-SPEC-v2.0.1.md §7-8 (Effect Handler Contract, Requirement Lifecycle)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createGoldenRunner,
  createGoldenSchema,
  stripHostState,
  type GoldenRunner,
  type GoldenScenario,
} from "../helpers/index.js";
import type { EffectHandler } from "../../../effects/types.js";

describe("Golden: Complex Effect Scenarios", () => {
  let runner: GoldenRunner;

  beforeEach(() => {
    runner = createGoldenRunner();
  });

  afterEach(async () => {
    await runner.dispose();
  });

  /**
   * Create a schema with effect-based actions
   *
   * IMPORTANT: All flows with effects must be re-entry safe.
   * Effects trigger another compute cycle when fulfilled, so:
   * - Use state guards (isNull checks) to prevent re-execution
   * - Response field being null indicates "not yet fetched"
   */
  function createEffectSchema() {
    return createGoldenSchema({
      id: "golden:effects",
      fields: {
        response: { type: "object" },
        fetchCount: { type: "number" },
        loading: { type: "boolean" },
        errorMessage: { type: "string" },
        lastUrl: { type: "string" },
      },
      actions: {
        // Simple fetch with state guard - only fetches if response is null
        fetchData: {
          flow: {
            kind: "if",
            cond: {
              kind: "isNull",
              arg: { kind: "get", path: "response" },
            },
            then: {
              kind: "seq",
              steps: [
                {
                  kind: "patch",
                  op: "set",
                  path: "loading",
                  value: { kind: "lit", value: true },
                },
                {
                  kind: "effect",
                  type: "api:fetch",
                  params: {
                    url: { kind: "get", path: "input.url" },
                  },
                },
              ],
            },
          },
        },
        // Increment counter only (no effect) - re-entry safe for pure patches
        incrementCounter: {
          flow: {
            kind: "patch",
            op: "set",
            path: "fetchCount",
            value: {
              kind: "add",
              left: {
                kind: "coalesce",
                args: [{ kind: "get", path: "fetchCount" }, { kind: "lit", value: 0 }],
              },
              right: { kind: "lit", value: 1 },
            },
          },
        },
        // Conditional fetch based on fetchCount
        conditionalFetch: {
          flow: {
            kind: "if",
            cond: {
              kind: "gt",
              left: { kind: "get", path: "fetchCount" },
              right: { kind: "lit", value: 0 },
            },
            then: {
              // Guard: only execute if response is null
              kind: "if",
              cond: {
                kind: "isNull",
                arg: { kind: "get", path: "response" },
              },
              then: {
                kind: "effect",
                type: "api:fetch",
                params: { url: { kind: "lit", value: "/api/conditional" } },
              },
            },
            else: {
              kind: "patch",
              op: "set",
              path: "errorMessage",
              value: { kind: "lit", value: "No fetches yet" },
            },
          },
        },
        // Simple fetch guarded by response being null
        simpleFetch: {
          flow: {
            kind: "if",
            cond: {
              kind: "isNull",
              arg: { kind: "get", path: "response" },
            },
            then: {
              kind: "effect",
              type: "api:fetch",
              params: {
                url: { kind: "lit", value: "/api/simple" },
              },
            },
          },
        },
        // Reset response to allow another fetch
        resetResponse: {
          flow: {
            kind: "seq",
            steps: [
              {
                kind: "patch",
                op: "set",
                path: "response",
                value: { kind: "lit", value: null },
              },
              {
                kind: "patch",
                op: "set",
                path: "lastUrl",
                value: { kind: "lit", value: "" },
              },
            ],
          },
        },
      },
    });
  }

  /**
   * Create deterministic effect handlers
   * Effect handlers return simple patch values (no expressions)
   */
  function createEffectHandlers() {
    return {
      "api:fetch": (async (_type, params) => {
        const url = params.url as string;
        return [
          { op: "set", path: "loading", value: false },
          { op: "set", path: "response", value: { url, success: true } },
          { op: "set", path: "lastUrl", value: url },
        ];
      }) as EffectHandler,
    };
  }

  describe("Single Effect Execution", () => {
    it("should execute a single fetch effect", async () => {
      const scenario: GoldenScenario = {
        id: "single-effect-fetch",
        description: "Single fetch effect execution",
        schema: createEffectSchema(),
        initialData: {
          response: null,
          fetchCount: 0,
          loading: false,
          errorMessage: "",
          lastUrl: "",
        },
        effectHandlers: createEffectHandlers(),
        intents: [{ type: "fetchData", input: { url: "/api/test" } }],
      };

      const result = await runner.execute(scenario);

      // Verify loading was set and then unset by effect
      expect(result.finalSnapshot.data).toMatchObject({
        loading: false,
        response: { url: "/api/test", success: true },
        lastUrl: "/api/test",
      });
    });

    it("should track fetch count with separate increment intents", async () => {
      // Counter increments and fetches are separate to avoid re-entry issues
      const scenario: GoldenScenario = {
        id: "effect-with-counter",
        description: "Separate counter increments then fetch",
        schema: createEffectSchema(),
        initialData: {
          response: null,
          fetchCount: 0,
          loading: false,
          errorMessage: "",
          lastUrl: "",
        },
        effectHandlers: createEffectHandlers(),
        intents: [
          { type: "incrementCounter" },
          { type: "incrementCounter" },
          { type: "incrementCounter" },
          { type: "simpleFetch" },
        ],
      };

      const result = await runner.execute(scenario);

      // Fetch count should be 3 from the 3 increment intents
      expect((result.finalSnapshot.data as any).fetchCount).toBe(3);
      expect((result.finalSnapshot.data as any).lastUrl).toBe("/api/simple");
    });
  });

  describe("Conditional Effects", () => {
    it("should skip effect when condition is false", async () => {
      const scenario: GoldenScenario = {
        id: "conditional-effect-skip",
        description: "Conditional effect - skip branch",
        schema: createEffectSchema(),
        initialData: {
          response: null,
          fetchCount: 0, // Condition will be false
          loading: false,
          errorMessage: "",
          lastUrl: "",
        },
        effectHandlers: createEffectHandlers(),
        intents: [{ type: "conditionalFetch" }],
      };

      const result = await runner.execute(scenario);

      // Should have error message, not response
      expect((result.finalSnapshot.data as any).errorMessage).toBe("No fetches yet");
      expect((result.finalSnapshot.data as any).response).toBeNull();
    });

    it("should execute effect when condition is true", async () => {
      const scenario: GoldenScenario = {
        id: "conditional-effect-execute",
        description: "Conditional effect - execute branch",
        schema: createEffectSchema(),
        initialData: {
          response: null,
          fetchCount: 5, // Condition will be true (> 0)
          loading: false,
          errorMessage: "",
          lastUrl: "",
        },
        effectHandlers: createEffectHandlers(),
        intents: [{ type: "conditionalFetch" }],
      };

      const result = await runner.execute(scenario);

      // Should have response from effect, error message unchanged
      expect((result.finalSnapshot.data as any).response).toEqual({
        url: "/api/conditional",
        success: true,
      });
      expect((result.finalSnapshot.data as any).lastUrl).toBe("/api/conditional");
    });
  });

  describe("Effect State History", () => {
    it("should track state changes through effect lifecycle", async () => {
      const scenario: GoldenScenario = {
        id: "effect-state-history",
        description: "Track state through effect",
        schema: createEffectSchema(),
        initialData: {
          response: null,
          fetchCount: 0,
          loading: false,
          errorMessage: "",
          lastUrl: "",
        },
        effectHandlers: createEffectHandlers(),
        intents: [
          { type: "simpleFetch" },
          { type: "incrementCounter" },
          { type: "resetResponse" },  // Reset to allow another fetch
          { type: "conditionalFetch" }, // Now fetchCount > 0, should fetch
        ],
      };

      const result = await runner.execute(scenario);

      // Verify state history
      expect(result.stateHistory).toHaveLength(4);

      // After first fetch
      expect(result.stateHistory[0].snapshot.data).toMatchObject({
        lastUrl: "/api/simple",
      });

      // After increment
      expect((result.stateHistory[1].snapshot.data as any).fetchCount).toBe(1);

      // After reset
      expect(result.stateHistory[2].snapshot.data).toMatchObject({
        response: null,
        lastUrl: "",
      });

      // After conditional fetch (fetchCount=1 > 0, so it executes)
      expect(result.stateHistory[3].snapshot.data).toMatchObject({
        lastUrl: "/api/conditional",
      });
    });
  });

  describe("Effect Determinism", () => {
    it("should execute effects deterministically across runs", async () => {
      const scenario: GoldenScenario = {
        id: "effect-determinism",
        description: "Effect execution determinism",
        schema: createEffectSchema(),
        initialData: {
          response: null,
          fetchCount: 0,
          loading: false,
          errorMessage: "",
          lastUrl: "",
        },
        effectHandlers: createEffectHandlers(),
        intents: [
          { type: "incrementCounter" },
          { type: "incrementCounter" },
          { type: "conditionalFetch" }, // Should execute (fetchCount > 0)
        ],
      };

      const verification = await runner.verifyDeterminism(scenario, 3);
      expect(verification.deterministic).toBe(true);

      // All runs should have same final state
      const states = verification.results.map((r) =>
        JSON.stringify(stripHostState(r.finalSnapshot.data))
      );
      expect(new Set(states).size).toBe(1);

      // Verify the expected final state
      const finalData = verification.results[0].finalSnapshot.data as any;
      expect(finalData.fetchCount).toBe(2);
      expect(finalData.lastUrl).toBe("/api/conditional");
    });
  });

  describe("Effect Trace Events", () => {
    it("should emit effect-related trace events", async () => {
      const scenario: GoldenScenario = {
        id: "effect-trace-events",
        description: "Effect trace event emission",
        schema: createEffectSchema(),
        initialData: {
          response: null,
          fetchCount: 0,
          loading: false,
          errorMessage: "",
          lastUrl: "",
        },
        effectHandlers: createEffectHandlers(),
        intents: [{ type: "simpleFetch" }],
      };

      const result = await runner.execute(scenario);

      // Check for core events at minimum
      const coreEvents = result.trace.filter(
        (e) => e.t === "core:compute" || e.t === "core:apply"
      );

      // Should have some core events
      expect(coreEvents.length).toBeGreaterThan(0);
    });

    it("should have consistent trace across runs with effects", async () => {
      const scenario: GoldenScenario = {
        id: "effect-trace-consistency",
        description: "Effect trace consistency",
        schema: createEffectSchema(),
        initialData: {
          response: null,
          fetchCount: 0,
          loading: false,
          errorMessage: "",
          lastUrl: "",
        },
        effectHandlers: createEffectHandlers(),
        intents: [
          { type: "simpleFetch" },
          { type: "fetchWithCounter", input: { url: "/api/test" } },
        ],
      };

      const verification = await runner.verifyDeterminism(scenario, 3);

      // Trace event counts should be consistent
      const traceCounts = verification.results.map((r) => r.trace.length);
      expect(new Set(traceCounts).size).toBe(1);
    });
  });

  describe("Multiple Intent Effect Chains", () => {
    it("should handle effect chains across multiple intents", async () => {
      const scenario: GoldenScenario = {
        id: "multi-intent-effects",
        description: "Effect chains across intents",
        schema: createEffectSchema(),
        initialData: {
          response: null,
          fetchCount: 0,
          loading: false,
          errorMessage: "",
          lastUrl: "",
        },
        effectHandlers: createEffectHandlers(),
        intents: [
          { type: "incrementCounter" },  // fetchCount = 1
          { type: "incrementCounter" },  // fetchCount = 2
          { type: "conditionalFetch" },  // Execute (fetchCount > 0)
          { type: "resetResponse" },     // Reset to allow another fetch
          { type: "simpleFetch" },       // Another fetch
        ],
      };

      const result = await runner.execute(scenario);
      const data = result.finalSnapshot.data as any;

      // Verify final state
      expect(data.fetchCount).toBe(2);
      expect(data.lastUrl).toBe("/api/simple"); // Last fetch was simpleFetch
    });

    it("should maintain determinism with complex effect chains", async () => {
      const scenario: GoldenScenario = {
        id: "complex-effect-chain-determinism",
        description: "Complex effect chain determinism",
        schema: createEffectSchema(),
        initialData: {
          response: null,
          fetchCount: 0,
          loading: false,
          errorMessage: "",
          lastUrl: "",
        },
        effectHandlers: createEffectHandlers(),
        intents: [
          { type: "conditionalFetch" },  // Skip (fetchCount=0), sets errorMessage
          { type: "incrementCounter" },  // fetchCount = 1
          { type: "resetResponse" },     // Reset to allow fetch
          { type: "conditionalFetch" },  // Execute (fetchCount=1 > 0)
          { type: "incrementCounter" },  // fetchCount = 2
        ],
      };

      const verification = await runner.verifyDeterminism(scenario, 3);
      expect(verification.deterministic).toBe(true);

      // First run state check
      const finalData = verification.results[0].finalSnapshot.data as any;
      expect(finalData.fetchCount).toBe(2);
      expect(finalData.errorMessage).toBe("No fetches yet"); // Set by first conditional
      expect(finalData.lastUrl).toBe("/api/conditional"); // From the second conditionalFetch
    });
  });
});
