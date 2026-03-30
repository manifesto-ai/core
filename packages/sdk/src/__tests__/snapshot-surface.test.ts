import { describe, expect, it } from "vitest";

import { createManifesto, dispatchAsync, type Snapshot } from "../index.js";

type CounterState = {
  count: number;
  $host?: Record<string, unknown>;
  $mel?: Record<string, unknown>;
};

const COUNTER_DOMAIN = `
  domain Counter {
    state {
      count: number = 0
    }

    action increment() {
      when true {
        patch count = count + 1
      }
    }
  }
`;

describe("sdk snapshot surface", () => {
  it("propagates the same direct-dispatch snapshot shape through guard, subscribe, events, and getSnapshot", async () => {
    let guardSnapshot: Snapshot<CounterState> | undefined;
    const selectorSnapshots: Snapshot<CounterState>[] = [];
    let completedSnapshot: Snapshot<CounterState> | undefined;

    const instance = createManifesto<CounterState>({
      schema: COUNTER_DOMAIN,
      effects: {},
      guard: (_intent, snapshot) => {
        guardSnapshot = snapshot;
        return true;
      },
    });

    const offSub = instance.subscribe(
      (snapshot) => {
        selectorSnapshots.push(snapshot);
        return snapshot.data.count;
      },
      () => {},
    );
    const offCompleted = instance.on("dispatch:completed", (event) => {
      completedSnapshot = event.snapshot;
    });

    try {
      const terminalSnapshot = await dispatchAsync(instance, { type: "increment" });
      const currentSnapshot = instance.getSnapshot();

      expect(guardSnapshot?.system.lastError).toBeNull();
      expect(selectorSnapshots).toHaveLength(2);
      expect(selectorSnapshots[0]?.system.lastError).toBeNull();
      expect(selectorSnapshots[0]?.data.count).toBe(0);
      expect(selectorSnapshots[1]?.system.lastError).toBeNull();
      expect(selectorSnapshots[1]?.data.count).toBe(1);
      expect(completedSnapshot?.system.lastError).toBeNull();
      expect(completedSnapshot?.data.count).toBe(1);
      expect(terminalSnapshot).toEqual(completedSnapshot);
      expect(currentSnapshot).toEqual(completedSnapshot);
    } finally {
      offSub();
      offCompleted();
      instance.dispose();
    }
  });
});
