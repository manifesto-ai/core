import { describe, expect, it } from "vitest";

import {
  AlreadyActivatedError,
  CompileError,
  ManifestoError,
  ReservedEffectError,
  createManifesto,
  type DomainSchema,
} from "../index.js";
import {
  counterMelSource,
  createCounterSchema,
  createRawCounterSchema,
  type CounterDomain,
  type MelCounterDomain,
  withHash,
} from "./helpers/schema.js";

describe("createManifesto()", () => {
  it("returns a composable manifesto with normalized schema and no runtime verbs", () => {
    const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});

    expect(manifesto.schema.state.fields.$host).toBeDefined();
    expect(manifesto.schema.state.fields.$mel).toBeDefined();
    expect("activate" in manifesto).toBe(true);
    expect("dispatchAsync" in manifesto).toBe(false);
    expect("subscribe" in manifesto).toBe(false);
  });

  it("activates only once", () => {
    const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});
    const world = manifesto.activate();

    expect(world.MEL.actions.increment).toBeDefined();
    expect(() => manifesto.activate()).toThrow(AlreadyActivatedError);

    world.dispose();
  });

  it("creates intents from MEL action refs with generated ids and packed input", () => {
    const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const increment = world.createIntent(world.MEL.actions.increment);
    expect(increment.type).toBe("increment");
    expect(increment.input).toBeUndefined();
    expect(increment.intentId.length).toBeGreaterThan(0);

    const add = world.createIntent(world.MEL.actions.add, 7);
    expect(add.type).toBe("add");
    expect(add.input).toEqual({ amount: 7 });
    expect(add.intentId.length).toBeGreaterThan(0);

    world.dispose();
  });

  it("compiles MEL source strings before activation", async () => {
    const world = createManifesto<MelCounterDomain>(counterMelSource, {}).activate();

    await world.dispatchAsync(world.createIntent(world.MEL.actions.increment));

    expect(world.getSnapshot().data.count).toBe(1);
    world.dispose();
  });

  it("throws CompileError when MEL compilation fails", () => {
    expect(() => createManifesto<CounterDomain>("domain Broken { nope", {})).toThrow(CompileError);
  });

  it("rejects reserved effect overrides", () => {
    expect(() => createManifesto<CounterDomain>(createCounterSchema(), {
      "system.get": async () => [],
    })).toThrow(ReservedEffectError);
  });

  it("rejects reserved action namespaces", () => {
    const raw = createRawCounterSchema();
    const schema = withHash({
      ...raw,
      actions: {
        ...raw.actions,
        "system.increment": raw.actions.increment,
      },
    });

    expect(() => createManifesto<CounterDomain>(schema, {})).toThrowError(
      expect.objectContaining<Partial<ManifestoError>>({
        code: "RESERVED_NAMESPACE",
      }),
    );
  });

  it("rejects invalid reserved platform namespace shapes", () => {
    const raw = createRawCounterSchema();
    const schema: DomainSchema = withHash({
      ...raw,
      state: {
        fields: {
          ...raw.state.fields,
          $host: { type: "string", required: false },
        },
      },
    });

    expect(() => createManifesto<CounterDomain>(schema, {})).toThrowError(
      expect.objectContaining<Partial<ManifestoError>>({
        code: "SCHEMA_ERROR",
      }),
    );
  });
});
