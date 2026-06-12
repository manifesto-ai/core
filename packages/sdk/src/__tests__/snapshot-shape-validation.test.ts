import { describe, expect, it } from "vitest";
import { createHost, createHostContextProvider, defaultRuntime } from "@manifesto-ai/host";
import { createSnapshot, extractDefaults, type Snapshot as CoreSnapshot } from "@manifesto-ai/core";

import { createManifesto } from "../index.js";
import { getRuntimeKernelFactory } from "../provider.js";
import { createRuntimeStateStore } from "../runtime/state-store.js";
import { createCounterSchema, type CounterDomain } from "./helpers/schema.js";

/**
 * Regression tests for #492: setVisibleSnapshot silently accepted snapshots
 * with unknown top-level keys. A v4-era "data" key next to the real "state"
 * disabled state preservation with no error, warning, or log. Hydration
 * inputs are external data; the seam now validates the canonical top-level
 * shape.
 */
function createStore() {
  const schema = createCounterSchema();
  const contextProvider = createHostContextProvider(defaultRuntime);
  const initial = createSnapshot(
    extractDefaults(schema.state),
    schema.hash,
    contextProvider.createInitialContext(),
  );
  const host = createHost(schema, {
    initialSnapshot: initial,
    runtime: defaultRuntime,
  });

  return {
    initial,
    store: createRuntimeStateStore<CounterDomain>({
      host,
      initialCanonicalSnapshot: initial,
      projectSnapshotFromCanonical: (snapshot) => structuredClone(snapshot) as never,
    }),
  };
}

describe("setVisibleSnapshot canonical shape validation (#492)", () => {
  it("accepts a well-formed canonical snapshot", () => {
    const { store, initial } = createStore();

    expect(() =>
      store.setVisibleSnapshot(structuredClone(initial), { notify: false }),
    ).not.toThrow();
  });

  it("rejects a snapshot carrying the v4 'data' key with a rename hint", () => {
    const { store, initial } = createStore();
    const v4Shaped = {
      ...structuredClone(initial),
      data: { count: 42 },
    } as unknown as CoreSnapshot;

    expect(() => store.setVisibleSnapshot(v4Shaped, { notify: false })).toThrow(
      /unknown top-level key\(s\): data.*"state" since v5/s,
    );
  });

  it("rejects arbitrary unknown top-level keys", () => {
    const { store, initial } = createStore();
    const stray = {
      ...structuredClone(initial),
      ghost: true,
    } as unknown as CoreSnapshot;

    expect(() => store.setVisibleSnapshot(stray, { notify: false })).toThrow(
      /unknown top-level key\(s\): ghost/,
    );
  });

  it("rejects snapshots missing required top-level objects", () => {
    const { store, initial } = createStore();
    const broken = structuredClone(initial) as unknown as Record<string, unknown>;
    delete broken.state;

    expect(() =>
      store.setVisibleSnapshot(broken as unknown as CoreSnapshot, {
        notify: false,
      }),
    ).toThrow(/missing the required "state" object/);
  });

  it("rejects non-object snapshots", () => {
    const { store } = createStore();

    expect(() =>
      store.setVisibleSnapshot(null as unknown as CoreSnapshot, {
        notify: false,
      }),
    ).toThrow(/must be a canonical snapshot object/);
  });

  it("rejects non-JSON values at the hydration boundary", () => {
    const { store, initial } = createStore();
    const broken = {
      ...structuredClone(initial),
      state: {
        count: Number.NaN,
      },
    } as CoreSnapshot;

    expect(() =>
      store.setVisibleSnapshot(broken, {
        notify: false,
      }),
    ).toThrow(/non-JSON value at snapshot\.state\.count: non-finite number \(NaN\)/);
  });

  it("rejects non-JSON values when rehydrating restored snapshots", () => {
    const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});
    const kernel = getRuntimeKernelFactory(manifesto)();
    const canonical = structuredClone(kernel.getVisibleCoreSnapshot());
    const broken = {
      ...canonical,
      state: {
        ...canonical.state,
        count: Number.NaN,
      },
    } as CoreSnapshot;

    expect(() => kernel.rehydrateSnapshot(broken)).toThrow(
      /Failed to rehydrate restored snapshot JSON values: snapshot\.state\.count: non-finite number \(NaN\)/,
    );
  });
});
