import { describe, expect, it } from "vitest";

import { ManifestoError, createManifesto } from "../index.js";
import { createSimulationSession } from "../extensions.js";
import type { TypedIntent } from "../types.js";
import { createCounterSchema, type CounterDomain } from "./helpers/schema.js";

describe("@manifesto-ai/sdk/extensions createSimulationSession", () => {
  it("creates a root session from the current runtime snapshot", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const session = createSimulationSession(app);

    expect(session.depth).toBe(0);
    expect(session.snapshot).toEqual(app.getSnapshot());
    expect(session.canonicalSnapshot).toEqual(app.getCanonicalSnapshot());
    expect(session.trajectory).toEqual([]);
    expect(session.status).toBe("idle");
    expect(session.isTerminal).toBe(false);
    expect(session.availableActions.map((action) => action.name)).toEqual([
      "increment",
      "add",
      "incrementIfEven",
      "load",
    ]);

    app.dispose();
  });

  it("returns new immutable sessions when stepping and supports branching", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const root = createSimulationSession(app);
    const step1 = root.next(app.MEL.actions.increment);
    const branchA = step1.next(app.MEL.actions.increment);
    const branchB = step1.next(app.MEL.actions.add, 5);

    expect(root.depth).toBe(0);
    expect(root.snapshot.data.count).toBe(0);
    expect(root.trajectory).toHaveLength(0);

    expect(step1.depth).toBe(1);
    expect(step1.snapshot.data.count).toBe(1);
    expect(step1.trajectory).toHaveLength(1);
    expect(step1.trajectory[0]?.intent.type).toBe("increment");

    expect(branchA.snapshot.data.count).toBe(2);
    expect(branchA.trajectory).toHaveLength(2);
    expect(branchA.trajectory.map((step) => step.intent.type)).toEqual([
      "increment",
      "increment",
    ]);

    expect(branchB.snapshot.data.count).toBe(6);
    expect(branchB.trajectory).toHaveLength(2);
    expect(branchB.trajectory.map((step) => step.intent.type)).toEqual([
      "increment",
      "add",
    ]);

    expect(step1.snapshot.data.count).toBe(1);
    expect(step1.trajectory).toHaveLength(1);

    app.dispose();
  });

  it("accepts a prebuilt typed intent and finish returns the final session snapshot", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const root = createSimulationSession(app);
    const intent = app.createIntent(app.MEL.actions.add, 3);
    const final = root.next(intent).finish();

    expect(final.depth).toBe(1);
    expect(final.snapshot.data.count).toBe(3);
    expect(final.trajectory).toHaveLength(1);
    expect(final.trajectory[0]?.intent).toEqual(intent);

    app.dispose();
  });

  it("clones and deep-freezes recorded intents in the trajectory", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const root = createSimulationSession(app);
    const intent = app.createIntent(app.MEL.actions.add, 3) as TypedIntent<CounterDomain> & {
      input: { amount: number };
    };
    const step = root.next(intent);
    const recorded = step.trajectory[0]!.intent as typeof intent;

    intent.input.amount = 99;

    expect(recorded.input.amount).toBe(3);
    expect(() => {
      recorded.input.amount = 77;
    }).toThrow(TypeError);

    app.dispose();
  });

  it("treats pending sessions as terminal and prevents further steps", () => {
    const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();

    const pending = createSimulationSession(app).next(app.MEL.actions.load);

    expect(pending.status).toBe("pending");
    expect(pending.isTerminal).toBe(true);
    expect(pending.availableActions).toEqual([]);
    expect(pending.requirements).toHaveLength(1);

    expect(() => pending.next(app.MEL.actions.increment)).toThrowError(
      expect.objectContaining({
        code: "SIMULATION_SESSION_TERMINAL",
      } satisfies Partial<ManifestoError>),
    );

    app.dispose();
  });
});
