import { describe, expect, it, vi } from "vitest";
import { createManifesto } from "@manifesto-ai/sdk";

import { caseTitle, ACTS_CASES } from "../acts-coverage.js";
import {
  createCounterSchema,
  type CounterDomain,
} from "../helpers/schema.js";

describe("ACTS SDK v5 Action Candidate Suite", () => {
  it(
    caseTitle(
      ACTS_CASES.V5_ACTION_CANDIDATE_SURFACE,
      "Activated runtime exposes the v5 root and action-handle grammar without v3 root verbs.",
    ),
    () => {
      const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

      expect(Object.keys(app).sort()).toEqual([
        "action",
        "actions",
        "dispose",
        "inspect",
        "observe",
        "snapshot",
      ]);
      expect("dispatchAsync" in app).toBe(false);
      expect("createIntent" in app).toBe(false);
      expect("getSnapshot" in app).toBe(false);
      expect(Object.keys(app.actions.increment).sort()).toEqual([
        "available",
        "bind",
        "check",
        "info",
        "preview",
        "submit",
      ]);
      expect(app.action("increment").info().name).toBe("increment");
    },
  );

  it(
    caseTitle(
      ACTS_CASES.V5_ADMISSION_AND_PREVIEW,
      "check() and preview() preserve first-failing admission order and preview non-commit semantics.",
    ),
    async () => {
      const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

      expect(app.actions.add.check("bad" as unknown as number)).toMatchObject({
        ok: false,
        layer: "input",
        code: "INVALID_INPUT",
      });

      await app.actions.increment.submit();
      expect(app.actions.incrementIfEven.check()).toMatchObject({
        ok: false,
        layer: "availability",
        code: "ACTION_UNAVAILABLE",
      });

      const before = app.snapshot();
      const preview = app.actions.add.preview(4);
      expect(preview.admitted).toBe(true);
      expect(preview.admitted && preview.after.state.count).toBe(5);
      expect(app.snapshot()).toBe(before);
      expect(app.snapshot().state.count).toBe(1);
    },
  );

  it(
    caseTitle(
      ACTS_CASES.V5_SUBMIT_RESULTS,
      "base submit() returns settled result envelopes, full projected snapshots, and explicit operational failures.",
    ),
    async () => {
      const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

      const rejected = await app.actions.add.submit("bad" as unknown as number);
      expect(rejected).toMatchObject({
        ok: false,
        mode: "base",
        action: "add",
        admission: { layer: "input", code: "INVALID_INPUT" },
      });

      const result = await app.actions.add.submit(3);
      expect(result).toMatchObject({
        ok: true,
        mode: "base",
        status: "settled",
        action: "add",
        outcome: { kind: "ok" },
      });
      expect(result.ok && result.before.state.count).toBe(0);
      expect(result.ok && result.after.state.count).toBe(3);
    },
  );

  it(
    caseTitle(
      ACTS_CASES.V5_OBSERVE_EVENTS,
      "observe.event() emits compact lifecycle payloads without embedding projected or canonical snapshots.",
    ),
    async () => {
      const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const settled = vi.fn();
      app.observe.event("submission:settled", settled);

      await app.actions.increment.submit();

      expect(settled).toHaveBeenCalledWith(expect.objectContaining({
        action: "increment",
        mode: "base",
        outcome: { kind: "ok" },
        schemaHash: app.inspect.schemaHash(),
      }));
      expect(settled.mock.calls[0]?.[0]).not.toHaveProperty("snapshot");
      expect(settled.mock.calls[0]?.[0]).not.toHaveProperty("canonicalSnapshot");
    },
  );
});
