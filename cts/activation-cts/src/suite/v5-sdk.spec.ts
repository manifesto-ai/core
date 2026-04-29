import { describe, it } from "vitest";
import { caseTitle, ACTS_CASES } from "../acts-coverage.js";

describe("ACTS SDK v5 Action Candidate Suite", () => {
  it.todo(
    caseTitle(
      ACTS_CASES.V5_ACTION_CANDIDATE_SURFACE,
      "Activated runtime exposes the v5 root and action-handle grammar without v3 root verbs.",
    ),
  );

  it.todo(
    caseTitle(
      ACTS_CASES.V5_ADMISSION_AND_PREVIEW,
      "check() and preview() preserve first-failing admission order and preview non-commit semantics.",
    ),
  );

  it.todo(
    caseTitle(
      ACTS_CASES.V5_SUBMIT_RESULTS,
      "base submit() returns settled result envelopes, full projected snapshots, and explicit operational failures.",
    ),
  );

  it.todo(
    caseTitle(
      ACTS_CASES.V5_OBSERVE_EVENTS,
      "observe.event() emits compact lifecycle payloads without embedding projected or canonical snapshots.",
    ),
  );
});
