import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Snapshot } from "../../../index.js";
import { createLineageComplianceAdapter } from "../lcts-adapter.js";
import { caseTitle, LCTS_CASES } from "../lcts-coverage.js";
import {
  evaluateRule,
  expectAllCompliance,
  noteEvidence,
  warnRule,
} from "../lcts-assertions.js";
import { getRuleOrThrow } from "../lcts-rules.js";

function collectImportSpecifiers(root: string): string[] {
  const collected: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "__tests__") {
      continue;
    }

    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectImportSpecifiers(fullPath));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }

    const source = readFileSync(fullPath, "utf8");
    for (const match of source.matchAll(/from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g)) {
      const specifier = match[1] ?? match[2];
      if (specifier) {
        collected.push(specifier);
      }
    }
  }

  return collected;
}

function collectSourceContents(root: string): string[] {
  const sources: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "__tests__") {
      continue;
    }

    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      sources.push(...collectSourceContents(fullPath));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }

    sources.push(readFileSync(fullPath, "utf8"));
  }

  return sources;
}

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

describe("LCTS Seam Suite", () => {
  const adapter = createLineageComplianceAdapter();

  it(
    caseTitle(
      LCTS_CASES.SEAMS_SURFACE,
      "Lineage package exposes lineage helpers without governance lifecycle/event exports."
    ),
    () => {
      const exported = adapter.exports();
      const sourceRoot = fileURLToPath(new URL("../../../", import.meta.url));
      const importSpecifiers = collectImportSpecifiers(sourceRoot);
      const sourceContents = collectSourceContents(sourceRoot);
      const hasLineageSurface = typeof exported.computeSnapshotHash === "function"
        && typeof exported.computeWorldId === "function"
        && typeof exported.createInMemoryLineageStore === "function"
        && typeof exported.createLineageService === "function";
      const omitsGovernanceSurface = !("createProposal" in exported)
        && !("createDecisionRecord" in exported)
        && !("createNoopWorldEventSink" in exported)
        && !("ProposalQueue" in exported);
      const governanceImports = importSpecifiers.filter((specifier) => specifier.startsWith("@manifesto-ai/governance"));
      const eventImports = importSpecifiers.filter((specifier) =>
        specifier === "events"
        || specifier === "node:events"
        || specifier.includes("/events")
      );
      const eventEmissionSites = sourceContents.reduce((count, source) => {
        return count
          + [...source.matchAll(/\.emit\(/g)].length
          + [...source.matchAll(/dispatchEvent\(/g)].length
          + [...source.matchAll(/new\s+EventTarget\(/g)].length;
      }, 0);

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("LIN-BOUNDARY-1"), governanceImports.length === 0, {
          passMessage: "Lineage package source does not import @manifesto-ai/governance.",
          failMessage: `Lineage source imports governance package directly: ${governanceImports.join(", ")}`,
          evidence: [noteEvidence("Verified source imports directly instead of inferring from export shape.")],
        }),
        evaluateRule(getRuleOrThrow("LIN-BOUNDARY-4"), eventImports.length === 0 && eventEmissionSites === 0, {
          passMessage: "Lineage source does not import event infrastructure or emit events.",
          failMessage: `Lineage source shows event usage (imports=${eventImports.join(", ") || "none"}, emissionSites=${eventEmissionSites}).`,
          evidence: [noteEvidence("Scanned source imports and common event-emission primitives to verify event-free lineage ownership.")],
        }),
      ]);

      expect(hasLineageSurface).toBe(true);
      expect(omitsGovernanceSurface).toBe(true);
      expect(governanceImports).toHaveLength(0);
      expect(eventImports).toHaveLength(0);
      expect(eventEmissionSites).toBe(0);
    }
  );

  it(
    caseTitle(
      LCTS_CASES.STAGED_RULES,
      "Split-native lineage prepare/store rules are directly enforced by the package implementation."
    ),
    () => {
      const store = adapter.createMemoryStore();
      const service = adapter.createService(store);
      const genesisSnapshot = createTestSnapshot({ count: 1 });
      const beforeGenesis = JSON.stringify({
        branches: store.getBranches(),
        activeBranchId: store.getActiveBranchId(),
        world: store.getWorld("missing"),
      });
      const preparedGenesis = service.prepareSealGenesis({
        schemaHash: "schema-hash",
        terminalSnapshot: genesisSnapshot,
        createdAt: 1,
      });
      const afterGenesisPrepare = JSON.stringify({
        branches: store.getBranches(),
        activeBranchId: store.getActiveBranchId(),
        world: store.getWorld("missing"),
      });
      service.commitPrepared(preparedGenesis);

      const completedNext = service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: preparedGenesis.worldId,
        branchId: preparedGenesis.branchId,
        terminalSnapshot: createTestSnapshot({ count: 2 }),
        createdAt: 2,
      });
      service.commitPrepared(completedNext);

      const failedNext = service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: completedNext.worldId,
        branchId: completedNext.branchId,
        terminalSnapshot: createTestSnapshot(
          { count: 3 },
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
              errors: [],
              currentAction: null,
            },
          }
        ),
        createdAt: 3,
      });
      service.commitPrepared(failedNext);

      const headAfterFailedCommit = service.getActiveBranch().head;
      const collisionRejected = (() => {
        try {
          service.prepareSealNext({
            schemaHash: "schema-hash",
            baseWorldId: completedNext.worldId,
            branchId: completedNext.branchId,
            terminalSnapshot: createTestSnapshot({ count: 2 }),
            createdAt: 4,
          });
          return false;
        } catch {
          return true;
        }
      })();

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("LIN-SEAL-PURE-1"),
          beforeGenesis === afterGenesisPrepare,
          {
            passMessage: "prepareSealGenesis() leaves the store unchanged.",
            failMessage: "prepareSealGenesis() mutated store state.",
            evidence: [noteEvidence("Compared store snapshot before and after prepare without commit.")],
          }
        ),
        evaluateRule(
          getRuleOrThrow("LIN-COLLISION-1"),
          collisionRejected,
          {
            passMessage: "prepareSealNext() rejects an already-existing computed worldId.",
            failMessage: "prepareSealNext() allowed an existing computed worldId.",
            evidence: [noteEvidence("Prepared the same semantic next snapshot twice against an unchanged branch head.")],
          }
        ),
        evaluateRule(
          getRuleOrThrow("LIN-HEAD-ADV-1"),
          failedNext.branchChange.headAdvanced === false && headAfterFailedCommit === completedNext.worldId,
          {
            passMessage: "Failed worlds are persisted without advancing the branch head.",
            failMessage: "Failed worlds advanced the branch head.",
            evidence: [noteEvidence("Committed a failed next world and verified the active branch head stayed on the prior completed world.")],
          }
        ),
        evaluateRule(
          getRuleOrThrow("LIN-STORE-3"),
          typeof store.getWorld === "function"
            && typeof store.getSnapshot === "function"
            && typeof store.commitPrepared === "function",
          {
            passMessage: "Lineage package provides a dedicated in-memory LineageStore implementation.",
            failMessage: "In-memory LineageStore implementation is incomplete.",
            evidence: [noteEvidence("Verified core store methods on createInMemoryLineageStore().")],
          }
        ),
      ]);

      expect(beforeGenesis).toBe(afterGenesisPrepare);
      expect(collisionRejected).toBe(true);
      expect(headAfterFailedCommit).toBe(completedNext.worldId);
      expect(typeof store.getWorld).toBe("function");
    }
  );
});
