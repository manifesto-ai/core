import { describe, it } from "vitest";
import { caseTitle, WFCTS_CASES } from "../wfcts-coverage.js";
import { expectAllCompliance, noteEvidence, warnRule } from "../wfcts-assertions.js";
import { getRuleOrThrow } from "../wfcts-rules.js";

describe("WFCTS Coordinator Suite", () => {
  it(
    caseTitle(
      WFCTS_CASES.COORDINATOR_TRACKING,
      "Coordinator ordering and retry rules remain visible as pending CTS entries."
    ),
    () => {
      expectAllCompliance([
        warnRule(
          getRuleOrThrow("FACADE-COORD-1"),
          "Facade coordinator ordering is still embedded in ManifestoWorld rather than an extracted coordinator service.",
          [noteEvidence("Tracked ahead of lineage.prepare -> governance.finalize sequencing split.")],
        ),
        warnRule(
          getRuleOrThrow("FACADE-COORD-2"),
          "Atomic write-set assembly is not yet exposed as a split facade coordinator seam.",
          [noteEvidence("Tracked ahead of commit coordinator extraction.")],
        ),
        warnRule(
          getRuleOrThrow("FACADE-COORD-3"),
          "Post-commit event ordering is still verified indirectly through legacy world behavior.",
          [noteEvidence("Tracked ahead of explicit facade event dispatcher seam.")],
        ),
        warnRule(
          getRuleOrThrow("FACADE-COORD-4"),
          "Seal rejection routing remains an implementation detail of the monolithic world package.",
          [noteEvidence("Tracked until finalizeOnSealRejection() is split into governance.")],
        ),
        warnRule(
          getRuleOrThrow("FACADE-COORD-9"),
          "Retry-from-prepare CAS behavior is not yet exposed as a facade-owned loop.",
          [noteEvidence("Tracked ahead of split coordinator retries.")],
        ),
      ]);
    }
  );
});
