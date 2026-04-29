import { describe, expect, it } from "vitest";
import {
  AlreadyActivatedError,
  createManifesto,
} from "@manifesto-ai/sdk";
import { caseTitle, ACTS_CASES } from "../acts-coverage.js";
import {
  evaluateRule,
  expectAllCompliance,
  noteEvidence,
} from "../assertions.js";
import { getRuleOrThrow } from "../acts-rules.js";
import {
  createCounterSchema,
  createHaltingSchema,
  type CounterDomain,
  type HaltingDomain,
} from "../helpers/schema.js";

describe("ACTS Base Suite", () => {
  it(
    caseTitle(
      ACTS_CASES.BASE_COMPOSABLE_SURFACE,
      "Base createManifesto() returns a composable object with no runtime verbs and one-shot activation.",
    ),
    () => {
      const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});
      const app = manifesto.activate();

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-1"),
          "activate" in manifesto
            && !("dispatchAsync" in manifesto)
            && !("snapshot" in manifesto),
          {
            passMessage: "Base composable exposes activation only and no runtime verbs.",
            failMessage: "Base composable leaked runtime verbs before activation.",
            evidence: [noteEvidence("Checked base composable pre-activation surface.")],
          },
        ),
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-2"),
          (() => {
            try {
              manifesto.activate();
              return false;
            } catch (error) {
              return error instanceof AlreadyActivatedError;
            }
          })(),
          {
            passMessage: "Base composable activation is one-shot.",
            failMessage: "Base composable allowed second activation.",
            evidence: [noteEvidence("Second activation threw AlreadyActivatedError.")],
          },
        ),
      ]);

      app.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_ACTIVATION_CHAIN,
      "Base activation chain submits action candidates successfully.",
    ),
    async () => {
      const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const result = await app.actions.add.submit(2);

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("ACTS-BASE-3"), result.ok
          && result.after.state.count === 2
          && app.snapshot().state.count === 2, {
          passMessage: "Base activation chain submitted an action candidate successfully.",
          failMessage: "Base activation chain did not publish the expected terminal snapshot.",
          evidence: [noteEvidence("Executed createManifesto() -> activate() -> actions.add.submit().")],
        }),
      ]);

      app.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_MUTATION_SAFETY,
      "Visible snapshot reads are read-only, mutation-safe, and do not leak external changes back in.",
    ),
    async () => {
      const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      await app.actions.add.submit(3);
      const snapshot = app.snapshot();

      expect(() => {
        (snapshot.state as { count: number }).count = 99;
      }).toThrow(TypeError);

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("ACTS-BASE-4"), app.snapshot().state.count === 3, {
          passMessage: "Projected snapshot mutation did not leak back into runtime state.",
          failMessage: "Projected snapshot mutation changed runtime state.",
          evidence: [noteEvidence("Mutated a projected snapshot clone and re-read app.snapshot().")],
        }),
      ]);

      app.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_INTROSPECTION_SURFACE,
      "Activated base runtime exposes inspect and preview as read-only introspection surfaces.",
    ),
    () => {
      const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const graph = app.inspect.graph();
      const before = app.snapshot();
      const preview = app.actions.load.preview();

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("ACTS-BASE-5"), typeof graph.traceUp === "function"
          && typeof app.actions.increment.preview === "function"
          && typeof app.action("increment").info === "function", {
          passMessage: "V5 base runtime exposes inspect.graph(), action info, and action preview.",
          failMessage: "V5 base runtime introspection surface is incomplete.",
          evidence: [noteEvidence("Checked inspect.graph(), action(name).info(), and actions.x.preview().")],
        }),
        evaluateRule(getRuleOrThrow("ACTS-BASE-6"), graph.traceUp("state:count").nodes.length > 0
          && !("namespaces" in app.snapshot()), {
          passMessage: "Schema graph debug lookup works and projected snapshots exclude namespaces.",
          failMessage: "Schema graph lookup or projected snapshot boundary regressed.",
          evidence: [noteEvidence("Traced state:count and checked app.snapshot() projection.")],
        }),
        evaluateRule(getRuleOrThrow("ACTS-BASE-7"), preview.admitted
          && preview.status === "pending"
          && preview.after.state.status === "loading"
          && app.snapshot() === before, {
          passMessage: "Preview is non-committing and returns projected after snapshot plus requirements.",
          failMessage: "Preview committed state or did not expose expected dry-run data.",
          evidence: [noteEvidence("Ran actions.load.preview() and re-read app.snapshot().")],
        }),
      ]);

      app.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_SIMULATE_HALTED,
      "preview() preserves Core halted status without publishing runtime state.",
    ),
    () => {
      const app = createManifesto<HaltingDomain>(createHaltingSchema(), {}).activate();
      const preview = app.actions.finalize.preview();

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("ACTS-BASE-8"), preview.admitted
          && preview.status === "halted"
          && app.snapshot().state.status === "idle", {
          passMessage: "Preview preserved halted status without publishing state.",
          failMessage: "Preview failed to preserve halted status or committed state.",
          evidence: [noteEvidence("Ran actions.finalize.preview() against halting schema.")],
        }),
      ]);

      app.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_REPORT_SURFACE,
      "Base submit() returns settled result envelopes and admission failure values.",
    ),
    async () => {
      const app = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const result = await app.actions.add.submit(2);
      const rejected = await app.actions.add.submit("bad" as unknown as number);

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("ACTS-BASE-9"), result.ok
          && result.mode === "base"
          && result.status === "settled"
          && result.before.state.count === 0
          && result.after.state.count === 2, {
          passMessage: "Base submit returned a settled result envelope with projected snapshots.",
          failMessage: "Base submit did not return the expected settled result envelope.",
          evidence: [noteEvidence("Ran actions.add.submit(2).")],
        }),
        evaluateRule(getRuleOrThrow("ACTS-BASE-10"), !rejected.ok
          && rejected.mode === "base"
          && rejected.admission.layer === "input", {
          passMessage: "Base submit returned admission failure as a value.",
          failMessage: "Base submit did not preserve admission rejection as a value.",
          evidence: [noteEvidence("Ran actions.add.submit() with invalid input.")],
        }),
      ]);

      app.dispose();
    },
  );
});
