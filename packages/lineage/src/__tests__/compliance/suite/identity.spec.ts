import { describe, expect, it } from "vitest";
import type { Snapshot } from "../../../index.js";
import { createLineageComplianceAdapter } from "../lcts-adapter.js";
import { caseTitle, LCTS_CASES } from "../lcts-coverage.js";
import { evaluateRule, expectAllCompliance, noteEvidence } from "../lcts-assertions.js";
import { getRuleOrThrow } from "../lcts-rules.js";

function createTestSnapshot(
  data: Record<string, unknown>,
  overrides?: Partial<Snapshot>
): Snapshot {
  return {
    data,
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      pendingRequirements: [],
      errors: [],
      currentAction: null,
    },
    input: {},
    meta: {
      version: 1,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "schema-hash",
    },
    ...overrides,
  };
}

describe("LCTS Identity Suite", () => {
  const adapter = createLineageComplianceAdapter();

  it(
    caseTitle(
      LCTS_CASES.HASH_DETERMINISM,
      "Snapshot hash stays stable across platform/meta-only changes and changes when semantic data changes."
    ),
    async () => {
      const base = createTestSnapshot({
        count: 1,
        $host: { internal: true },
        $mel: { guard: true },
      });
      const onlyPlatformAndMetaChanged = createTestSnapshot(
        {
          count: 1,
          $host: { internal: false, changed: true },
          $mel: { another: "value" },
        },
        {
          computed: { derived: 99 },
          input: { transient: "ignore-me" },
          meta: {
            version: 999,
            timestamp: 123456789,
            randomSeed: "different-seed",
            schemaHash: "different-schema-hash",
          },
        }
      );
      const domainChanged = createTestSnapshot({
        count: 2,
        $host: { internal: true },
        $mel: { guard: true },
      });

      const baseHash = await adapter.computeSnapshotHash(base);
      const onlyMetaHash = await adapter.computeSnapshotHash(onlyPlatformAndMetaChanged);
      const domainHash = await adapter.computeSnapshotHash(domainChanged);

      const exclusionOk = baseHash === onlyMetaHash;
      const semanticDataIncluded = baseHash !== domainHash;

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("LIN-HASH-1"), semanticDataIncluded, {
          passMessage: "Semantic data participates in snapshot hash identity.",
          failMessage: "Domain data changes did not affect snapshotHash.",
          evidence: [noteEvidence("Changed only domain data (`count`) to verify semantic identity.")],
        }),
        evaluateRule(getRuleOrThrow("LIN-HASH-4a"), exclusionOk, {
          passMessage: "$host namespace is excluded from snapshotHash.",
          failMessage: "$host namespace leaked into snapshotHash identity.",
        }),
        evaluateRule(getRuleOrThrow("LIN-HASH-4b"), exclusionOk, {
          passMessage: "$mel namespace is excluded from snapshotHash.",
          failMessage: "$mel namespace leaked into snapshotHash identity.",
        }),
        evaluateRule(getRuleOrThrow("LIN-HASH-5"), exclusionOk, {
          passMessage: "meta.version is excluded from snapshotHash.",
          failMessage: "meta.version affected snapshotHash.",
        }),
        evaluateRule(getRuleOrThrow("LIN-HASH-6"), exclusionOk, {
          passMessage: "meta.timestamp is excluded from snapshotHash.",
          failMessage: "meta.timestamp affected snapshotHash.",
        }),
        evaluateRule(getRuleOrThrow("LIN-HASH-7"), exclusionOk, {
          passMessage: "meta.randomSeed is excluded from snapshotHash.",
          failMessage: "meta.randomSeed affected snapshotHash.",
        }),
        evaluateRule(getRuleOrThrow("LIN-HASH-9"), exclusionOk, {
          passMessage: "computed values are excluded from snapshotHash in the current lineage adapter.",
          failMessage: "computed values affected snapshotHash.",
        }),
        evaluateRule(getRuleOrThrow("LIN-HASH-10"), exclusionOk, {
          passMessage: "input is excluded from snapshotHash.",
          failMessage: "input affected snapshotHash.",
        }),
      ]);

      expect(exclusionOk).toBe(true);
      expect(semanticDataIncluded).toBe(true);
    }
  );

  it(
    caseTitle(
      LCTS_CASES.WORLD_ID_DETERMINISM,
      "WorldId derivation is deterministic for the same schemaHash and snapshotHash."
    ),
    async () => {
      const snapshot = createTestSnapshot({ count: 1 });
      const snapshotHash = await adapter.computeSnapshotHash(snapshot);
      const first = await adapter.computeWorldId("schema-hash", snapshotHash);
      const second = await adapter.computeWorldId("schema-hash", snapshotHash);

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("LIN-ID-1"), first === second, {
          passMessage: "WorldId derivation is deterministic for stable inputs.",
          failMessage: "WorldId derivation is unstable for identical inputs.",
          evidence: [noteEvidence("Computed WorldId twice using the same schemaHash and snapshotHash.")],
        }),
      ]);

      expect(first).toBe(second);
    }
  );
});
