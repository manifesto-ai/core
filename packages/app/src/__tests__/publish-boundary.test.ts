/**
 * Publish Boundary Tests (Standard Compliance)
 *
 * @see SPEC v2.0.0 §17
 * @see FDR-APP-PUB-001
 */

import { describe, it, expect } from "vitest";
import { createApp } from "../index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import type { HookContext, Snapshot } from "../types/index.js";
import type { WorldId } from "@manifesto-ai/world";

declare module "../types/index.js" {
  interface AppHooks {
    "state:publish": (
      payload: { snapshot: Snapshot; worldId: WorldId },
      ctx: HookContext
    ) => void | Promise<void>;
  }
}

const schema: DomainSchema = {
  id: "test:publish",
  version: "1.0.0",
  hash: "schema-publish",
  types: {},
  actions: {
    "todo.add": {
      flow: { kind: "seq", steps: [] },
    },
  },
  computed: { fields: {} },
  state: { fields: {} },
};

describe("Publish Boundary", () => {
  it("PUB-BOUNDARY-1/2: state:publish fires once per proposal tick", async () => {
    const app = createApp(schema);
    await app.ready();

    const publishes: Array<{ snapshot: Snapshot; worldId: WorldId }> = [];
    app.hooks.on("state:publish", (payload) => {
      publishes.push(payload);
    });

    const handle = app.act("todo.add", { title: "test" });
    await handle.done();

    expect(publishes.length).toBe(1);
  });
});
