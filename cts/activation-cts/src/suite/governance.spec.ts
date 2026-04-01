import { describe, expect, it } from "vitest";
import {
  createInMemoryGovernanceStore,
  withGovernance,
} from "@manifesto-ai/governance";
import {
  createInMemoryLineageStore,
  withLineage,
} from "@manifesto-ai/lineage";
import { createLineageService } from "@manifesto-ai/lineage/internal";
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
      const base = createManifesto<CounterDomain>(createCounterSchema(), {});
      const lineage = withLineage(
        base,
        { store: createInMemoryLineageStore() },
      );
      const manifesto = withGovernance(
        lineage,
        {
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
            } catch (error) {
              if (!(error instanceof AlreadyActivatedError)) {
                return false;
              }
            }

            try {
              lineage.activate();
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
            passMessage: "Governance-decorated composable shares one-shot activation with lineage and base composables.",
            failMessage: "Governance activation still leaves a re-activation backdoor on the governed, lineage, or base composable.",
            evidence: [
              noteEvidence(
                "Second activation attempt threw AlreadyActivatedError on the governed, lineage, and base composables.",
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
      ACTS_CASES.GOVERNANCE_EXPLICIT_LINEAGE,
      "Governance requires explicit lineage composition and removes direct dispatch and commit verbs from the governed runtime.",
    ),
    async () => {
      const lineage = withLineage(
        createManifesto<CounterDomain>(createCounterSchema(), {}),
        { store: createInMemoryLineageStore() },
      );
      const governed = withGovernance(
        lineage,
        {
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
          !("dispatchAsync" in governed) && !("commitAsync" in governed),
          {
            passMessage: "Governed runtime removes both direct dispatchAsync and commitAsync backdoors.",
            failMessage: "Governed runtime still exposes a superseded execution verb.",
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
            passMessage: "Governance runs only on explicitly lineage-composed input and still produces a sealed head on proposal completion.",
            failMessage: "Explicit lineage composition did not yield a completed proposal plus lineage head.",
            evidence: [
              noteEvidence(
                "Activated governance from an explicitly lineage-composed manifesto and checked proposal completion plus head availability.",
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
      "Governance reuses the explicitly composed lineage service.",
    ),
    async () => {
      const explicitStore = createInMemoryLineageStore();
      const explicitService = createLineageService(explicitStore);

      const governed = withGovernance(
        withLineage(
          createManifesto<CounterDomain>(createCounterSchema(), {}),
          { service: explicitService },
        ),
        {
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
          (await explicitService.getBranches()).length > 0,
          {
            passMessage: "Governance execution reuses the explicitly composed lineage service.",
            failMessage: "Governance execution did not write through the explicitly composed lineage service.",
            evidence: [
              noteEvidence(
                "Activated governance on an explicitly composed lineage service and confirmed branch persistence on that same service.",
              ),
            ],
          },
        ),
      ]);

      governed.dispose();
    },
  );
});
