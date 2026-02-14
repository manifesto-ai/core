/**
 * Publish Boundary Tests (Standard Compliance)
 *
 * @see SPEC v2.0.0 §17
 * @see FDR-APP-PUB-001
 */

import { describe, it, expect } from "vitest";
import { createApp, createTestApp } from "../index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import type { Snapshot } from "../index.js";

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
    const app = createTestApp(schema);
    await app.ready();

    const publishes: Array<{ snapshot: Snapshot; worldId: string }> = [];
    app.hooks.on("state:publish", (payload) => {
      publishes.push(payload);
    });

    const handle = app.act("todo.add", { title: "test" });
    await handle.done();

    expect(publishes.length).toBe(1);
  });
});
