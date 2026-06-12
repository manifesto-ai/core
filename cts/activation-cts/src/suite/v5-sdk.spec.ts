import { describe, expect, it, vi } from "vitest";
import { createManifesto } from "@manifesto-ai/sdk";
import { createSimulationSession, getExtensionKernel } from "@manifesto-ai/sdk/extensions";

import { caseTitle, ACTS_CASES } from "../acts-coverage.js";
import {
  createCollisionSchema,
  createCounterSchema,
  createFailingSchema,
  createHaltingSchema,
  createRootNameCollisionSchema,
  type CollisionDomain,
  type CounterDomain,
  type FailingDomain,
  type HaltingDomain,
  type RootNameCollisionDomain,
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
        "computed",
        "context",
        "dispose",
        "getAction",
        "injectContext",
        "inspect",
        "observe",
        "snapshot",
        "state",
        "updateContext",
        "with",
      ]);
      expect("dispatchAsync" in app).toBe(false);
      expect("createIntent" in app).toBe(false);
      expect("getSnapshot" in app).toBe(false);
      expect(app.context()).toEqual({});
      expect(Object.isFrozen(app.context())).toBe(true);
      expect(app.snapshot()).not.toHaveProperty("data");
      expect(app.snapshot()).not.toHaveProperty("namespaces");
      expect(Object.keys(app.snapshot().meta)).toEqual(["schemaHash"]);
      expect(app.inspect.canonicalSnapshot()).toHaveProperty("namespaces");
      expect(Object.keys(app.action.increment).sort()).toEqual([
        "available",
        "bind",
        "check",
        "info",
        "preview",
        "submit",
      ]);
      expect(app.getAction("increment")).toBe(app.action.increment);
      expect(app.getAction("missing")).toBeUndefined();
      expect(app.action.increment.info().name).toBe("increment");
    },
  );

  it(
    caseTitle(
      ACTS_CASES.V5_ACTION_CANDIDATE_SURFACE,
      "root getAction() performs declared lookup without availability filtering.",
    ),
    async () => {
      const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

      await app.action.increment.submit();
      const handle = app.getAction("incrementIfEven");

      expect(handle).toBe(app.action.incrementIfEven);
      expect(handle.available()).toBe(false);
      expect(handle.check()).toMatchObject({
        ok: false,
        layer: "availability",
        code: "ACTION_UNAVAILABLE",
      });
      expect(app.getAction("missing")).toBeUndefined();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.V5_ACTION_CANDIDATE_SURFACE,
      "root getAction() preserves the selected execution view.",
    ),
    async () => {
      const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const result = await app.with({ report: "none" }).getAction("add").submit(2);

      expect(result).toMatchObject({
        ok: true,
        mode: "base",
        status: "settled",
        action: "add",
      });
      expect(result.ok && "report" in result).toBe(false);
      expect(app.snapshot().state.count).toBe(2);
    },
  );

  it(
    caseTitle(
      ACTS_CASES.V5_ACTION_CANDIDATE_SURFACE,
      "reserved public action names are rejected before activation.",
    ),
    () => {
      expect(() => {
        createManifesto<CollisionDomain>(createCollisionSchema(), {}).activate();
      }).toThrow(/RESERVED_ACTION_NAME|reserved/);
    },
  );

  it(
    caseTitle(
      ACTS_CASES.V5_ACTION_CANDIDATE_SURFACE,
      "valid root-name actions remain domain actions under action.* and getAction().",
    ),
    async () => {
      const app = createManifesto<RootNameCollisionDomain>(
        createRootNameCollisionSchema(),
        {},
      ).activate();

      for (const [name, value] of Object.entries({
        get: 1,
        bind: 2,
        state: 3,
        computed: 4,
        inspect: 5,
        snapshot: 6,
        with: 7,
        dispose: 8,
        getAction: 9,
        toString: 10,
        hasOwnProperty: 11,
        valueOf: 12,
      }) as Array<[keyof RootNameCollisionDomain["actions"], number]>) {
        expect(app.action).toHaveProperty(name);
        expect(app.getAction(name)).toBe(app.action[name]);
        await app.action[name].submit();
        expect(app.snapshot().state.count).toBe(value);
      }
    },
  );

  it(
    caseTitle(
      ACTS_CASES.V5_ADMISSION_AND_PREVIEW,
      "check() and preview() preserve first-failing admission order and preview non-commit semantics.",
    ),
    async () => {
      const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

      const scalarBound = app.action.add.bind(2);
      expect(scalarBound.input).toBe(2);
      expect(scalarBound.intent()).toMatchObject({
        type: "add",
        input: { amount: 2 },
      });

      const objectBound = app.action.replace.bind({ count: 7 });
      expect(objectBound.input).toEqual({ count: 7 });
      expect(objectBound.intent()).toMatchObject({
        type: "replace",
        input: { count: 7 },
      });

      expect(app.action.add.check("bad" as unknown as number)).toMatchObject({
        ok: false,
        layer: "input",
        code: "INVALID_INPUT",
      });

      await app.action.increment.submit();
      expect(app.action.addWhenPositive.check("bad" as unknown as number)).toMatchObject({
        ok: false,
        layer: "input",
        code: "INVALID_INPUT",
      });
      expect(app.action.addWhenPositive.check(0)).toMatchObject({
        ok: false,
        layer: "dispatchability",
        code: "INTENT_NOT_DISPATCHABLE",
      });
      expect(app.action.incrementIfEven.check()).toMatchObject({
        ok: false,
        layer: "availability",
        code: "ACTION_UNAVAILABLE",
      });

      const before = app.snapshot();
      const preview = app.action.add.preview(4);
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

      const rejected = await app.action.add.submit("bad" as unknown as number);
      expect(rejected).toMatchObject({
        ok: false,
        mode: "base",
        action: "add",
        admission: { layer: "input", code: "INVALID_INPUT" },
      });

      const result = await app.action.add.submit(3);
      expect(result).toMatchObject({
        ok: true,
        mode: "base",
        status: "settled",
        action: "add",
        outcome: { kind: "ok" },
      });
      expect(result.ok && result.before.state.count).toBe(0);
      expect(result.ok && result.after.state.count).toBe(3);

      const full = await app.with({ report: "full" }).action.add.submit(2);
      expect(full).toMatchObject({
        ok: true,
        status: "settled",
        report: {
          mode: "base",
          action: "add",
          outcome: { kind: "ok" },
        },
      });
      expect(full.ok && full.report).toMatchObject({
        changes: expect.any(Array),
        requirements: expect.any(Array),
      });

      const stopped = await createManifesto<HaltingDomain>(createHaltingSchema(), {})
        .activate()
        .with({ report: "full" })
        .action.finalize.submit();
      expect(stopped).toMatchObject({
        ok: true,
        status: "settled",
        outcome: { kind: "stop", reason: "done" },
        report: { outcome: { kind: "stop" } },
      });

      const failed = await createManifesto<FailingDomain>(createFailingSchema(), {})
        .activate()
        .with({ report: "full" })
        .action.fail.submit();
      expect(failed).toMatchObject({
        ok: true,
        status: "settled",
        outcome: {
          kind: "fail",
          error: { message: "repair required" },
        },
        report: { outcome: { kind: "fail" } },
      });
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
      const afterThrow = vi.fn();
      const proposalCreated = vi.fn();
      const sequence: string[] = [];
      app.observe.event("submission:admitted", () => sequence.push("submission:admitted"));
      app.observe.event("submission:submitted", () => sequence.push("submission:submitted"));
      app.observe.event("submission:settled", () => {
        throw new Error("observer failed");
      });
      app.observe.event("submission:settled", settled);
      app.observe.event("submission:settled", afterThrow);
      app.observe.event("submission:settled", () => sequence.push("submission:settled"));
      app.observe.event("proposal:created", proposalCreated);

      const result = await app.action.increment.submit();

      expect(result.ok).toBe(true);
      expect(settled).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "increment",
          mode: "base",
          outcome: { kind: "ok" },
          schemaHash: app.inspect.schemaHash(),
        }),
      );
      expect(afterThrow).toHaveBeenCalledTimes(1);
      expect(sequence).toEqual([
        "submission:admitted",
        "submission:submitted",
        "submission:settled",
      ]);
      expect(proposalCreated).not.toHaveBeenCalled();
      expect(settled.mock.calls[0]?.[0]).not.toHaveProperty("snapshot");
      expect(settled.mock.calls[0]?.[0]).not.toHaveProperty("canonicalSnapshot");
    },
  );

  it(
    caseTitle(
      ACTS_CASES.V5_OBSERVE_STATE,
      "observe.state() observes terminal projected snapshot changes without immediate registration callbacks.",
    ),
    async () => {
      const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const observed: Array<readonly [number, number]> = [];

      app.observe.state(
        (snapshot) => snapshot.state.count,
        (next, prev) => observed.push([next, prev]),
      );

      expect(observed).toEqual([]);

      await app.action.increment.submit();

      expect(observed).toEqual([[1, 0]]);
    },
  );

  it(
    caseTitle(
      ACTS_CASES.V5_INSPECT_READS,
      "inspect.* exposes current active-runtime reads without restoring v3 root verbs.",
    ),
    async () => {
      const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

      expect(app.inspect.schemaHash()).toBe(app.inspect.canonicalSnapshot().meta.schemaHash);
      expect(app.inspect.action("increment")).toEqual(app.action.increment.info());
      expect(app.inspect.availableActions().map((action) => action.name)).toContain(
        "incrementIfEven",
      );

      await app.action.increment.submit();

      expect(app.inspect.availableActions().map((action) => action.name)).not.toContain(
        "incrementIfEven",
      );
      expect("getCanonicalSnapshot" in app).toBe(false);
      expect("getAvailableActions" in app).toBe(false);
    },
  );

  it(
    caseTitle(
      ACTS_CASES.V5_EXTENSION_KERNEL,
      "extension-kernel APIs remain under @manifesto-ai/sdk/extensions and stay read-only.",
    ),
    () => {
      const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const ext = getExtensionKernel(app);
      const root = ext.getCanonicalSnapshot();
      const intent = ext.createIntent(ext.MEL.actions.increment);
      const simulated = ext.simulateSync(root, intent);
      const projected = ext.projectSnapshot(simulated.snapshot);
      const session = createSimulationSession(app);
      const branch = session.next(ext.MEL.actions.increment);

      expect("kernel" in app).toBe(false);
      expect("setVisibleSnapshot" in ext).toBe(false);
      expect(app.snapshot().state.count).toBe(0);
      expect(projected.state.count).toBe(1);
      expect(branch.snapshot.state.count).toBe(1);
      expect(app.snapshot().state.count).toBe(0);
    },
  );
});
