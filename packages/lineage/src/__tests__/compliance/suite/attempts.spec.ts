import { describe, expect, it } from "vitest";
import { caseTitle, LCTS_CASES } from "../lcts-coverage.js";
import { evaluateRule, expectAllCompliance, noteEvidence } from "../lcts-assertions.js";
import { getRuleOrThrow } from "../lcts-rules.js";
import { createBootstrappedLineage, createTestSnapshot } from "../helpers.js";

describe("LCTS Attempts Suite", () => {
  it(
    caseTitle(
      LCTS_CASES.ATTEMPT_PERSISTENCE,
      "Every successful seal persists exactly one SealAttempt and exposes attempt chronology by world and branch."
    ),
    async () => {
      const { service, genesis } = await createBootstrappedLineage();
      const next = await service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: createTestSnapshot({ count: 2 }),
        createdAt: 2,
      });
      await service.commitPrepared(next);

      const worldAttempts = await service.getAttempts(next.worldId);
      const branchAttempts = await service.getAttemptsByBranch(next.branchId);

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("MRKL-ATTEMPT-2"), worldAttempts.length === 1 && branchAttempts.length === 2, {
          passMessage: "Successful seals persist attempt records and expose them by world and branch.",
          failMessage: "Seal attempt persistence/query surface is incomplete.",
          evidence: [noteEvidence("Genesis contributes one branch attempt; the completed next seal contributes one world-specific attempt.")],
        }),
      ]);

      expect(worldAttempts).toHaveLength(1);
      expect(worldAttempts[0]?.reused).toBe(false);
      expect(branchAttempts).toHaveLength(2);
    }
  );

  it(
    caseTitle(
      LCTS_CASES.IDEMPOTENT_REUSE,
      "Same-parent same-snapshot seals reuse the existing world while preserving first-written substrate."
    ),
    async () => {
      const { service } = await createBootstrappedLineage();
      const firstSnapshot = createTestSnapshot(
        { count: 2 },
        {
          computed: { derived: 1 },
          input: { transient: true },
          meta: {
            version: 7,
            timestamp: 22,
            randomSeed: "seed-a",
            schemaHash: "schema-hash",
          },
          namespaces: {
            host: { trace: "first" },
            mel: { guards: { intent: {} } },
          },
        }
      );
      const mainBranch = await service.getActiveBranch();
      const firstCommit = await service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: mainBranch.head,
        branchId: mainBranch.id,
        terminalSnapshot: firstSnapshot,
        createdAt: 2,
        patchDelta: { _patchFormat: 2, patches: [] },
      });
      await service.commitPrepared(firstCommit);

      const forkBranchId = await service.createBranch("fork", mainBranch.head);
      await service.switchActiveBranch(forkBranchId);
      const reusedSnapshot = createTestSnapshot(
        { count: 2 },
        {
          computed: { derived: 999 },
          input: { transient: "different" },
          meta: {
            version: 88,
            timestamp: 99,
            randomSeed: "seed-b",
            schemaHash: "schema-hash",
          },
          namespaces: {
            host: { trace: "second" },
            mel: { guards: { intent: {} } },
          },
        }
      );
      const reusedCommit = await service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: mainBranch.head,
        branchId: forkBranchId,
        terminalSnapshot: reusedSnapshot,
        createdAt: 3,
        patchDelta: { _patchFormat: 2, patches: [{ op: "set", path: "state.count", value: 2 }] },
      });
      await service.commitPrepared(reusedCommit);

      const lineage = await service.getLineage();
      const attemptsForWorld = await service.getAttempts(firstCommit.worldId);
      const storedSnapshot = await service.getSnapshot(firstCommit.worldId);
      const forkBranch = await service.getBranch(forkBranchId);

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("MRKL-REUSE-1"), reusedCommit.worldId === firstCommit.worldId && lineage.worlds.size === 2, {
          passMessage: "Same-parent same-snapshot seal reused the existing world identity.",
          failMessage: "Same-parent same-snapshot seal created a duplicate world instead of reusing it.",
        }),
        evaluateRule(getRuleOrThrow("MRKL-REUSE-2"), attemptsForWorld.length === 2 && attemptsForWorld[1]?.reused === true, {
          passMessage: "Reuse commit still persisted a distinct SealAttempt marked reused=true.",
          failMessage: "Reuse commit did not persist a distinct reused SealAttempt.",
          evidence: [noteEvidence("Committed the same parent+snapshot on a fork branch after the main branch had already sealed it.")],
        }),
        evaluateRule(getRuleOrThrow("MRKL-STORE-4"), JSON.stringify(storedSnapshot) === JSON.stringify(firstSnapshot), {
          passMessage: "Reuse preserved the first-written snapshot substrate.",
          failMessage: "Reuse overwrote the stored snapshot substrate for the reused world.",
        }),
      ]);

      expect(forkBranch?.head).toBe(firstCommit.worldId);
      expect(forkBranch?.tip).toBe(firstCommit.worldId);
      expect(storedSnapshot).toEqual(firstSnapshot);
    }
  );
});
