import { describe, expect, it } from "vitest";
import { caseTitle, LCTS_CASES } from "../lcts-coverage.js";
import { evaluateRule, expectAllCompliance, noteEvidence } from "../lcts-assertions.js";
import { getRuleOrThrow } from "../lcts-rules.js";
import { createBootstrappedLineage, createTestSnapshot } from "../helpers.js";

describe("LCTS Restore Suite", () => {
  it(
    caseTitle(
      LCTS_CASES.RESTORE_NORMALIZATION,
      "restore() resets non-hash runtime fields while preserving semantic snapshot content."
    ),
    async () => {
      const { service, genesis } = await createBootstrappedLineage();
      const failed = await service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: createTestSnapshot(
          {
            count: 2,
            $host: { runtime: true },
            $mel: { guards: { intent: { stale: true } } },
            $custom: { opaque: true },
          },
          {
            computed: { derived: 2 },
            system: {
              status: "error",
              lastError: {
                code: "ERR",
                message: "boom",
                source: { actionId: "action-1", nodePath: "/effects/0" },
                timestamp: 11,
              },
              pendingRequirements: [],
              errors: [],
              currentAction: "retrying",
            },
            input: { transient: true },
            meta: {
              version: 9,
              timestamp: 1234,
              randomSeed: "seed-x",
              schemaHash: "schema-hash",
            },
          }
        ),
        createdAt: 2,
      });
      await service.commitPrepared(failed);

      const restored = await service.restore(failed.worldId);

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("MRKL-RESTORE-1"), JSON.stringify(restored.data.$host) === "{}"
          && JSON.stringify(restored.data.$mel) === JSON.stringify({ guards: { intent: {} } })
          && JSON.stringify(restored.data.$custom) === "{}", {
          passMessage: "restore() resets stored platform namespaces to clean runtime defaults.",
          failMessage: "restore() did not reset one or more platform namespaces.",
        }),
        evaluateRule(getRuleOrThrow("MRKL-RESTORE-2"), restored.input === null, {
          passMessage: "restore() clears transient input.",
          failMessage: "restore() preserved input instead of resetting it to null.",
        }),
        evaluateRule(getRuleOrThrow("MRKL-RESTORE-3"), restored.meta.timestamp === 0 && restored.meta.randomSeed === "", {
          passMessage: "restore() resets timestamp and randomSeed.",
          failMessage: "restore() preserved timestamp or randomSeed.",
        }),
        evaluateRule(getRuleOrThrow("MRKL-RESTORE-3a"), restored.system.currentAction === null, {
          passMessage: "restore() clears system.currentAction.",
          failMessage: "restore() preserved system.currentAction.",
        }),
        evaluateRule(getRuleOrThrow("MRKL-RESTORE-4"), restored.data.count === 2
          && restored.computed.derived === 2
          && restored.system.status === "error"
          && restored.system.lastError?.code === "ERR"
          && restored.meta.version === 9
          && restored.meta.schemaHash === "schema-hash", {
          passMessage: "restore() preserves semantic snapshot fields while normalizing runtime-only fields.",
          failMessage: "restore() lost semantic snapshot fields during normalization.",
          evidence: [noteEvidence("Restored a failed world containing platform namespaces, transient input, currentAction, and custom meta values.")],
        }),
      ]);

      expect(restored.data).toMatchObject({
        count: 2,
        $host: {},
        $mel: { guards: { intent: {} } },
        $custom: {},
      });
    }
  );
});
