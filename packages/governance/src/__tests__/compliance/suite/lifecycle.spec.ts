import { describe, expect, it } from "vitest";
import type { ProposalStatus } from "../../../index.js";
import { createGovernanceComplianceAdapter } from "../gcts-adapter.js";
import { expectAllCompliance, evaluateRule, noteEvidence, warnRule } from "../gcts-assertions.js";
import { caseTitle, GCTS_CASES } from "../gcts-coverage.js";
import { getRuleOrThrow } from "../gcts-rules.js";

describe("GCTS Lifecycle Suite", () => {
  const adapter = createGovernanceComplianceAdapter();

  it(
    caseTitle(
      GCTS_CASES.LIFECYCLE_MONOTONIC,
      "Legacy world-backed governance preserves the current monotonic proposal state machine."
    ),
    () => {
      const monotonicPairs: Array<readonly [ProposalStatus, ProposalStatus, boolean]> = [
        ["submitted", "evaluating", true],
        ["submitted", "rejected", true],
        ["submitted", "approved", false],
        ["evaluating", "approved", true],
        ["evaluating", "rejected", true],
        ["evaluating", "completed", false],
        ["approved", "executing", true],
        ["approved", "completed", false],
        ["executing", "completed", true],
        ["executing", "failed", true],
        ["completed", "executing", false],
        ["failed", "submitted", false],
      ];

      const expectedTransitions: Record<ProposalStatus, ProposalStatus[]> = {
        submitted: ["evaluating", "rejected"],
        evaluating: ["approved", "rejected"],
        approved: ["executing"],
        executing: ["completed", "failed"],
        rejected: [],
        completed: [],
        failed: [],
      };

      const transitionsOk = monotonicPairs.every(([from, to, expected]) => (
        adapter.isValidTransition(from, to) === expected
      ));
      const shapeOk = (Object.keys(expectedTransitions) as ProposalStatus[]).every((status) => {
        const actual = adapter.getValidTransitions(status);
        return JSON.stringify(actual) === JSON.stringify(expectedTransitions[status]);
      });

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("GOV-TRANS-1"), transitionsOk && shapeOk, {
          passMessage: "Monotonic lifecycle remains intact in the legacy world-backed adapter.",
          failMessage: "Legacy proposal state machine drifted from the documented monotonic transitions.",
          evidence: [noteEvidence("Checked current transition graph against the legacy world state machine.")],
        }),
      ]);

      expect(transitionsOk && shapeOk).toBe(true);
    }
  );

  it(
    caseTitle(
      GCTS_CASES.LIFECYCLE_SPLIT_TRACKING,
      "Split-only governance rules remain visible as pending CTS entries."
    ),
    () => {
      expectAllCompliance([
        warnRule(
          getRuleOrThrow("GOV-STAGE-7"),
          "Legacy world proposals do not model superseded as an ingress-terminal status yet.",
          [noteEvidence("Pending until governance owns split-era proposal stages.")]
        ),
        warnRule(
          getRuleOrThrow("GOV-TRANS-3"),
          "Legacy world transitions do not model superseded-specific DecisionRecord rules yet.",
          [noteEvidence("Pending until split governance state machine is implemented.")]
        ),
        warnRule(
          getRuleOrThrow("GOV-TRANS-4"),
          "Legacy world transitions do not yet validate superseded ingress-only paths.",
          [noteEvidence("Pending split-only transition rules.")]
        ),
        warnRule(
          getRuleOrThrow("GOV-BRANCH-1"),
          "Proposal.branchId is not present in the legacy proposal model.",
          [noteEvidence("Tracked so branch-aware governance can become blocking once extracted.")]
        ),
        warnRule(
          getRuleOrThrow("GOV-BRANCH-GATE-1"),
          "Single-writer execution-stage branch gates are not isolated into a split governance package yet.",
          [noteEvidence("Tracked ahead of GovernanceStore extraction.")]
        ),
        warnRule(
          getRuleOrThrow("GOV-SEAL-2"),
          "Pure finalize/finalizeOnSealRejection seams do not exist as governance-owned functions yet.",
          [noteEvidence("Tracked ahead of the coordinator/finalize split.")]
        ),
      ]);
    }
  );
});
