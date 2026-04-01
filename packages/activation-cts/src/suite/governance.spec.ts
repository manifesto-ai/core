import { describe, expect, it } from "vitest";
import {
  createInMemoryGovernanceStore,
  withGovernance,
} from "@manifesto-ai/governance";
import {
  createInMemoryLineageStore,
  createLineageService,
  withLineage,
} from "@manifesto-ai/lineage";
import { AlreadyActivatedError, createManifesto } from "@manifesto-ai/sdk";
import { caseTitle, ACTS_CASES } from "../acts-coverage.js";
import {
  evaluateRule,
  expectAllCompliance,
  noteEvidence,
} from "../assertions.js";
import { getRuleOrThrow } from "../acts-rules.js";
import {
  createAutoBinding,
  createCounterSchema,
  createExecutionConfig,
  type CounterDomain,
} from "../helpers/schema.js";

describe("ACTS Governance Suite", () => {
  it(
    caseTitle(
      ACTS_CASES.GOVERNANCE_COMPOSABLE_SURFACE,
      "withGovernance() stays pre-activation and one-shot until runtime opens.",
    ),
    () => {
      const manifesto = withGovernance(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        {
          lineage: { store: createInMemoryLineageStore() },
          governanceStore: createInMemoryGovernanceStore(),
          bindings: [createAutoBinding()],
          execution: createExecutionConfig("acts-gov-surface"),
        },
      );
      const governed = manifesto.activate();

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-GOV-1"),
          "activate" in manifesto
            && !("dispatchAsync" in manifesto)
            && !("proposeAsync" in manifesto)
            && !("getSnapshot" in manifesto),
          {
            passMessage: "Governance decorator stays pre-activation until activate().",
            failMessage: "Governance decorator leaked runtime verbs before activation.",
            evidence: [
              noteEvidence(
                "Checked withGovernance() result before activation for runtime-verb absence.",
              ),
            ],
          },
        ),
        evaluateRule(
          getRuleOrThrow("ACTS-GOV-5"),
          (() => {
            try {
              manifesto.activate();
              return false;
            } catch (error) {
              return error instanceof AlreadyActivatedError;
            }
          })(),
          {
            passMessage: "Governance-decorated composable activation is one-shot.",
            failMessage: "Governance-decorated composable allowed second activation.",
            evidence: [
              noteEvidence(
                "Second activation attempt threw AlreadyActivatedError on the governance-decorated composable.",
              ),
            ],
          },
        ),
      ]);

      governed.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.GOVERNANCE_AUTO_LINEAGE,
      "Governance auto-ensures lineage and removes direct dispatchAsync from the governed runtime.",
    ),
    async () => {
      const governed = withGovernance(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        {
          lineage: { store: createInMemoryLineageStore() },
          governanceStore: createInMemoryGovernanceStore(),
          bindings: [createAutoBinding()],
          execution: createExecutionConfig("acts-gov-auto"),
        },
      ).activate();

      const proposal = await governed.proposeAsync(
        governed.createIntent(governed.MEL.actions.increment),
      );
      const latestHead = await governed.getLatestHead();

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-GOV-2"),
          !("dispatchAsync" in governed),
          {
            passMessage: "Governed runtime removes the direct dispatchAsync backdoor.",
            failMessage: "Governed runtime still exposes dispatchAsync.",
            evidence: [
              noteEvidence(
                "Checked runtime surface on governed activation output.",
              ),
            ],
          },
        ),
        evaluateRule(
          getRuleOrThrow("ACTS-GOV-3"),
          proposal.status === "completed"
            && governed.getSnapshot().data.count === 1
            && latestHead !== null,
          {
            passMessage: "Governance auto-ensures lineage and produces a sealed head on proposal completion.",
            failMessage: "Governance auto-lineage guarantee did not yield a completed proposal plus lineage head.",
            evidence: [
              noteEvidence(
                "Activated governance directly from a base composable using config.lineage and checked proposal completion plus head availability.",
              ),
            ],
          },
        ),
      ]);

      governed.dispose();
    },
  );

  it(
    caseTitle(
      ACTS_CASES.GOVERNANCE_EXPLICIT_PRECEDENCE,
      "Explicit lineage composition wins over governance config lineage overrides.",
    ),
    async () => {
      const explicitStore = createInMemoryLineageStore();
      const ignoredStore = createInMemoryLineageStore();
      const explicitService = createLineageService(explicitStore);

      const governed = withGovernance(
        withLineage(
          createManifesto<CounterDomain>(createCounterSchema(), {}),
          { service: explicitService },
        ),
        {
          lineage: { store: ignoredStore },
          governanceStore: createInMemoryGovernanceStore(),
          bindings: [createAutoBinding()],
          execution: createExecutionConfig("acts-gov-explicit"),
        },
      ).activate();

      await governed.proposeAsync(
        governed.createIntent(governed.MEL.actions.increment),
      );

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("ACTS-GOV-4"),
          (await explicitService.getBranches()).length > 0
            && (await ignoredStore.getBranches()).length === 0,
          {
            passMessage: "Explicit withLineage() composition wins over governance config lineage overrides.",
            failMessage: "Governance config lineage overrode an explicitly composed lineage runtime.",
            evidence: [
              noteEvidence(
                "Compared branch persistence between explicit lineage service and ignored governance config store.",
              ),
            ],
          },
        ),
      ]);

      governed.dispose();
    },
  );
});
