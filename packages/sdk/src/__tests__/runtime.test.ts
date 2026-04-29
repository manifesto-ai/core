import { describe, expect, it, vi } from "vitest";

import {
  DisposedError,
  createManifesto,
} from "../index.js";
import { getExtensionKernel } from "../extensions.js";
import { projectedSnapshotsEqual } from "../projection/snapshot-projection.js";
import {
  createCounterSchema,
  type CounterDomain,
} from "./helpers/schema.js";

describe("activated v5 base runtime", () => {
  it("submits through action handles and publishes the terminal projected snapshot", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const listener = vi.fn();
    app.observe.state((snapshot) => snapshot.state.count, listener);

    const result = await app.actions.increment.submit();

    expect(result.ok && result.before.state.count).toBe(0);
    expect(result.ok && result.after.state.count).toBe(1);
    expect(app.snapshot().state.count).toBe(1);
    expect(listener).toHaveBeenCalledWith(1, 0);
  });

  it("returns projected snapshots from snapshot() and canonical substrate from inspect", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const projected = app.snapshot();
    const canonical = app.inspect.canonicalSnapshot();

    expect(projected.state).toEqual({ count: 0, status: "idle" });
    expect(projected).not.toHaveProperty("namespaces");
    expect(canonical.state.$host).toBeDefined();
    expect(canonical.state.$mel).toBeDefined();
    expect(canonical.namespaces).toBeDefined();
  });

  it("previews without publishing state and preserves pending status", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const before = app.snapshot();

    const preview = app.actions.load.preview();

    expect(preview.admitted).toBe(true);
    expect(preview.admitted && preview.status).toBe("pending");
    expect(preview.admitted && preview.after.state.status).toBe("loading");
    expect(preview.admitted && preview.requirements).toHaveLength(1);
    expect(app.snapshot()).toBe(before);
    expect(app.snapshot().state.status).toBe("idle");
  });

  it("keeps extension-kernel arbitrary-snapshot simulation read-only", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const ext = getExtensionKernel(app);
    const canonical = ext.getCanonicalSnapshot();
    const intent = ext.createIntent(ext.MEL.actions.increment);

    const first = ext.simulateSync(canonical, intent);
    const second = ext.simulateSync(canonical, intent);

    expect(first.status).toBe("complete");
    expect(first.snapshot.state.count).toBe(1);
    expect(second.snapshot.state.count).toBe(1);
    expect(app.inspect.canonicalSnapshot().state.count).toBe(0);
  });

  it("compares projected snapshots using state/computed/system/meta only", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    const before = app.snapshot();
    await app.actions.increment.submit();
    const after = app.snapshot();

    expect(projectedSnapshotsEqual(before, before)).toBe(true);
    expect(projectedSnapshotsEqual(before, after)).toBe(false);
  });

  it("disposes idempotently and rejects future submit calls", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    app.dispose();
    app.dispose();

    await expect(app.actions.increment.submit()).rejects.toBeInstanceOf(DisposedError);
    expect(app.snapshot().state.count).toBe(0);
  });

  it("does not let projected snapshot mutation leak back into runtime state", async () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
    await app.actions.add.submit(3);

    const snapshot = app.snapshot();
    expect(() => {
      (snapshot.state as { count: number }).count = 999;
    }).toThrow(TypeError);
    expect(app.snapshot().state.count).toBe(3);
  });
});
