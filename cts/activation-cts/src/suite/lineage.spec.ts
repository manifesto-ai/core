import { describe, expect, it, vi } from "vitest";
import {
  createInMemoryLineageStore,
  withLineage,
} from "@manifesto-ai/lineage";
import {
  createLineageService,
  type LineageService,
} from "@manifesto-ai/lineage/provider";
import { AlreadyActivatedError, createManifesto } from "@manifesto-ai/sdk";
import { caseTitle, ACTS_CASES } from "../acts-coverage.js";
import {
  evaluateRule,
  expectAllCompliance,
  noteEvidence,
} from "../assertions.js";
import { getRuleOrThrow } from "../acts-rules.js";
import { createCounterSchema, type CounterDomain } from "../helpers/schema.js";

describe("ACTS Lineage Suite", () => {
  it(
    caseTitle(
      ACTS_CASES.LINEAGE_COMPOSABLE_SURFACE,
      "withLineage() stays pre-activation and one-shot until runtime opens.",
    ),
    () => {
      const base = createManifesto<CounterDomain>(createCounterSchema(), {});
      const manifesto = withLineage(
        base,
        { store: createInMemoryLineageStore() },
      );
      const world = manifesto.activate();

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-LIN-1"),
          "activate" in manifesto
            && !("dispatchAsync" in manifesto)
            && !("getSnapshot" in manifesto),
          {
            passMessage: "Lineage decorator stays pre-activation until activate().",
            failMessage: "Lineage decorator leaked runtime verbs before activation.",
            evidence: [
              noteEvidence(
                "Checked withLineage() result before activation for runtime-verb absence.",
              ),
            ],
          },
        ),
        evaluateRule(
          getRuleOrThrow("ACTS-LIN-3"),
          (() => {
            try {
              manifesto.activate();
            } catch (error) {
              if (!(error instanceof AlreadyActivatedError)) {
                return false;
              }
            }

            try {
              base.activate();
              return false;
            } catch (error) {
              return error instanceof AlreadyActivatedError;
            }
          })(),
          {
            passMessage: "Lineage-decorated composable shares one-shot activation with its base composable.",
            failMessage: "Lineage activation still leaves a re-activation backdoor on the decorated or base composable.",
            evidence: [
              noteEvidence(
                "Second activation attempt threw AlreadyActivatedError on both the lineage-decorated composable and its base composable.",
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
      ACTS_CASES.LINEAGE_SEAL_PUBLICATION,
      "Lineage commit publishes only after seal commit succeeds and does not publish on commit failure.",
    ),
    async () => {
      const store = createInMemoryLineageStore();
      const realService = createLineageService(store);
      const order: string[] = [];

      const service: LineageService = {
        prepareSealGenesis: realService.prepareSealGenesis.bind(realService),
        prepareSealNext: realService.prepareSealNext.bind(realService),
        async commitPrepared(prepared) {
          order.push("commit:start");
          await Promise.resolve();
          const result = await realService.commitPrepared(prepared);
          order.push("commit:end");
          return result;
        },
        createBranch: realService.createBranch.bind(realService),
        getBranch: realService.getBranch.bind(realService),
        getBranches: realService.getBranches.bind(realService),
        getActiveBranch: realService.getActiveBranch.bind(realService),
        switchActiveBranch: realService.switchActiveBranch.bind(realService),
        getWorld: realService.getWorld.bind(realService),
        getSnapshot: realService.getSnapshot.bind(realService),
        getAttempts: realService.getAttempts.bind(realService),
        getAttemptsByBranch: realService.getAttemptsByBranch.bind(realService),
        getLineage: realService.getLineage.bind(realService),
        getHeads: realService.getHeads.bind(realService),
        getLatestHead: realService.getLatestHead.bind(realService),
        restore: realService.restore.bind(realService),
      };

      const world = withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { service },
      ).activate();

      const subscriber = vi.fn(() => {
        order.push("subscriber");
      });
      const completed = vi.fn(() => {
        order.push("completed");
      });
      world.subscribe((snapshot) => snapshot.state.count, subscriber);
      world.on("dispatch:completed", completed);

      const snapshot = await world.commitAsync(
        world.createIntent(world.MEL.actions.increment),
      );

      const failingStore = createInMemoryLineageStore();
      const failingRealService = createLineageService(failingStore);
      const failingService: LineageService = {
        prepareSealGenesis: failingRealService.prepareSealGenesis.bind(failingRealService),
        prepareSealNext: failingRealService.prepareSealNext.bind(failingRealService),
        async commitPrepared() {
          throw new Error("seal commit failed");
        },
        createBranch: failingRealService.createBranch.bind(failingRealService),
        getBranch: failingRealService.getBranch.bind(failingRealService),
        getBranches: failingRealService.getBranches.bind(failingRealService),
        getActiveBranch: failingRealService.getActiveBranch.bind(failingRealService),
        switchActiveBranch: failingRealService.switchActiveBranch.bind(failingRealService),
        getWorld: failingRealService.getWorld.bind(failingRealService),
        getSnapshot: failingRealService.getSnapshot.bind(failingRealService),
        getAttempts: failingRealService.getAttempts.bind(failingRealService),
        getAttemptsByBranch: failingRealService.getAttemptsByBranch.bind(failingRealService),
        getLineage: failingRealService.getLineage.bind(failingRealService),
        getHeads: failingRealService.getHeads.bind(failingRealService),
        getLatestHead: failingRealService.getLatestHead.bind(failingRealService),
        restore: failingRealService.restore.bind(failingRealService),
      };

      const failingWorld = withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { service: failingService },
      ).activate();
      const failingSubscriber = vi.fn();
      failingWorld.subscribe((next) => next.state.count, failingSubscriber);

      await expect(
        failingWorld.commitAsync(
          failingWorld.createIntent(failingWorld.MEL.actions.increment),
        ),
      ).rejects.toThrow("seal commit failed");

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-LIN-2"),
          snapshot.state.count === 1
            && world.getSnapshot().state.count === 1
            && order.filter((entry) => entry === "commit:end").length >= 1
            && order.indexOf("subscriber") > order.lastIndexOf("commit:end")
            && order.indexOf("completed") > order.lastIndexOf("commit:end")
            && failingWorld.getSnapshot().state.count === 0
            && failingSubscriber.mock.calls.length === 0,
          {
            passMessage: "Lineage publication stays seal-aware and publish happens only after commit success.",
            failMessage: "Lineage publication ordering or commit-failure visibility drifted from the seal-aware contract.",
            evidence: [
              noteEvidence(
                "Captured commit/subscriber/completed ordering and verified commit failure did not publish a second visible snapshot.",
                { order, failingVisibleCount: failingWorld.getSnapshot().state.count },
              ),
            ],
          },
        ),
      ]);

      world.dispose();
      failingWorld.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.LINEAGE_REPORT_SURFACE,
      "Activated lineage runtime promotes commitAsyncWithReport(), removes base report verbs, and returns completed lineage continuity reports.",
    ),
    async () => {
      const world = withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      ).activate();

      const report = await world.commitAsyncWithReport(
        world.createIntent(world.MEL.actions.increment),
      );

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-LIN-4"),
          !("dispatchAsyncWithReport" in world)
            && "commitAsyncWithReport" in world
            && report.kind === "completed"
            && report.headAdvanced === true
            && report.outcome.projected.beforeSnapshot.state.count === 0
            && report.outcome.projected.afterSnapshot.state.count === 1
            && report.resultWorld === (await world.getLatestHead())?.worldId
            && report.branchId === (await world.getActiveBranch()).id,
          {
            passMessage: "Lineage runtime promotes commitAsyncWithReport() and returns continuity-aware completed reports.",
            failMessage: "Lineage report companion surface drifted from verb promotion or completed continuity report semantics.",
            evidence: [
              noteEvidence("Observed lineage commit report", report),
              noteEvidence("Visible snapshot after lineage report commit", world.getSnapshot()),
            ],
          },
        ),
      ]);

      world.dispose();
    },
  );
});
