/**
 * Golden Test: Trace-derived replay
 *
 * Validates that a recorded trace + host intent slots are sufficient to
 * reconstruct intent execution order and reproduce the same result.
 */

import { describe, it, expect } from "vitest";
import type { DomainSchema, Intent, Snapshot } from "@manifesto-ai/core";
import type { TraceEvent } from "../compliance/hcts-types.js";
import { createTestRuntime } from "../compliance/hcts-runtime.js";
import { V2HostAdapter } from "../compliance/adapter-v2.js";
import { SimpleTestEffectRunner } from "../compliance/hcts-adapter.js";
import type { EffectHandler } from "../../effects/types.js";
import { createGoldenSnapshot, normalizeTrace } from "./helpers/golden-runner.js";
import { getHostState } from "../../types/host-state.js";

type ReplayRunResult = {
  finalSnapshot: Snapshot;
  trace: TraceEvent[];
};

type ReplayScenario = {
  schema: DomainSchema;
  initialData: Record<string, unknown>;
  intents: Intent[];
  effectHandlers: Record<string, EffectHandler>;
};

const EXECUTION_KEY = "trace-replay-key";

async function runScenario({
  schema,
  initialData,
  intents,
  effectHandlers,
}: ReplayScenario): Promise<ReplayRunResult> {
  const runtime = createTestRuntime();
  const adapter = new V2HostAdapter();
  const effectRunner = new SimpleTestEffectRunner();

  for (const [type, handler] of Object.entries(effectHandlers)) {
    effectRunner.register(type, handler);
  }

  await adapter.create({ schema, effectRunner, runtime });

  const initialSnapshot = createGoldenSnapshot(initialData, schema.hash);
  adapter.seedSnapshot(EXECUTION_KEY, initialSnapshot);

  for (const intent of intents) {
    adapter.submitIntent(EXECUTION_KEY, intent);
    await adapter.drain(EXECUTION_KEY);
  }

  const finalSnapshot = adapter.getSnapshot(EXECUTION_KEY);
  const trace = adapter.getTrace(EXECUTION_KEY);

  await adapter.dispose();

  return { finalSnapshot, trace };
}

function extractReplayIntents(trace: TraceEvent[], snapshot: Snapshot): Intent[] {
  const hostState = getHostState(snapshot.data);
  const intentSlots = hostState?.intentSlots ?? {};
  const intentOrder: string[] = [];

  for (const event of trace) {
    if (event.t !== "core:compute") continue;
    if (!intentOrder.includes(event.intentId)) {
      intentOrder.push(event.intentId);
    }
  }

  return intentOrder.map((intentId) => {
    const slot = intentSlots[intentId];
    if (!slot) {
      throw new Error(`Missing intent slot for replay: ${intentId}`);
    }
    return {
      type: slot.type,
      input: slot.input,
      intentId,
    };
  });
}

describe("Golden: Trace-derived replay", () => {
  it("replays from trace-derived intent order and matches snapshot + trace", async () => {
    const schema: DomainSchema = {
      id: "golden:trace-replay",
      version: "1.0.0",
      hash: "golden:trace-replay-hash",
      types: {},
      state: {
        fields: {
          $host: { type: "object", required: false, default: {} },
          counter: { type: "number", required: true },
          response: { type: "string", required: false },
        },
      },
      computed: { fields: {} },
      actions: {
        increment: {
          flow: {
            kind: "patch",
            op: "set",
            path: "counter",
            value: {
              kind: "add",
              left: {
                kind: "coalesce",
                args: [{ kind: "get", path: "counter" }, { kind: "lit", value: 0 }],
              },
              right: { kind: "lit", value: 1 },
            },
          },
        },
        fetch: {
          flow: {
            kind: "if",
            cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
            then: {
              kind: "effect",
              type: "mock.fetch",
              params: { query: { kind: "lit", value: "ok" } },
            },
          },
        },
      },
    };

    const effectHandlers: Record<string, EffectHandler> = {
      "mock.fetch": async () => [
        { op: "set", path: "response", value: "done" },
      ],
    };

    const intents: Intent[] = [
      { type: "increment", intentId: "intent-1" },
      { type: "fetch", intentId: "intent-2" },
      { type: "increment", intentId: "intent-3" },
    ];

    const liveRun = await runScenario({
      schema,
      initialData: { counter: 0, response: null },
      intents,
      effectHandlers,
    });

    const replayIntents = extractReplayIntents(liveRun.trace, liveRun.finalSnapshot);

    const replayRun = await runScenario({
      schema,
      initialData: { counter: 0, response: null },
      intents: replayIntents,
      effectHandlers,
    });

    expect(liveRun.finalSnapshot.data).toEqual(replayRun.finalSnapshot.data);
    expect(normalizeTrace(liveRun.trace)).toEqual(normalizeTrace(replayRun.trace));
  });
});
