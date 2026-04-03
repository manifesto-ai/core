import { describe, expect, it, vi } from "vitest";
import { AlreadyActivatedError, createManifesto } from "@manifesto-ai/sdk";
import { caseTitle, ACTS_CASES } from "../acts-coverage.js";
import {
  evaluateRule,
  expectAllCompliance,
  noteEvidence,
} from "../assertions.js";
import { getRuleOrThrow } from "../acts-rules.js";
import { createCounterSchema, type CounterDomain } from "../helpers/schema.js";

describe("ACTS Base Suite", () => {
  it(
    caseTitle(
      ACTS_CASES.BASE_COMPOSABLE_SURFACE,
      "Base createManifesto() returns a composable object with no runtime verbs and one-shot activation.",
    ),
    () => {
      const manifesto = createManifesto<CounterDomain>(createCounterSchema(), {});
      const firstWorld = manifesto.activate();

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-1"),
          "activate" in manifesto
            && !("dispatchAsync" in manifesto)
            && !("subscribe" in manifesto)
            && !("getSnapshot" in manifesto),
          {
            passMessage: "Base composable exposes activation only and no runtime verbs.",
            failMessage: "Base composable leaked runtime verbs before activation.",
            evidence: [
              noteEvidence(
                "Checked base composable surface for activation-only contract.",
              ),
            ],
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
            evidence: [
              noteEvidence(
                "Second activation attempt threw AlreadyActivatedError.",
              ),
            ],
          },
        ),
      ]);

      firstWorld.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_ACTIVATION_CHAIN,
      "Base activation chain creates typed intents and executes dispatchAsync successfully.",
    ),
    async () => {
      const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const snapshot = await world.dispatchAsync(
        world.createIntent(world.MEL.actions.add, 2),
      );

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("ACTS-BASE-3"), snapshot.data.count === 2
          && world.getSnapshot().data.count === 2, {
          passMessage: "Base activation chain executed typed intent dispatch successfully.",
          failMessage: "Base activation chain did not publish the expected terminal snapshot.",
          evidence: [
            noteEvidence(
              "Executed createManifesto() -> activate() -> createIntent(MEL.actions.add) -> dispatchAsync().",
            ),
          ],
        }),
      ]);

      world.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_DEQUEUE_AVAILABILITY,
      "Queued intents are evaluated for availability at dequeue time, not enqueue time.",
    ),
    async () => {
      const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      const rejected = vi.fn();
      world.on("dispatch:rejected", rejected);

      const first = world.dispatchAsync(
        world.createIntent(world.MEL.actions.increment),
      );
      const second = world.dispatchAsync(
        world.createIntent(world.MEL.actions.incrementIfEven),
      );

      await expect(first).resolves.toMatchObject({ data: { count: 1 } });
      await expect(second).rejects.toMatchObject({
        code: "ACTION_UNAVAILABLE",
      });

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-4"),
          world.getSnapshot().data.count === 1 && rejected.mock.calls.length === 1,
          {
            passMessage: "Base runtime checks availability at dequeue time and rejects without publication.",
            failMessage: "Queued action availability drifted from dequeue-time semantics.",
            evidence: [
              noteEvidence(
                "Queued increment then incrementIfEven and confirmed second action rejected after first changed state.",
              ),
            ],
          },
        ),
      ]);

      world.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.BASE_MUTATION_SAFETY,
      "Visible snapshot reads are read-only, mutation-safe, and do not leak external changes back in.",
    ),
    async () => {
      const world = createManifesto<CounterDomain>(createCounterSchema(), {}).activate();
      await world.dispatchAsync(world.createIntent(world.MEL.actions.add, 3));

      const snapshot = world.getSnapshot();
      let threwOnMutation = false;

      try {
        (snapshot.data as { count: number }).count = 999;
      } catch (error) {
        threwOnMutation = error instanceof TypeError;
      }

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-BASE-5"),
          threwOnMutation && world.getSnapshot().data.count === 3,
          {
            passMessage: "Snapshot reads are read-only and mutation-safe.",
            failMessage: "Visible snapshot reads were mutable or leaked external mutation back into runtime state.",
            evidence: [
              noteEvidence(
                "Attempted to mutate count on a returned snapshot, confirmed TypeError, then re-read visible snapshot state.",
              ),
            ],
          },
        ),
      ]);

      world.dispose();
    },
  );
});
