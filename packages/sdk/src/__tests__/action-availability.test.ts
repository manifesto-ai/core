import { describe, expect, it } from "vitest";
import {
  type DomainSchema,
  hashSchemaSync,
  semanticPathToPatchPath,
} from "@manifesto-ai/core";

import { createManifesto, dispatchAsync } from "../index.js";

const pp = semanticPathToPatchPath;

function createTestSchema(): DomainSchema {
  const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
    id: "manifesto:sdk-action-availability-test",
    version: "1.0.0",
    types: {},
    state: {
      fields: {
        count: { type: "number", required: false, default: 0 },
      },
    },
    computed: { fields: {} },
    actions: {
      increment: {
        available: {
          kind: "lt",
          left: { kind: "get", path: "count" },
          right: { kind: "lit", value: 1 },
        },
        flow: {
          kind: "patch",
          op: "set",
          path: pp("count"),
          value: {
            kind: "add",
            left: { kind: "get", path: "count" },
            right: { kind: "lit", value: 1 },
          },
        },
      },
      reset: {
        flow: {
          kind: "patch",
          op: "set",
          path: pp("count"),
          value: { kind: "lit", value: 0 },
        },
      },
    },
  };

  return {
    ...schemaWithoutHash,
    hash: hashSchemaSync(schemaWithoutHash),
  };
}

describe("sdk action availability", () => {
  it("reflects the current snapshot through createManifesto()", async () => {
    const instance = createManifesto({
      schema: createTestSchema(),
      effects: {},
    });

    try {
      expect(instance.isActionAvailable("increment")).toBe(true);
      expect(instance.getAvailableActions()).toEqual(["increment", "reset"]);

      await dispatchAsync(instance, { type: "increment" });

      expect(instance.isActionAvailable("increment")).toBe(false);
      expect(instance.getAvailableActions()).toEqual(["reset"]);
    } finally {
      instance.dispose();
    }
  });

  it("throws when action is missing", () => {
    const instance = createManifesto({
      schema: createTestSchema(),
      effects: {},
    });

    try {
      expect(() => instance.isActionAvailable("missing")).toThrow("Unknown action: missing");
    } finally {
      instance.dispose();
    }
  });

  it("does not emit events or mutate snapshot when queried", () => {
    const instance = createManifesto({
      schema: createTestSchema(),
      effects: {},
    });
    let completedEvents = 0;
    let selectorCalls = 0;

    const before = instance.getSnapshot();
    const offEvent = instance.on("dispatch:completed", () => {
      completedEvents += 1;
    });
    const offSub = instance.subscribe(
      (snapshot) => snapshot.data,
      () => {
        selectorCalls += 1;
      }
    );

    try {
      expect(instance.isActionAvailable("increment")).toBe(true);
      expect(instance.getAvailableActions()).toEqual(["increment", "reset"]);
      expect(instance.getSnapshot()).toEqual(before);
      expect(completedEvents).toBe(0);
      expect(selectorCalls).toBe(0);
    } finally {
      offEvent();
      offSub();
      instance.dispose();
    }
  });
});
