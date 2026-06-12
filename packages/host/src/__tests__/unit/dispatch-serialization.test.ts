import { semanticPathToPatchPath } from "@manifesto-ai/core";
import { describe, it, expect } from "vitest";

import { createHost } from "../../host.js";
import { createTestSchema, createTestIntentWithId, stripHostState } from "../helpers/index.js";

const pp = semanticPathToPatchPath;

/**
 * Regression tests for #476: the dispatch critical section (read baseline
 * from the stateful head -> execute -> write final snapshot back) must be
 * serialized. Concurrent dispatches used to clone the same stale baseline
 * at the first await point, so the last writer silently discarded every
 * other dispatch's state transition.
 */
function createIncrementHost() {
  const schema = createTestSchema({
    actions: {
      increment: {
        flow: {
          kind: "patch",
          op: "set",
          path: pp("count"),
          value: {
            kind: "add",
            left: {
              kind: "coalesce",
              args: [
                { kind: "get", path: "count" },
                { kind: "lit", value: 0 },
              ],
            },
            right: { kind: "lit", value: 1 },
          },
        },
      },
    },
  });
  return createHost(schema, { initialData: { count: 0 } });
}

describe("stateful dispatch head serialization (#476)", () => {
  it("does not lose updates across two concurrent dispatches", async () => {
    const host = createIncrementHost();

    const [first, second] = await Promise.all([
      host.dispatch(createTestIntentWithId("increment", "inc-1")),
      host.dispatch(createTestIntentWithId("increment", "inc-2")),
    ]);

    expect(first.status).toBe("complete");
    expect(second.status).toBe("complete");
    expect(stripHostState(host.getSnapshot()?.state)).toEqual({ count: 2 });
  });

  it("does not lose updates across many concurrent dispatches", async () => {
    const host = createIncrementHost();
    const total = 25;

    const results = await Promise.all(
      Array.from({ length: total }, (_, index) =>
        host.dispatch(createTestIntentWithId("increment", `inc-${index}`)),
      ),
    );

    for (const result of results) {
      expect(result.status).toBe("complete");
    }
    expect(stripHostState(host.getSnapshot()?.state)).toEqual({ count: total });
  });

  it("keeps dispatch results ordered against the head they observed", async () => {
    const host = createIncrementHost();

    const [first, second] = await Promise.all([
      host.dispatch(createTestIntentWithId("increment", "inc-a")),
      host.dispatch(createTestIntentWithId("increment", "inc-b")),
    ]);

    // The serialized second dispatch must observe the first one's write.
    expect(stripHostState(first.snapshot.state)).toEqual({ count: 1 });
    expect(stripHostState(second.snapshot.state)).toEqual({ count: 2 });
  });
});
