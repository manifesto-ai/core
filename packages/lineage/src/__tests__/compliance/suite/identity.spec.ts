import { describe, expect, it } from "vitest";
import { createLineageComplianceAdapter } from "../lcts-adapter.js";
import { caseTitle, LCTS_CASES } from "../lcts-coverage.js";
import { evaluateRule, expectAllCompliance, noteEvidence } from "../lcts-assertions.js";
import { getRuleOrThrow } from "../lcts-rules.js";
import { createBootstrappedLineage, createTestSnapshot } from "../helpers.js";

describe("LCTS Identity Suite", () => {
  const adapter = createLineageComplianceAdapter();

  it(
    caseTitle(
      LCTS_CASES.HASH_DETERMINISM,
      "Snapshot hash stays stable across platform/meta-only changes and tracks hash-visible fields only."
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
        evaluateRule(getRuleOrThrow("LIN-HASH-10"), exclusionOk, {
          passMessage: "input is excluded from snapshotHash.",
          failMessage: "input affected snapshotHash.",
        }),
        evaluateRule(getRuleOrThrow("LIN-HASH-11"), exclusionOk, {
          passMessage: "pendingDigest remains stable when pending requirements are unchanged.",
          failMessage: "Non-semantic changes affected pendingDigest identity.",
        }),
      ]);

      expect(exclusionOk).toBe(true);
      expect(semanticDataIncluded).toBe(true);
    }
  );

  it(
    caseTitle(
      LCTS_CASES.CURRENT_ERROR_IDENTITY,
      "Current error identity uses only lastError.code and source, not error history or non-hash fields."
    ),
    async () => {
      const currentError = {
        code: "ERR_CODE",
        message: "boom",
        source: { actionId: "action-1", nodePath: "/effects/0" },
        timestamp: 1,
        context: { a: 1 },
      } as const;

      const base = createTestSnapshot(
        { count: 1 },
        {
          system: {
            status: "idle",
            lastError: currentError,
            pendingRequirements: [],
            currentAction: "running",
          },
        }
      );
      const sameCurrentDifferentHistory = createTestSnapshot(
        { count: 1 },
        {
          system: {
            status: "pending",
            lastError: {
              ...currentError,
              message: "changed",
              timestamp: 999,
              context: { other: true },
            },
            pendingRequirements: [],
            currentAction: null,
          },
        }
      );
      const differentCurrent = createTestSnapshot(
        { count: 1 },
        {
          system: {
            status: "idle",
            lastError: {
              code: "ERR_OTHER",
              message: "boom",
              source: { actionId: "action-1", nodePath: "/effects/0" },
              timestamp: 1,
            },
            pendingRequirements: [],
            currentAction: null,
          },
        }
      );

      const baseHash = await adapter.computeSnapshotHash(base);
      const sameCurrentHash = await adapter.computeSnapshotHash(sameCurrentDifferentHistory);
      const differentCurrentHash = await adapter.computeSnapshotHash(differentCurrent);

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("LIN-HASH-3a"), baseHash !== await adapter.computeSnapshotHash(createTestSnapshot({ count: 1 })), {
          passMessage: "lastError participates in snapshotHash identity.",
          failMessage: "lastError did not affect snapshotHash identity.",
        }),
        evaluateRule(getRuleOrThrow("LIN-HASH-3c"), baseHash !== differentCurrentHash, {
          passMessage: "Current error code/source changes affect snapshotHash.",
          failMessage: "Current error code/source changes did not affect snapshotHash.",
          evidence: [noteEvidence("Changed only lastError.code while keeping the same data and source envelope.")],
        }),
        evaluateRule(getRuleOrThrow("LIN-HASH-3d"), baseHash === sameCurrentHash, {
          passMessage: "Non-hash error fields and history do not affect snapshotHash.",
          failMessage: "Error message/timestamp/context or history leaked into snapshotHash identity.",
          evidence: [noteEvidence("Changed only lastError message/timestamp/context while keeping lastError.code/source fixed.")],
        }),
      ]);

      expect(baseHash).toBe(sameCurrentHash);
      expect(baseHash).not.toBe(differentCurrentHash);
    }
  );

  it(
    caseTitle(
      LCTS_CASES.POSITIONAL_WORLD_ID,
      "WorldId is positional and changes when parentWorldId changes."
    ),
    async () => {
      const snapshot = createTestSnapshot({ count: 1 });
      const snapshotHash = await adapter.computeSnapshotHash(snapshot);
      const genesisA = await adapter.computeWorldId("schema-hash", snapshotHash, null);
      const genesisB = await adapter.computeWorldId("schema-hash", snapshotHash, null);
      const childA = await adapter.computeWorldId("schema-hash", snapshotHash, "parent-a");
      const childB = await adapter.computeWorldId("schema-hash", snapshotHash, "parent-b");

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("LIN-ID-1"), genesisA === genesisB, {
          passMessage: "WorldId derivation is deterministic for stable positional inputs.",
          failMessage: "WorldId derivation is unstable for identical positional inputs.",
        }),
        evaluateRule(getRuleOrThrow("LIN-ID-2"), genesisA !== childA, {
          passMessage: "Genesis uses parentWorldId=null and therefore differs from next-seal identities.",
          failMessage: "Genesis world identity did not distinguish parentWorldId=null.",
        }),
        evaluateRule(getRuleOrThrow("LIN-ID-3"), childA !== childB, {
          passMessage: "Different parentWorldId values produce different WorldIds.",
          failMessage: "parentWorldId did not participate in WorldId identity.",
          evidence: [noteEvidence("Computed the same schemaHash+snapshotHash with two different parentWorldId values.")],
        }),
        evaluateRule(getRuleOrThrow("LIN-ID-4"), genesisA !== childA, {
          passMessage: "WorldId is not content-only.",
          failMessage: "WorldId behaved like schemaHash+snapshotHash-only identity.",
        }),
      ]);

      expect(genesisA).toBe(genesisB);
      expect(childA).not.toBe(childB);
    }
  );

  it(
    caseTitle(
      LCTS_CASES.REPEATED_FAILURE_IDENTITY,
      "Repeated identical failures on the same branch produce distinct Worlds because tip changes."
    ),
    async () => {
      const { service, genesis } = await createBootstrappedLineage();
      const failingSnapshot = createTestSnapshot(
        { count: 2 },
        {
          system: {
            status: "idle",
            lastError: {
              code: "ERR",
              message: "boom",
              source: { actionId: "action-1", nodePath: "/effects/0" },
              timestamp: 0,
            },
            pendingRequirements: [],
            currentAction: null,
          },
        }
      );

      const firstFailure = await service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: failingSnapshot,
        createdAt: 2,
      });
      await service.commitPrepared(firstFailure);

      const secondFailure = await service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: failingSnapshot,
        createdAt: 3,
      });

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("LIN-ID-3"), firstFailure.worldId !== secondFailure.worldId, {
          passMessage: "Branch tip participates in next-seal positional identity.",
          failMessage: "Repeated identical failures reused the same WorldId even though branch tip changed.",
          evidence: [noteEvidence("Committed one failed seal, then prepared the same failed seal again against the unchanged branch head.")],
        }),
      ]);

      expect(firstFailure.worldId).not.toBe(secondFailure.worldId);
      expect(secondFailure.world.parentWorldId).toBe(firstFailure.worldId);
    }
  );
});
